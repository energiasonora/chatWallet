package org.energiasonora.chatwallet;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Auto-updater del APK. Descarga el .apk desde la URL del release (GitHub) al cache de la app
 * y lanza el instalador de paquetes de Android (ACTION_VIEW + FileProvider). El usuario confirma
 * la instalación con un toque — una app normal NO puede instalar en silencio.
 *
 * Requiere el permiso REQUEST_INSTALL_PACKAGES y el FileProvider `${applicationId}.fileprovider`
 * (ya declarados en el AndroidManifest).
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Falta la URL del APK");
            return;
        }

        new Thread(() -> {
            try {
                File outFile = new File(getContext().getCacheDir(), "update.apk");
                if (outFile.exists()) outFile.delete();

                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(60000);
                conn.connect();

                int code = conn.getResponseCode();
                if (code != HttpURLConnection.HTTP_OK) {
                    call.reject("Descarga falló (HTTP " + code + ")");
                    return;
                }

                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(outFile)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                    }
                    out.flush();
                }
                conn.disconnect();

                Uri apkUri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        outFile);

                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                getActivity().runOnUiThread(() -> {
                    try {
                        getActivity().startActivity(intent);
                        JSObject ret = new JSObject();
                        ret.put("launched", true);
                        call.resolve(ret);
                    } catch (Exception e) {
                        call.reject("No se pudo abrir el instalador: " + e.getMessage());
                    }
                });
            } catch (Exception e) {
                call.reject("Error descargando el APK: " + e.getMessage());
            }
        }).start();
    }

    /** ¿Puede esta app instalar APKs? (Android 8+ pide el toggle "fuentes desconocidas".) */
    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean can = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            can = getContext().getPackageManager().canRequestPackageInstalls();
        }
        JSObject ret = new JSObject();
        ret.put("canInstall", can);
        call.resolve(ret);
    }
}
