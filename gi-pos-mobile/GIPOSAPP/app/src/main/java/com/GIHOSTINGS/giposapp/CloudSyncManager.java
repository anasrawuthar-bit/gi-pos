package com.GIHOSTINGS.giposapp;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public final class CloudSyncManager {
  private static final ExecutorService EXECUTOR=Executors.newSingleThreadExecutor();
  private static final AtomicBoolean RUNNING=new AtomicBoolean(false);
  private static final String PREFS="gi_pos_mobile_sync",LAST_SYNC="last_sync",LAST_ERROR="last_error";
  private CloudSyncManager(){}
  public static void initialSync(Context context)throws Exception{Context app=context.getApplicationContext();SecureStore.Session session=SecureStore.load(app);sync(app,session);}
  public static void syncAsync(Context context){Context app=context.getApplicationContext();if(!RUNNING.compareAndSet(false,true))return;EXECUTOR.execute(()->{SecureStore.Session session=SecureStore.load(app);try{sync(app,session);}catch(Exception error){prefs(app).edit().putString(key(LAST_ERROR,session),message(error)).apply();}finally{RUNNING.set(false);}});}
  public static String lastError(Context context){SecureStore.Session session=SecureStore.load(context);return prefs(context).getString(key(LAST_ERROR,session),"");}
  public static String lastSync(Context context){SecureStore.Session session=SecureStore.load(context);return prefs(context).getString(key(LAST_SYNC,session),"");}
  private static void sync(Context context,SecureStore.Session session)throws Exception{if(session==null||!session.isActive()||session.deviceId.isEmpty()||session.apiKey.isEmpty()||!online(context))return;PosDatabase db=PosDatabase.get(context);pull(context,session,db);for(int batch=0;batch<20;batch++){List<PosDatabase.SyncChange> pending=db.pendingCloudChanges(50);if(pending.isEmpty())break;JSONArray changes=new JSONArray();for(PosDatabase.SyncChange item:pending)changes.put(item.json());JSONObject result=CloudClient.push(session,changes);JSONArray accepted=result.optJSONArray("acceptedIds");List<String> ids=new ArrayList<>();if(accepted!=null)for(int i=0;i<accepted.length();i++)ids.add(accepted.optString(i));if(ids.isEmpty())break;db.markCloudSynced(ids);}prefs(context).edit().putString(key(LAST_SYNC,session),java.time.Instant.now().toString()).remove(key(LAST_ERROR,session)).apply();}
  private static void pull(Context context,SecureStore.Session session,PosDatabase db)throws Exception{String syncKey=key(LAST_SYNC,session);String cursor=prefs(context).getString(syncKey,"1970-01-01T00:00:00.000Z"),serverTime=cursor;for(int page=0;page<20;page++){JSONObject response=CloudClient.pull(session,cursor);JSONArray changes=response.optJSONArray("changes");serverTime=response.optString("serverTime",serverTime);if(changes==null||changes.length()==0)break;List<RemoteValue> values=new ArrayList<>();String latest=cursor;for(int i=0;i<changes.length();i++){JSONObject item=changes.optJSONObject(i);if(item==null)continue;String key=item.optString("key"),updated=item.optString("updatedAt");JSONObject value=item.optJSONObject("value");if(key.startsWith("mobile-v1:")&&value!=null)values.add(new RemoteValue(key,value));if(updated.compareTo(latest)>0)latest=updated;}values.sort(Comparator.comparingInt(item->priority(item.value.optString("type"))));for(RemoteValue item:values)db.applyCloudValue(item.key,item.value);if(changes.length()<500)break;if(latest.equals(cursor))break;cursor=latest;}prefs(context).edit().putString(syncKey,serverTime).apply();}
  private static int priority(String type){if("category".equals(type)||"floor".equals(type)||"customer".equals(type))return 0;if("table".equals(type)||"product".equals(type))return 1;return 2;}
  private static boolean online(Context context){ConnectivityManager manager=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);if(manager==null)return false;Network network=manager.getActiveNetwork();NetworkCapabilities caps=network==null?null:manager.getNetworkCapabilities(network);return caps!=null&&caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);}
  private static String key(String prefix,SecureStore.Session session){return prefix+":"+(session==null||session.restaurantId.isEmpty()?"none":session.restaurantId);}
  private static SharedPreferences prefs(Context context){return context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}private static String message(Throwable error){String text=error.getMessage();return text==null||text.isBlank()?error.getClass().getSimpleName():text;}
  private static final class RemoteValue {final String key;final JSONObject value;RemoteValue(String key,JSONObject value){this.key=key;this.value=value;}}
}
