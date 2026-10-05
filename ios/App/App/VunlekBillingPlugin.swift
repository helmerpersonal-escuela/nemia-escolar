import Foundation
import Capacitor
import StoreKit

/// Suscripciones de VUNLEK con StoreKit 2.
/// La app web (Capacitor) lo usa como `VunlekBilling`. Aquí solo se habla con App Store;
/// quien da el acceso es el servidor, después de confirmar la compra con Apple.
@objc(VunlekBillingPlugin)
public class VunlekBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VunlekBillingPlugin"
    public let jsName = "VunlekBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishTransaction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise)
    ]

    private var updatesTask: Task<Void, Never>?
    private var products: [String: Product] = [:]

    // MARK: - Ciclo de vida

    override public func load() {
        // Renovaciones, compras aprobadas después (por ejemplo "Pedir permiso") y reembolsos
        // llegan aquí aunque el usuario no esté en la pantalla de planes.
        updatesTask = Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard let self = self, case .verified(let transaction) = result else { continue }
                self.notifyListeners("purchaseUpdated", data: ["purchases": [self.describe(transaction)]], retainUntilConsumed: true)
            }
        }
    }

    deinit { updatesTask?.cancel() }

    // MARK: - Métodos

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": AppStore.canMakePayments, "store": "APPLE"])
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        guard !ids.isEmpty else { return fail(call, "PRODUCT_NOT_FOUND", "No se indicaron productos") }
        Task {
            do {
                let found = try await Product.products(for: ids)
                for product in found { self.products[product.id] = product }
                call.resolve([
                    "products": found.map { self.describe($0) },
                    "missing": ids.filter { id in !found.contains(where: { $0.id == id }) }
                ])
            } catch {
                self.fail(call, error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else { return fail(call, "PRODUCT_NOT_FOUND", "Falta el producto") }
        guard AppStore.canMakePayments else { return fail(call, "NOT_ALLOWED", "Las compras están desactivadas en este dispositivo") }
        let accountToken = call.getString("accountToken").flatMap { UUID(uuidString: $0) }
        Task {
            do {
                var product = self.products[productId]
                if product == nil {
                    product = try await Product.products(for: [productId]).first
                    if let product = product { self.products[productId] = product }
                }
                guard let product = product else { return self.fail(call, "PRODUCT_NOT_FOUND", "El plan no está disponible en App Store") }

                var options: Set<Product.PurchaseOption> = []
                // Liga la compra al espacio de trabajo: el servidor lo compara al verificar
                if let token = accountToken { options.insert(.appAccountToken(token)) }

                let result = try await product.purchase(options: options)
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        // No se llama finish() aquí: la app lo pide con finishTransaction
                        // cuando el servidor ya registró la compra.
                        var data = self.describe(transaction)
                        data["status"] = "purchased"
                        call.resolve(data)
                    case .unverified(_, let error):
                        self.fail(call, "VERIFICATION_FAILED", "App Store no pudo verificar la compra: \(error.localizedDescription)")
                    }
                case .pending:
                    call.resolve(["status": "pending", "productId": productId, "store": "APPLE"])
                case .userCancelled:
                    self.fail(call, "USER_CANCELLED", "Compra cancelada")
                @unknown default:
                    self.fail(call, "UNKNOWN", "App Store devolvió un resultado desconocido")
                }
            } catch {
                self.fail(call, error)
            }
        }
    }

    @objc func getEntitlements(_ call: CAPPluginCall) {
        Task { call.resolve(["purchases": await self.currentEntitlements()]) }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                // Pide la contraseña del Apple ID; solo se llama cuando el usuario toca "Restaurar compras"
                try await AppStore.sync()
                call.resolve(["purchases": await self.currentEntitlements()])
            } catch {
                self.fail(call, error)
            }
        }
    }

    @objc func finishTransaction(_ call: CAPPluginCall) {
        guard let id = call.getString("transactionId") else { return call.resolve() }
        Task {
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result, String(transaction.id) == id {
                    await transaction.finish()
                }
            }
            call.resolve()
        }
    }

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                return self.fail(call, "UNKNOWN", "No se pudo abrir la administración de suscripciones")
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch {
                self.fail(call, error)
            }
        }
    }

    // MARK: - Apoyo

    private func currentEntitlements() async -> [[String: Any]] {
        var list: [[String: Any]] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.productType == .autoRenewable {
                list.append(describe(transaction))
            }
        }
        return list
    }

    private func describe(_ product: Product) -> [String: Any] {
        var data: [String: Any] = [
            "id": product.id,
            "title": product.displayName,
            "description": product.description,
            "price": product.displayPrice,
            "priceAmount": NSDecimalNumber(decimal: product.price).doubleValue,
            "currency": product.priceFormatStyle.currencyCode
        ]
        if let period = product.subscription?.subscriptionPeriod {
            let unit: String
            switch period.unit {
            case .day: unit = "D"
            case .week: unit = "W"
            case .month: unit = "M"
            case .year: unit = "Y"
            @unknown default: unit = "M"
            }
            data["period"] = "P\(period.value)\(unit)"
        }
        return data
    }

    private func describe(_ transaction: Transaction) -> [String: Any] {
        var data: [String: Any] = [
            "store": "APPLE",
            "productId": transaction.productID,
            "transactionId": String(transaction.id),
            "originalTransactionId": String(transaction.originalID),
            "revoked": transaction.revocationDate != nil
        ]
        if let expires = transaction.expirationDate {
            data["expiresAt"] = ISO8601DateFormatter().string(from: expires)
        }
        if let token = transaction.appAccountToken {
            data["accountToken"] = token.uuidString.lowercased()
        }
        return data
    }

    /// Traduce los errores de StoreKit a códigos que la app sabe explicar.
    private func fail(_ call: CAPPluginCall, _ error: Error) {
        if let storeError = error as? StoreKitError {
            switch storeError {
            case .userCancelled: return fail(call, "USER_CANCELLED", "Compra cancelada")
            case .networkError: return fail(call, "NETWORK", "Sin conexión con App Store")
            case .notAvailableInStorefront: return fail(call, "PRODUCT_NOT_FOUND", "El plan no está disponible en tu país")
            case .notEntitled: return fail(call, "NOT_ALLOWED", "La app no tiene permiso para vender suscripciones")
            case .systemError, .unknown: return fail(call, "BILLING_UNAVAILABLE", "App Store no está disponible en este momento")
            @unknown default: return fail(call, "UNKNOWN", storeError.localizedDescription)
            }
        }
        if let purchaseError = error as? Product.PurchaseError {
            switch purchaseError {
            case .productUnavailable: return fail(call, "PRODUCT_NOT_FOUND", "El plan no está disponible")
            case .purchaseNotAllowed: return fail(call, "NOT_ALLOWED", "Las compras están desactivadas en este dispositivo")
            case .ineligibleForOffer, .invalidOfferIdentifier, .invalidOfferPrice, .invalidOfferSignature, .missingOfferParameters, .invalidQuantity:
                return fail(call, "UNKNOWN", "La oferta no es válida")
            @unknown default: return fail(call, "UNKNOWN", purchaseError.localizedDescription)
            }
        }
        fail(call, "UNKNOWN", error.localizedDescription)
    }

    private func fail(_ call: CAPPluginCall, _ code: String, _ message: String) {
        call.reject(message, code)
    }
}
