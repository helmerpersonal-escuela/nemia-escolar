import UIKit
import Capacitor

/// Pantalla principal: registra los complementos propios de VUNLEK.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(VunlekBillingPlugin())
    }
}
