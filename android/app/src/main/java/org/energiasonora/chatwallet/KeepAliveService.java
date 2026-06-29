package org.energiasonora.chatwallet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Servicio en primer plano cuyo ÚNICO trabajo es impedir que Android mate el proceso
 * mientras la app está en segundo plano, para que el stream XMTP (que corre en el WebView)
 * siga recibiendo mensajes y pueda disparar notificaciones locales.
 *
 * NO toca las llaves: el descifrado y todo el manejo de identidad ocurre en el WebView.
 * Este servicio nativo no tiene acceso al almacenamiento del WebView.
 */
public class KeepAliveService extends Service {
    public static final String CHANNEL_ID = "chatwallet_keepalive";
    public static final int NOTIF_ID = 7777;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("ChatWallet activo")
                .setContentText("Escuchando mensajes cifrados (E2E) en segundo plano")
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(android.graphics.Color.rgb(0x4F, 0x46, 0xE5))
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // Android 14+ exige tipo
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIF_ID, notification);
        }
        // Si el SO lo mata por memoria, que intente recrearlo.
        return START_STICKY;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "ChatWallet en segundo plano",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Mantiene la conexión para recibir mensajes con la app cerrada");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
