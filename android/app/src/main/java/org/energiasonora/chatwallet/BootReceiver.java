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
 * Tras un reinicio del teléfono el foreground service NO puede rearrancar solo
 * (Android 12+ lo bloquea desde background) y el stream XMTP vive en el WebView,
 * que necesita que la app se abra. Sin esto, después de un reboot las
 * notificaciones quedan mudas EN SILENCIO hasta que el usuario abre la app.
 *
 * Este receiver no puede reactivar el chat, pero sí avisar: postea una
 * notificación "abrí ChatWallet para reactivar el chat" cuyo tap abre la app.
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "chatwallet_boot";
    private static final int NOTIF_ID = 7778;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;

        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Recordatorio tras reinicio",
                    NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Avisa que hay que abrir la app para reactivar el chat tras reiniciar");
            nm.createNotificationChannel(channel);
        }

        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(
                context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle("ChatWallet está dormido")
                .setContentText("El teléfono se reinició: abrí la app para reactivar los mensajes")
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(android.graphics.Color.rgb(0x4F, 0x46, 0xE5))
                .setContentIntent(tap)
                .setAutoCancel(true)
                .build();

        nm.notify(NOTIF_ID, notification);
    }
}
