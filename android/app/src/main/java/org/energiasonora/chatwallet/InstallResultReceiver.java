package org.energiasonora.chatwallet;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

import com.getcapacitor.JSObject;

/**
 * Resultado de la sesión de instalación de UpdaterPlugin.
 *  - PENDING_USER_ACTION: el sistema quiere que la persona confirme (Android < 12, o lo pide
 *    Play Protect): se abre SU pantalla de confirmación. La app está en primer plano, se puede.
 *  - SUCCESS: casi nunca llega (la app se reemplaza y el proceso muere); avisa UpdatedReceiver.
 *  - Cualquier fallo: se le cuenta al WebView (evento updateResult) para que ofrezca el plan B.
 */
public class InstallResultReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        int estado = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String mensaje = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        if (estado == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirmar = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirmar != null) {
                confirmar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { context.startActivity(confirmar); } catch (Exception e) { estado = PackageInstaller.STATUS_FAILURE; mensaje = e.getMessage(); }
            }
        }
        UpdaterPlugin p = UpdaterPlugin.instancia;
        if (p != null) {
            JSObject datos = new JSObject();
            datos.put("estado", estado);
            datos.put("mensaje", mensaje == null ? "" : mensaje);
            datos.put("confirmar", estado == PackageInstaller.STATUS_PENDING_USER_ACTION);
            datos.put("ok", estado == PackageInstaller.STATUS_SUCCESS);
            datos.put("bloqueado", estado == PackageInstaller.STATUS_FAILURE_BLOCKED);
            datos.put("cancelado", estado == PackageInstaller.STATUS_FAILURE_ABORTED);
            p.avisar("updateResult", datos);
        }
    }
}
