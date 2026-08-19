package org.energiasonora.chatwallet;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Guardar un archivo en la carpeta Descargas del teléfono.
 *
 * POR QUÉ: el WebView de Capacitor IGNORA <a download> (no hay DownloadListener), así que
 * "Descargar" desde la app se quedaba mudo en el APK. Acá el WebView manda el contenido en
 * base64 y el nativo lo escribe por MediaStore (API 29+, sin permisos).
 *
 * Lo usa el archivo del historial propio al adoptar el chat de otra wallet.
 */
@CapacitorPlugin(name = "Files")
public class FilesPlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        final String name = call.getString("name");
        final String base64 = call.getString("base64");
        final String mime = call.getString("mime", "application/octet-stream");
        if (name == null || name.isEmpty() || base64 == null) {
            call.reject("Faltan el nombre o el contenido del archivo");
            return;
        }

        new Thread(() -> {
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                Uri uri;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                    cv.put(MediaStore.Downloads.IS_PENDING, 1);
                    uri = getContext().getContentResolver()
                            .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) throw new Exception("MediaStore no aceptó el archivo");
                    OutputStream out = getContext().getContentResolver().openOutputStream(uri);
                    try {
                        out.write(data);
                    } finally {
                        if (out != null) out.close();
                    }
                    cv.clear();
                    cv.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContext().getContentResolver().update(uri, cv, null, null);
                } else {
                    // Android 9 y anteriores: escritura directa (necesita WRITE_EXTERNAL_STORAGE).
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, name);
                    FileOutputStream out = new FileOutputStream(f);
                    try {
                        out.write(data);
                    } finally {
                        out.close();
                    }
                    uri = Uri.fromFile(f);
                }

                JSObject ret = new JSObject();
                ret.put("uri", uri.toString());
                ret.put("name", name);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("No se pudo guardar en Descargas: " + e.getMessage());
            }
        }).start();
    }
}
