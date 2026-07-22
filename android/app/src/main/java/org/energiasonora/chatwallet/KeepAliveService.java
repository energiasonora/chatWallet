package org.energiasonora.chatwallet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Servicio en primer plano con dos trabajos:
 *  1. Impedir que Android mate el proceso mientras la app está en segundo plano, para que
 *     el stream XMTP (que corre en el WebView) siga recibiendo mensajes (Fase 1).
 *  2. Wake push (Fase 2): mantener una suscripción NATIVA liviana (ndjson por HTTP) al
 *     servidor ntfy autohospedado. Cuando un contacto avisa que mandó un mensaje, se
 *     despierta el WebView (resync + notificación por el pipeline normal). Si el WebView
 *     no está, se postea una notificación genérica. La conexión es chica y con reconexión
 *     controlada: no depende del worker WASM de XMTP (que es lo que se colgaba).
 *
 * NO toca las llaves: el descifrado y todo el manejo de identidad ocurre en el WebView.
 * Al server ntfy solo viaja el topic opaco (token aleatorio), nunca address ni inbox ID.
 */
public class KeepAliveService extends Service {
    public static final String CHANNEL_ID = "chatwallet_keepalive";
    public static final int NOTIF_ID = 7777;
    public static final int WAKE_NOTIF_ID = 7779;
    private static final String TAG = "ChatWalletWake";
    public static final String WAKE_PREFS = "chatwallet_wake";

    private volatile boolean running = false;
    private volatile Thread subscriberThread = null;
    private volatile HttpURLConnection currentConn = null;
    // Último id de evento visto: en la reconexión se pide ?since=<id> para no perder
    // avisos que llegaron mientras la conexión estuvo caída (ntfy los cachea 3h).
    private volatile String lastEventId = null;

    // Respaldo del wake: si el JS no confirma que manejó el aviso dentro de esta ventana
    // (worker XMTP colgado o WebView congelado en background), el nativo postea la
    // notificación genérica por su cuenta. Es el fix de v1.91: antes se confiaba en que
    // "bridge vivo" == "el JS va a notificar", y un WebView congelado dejaba el wake mudo.
    private static final long FALLBACK_DELAY_MS = 7000;
    private final Handler fallbackHandler = new Handler(Looper.getMainLooper());
    private final Runnable fallbackRunnable = this::postGenericNotification;

