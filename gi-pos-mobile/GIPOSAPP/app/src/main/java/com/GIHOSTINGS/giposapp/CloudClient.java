package com.GIHOSTINGS.giposapp;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

public final class CloudClient {
  public static final class Result {
    public final JSONObject session;
    Result(JSONObject session) { this.session = session; }
  }

  private CloudClient() {}

  public static Result activate(String serverInput, String login, String password, String fingerprint, SecureStore.Session existingSession) throws Exception {
    String server = normalizeServer(serverInput);
    JSONObject loginResponse = request(server + "/api/v1/client/login", "POST", null,
      new JSONObject().put("login", login.trim()).put("password", password).put("appPlatform", "android"));
    String token = loginResponse.optString("token");
    if (token.isBlank()) throw new Exception("The server did not return a valid session.");

    JSONObject me = request(server + "/api/v1/client/me", "GET", token, null);
    JSONObject restaurant = selectRestaurant(me.optJSONArray("restaurants"), existingSession == null ? "" : existingSession.restaurantId);
    if (restaurant == null) throw new Exception("No approved restaurant with an active license was found.");

    String restaurantId = restaurant.optString("id");
    boolean reuseActivation = existingSession != null
      && server.equals(existingSession.serverUrl)
      && restaurantId.equals(existingSession.restaurantId)
      && !existingSession.deviceId.isBlank()
      && !existingSession.apiKey.isBlank();
    if (reuseActivation) {
      try {
        String now = URLEncoder.encode(Instant.now().toString(), StandardCharsets.UTF_8.name());
        deviceRequest(server + "/api/v1/sync/pull?since=" + now, "GET", existingSession, null);
      } catch (Exception ignored) {
        reuseActivation = false;
      }
    }
    JSONObject activation = reuseActivation ? null : request(server + "/api/v1/client/restaurants/" + restaurantId + "/devices/activate", "POST", token,
      new JSONObject().put("deviceName", "GI POS Mobile").put("platform", "android").put("deviceFingerprint", fingerprint));

    JSONObject account = loginResponse.optJSONObject("account");
    JSONObject activeRestaurant = reuseActivation ? restaurant : activation.optJSONObject("restaurant");
    JSONObject subscription = reuseActivation ? subscriptionFromRestaurant(restaurant) : activation.optJSONObject("subscription");
    JSONObject device = reuseActivation ? null : activation.optJSONObject("device");
    JSONObject offlineLicense = reuseActivation ? null : activation.optJSONObject("offlineLicense");
    String expiry = first(subscription, "expires_at", "expiresAt");
    if (expiry.isBlank()) expiry = restaurant.optString("expires_at");
    String activatedAt = offlineLicense == null ? Instant.now().toString() : offlineLicense.optString("activatedAt", Instant.now().toString());

    JSONObject session = new JSONObject()
      .put("serverUrl", server).put("token", token).put("restaurantId", restaurantId)
      .put("businessName", activeRestaurant == null ? restaurant.optString("name") : activeRestaurant.optString("name"))
      .put("ownerName", account == null ? "Owner" : account.optString("ownerName", "Owner"))
      .put("planId", first(subscription, "plan_id", "planId"))
      .put("plan", first(subscription, "plan_name", "planName"))
      .put("capabilities", subscription == null ? new JSONObject() : subscription.optJSONObject("plan_capabilities"))
      .put("status", subscription == null ? restaurant.optString("subscription_status") : subscription.optString("status"))
      .put("activatedAt", activatedAt).put("expiresAt", expiry)
      .put("deviceId", reuseActivation ? existingSession.deviceId : device == null ? "" : device.optString("id"))
      .put("apiKey", reuseActivation ? existingSession.apiKey : activation.optString("apiKey"));
    SecureStore.Session checked = new SecureStore.Session(session);
    if (!checked.isActive()) throw new Exception("The restaurant license is inactive or expired.");
    return new Result(session);
  }

  private static JSONObject subscriptionFromRestaurant(JSONObject restaurant) throws Exception {
    return new JSONObject()
      .put("plan_id", restaurant.optString("plan_id"))
      .put("plan_name", restaurant.optString("plan_name"))
      .put("plan_capabilities", restaurant.optJSONObject("plan_capabilities"))
      .put("status", restaurant.optString("subscription_status"))
      .put("starts_at", restaurant.optString("starts_at"))
      .put("expires_at", restaurant.optString("expires_at"));
  }

