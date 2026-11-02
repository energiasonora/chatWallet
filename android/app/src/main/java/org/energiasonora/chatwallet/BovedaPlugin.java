package org.energiasonora.chatwallet;

import android.app.KeyguardManager;
import android.content.Context;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Bóveda de secretos: cifra la clave privada, la frase y la llave Ğ1 antes de que el WebView las
 * guarde, con una llave AES-256 que vive en el Android Keystore y NO se puede exportar.
 *
 * No pide huella ni PIN (decisión de producto): el candado es el bloqueo de pantalla del teléfono.
 * Lo que gana: lo que queda guardado en los datos de la app es texto cifrado que no sirve fuera de
 * este teléfono, porque la llave para abrirlo no sale del chip.
 *
 * NO usa setUnlockedDeviceRequired: en algunos Android, sacar el bloqueo de pantalla invalida esas
 * llaves y el usuario sin las palabras anotadas perdería la billetera.
 *
 * Formato: base64(iv[12] || texto cifrado + tag[16]).
 */
@CapacitorPlugin(name = "Boveda")
public class BovedaPlugin extends Plugin {
    private static final String TAG = "Boveda";
    private static final String ALIAS = "chatwallet_boveda_v1";
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String TRANSFORMACION = "AES/GCM/NoPadding";

    private static synchronized SecretKey llave(boolean crearSiFalta) throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE);
        ks.load(null);
        KeyStore.Entry e = ks.getEntry(ALIAS, null);
        if (e instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) e).getSecretKey();
        if (!crearSiFalta) return null;

        // StrongBox (chip separado) si el teléfono lo tiene; si no, el TEE.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                return generar(true);
            } catch (Exception sinStrongBox) {
                Log.i(TAG, "Sin StrongBox, uso el TEE: " + sinStrongBox.getMessage());
            }
        }
        return generar(false);
    }

    private static SecretKey generar(boolean strongBox) throws Exception {
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(false);
        if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) b.setIsStrongBoxBacked(true);
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        kg.init(b.build());
        return kg.generateKey();
    }

    @PluginMethod
    public void cifrar(PluginCall call) {
        final String texto = call.getString("texto");
        if (texto == null) { call.reject("Falta el texto"); return; }
        new Thread(() -> {
            try {
                Cipher c = Cipher.getInstance(TRANSFORMACION);
                c.init(Cipher.ENCRYPT_MODE, llave(true));
                byte[] iv = c.getIV();
                byte[] ct = c.doFinal(texto.getBytes(StandardCharsets.UTF_8));
                ByteBuffer bb = ByteBuffer.allocate(iv.length + ct.length);
                bb.put(iv).put(ct);
                JSObject r = new JSObject();
                r.put("c", Base64.encodeToString(bb.array(), Base64.NO_WRAP));
                call.resolve(r);
            } catch (Exception e) {
                Log.e(TAG, "cifrar", e);
                call.reject("No se pudo cifrar: " + e.getMessage(), "ERROR");
            }
        }).start();
    }

    @PluginMethod
    public void descifrar(PluginCall call) {
        final String cifrado = call.getString("c");
        if (cifrado == null) { call.reject("Falta el texto cifrado"); return; }
        new Thread(() -> {
            try {
                SecretKey k = llave(false);
                // Sin llave: se borraron los datos del Keystore (o nunca existió en este teléfono).
                // El texto cifrado ya no se puede abrir; se recupera con las palabras.
                if (k == null) { call.reject("La llave de la bóveda no está en este teléfono", "SIN_LLAVE"); return; }
                byte[] todo = Base64.decode(cifrado, Base64.NO_WRAP);
                if (todo.length < 12 + 16) { call.reject("Texto cifrado inválido", "INVALIDO"); return; }
                Cipher c = Cipher.getInstance(TRANSFORMACION);
                c.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(128, todo, 0, 12));
                byte[] claro = c.doFinal(todo, 12, todo.length - 12);
                JSObject r = new JSObject();
                r.put("texto", new String(claro, StandardCharsets.UTF_8));
                call.resolve(r);
            } catch (KeyPermanentlyInvalidatedException e) {
                call.reject("La llave de la bóveda quedó invalidada", "SIN_LLAVE");
            } catch (AEADBadTagException e) {
                call.reject("El texto cifrado no corresponde a la llave de este teléfono", "SIN_LLAVE");
            } catch (Exception e) {
                Log.e(TAG, "descifrar", e);
                call.reject("No se pudo descifrar: " + e.getMessage(), "ERROR");
            }
        }).start();
    }

    /** Para avisar al usuario: ¿el teléfono tiene bloqueo de pantalla? ¿la llave está en hardware? */
    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        boolean seguro = false;
        try {
            KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
            seguro = km != null && (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? km.isDeviceSecure() : km.isKeyguardSecure());
        } catch (Exception ignored) { }
        r.put("bloqueoPantalla", seguro);
        String hardware = "desconocido";
        try {
            SecretKey k = llave(false);
            if (k != null) {
                SecretKeyFactory f = SecretKeyFactory.getInstance(k.getAlgorithm(), KEYSTORE);
                KeyInfo info = (KeyInfo) f.getKeySpec(k, KeyInfo.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    int nivel = info.getSecurityLevel();
                    hardware = nivel == KeyProperties.SECURITY_LEVEL_STRONGBOX ? "strongbox"
                            : nivel == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT ? "tee" : "software";
                } else {
                    hardware = info.isInsideSecureHardware() ? "tee" : "software";
                }
            } else {
                hardware = "sin_llave";
            }
        } catch (Exception ignored) { }
        r.put("hardware", hardware);
        call.resolve(r);
    }
}
