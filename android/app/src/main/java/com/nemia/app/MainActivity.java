package com.nemia.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.nemia.app.billing.VunlekBillingPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Complementos propios de VUNLEK (deben registrarse antes de super.onCreate)
        registerPlugin(VunlekBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