  public static JSONObject push(SecureStore.Session session,JSONArray changes)throws Exception{return deviceRequest(session.serverUrl+"/api/v1/sync/push","POST",session,new JSONObject().put("changes",changes));}
  public static JSONObject pull(SecureStore.Session session,String since)throws Exception{return deviceRequest(session.serverUrl+"/api/v1/sync/pull?since="+URLEncoder.encode(since==null?"":since,StandardCharsets.UTF_8.name()),"GET",session,null);}

  private static JSONObject selectRestaurant(JSONArray restaurants, String preferredRestaurantId) {
    if (restaurants == null) return null;
    JSONObject firstActive = null;
    for (int index = 0; index < restaurants.length(); index++) {
      JSONObject item = restaurants.optJSONObject(index);
      if (item == null || !"approved".equalsIgnoreCase(item.optString("status"))) continue;
      String status = item.optString("subscription_status");
      String expiry = item.optString("expires_at");
      boolean active = "active".equalsIgnoreCase(status) || "trial".equalsIgnoreCase(status);
      boolean current;
      try { current = !expiry.isBlank() && Instant.parse(expiry).isAfter(Instant.now()); } catch (Exception ignored) { current = false; }
      if (active && current && item.optString("id").equals(preferredRestaurantId)) return item;
      if (active && current && firstActive == null) firstActive = item;
    }
    return firstActive;
  }

  private static JSONObject request(String endpoint, String method, String token, JSONObject body) throws Exception {
    HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
    connection.setRequestMethod(method); connection.setConnectTimeout(12_000); connection.setReadTimeout(20_000);
    connection.setRequestProperty("Accept", "application/json");
    if (token != null && !token.isBlank()) connection.setRequestProperty("x-client-token", token);
    if (body != null) {
      connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
      connection.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));
    }
    int code = connection.getResponseCode();
    InputStream stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
    String raw = stream == null ? "" : readUtf8(stream);
    JSONObject response = raw.isBlank() ? new JSONObject() : new JSONObject(raw);
    connection.disconnect();
    if (code < 200 || code >= 300 || !response.optBoolean("ok", false)) throw new Exception(response.optString("error", "Server connection failed (" + code + ")."));
    return response;
  }
  private static JSONObject deviceRequest(String endpoint,String method,SecureStore.Session session,JSONObject body)throws Exception{HttpURLConnection connection=(HttpURLConnection)new URL(endpoint).openConnection();connection.setRequestMethod(method);connection.setConnectTimeout(12_000);connection.setReadTimeout(25_000);connection.setRequestProperty("Accept","application/json");connection.setRequestProperty("x-restaurant-id",session.restaurantId);connection.setRequestProperty("x-device-id",session.deviceId);connection.setRequestProperty("x-api-key",session.apiKey);if(body!=null){connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json; charset=utf-8");connection.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));}int code=connection.getResponseCode();InputStream stream=code>=200&&code<300?connection.getInputStream():connection.getErrorStream();String raw=stream==null?"":readUtf8(stream);JSONObject response=raw.isBlank()?new JSONObject():new JSONObject(raw);connection.disconnect();if(code<200||code>=300||!response.optBoolean("ok",false))throw new Exception(response.optString("error","Cloud sync failed ("+code+")"));return response;}

  private static String normalizeServer(String input) throws Exception {
    String value = input == null ? "" : input.trim().replaceAll("/+$", "");
    URI uri = URI.create(value);
    if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme())) || uri.getHost() == null) throw new Exception("Enter a valid server address.");
    if (!"https".equalsIgnoreCase(uri.getScheme())) throw new Exception("Secure sign-in requires an HTTPS server address.");
    return value;
  }

  private static String first(JSONObject value, String snake, String camel) {
    if (value == null) return "";
    String result = value.optString(snake); return result.isBlank() ? value.optString(camel) : result;
  }

  private static String readUtf8(InputStream stream) throws Exception {
    try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192];
      int count;
      while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
      return output.toString(StandardCharsets.UTF_8.name());
    }
  }
}
