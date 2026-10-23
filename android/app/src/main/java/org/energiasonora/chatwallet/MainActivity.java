package org.energiasonora.chatwallet;

import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KeepAlivePlugin.class);
        registerPlugin(UpdaterPlugin.class);
        registerPlugin(FilesPlugin.class);
        super.onCreate(savedInstanceState);
        respetarBarrasDelSistema();
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

    // Android 15+ obliga a dibujar la app de borde a borde: la barra de estado y la de navegación
    // (los botones ◁ ○ |||) quedan ENCIMA del WebView y tapan el campo de escribir y la barra de abajo.
    // Le damos al WebView márgenes del tamaño de esas barras (y del teclado, que en ese modo ya no
    // achica la ventana solo). En Android 14 o anterior el sistema ya lo hace: no tocamos nada.
    private void respetarBarrasDelSistema() {
        if (Build.VERSION.SDK_INT < 35) return;
        View web = getBridge() != null ? getBridge().getWebView() : null;
        if (web == null) return;
        getWindow().getDecorView().setBackgroundColor(Color.BLACK); // detrás de las barras
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, wi) -> {
            Insets barras = wi.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets teclado = wi.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            mlp.leftMargin = barras.left;
            mlp.topMargin = barras.top;
            mlp.rightMargin = barras.right;
            mlp.bottomMargin = Math.max(barras.bottom, teclado.bottom);
            v.setLayoutParams(mlp);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(web);
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
