package com.jijbot.android;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(EncryptedKeyStorePlugin.class);
        registerPlugin(BotWorkerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
