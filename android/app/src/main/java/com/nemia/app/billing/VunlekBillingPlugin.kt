package com.nemia.app.billing

import android.content.Intent
import android.net.Uri
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Suscripciones de VUNLEK con Google Play Billing Library.
 * La app web (Capacitor) lo usa como `VunlekBilling`. Aquí solo se habla con Google Play;
 * quien da el acceso (y confirma la compra ante Google) es el servidor.
 */
@CapacitorPlugin(name = "VunlekBilling")
class VunlekBillingPlugin : Plugin(), PurchasesUpdatedListener {

    private lateinit var client: BillingClient
    private val details = HashMap<String, ProductDetails>()

    /** Compra en curso: se responde cuando Google Play avisa en onPurchasesUpdated. */
    private var purchaseCall: PluginCall? = null

    override fun load() {
        client = BillingClient.newBuilder(context)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build()
    }

    override fun handleOnDestroy() {
        if (::client.isInitialized) client.endConnection()
    }

    // ------------------------------------------------------------------ Métodos

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val answer = { available: Boolean ->
            call.resolve(JSObject().put("available", available).put("store", "GOOGLE"))
        }
        if (client.isReady) return answer(supportsSubscriptions())
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                answer(result.responseCode == BillingResponseCode.OK && supportsSubscriptions())
            }
            override fun onBillingServiceDisconnected() { /* se reconecta sola */ }
        })
    }

    @PluginMethod
    fun getProducts(call: PluginCall) {
        val ids = call.getArray("productIds")?.toList<String>() ?: emptyList()
        if (ids.isEmpty()) return fail(call, "PRODUCT_NOT_FOUND", "No se indicaron productos")
        whenConnected(call) {
            queryDetails(ids) { result, found ->
                if (result.responseCode != BillingResponseCode.OK) return@queryDetails fail(call, result)
                val products = JSArray()
                found.forEach { describe(it)?.let(products::put) }
                val missing = JSArray()
                ids.filter { id -> found.none { it.productId == id } }.forEach(missing::put)
                call.resolve(JSObject().put("products", products).put("missing", missing))
            }
        }
    }

    @PluginMethod
    fun purchase(call: PluginCall) {
        val productId = call.getString("productId") ?: return fail(call, "PRODUCT_NOT_FOUND", "Falta el producto")
        val accountToken = call.getString("accountToken")
        if (purchaseCall != null) return fail(call, "IN_PROGRESS", "Ya hay una compra en curso")
        whenConnected(call) {
            val cached = details[productId]
            if (cached != null) launch(call, cached, accountToken)
            else queryDetails(listOf(productId)) { result, found ->
                val product = found.firstOrNull()
                when {
                    result.responseCode != BillingResponseCode.OK -> fail(call, result)
                    product == null -> fail(call, "PRODUCT_NOT_FOUND", "El plan no está disponible en Google Play")
                    else -> launch(call, product, accountToken)
                }
            }
        }
    }

    @PluginMethod
    fun getEntitlements(call: PluginCall) {
        whenConnected(call) {
            val params = QueryPurchasesParams.newBuilder().setProductType(ProductType.SUBS).build()
            client.queryPurchasesAsync(params) { result, purchases ->
                if (result.responseCode != BillingResponseCode.OK) return@queryPurchasesAsync fail(call, result)
                val list = JSArray()
                purchases.filter { it.purchaseState == Purchase.PurchaseState.PURCHASED }.forEach { list.put(describe(it)) }
                call.resolve(JSObject().put("purchases", list))
            }
        }
    }

    /** En Google Play las compras viven en la cuenta: restaurar es volver a consultarlas. */
    @PluginMethod
    fun restore(call: PluginCall) = getEntitlements(call)

    /** El acuse ante Google lo hace el servidor al verificar; aquí no hay nada que cerrar. */
    @PluginMethod
    fun finishTransaction(call: PluginCall) = call.resolve()

    @PluginMethod
    fun manageSubscriptions(call: PluginCall) {
        val productId = call.getString("productId")
        val uri = Uri.parse("https://play.google.com/store/account/subscriptions").buildUpon().apply {
            if (productId != null) appendQueryParameter("sku", productId)
            appendQueryParameter("package", context.packageName)
        }.build()
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, uri))
            call.resolve()
        } catch (e: Exception) {
            fail(call, "UNKNOWN", "No se pudo abrir Google Play")
        }
    }

    // ------------------------------------------------------------------ Google Play avisa

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        val call = purchaseCall
        purchaseCall = null

        if (result.responseCode != BillingResponseCode.OK) {
            if (call != null) fail(call, result)
            return
        }
        val purchase = purchases?.firstOrNull()
        if (purchase == null) {
            call?.let { fail(it, "UNKNOWN", "Google Play no devolvió la compra") }
            return
        }
        val data = describe(purchase)
        if (call != null) {
            call.resolve(data)
        } else {
            // Compra que se completó fuera de la pantalla de planes (por ejemplo, un pago pendiente aprobado)
            notifyListeners("purchaseUpdated", JSObject().put("purchases", JSArray().put(data)), true)
        }
    }

    // ------------------------------------------------------------------ Apoyo

    private fun supportsSubscriptions() =
        client.isFeatureSupported(BillingClient.FeatureType.SUBSCRIPTIONS).responseCode == BillingResponseCode.OK

    private fun whenConnected(call: PluginCall, block: () -> Unit) {
        if (client.isReady) return block()
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingResponseCode.OK) block() else fail(call, result)
            }
            override fun onBillingServiceDisconnected() { /* se reconecta sola */ }
        })
    }

    private fun queryDetails(ids: List<String>, done: (BillingResult, List<ProductDetails>) -> Unit) {
        val products = ids.map {
            QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(ProductType.SUBS).build()
        }
        val params = QueryProductDetailsParams.newBuilder().setProductList(products).build()
        client.queryProductDetailsAsync(params) { result, response ->
            val found = response.productDetailsList
            found.forEach { details[it.productId] = it }
            done(result, found)
        }
    }

    /** Oferta que se vende: el plan base (sin oferta especial) o, si no hay, la primera. */
    private fun offerOf(product: ProductDetails): ProductDetails.SubscriptionOfferDetails? {
        val offers = product.subscriptionOfferDetails ?: return null
        return offers.firstOrNull { it.offerId == null } ?: offers.firstOrNull()
    }

    private fun launch(call: PluginCall, product: ProductDetails, accountToken: String?) {
        val offer = offerOf(product) ?: return fail(call, "PRODUCT_NOT_FOUND", "El plan no tiene una oferta activa en Google Play")
        val item = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(product)
            .setOfferToken(offer.offerToken)
            .build()
        val flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(item))
        // Liga la compra al espacio de trabajo: el servidor lo compara al verificar
        if (!accountToken.isNullOrBlank()) flow.setObfuscatedAccountId(accountToken)

        purchaseCall = call
        val result = client.launchBillingFlow(activity, flow.build())
        if (result.responseCode != BillingResponseCode.OK) {
            purchaseCall = null
            fail(call, result)
        }
    }

    private fun describe(product: ProductDetails): JSObject? {
        val phase = offerOf(product)?.pricingPhases?.pricingPhaseList?.lastOrNull() ?: return null
        return JSObject()
            .put("id", product.productId)
            .put("title", product.name)
            .put("description", product.description)
            .put("price", phase.formattedPrice)
            .put("priceAmount", phase.priceAmountMicros / 1_000_000.0)
            .put("currency", phase.priceCurrencyCode)
            .put("period", phase.billingPeriod)
    }

    private fun describe(purchase: Purchase): JSObject {
        val status = when (purchase.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> "purchased"
            Purchase.PurchaseState.PENDING -> "pending"
            else -> "unknown"
        }
        return JSObject()
            .put("store", "GOOGLE")
            .put("status", status)
            .put("productId", purchase.products.firstOrNull())
            .put("purchaseToken", purchase.purchaseToken)
            .put("transactionId", purchase.orderId)
            .put("autoRenewing", purchase.isAutoRenewing)
            .put("acknowledged", purchase.isAcknowledged)
            .put("accountToken", purchase.accountIdentifiers?.obfuscatedAccountId)
    }

    /** Traduce las respuestas de Google Play a códigos que la app sabe explicar. */
    private fun fail(call: PluginCall, result: BillingResult) {
        when (result.responseCode) {
            BillingResponseCode.USER_CANCELED -> fail(call, "USER_CANCELLED", "Compra cancelada")
            BillingResponseCode.NETWORK_ERROR,
            BillingResponseCode.SERVICE_UNAVAILABLE,
            BillingResponseCode.SERVICE_DISCONNECTED -> fail(call, "NETWORK", "Sin conexión con Google Play")
            BillingResponseCode.BILLING_UNAVAILABLE,
            BillingResponseCode.FEATURE_NOT_SUPPORTED -> fail(call, "BILLING_UNAVAILABLE", "Google Play no está disponible en este dispositivo")
            BillingResponseCode.ITEM_UNAVAILABLE -> fail(call, "PRODUCT_NOT_FOUND", "El plan no está disponible")
            BillingResponseCode.ITEM_ALREADY_OWNED -> fail(call, "ALREADY_OWNED", "Ya tienes esta suscripción")
            else -> fail(call, "UNKNOWN", result.debugMessage.ifBlank { "Error ${result.responseCode} de Google Play" })
        }
    }

    private fun fail(call: PluginCall, code: String, message: String) {
        call.reject(message, code)
    }
}
