package org.energiasonora.chatwallet;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KeepAlivePlugin.class);
        registerPlugin(UpdaterPlugin.class);
        registerPlugin(FilesPlugin.class);
        super.onCreate(savedInstanceState);
        stashChatExtra(getIntent());
        stashDeepLink(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        stashChatExtra(intent);
        stashDeepLink(intent);
    }

    // Guarda la dirección del chat traída por el tap en la notificación; el WebView la consume.
    private void stashChatExtra(Intent intent) {
        if (intent != null) {
            String addr = intent.getStringExtra(KeepAlivePlugin.EXTRA_OPEN_CHAT);
            if (addr != null) KeepAlivePlugin.pendingChatAddress = addr;
        }
    }

    // Guarda la URL de un App Link (https://chatwallet.org/dapp?address=...&pk=...) para que el
    // WebView la consuma y la procese igual que un QR escaneado. NO navegamos el WebView a esa URL:
    // la app corre sobre assets locales; solo leemos los parámetros.
    private void stashDeepLink(Intent intent) {
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            KeepAlivePlugin.pendingDeepLink = intent.getData().toString();
        }
    }
}
