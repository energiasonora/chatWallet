package org.energiasonora.chatwallet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

/**
 * La app se acaba de actualizar (MY_PACKAGE_REPLACED). Al instalarse sin preguntar, Android
 * la cierra en el acto y no la puede volver a abrir sola desde segundo plano: se avisa con una
 * notificación que la abre al tocarla (lo mismo que el «Listo | Abrir» del instalador).
 */
public class UpdatedReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "chatwallet_update";
    private static final int NOTIF_ID = 7779;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Actualizaciones", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Avisa cuando ChatWallet terminó de actualizarse");
            nm.createNotificationChannel(ch);
        }
        String version = "";
        try { version = context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName; } catch (Exception e) { }
        Intent abrir = new Intent(context, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, 1, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle("ChatWallet se actualizó" + (version.isEmpty() ? "" : " a la " + version))
                .setContentText("Tocá para abrirla")
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(android.graphics.Color.rgb(0x4F, 0x46, 0xE5))
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build();
        nm.notify(NOTIF_ID, n);
    }
}
