package com.GIHOSTINGS.giposapp;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.time.Instant;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class SecureStore {
  private static final String PREFS = "gi_pos_secure";
  private static final String KEY_ALIAS = "gi_pos_mobile_session_v1";
  private static final String SESSION = "session";
  private static final String SIGNED_OUT = "signed_out";
  private static final String LOCAL_PIN = "local_pin_hash";
  private static final String LOCAL_SERVER_NAME = "local_server_name";
  private static final String LOCAL_SERVER_ENDPOINT = "local_server_endpoint";

  public static final class Session {
    public final String serverUrl, token, restaurantId, businessName, ownerName, planId, plan, status, activatedAt, expiresAt, deviceId, apiKey;
    public final JSONObject capabilities;
    Session(JSONObject value) {
      serverUrl = value.optString("serverUrl"); token = value.optString("token"); restaurantId = value.optString("restaurantId");
      businessName = value.optString("businessName"); ownerName = value.optString("ownerName"); planId = value.optString("planId"); plan = value.optString("plan");
      status = value.optString("status"); activatedAt = value.optString("activatedAt"); expiresAt = value.optString("expiresAt");
      deviceId = value.optString("deviceId"); apiKey = value.optString("apiKey");
      JSONObject available = value.optJSONObject("capabilities");
      capabilities = available == null ? new JSONObject() : available;
    }
    public boolean isActive() {
      if (!("active".equalsIgnoreCase(status) || "trial".equalsIgnoreCase(status))) return false;
      try { return !expiresAt.isBlank() && Instant.parse(expiresAt).isAfter(Instant.now()); } catch (Exception ignored) { return false; }
    }
    public boolean hasFeature(String feature) {
      return capabilities.length() == 0 || capabilities.optBoolean(feature, false);
    }
  }

  private SecureStore() {}

  public static void save(Context context, JSONObject value) throws Exception {
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, key());
    byte[] encrypted = cipher.doFinal(value.toString().getBytes(StandardCharsets.UTF_8));
    JSONObject wrapper = new JSONObject().put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP));
    prefs(context).edit().putString(SESSION, wrapper.toString()).putBoolean(SIGNED_OUT, false).commit();
  }

  public static Session load(Context context) {
    try {
      String stored = prefs(context).getString(SESSION, "");
      if (stored == null || stored.isBlank()) return null;
      JSONObject wrapper = new JSONObject(stored);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(wrapper.getString("iv"), Base64.NO_WRAP)));
      byte[] clear = cipher.doFinal(Base64.decode(wrapper.getString("data"), Base64.NO_WRAP));
      return new Session(new JSONObject(new String(clear, StandardCharsets.UTF_8)));
    } catch (Exception ignored) { clear(context); return null; }
  }

  public static boolean isSignedOut(Context context) { return prefs(context).getBoolean(SIGNED_OUT, false); }
  public static void signOut(Context context) { prefs(context).edit().putBoolean(SIGNED_OUT, true).apply(); }
  public static boolean hasPin(Context context) { return !prefs(context).getString(LOCAL_PIN, "").isBlank(); }
  public static void setPin(Context context, String pin) throws Exception { prefs(context).edit().putString(LOCAL_PIN, CredentialSecurity.hashPin(pin)).commit(); }
  public static boolean verifyPin(Context context, String pin) { return CredentialSecurity.verifyPin(pin, prefs(context).getString(LOCAL_PIN, "")); }
  public static void clearPin(Context context) { prefs(context).edit().remove(LOCAL_PIN).apply(); }
  public static String localServerName(Context context) { return prefs(context).getString(LOCAL_SERVER_NAME, "GI POS Main PC"); }
  public static String localServerEndpoint(Context context) { return prefs(context).getString(LOCAL_SERVER_ENDPOINT, ""); }
  public static void setLocalServerName(Context context, String name) {
    String value = name == null ? "" : name.trim();
    prefs(context).edit().putString(LOCAL_SERVER_NAME, value.isBlank() ? "GI POS Main PC" : value).apply();
  }
  public static void saveLocalServer(Context context, String name, String endpoint) {
    prefs(context).edit()
      .putString(LOCAL_SERVER_NAME, name == null || name.isBlank() ? "GI POS Main PC" : name.trim())
      .putString(LOCAL_SERVER_ENDPOINT, endpoint == null ? "" : endpoint.trim())
      .apply();
  }
  public static void clear(Context context) { prefs(context).edit().remove(SESSION).remove(SIGNED_OUT).remove(LOCAL_PIN).apply(); }
  private static SharedPreferences prefs(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

  private static SecretKey key() throws Exception {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
    if (store.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) store.getEntry(KEY_ALIAS, null)).getSecretKey();
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
    return generator.generateKey();
  }
}
