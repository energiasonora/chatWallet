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

                // Progreso real: contamos bytes y avisamos al WebView (updateProgress) por cada
                // punto porcentual — sin esto el "Descargando…" queda inmóvil y parece colgado.
                long total = conn.getContentLengthLong();
                long done = 0;
                int lastPct = -1;
                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(outFile)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                        done += n;
                        int pct = total > 0 ? (int) (done * 100 / total) : -1;
                        if (pct != lastPct) {
                            lastPct = pct;
                            JSObject ev = new JSObject();
                            ev.put("bytes", done);
                            ev.put("total", total);
                            ev.put("percent", pct);
                            notifyListeners("updateProgress", ev);
                        }
                    }
                    out.flush();
                }
                conn.disconnect();

                JSObject doneEv = new JSObject();
                doneEv.put("bytes", done);
                doneEv.put("total", total);
                doneEv.put("percent", 100);
                doneEv.put("installing", true);
                notifyListeners("updateProgress", doneEv);

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

    /**
     * Abre los ajustes de Google Play Protect para que el usuario pueda desactivar
     * "Analizar apps" — es el diálogo de Google que intercepta la instalación de APKs
     * sideload (debug-firmados) y hace que la actualización parezca trabada.
     */
    @PluginMethod
    public void openPlayProtectSettings(PluginCall call) {
        try {
            Intent intent = new Intent("com.google.android.gms.settings.VERIFY_APPS_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo abrir Play Protect: " + e.getMessage());
        }
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
