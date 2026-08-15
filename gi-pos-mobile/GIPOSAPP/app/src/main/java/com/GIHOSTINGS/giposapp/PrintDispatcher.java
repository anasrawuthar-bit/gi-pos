package com.GIHOSTINGS.giposapp;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class PrintDispatcher {
  private static final UUID SPP=UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
  private static final ExecutorService EXECUTOR=Executors.newSingleThreadExecutor();
  private PrintDispatcher(){}
  public interface Callback{void complete(boolean success,String message);}
  public static void processAsync(Context context){Context app=context.getApplicationContext();EXECUTOR.execute(()->process(app));}
  public static void testAsync(Context context,PosDatabase.PrinterProfile profile,Callback callback){Context app=context.getApplicationContext();EXECUTOR.execute(()->{try{send(app,profile,EscPosFormatter.testPage(profile));if(callback!=null)callback.complete(true,"Test print sent");}catch(Exception error){if(callback!=null)callback.complete(false,message(error));}});}
  private static void process(Context context){PosDatabase db=PosDatabase.get(context);for(PosDatabase.PrintJobInfo job:db.pendingPrintJobs()){PosDatabase.PrinterProfile printer=db.printerFor(job.type);if(printer==null){db.updatePrintJob(job.id,"retry","Configure a "+("kot".equals(job.type)?"KOT":"bill")+" printer");continue;}try{db.updatePrintJob(job.id,"printing","");byte[] bytes=EscPosFormatter.format(job.type,job.payload,printer.paperWidth);if(bytes.length<10)throw new IllegalStateException("Print document is empty");send(context,printer,bytes);db.updatePrintJob(job.id,"done","");}catch(Exception error){db.updatePrintJob(job.id,job.attempts+1>=3?"failed":"retry",message(error));}}}
  private static void send(Context context,PosDatabase.PrinterProfile profile,byte[] bytes)throws Exception{if("bluetooth".equals(profile.connectionType))sendBluetooth(context,profile.address,bytes);else sendNetwork(profile.address,profile.port,bytes);}
  private static void sendNetwork(String host,int port,byte[] bytes)throws Exception{try(Socket socket=new Socket()){socket.connect(new InetSocketAddress(host,port),5000);socket.setSoTimeout(5000);OutputStream output=socket.getOutputStream();output.write(bytes);output.flush();}}
  private static void sendBluetooth(Context context,String address,byte[] bytes)throws Exception{if(Build.VERSION.SDK_INT>=31&&context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED)throw new SecurityException("Bluetooth permission is required");BluetoothManager manager=(BluetoothManager)context.getSystemService(Context.BLUETOOTH_SERVICE);BluetoothAdapter adapter=manager==null?null:manager.getAdapter();if(adapter==null||!adapter.isEnabled())throw new IllegalStateException("Bluetooth is turned off");BluetoothDevice device=adapter.getRemoteDevice(address);try(BluetoothSocket socket=device.createRfcommSocketToServiceRecord(SPP)){socket.connect();OutputStream output=socket.getOutputStream();for(int offset=0;offset<bytes.length;offset+=512){int length=Math.min(512,bytes.length-offset);output.write(bytes,offset,length);output.flush();if(offset+length<bytes.length)Thread.sleep(12);}}}
  private static String message(Throwable error){String text=error.getMessage();return text==null||text.trim().isEmpty()?error.getClass().getSimpleName():text;}
}
