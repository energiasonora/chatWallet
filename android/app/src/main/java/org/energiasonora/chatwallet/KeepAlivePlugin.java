package org.energiasonora.chatwallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente JS <-> nativo. Superficie expuesta:
 *  - start()/stop(): foreground service que mantiene vivo el proceso/WebView.
 *  - showMessage(): notificación local de mensaje, generada on-device, con avatar circular.
 *  - consumePendingChat(): devuelve la dirección del chat a abrir si se tocó una notificación.
 *
 * Por acá NO viajan llaves: el WebView pasa solo título/cuerpo/dirección y, opcionalmente,
 * el avatar ya convertido a base64 (lo lee el propio WebView, no el nativo).
 */
@CapacitorPlugin(name = "KeepAlive")
public class KeepAlivePlugin extends Plugin {

    public static final String MSG_CHANNEL_ID = "chatwallet_messages";
    public static final String EXTRA_OPEN_CHAT = "openChatAddress";
    // Dirección pendiente de abrir tras tocar una notificación (la setea MainActivity).
    public static volatile String pendingChatAddress = null;
    // URL de App Link pendiente de procesar (la setea MainActivity al abrir chatwallet.org/dapp?...).
    public static volatile String pendingDeepLink = null;
    // Instancia viva del plugin (para que KeepAliveService pueda emitir eventos al WebView).
    private static volatile KeepAlivePlugin instance = null;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    /**
     * Wake push (Fase 2): avisa al WebView que llegó algo (el JS hace resync y notifica por
     * el pipeline normal). Devuelve false si no hay bridge vivo → el service postea la
     * notificación genérica como fallback.
     */
    public static boolean emitWakeEvent() {
        KeepAlivePlugin p = instance;
        if (p == null || p.getBridge() == null || p.getBridge().getWebView() == null) return false;
        try {
            p.notifyListeners("wakeEvent", new JSObject());
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Guarda topic/base del wake (ntfy) y reinicia el suscriptor nativo con la config nueva.
     *  Se llama en cada startKeepAlive: si la config no cambió, no se corta la conexión. */
    @PluginMethod
    public void configureWake(PluginCall call) {
        String topic = call.getString("topic", "");
        String base = call.getString("base", "");
        if (topic == null) topic = "";
        if (base == null) base = "";
        android.content.SharedPreferences prefs =
                getContext().getSharedPreferences(KeepAliveService.WAKE_PREFS, Context.MODE_PRIVATE);
        boolean changed = !topic.equals(prefs.getString("topic", ""))
                || !base.equals(prefs.getString("base", ""));
        if (changed) {
            prefs.edit().putString("topic", topic).putString("base", base).apply();
        }
        KeepAliveService.pokeSubscriber(changed);
        call.resolve();
    }

    @PluginMethod
    public void start(PluginCall call) {
        Intent intent = new Intent(getContext(), KeepAliveService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), KeepAliveService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    /**
     * ¿Está la app exenta de la optimización de batería (Doze)? Sin la exención, Android
     * corta la red en background y el stream XMTP muere → no llegan push con pantalla
     * apagada. Es el mismo requisito/camino que usan Telegram (sin Google Play Services),
     * Signal sin GPS, Conversations, etc.
     */
    @PluginMethod
    public void isBatteryUnrestricted(PluginCall call) {
        boolean unrestricted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            unrestricted = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("unrestricted", unrestricted);
        call.resolve(ret);
    }

    /** Abre el diálogo del sistema "¿Permitir que ChatWallet se ejecute en segundo plano?". */
    @PluginMethod
    public void requestBatteryUnrestricted(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
                i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } catch (Exception e) {
                // Fallback: pantalla general de optimización de batería
                try {
                    Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(i);
                } catch (Exception ignored) { }
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void consumePendingChat(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("address", pendingChatAddress);
        pendingChatAddress = null;
        call.resolve(ret);
    }

    @PluginMethod
    public void consumePendingDeepLink(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("url", pendingDeepLink);
        pendingDeepLink = null;
        call.resolve(ret);
    }

    @PluginMethod
    public void showMessage(PluginCall call) {
        Context ctx = getContext();
        String title = call.getString("title", "Nuevo mensaje");
        String body = call.getString("body", "");
        String address = call.getString("address", null);
        String avatarB64 = call.getString("avatar", null); // PNG base64 (sin prefijo) o null

        createMessagesChannel(ctx);

        // Avatar: el del remitente si vino, si no el gatito anónimo
        Bitmap large = null;
        if (avatarB64 != null && !avatarB64.isEmpty()) {
            try {
                byte[] data = Base64.decode(avatarB64, Base64.DEFAULT);
                large = BitmapFactory.decodeByteArray(data, 0, data.length);
            } catch (Exception e) { large = null; }
        }
        if (large == null) {
            try { large = BitmapFactory.decodeResource(ctx.getResources(), R.drawable.ic_anon); } catch (Exception e) { }
        }
        if (large != null) large = circleBitmap(large);

        // Tap → reabrir la app con la dirección del chat
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        if (address != null) open.putExtra(EXTRA_OPEN_CHAT, address);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(
                ctx, address != null ? address.hashCode() : 0, open, piFlags);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, MSG_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(Color.rgb(0x4F, 0x46, 0xE5)) // indigo de la marca
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setPriority(NotificationCompat.PRIORITY_HIGH);
        if (large != null) b.setLargeIcon(large);

        int id = address != null ? Math.abs(address.hashCode()) : (int) (System.currentTimeMillis() % 100000);
        try {
            NotificationManagerCompat.from(ctx).notify(id, b.build());
        } catch (SecurityException e) {
            // notificaciones deshabilitadas por el usuario; no es fatal
        }
        call.resolve();
    }

    private void createMessagesChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    MSG_CHANNEL_ID, "Mensajes", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Avisos de mensajes cifrados entrantes");
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    /** Recorta un bitmap a un círculo (avatar). */
    private Bitmap circleBitmap(Bitmap src) {
        int size = Math.min(src.getWidth(), src.getHeight());
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint paint = new Paint();
        paint.setAntiAlias(true);
        RectF rect = new RectF(0, 0, size, size);
        canvas.drawOval(rect, paint);
        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        // centrar el recorte cuadrado
        int left = (src.getWidth() - size) / 2;
        int top = (src.getHeight() - size) / 2;
        Rect srcRect = new Rect(left, top, left + size, top + size);
        canvas.drawBitmap(src, srcRect, rect, paint);
        return out;
    }
}
