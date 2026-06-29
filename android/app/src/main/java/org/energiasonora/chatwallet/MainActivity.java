package org.energiasonora.chatwallet;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KeepAlivePlugin.class);
        super.onCreate(savedInstanceState);
        stashChatExtra(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        stashChatExtra(intent);
    }

    // Guarda la dirección del chat traída por el tap en la notificación; el WebView la consume.
    private void stashChatExtra(Intent intent) {
        if (intent != null) {
            String addr = intent.getStringExtra(KeepAlivePlugin.EXTRA_OPEN_CHAT);
            if (addr != null) KeepAlivePlugin.pendingChatAddress = addr;
        }
    }
}