    private static volatile KeepAliveService instance = null;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
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
        startSubscriber();
        // Si el SO lo mata por memoria, que intente recrearlo.
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        instance = null;
        fallbackHandler.removeCallbacks(fallbackRunnable);
        closeCurrentConn();
        super.onDestroy();
    }

    /** Asegura el suscriptor corriendo; si la config cambió (topic/base nuevos), corta la
     *  conexión actual para que el loop relea las prefs y reconecte. */
    public static void pokeSubscriber(boolean configChanged) {
        KeepAliveService s = instance;
        if (s != null) {
            if (configChanged) s.closeCurrentConn();
            s.startSubscriber(); // por si el thread nunca arrancó (config llegó después de start)
        }
    }

    private void closeCurrentConn() {
        HttpURLConnection c = currentConn;
        if (c != null) {
            try { c.disconnect(); } catch (Exception ignored) { }
        }
    }

    private synchronized void startSubscriber() {
        if (running && subscriberThread != null && subscriberThread.isAlive()) return;
        running = true;
        subscriberThread = new Thread(this::subscriberLoop, "ntfy-wake-subscriber");
        subscriberThread.setDaemon(true);
        subscriberThread.start();
    }

    /** Loop de suscripción: GET {base}/{topic}/json (stream ndjson, keepalives cada 25s del
     *  server). Reconexión con backoff exponencial 2s→60s; el readTimeout de 55s detecta
     *  conexiones muertas (keepalive que no llegó) rápido para reconectar cuanto antes. */
    private void subscriberLoop() {
        long backoffMs = 2000;
        while (running) {
            SharedPreferences prefs = getSharedPreferences(WAKE_PREFS, Context.MODE_PRIVATE);
            String topic = prefs.getString("topic", "");
            String base = prefs.getString("base", "");
            if (topic.isEmpty() || base.isEmpty()) {
                // Sin config todavía (el WebView aún no llamó a configureWake): esperar.
                sleepQuiet(15000);
                continue;
            }
            HttpURLConnection conn = null;
            try {
                String since = lastEventId != null ? ("?since=" + lastEventId) : "";
                URL url = new URL(base + "/" + topic + "/json" + since);
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(55000); // > keepalive de 25s del server
                conn.setRequestProperty("Accept", "application/x-ndjson");
                currentConn = conn;
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                Log.i(TAG, "Suscripto a ntfy (wake stream conectado)");
                backoffMs = 2000; // conexión sana: resetear el backoff
                String line;
                while (running && (line = reader.readLine()) != null) {
                    if (line.isEmpty()) continue;
                    try {
                        JSONObject ev = new JSONObject(line);
                        String event = ev.optString("event", "");
                        String id = ev.optString("id", "");
                        if (!id.isEmpty()) lastEventId = id;
                        if ("message".equals(event)) {
                            Log.i(TAG, "Wake recibido, despertando WebView");
                            onWake();
                        }
                        // "open"/"keepalive": la conexión está viva, nada que hacer.
                    } catch (Exception e) {
                        Log.w(TAG, "Línea ndjson inválida: " + e.getMessage());
                    }
                }
            } catch (Exception e) {
                if (running) Log.w(TAG, "Stream ntfy caído: " + e.getMessage());
            } finally {
                currentConn = null;
                if (conn != null) { try { conn.disconnect(); } catch (Exception ignored) { } }
            }
            if (!running) break;
            sleepQuiet(backoffMs);
            backoffMs = Math.min(backoffMs * 2, 60000);
        }
    }

    /** Llegó un aviso de wake. Estrategia (v1.91):
     *  - Sin bridge/WebView vivo (proceso revivió pelado) → notificación genérica YA (el JS
     *    no puede ayudar).
     *  - Con bridge vivo → emitimos el evento al JS Y armamos un respaldo temporizado: el JS
     *    tiene FALLBACK_DELAY_MS para sincronizar y, o bien postear la notificación rica
     *    (showMessage), o confirmar que no hay nada nuevo (ackWake). Ambos cancelan el
     *    respaldo vía markWakeHandled(). Si el JS NO confirma (worker XMTP colgado / WebView
     *    congelado), el respaldo dispara y postea la genérica igual. Antes de v1.91 se
     *    confiaba en que "bridge vivo == el JS notifica", y un WebView congelado dejaba el
     *    wake mudo. */
    private void onWake() {
        boolean emitted = KeepAlivePlugin.emitWakeEvent();
        if (!emitted) {
            postGenericNotification();
            return;
        }
        armFallback();
    }

    private void armFallback() {
        fallbackHandler.removeCallbacks(fallbackRunnable);
        fallbackHandler.postDelayed(fallbackRunnable, FALLBACK_DELAY_MS);
    }

    /** El JS confirmó que manejó el wake (posteó una notificación rica, o no había nada
     *  nuevo): cancelar el respaldo pendiente y borrar la genérica si ya se había posteado
     *  (para no dejar dos avisos cuando llega la versión rica tras un reload). Idempotente. */
    public static void markWakeHandled() {
        KeepAliveService s = instance;
        if (s == null) return;
        s.fallbackHandler.removeCallbacks(s.fallbackRunnable);
        try { NotificationManagerCompat.from(s).cancel(WAKE_NOTIF_ID); } catch (Exception ignored) { }
    }

    private void postGenericNotification() {
        Context ctx = this;
        // El canal de mensajes lo crea normalmente el plugin; asegurarlo por si el proceso
        // revivió sin pasar por el WebView.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    KeepAlivePlugin.MSG_CHANNEL_ID, "Mensajes", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Avisos de mensajes cifrados entrantes");
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(ctx, WAKE_NOTIF_ID, open, piFlags);
        Notification n = new NotificationCompat.Builder(ctx, KeepAlivePlugin.MSG_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(android.graphics.Color.rgb(0x4F, 0x46, 0xE5))
                .setContentTitle("ChatWallet")
                .setContentText("📬 Tenés mensajes nuevos")
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build();
        try {
            NotificationManagerCompat.from(ctx).notify(WAKE_NOTIF_ID, n);
        } catch (SecurityException ignored) {
            // notificaciones deshabilitadas por el usuario; no es fatal
        }
    }

    private static void sleepQuiet(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ignored) { }
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
