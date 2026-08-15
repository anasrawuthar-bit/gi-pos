package com.GIHOSTINGS.giposapp;

import android.Manifest;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.activity.OnBackPressedCallback;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class PrinterActivity extends InsetActivity {
  private static final int BLUETOOTH_PERMISSION_REQUEST=301;
  private final int ink=Color.rgb(18,32,51),red=Color.rgb(199,22,55),muted=Color.rgb(99,115,138),teal=Color.rgb(8,127,140),line=Color.rgb(217,226,236),surface=Color.rgb(244,247,250);
  private PosDatabase db;
  private String editingId="";
  private EditText name,address,port;
  private Spinner connection,device,paper,role;
  private CheckBox primary;
  private LinearLayout networkFields,bluetoothFields;
  private final List<String> deviceAddresses=new ArrayList<>();

  @Override public void onCreate(Bundle state){super.onCreate(state);if(!requireFeature("bluetoothPrinting","networkPrinting"))return;db=PosDatabase.get(this);getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){if(name!=null)showList();else{setEnabled(false);getOnBackPressedDispatcher().onBackPressed();}}});showList();}
  @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==BLUETOOTH_PERMISSION_REQUEST&&name!=null)loadPairedDevices();}

  private void showList(){clearEditorReferences();LinearLayout content=column();content.setPadding(dp(18),dp(18),dp(18),dp(24));content.setBackgroundColor(surface);content.addView(header("Printers","Bill and KOT printer connections",this::finish));
    List<PosDatabase.PrinterProfile> profiles=db.printerProfiles();
    LinearLayout summary=row();summary.setGravity(Gravity.CENTER_VERTICAL);LinearLayout summaryText=column();summaryText.addView(text("Saved printers",18,ink,true));summaryText.addView(text(profiles.size()+" configured",13,muted,false));summary.addView(summaryText,new LinearLayout.LayoutParams(0,-2,1));Button add=button("+ Add printer",red,Color.WHITE);add.setOnClickListener(v->showEditor(null));summary.addView(add,new LinearLayout.LayoutParams(-2,dp(46)));content.addView(summary,top(22));
    if(profiles.isEmpty()){LinearLayout empty=column();empty.setGravity(Gravity.CENTER);empty.setPadding(dp(24),dp(38),dp(24),dp(38));empty.setBackground(shape(Color.WHITE,14,1,line));empty.addView(text("No printer configured",19,ink,true));TextView hint=text("Add a Bluetooth or network thermal printer before printing bills or KOTs.",14,muted,false);hint.setGravity(Gravity.CENTER);empty.addView(hint,top(8));content.addView(empty,top(14));}
    for(PosDatabase.PrinterProfile profile:profiles)content.addView(printerCard(profile),top(12));
    int pending=db.pendingPrintCount();if(pending>0){TextView queued=text(pending+" print job(s) waiting",13,Color.rgb(146,64,14),true);queued.setPadding(dp(14),dp(12),dp(14),dp(12));queued.setBackground(shape(Color.rgb(255,247,220),10,1,Color.rgb(245,202,116)));content.addView(queued,top(16));}
    ScrollView scroll=new ScrollView(this);scroll.addView(content);setContentView(scroll);
  }

  private View printerCard(PosDatabase.PrinterProfile profile){LinearLayout card=column();card.setPadding(dp(16),dp(15),dp(16),dp(15));card.setBackground(shape(Color.WHITE,13,1,line));LinearLayout top=row();top.setGravity(Gravity.CENTER_VERTICAL);LinearLayout label=column();String badge=profile.isDefault?"  •  Primary":"";label.addView(text(profile.name+badge,17,ink,true));String target="bluetooth".equals(profile.connectionType)?"Bluetooth · "+profile.address:"Network · "+profile.address+":"+profile.port;label.addView(text(target,13,muted,false),top(3));top.addView(label,new LinearLayout.LayoutParams(0,-2,1));Button edit=button("Edit",Color.rgb(241,245,249),ink);edit.setOnClickListener(v->showEditor(profile));top.addView(edit,new LinearLayout.LayoutParams(dp(78),dp(42)));card.addView(top);LinearLayout tags=row();tags.setPadding(0,dp(12),0,0);tags.addView(tag("POS "+profile.paperWidth+"mm"));tags.addView(tag(roleLabel(profile.role)),left(7));tags.addView(new View(this),new LinearLayout.LayoutParams(0,1,1));Button test=button("Test print",Color.rgb(229,247,249),teal);test.setOnClickListener(v->test(profile,test));tags.addView(test,new LinearLayout.LayoutParams(dp(108),dp(40)));card.addView(tags);return card;}

  private void showEditor(PosDatabase.PrinterProfile profile){editingId=profile==null?"":profile.id;LinearLayout content=column();content.setPadding(dp(18),dp(18),dp(18),dp(30));content.setBackgroundColor(surface);LinearLayout actionHeader=header(profile==null?"Add Printer":"Edit Printer","Configure one reliable print destination",this::showList);Button save=button("Save",red,Color.WHITE);save.setOnClickListener(v->save());actionHeader.addView(save,new LinearLayout.LayoutParams(dp(88),dp(44)));content.addView(actionHeader);
    LinearLayout form=column();form.setPadding(dp(16),dp(16),dp(16),dp(18));form.setBackground(shape(Color.WHITE,14,1,line));form.addView(section("Printer details","Give this connection a name your team understands."));name=input("Example: Counter bill printer");form.addView(field("Printer name",name));
    connection=spinner(new String[]{"Bluetooth printer","Network printer"});form.addView(field("Connection",connection));
    bluetoothFields=column();device=spinner(new String[]{"No paired printer found"});bluetoothFields.addView(field("Paired device",device));Button pair=button("Open Bluetooth settings",Color.rgb(241,245,249),ink);pair.setOnClickListener(v->startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)));bluetoothFields.addView(pair,top(8));form.addView(bluetoothFields);
    networkFields=column();address=input("192.168.1.50");port=input("9100");port.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);networkFields.addView(field("Printer IP address",address));networkFields.addView(field("Port",port));form.addView(networkFields);
    paper=spinner(new String[]{"POS 80mm","POS 58mm"});form.addView(field("Paper width",paper));role=spinner(new String[]{"Bill and KOT","Bills only","KOT only"});form.addView(field("Printer role",role));primary=new CheckBox(this);primary.setText("Use as primary printer for this role");primary.setTextColor(ink);primary.setTextSize(15);form.addView(primary,top(10));
    TextView note=text("Bluetooth printers must first be paired in Android settings. Network printers must be reachable on the same Wi-Fi/LAN and usually use port 9100.",13,muted,false);note.setPadding(dp(12),dp(12),dp(12),dp(12));note.setBackground(shape(Color.rgb(248,250,252),10,1,line));form.addView(note,top(14));content.addView(form,top(18));
    if(profile!=null){name.setText(profile.name);connection.setSelection("bluetooth".equals(profile.connectionType)?0:1);address.setText(profile.address);port.setText(String.valueOf(profile.port));paper.setSelection(profile.paperWidth==58?1:0);role.setSelection("bill".equals(profile.role)?1:"kot".equals(profile.role)?2:0);primary.setChecked(profile.isDefault);Button delete=button("Delete printer",Color.rgb(255,241,242),red);delete.setOnClickListener(v->confirmDelete(profile));content.addView(delete,top(14));}
    connection.setOnItemSelectedListener(new SimpleItemSelectedListener(position->toggleConnection(position==0)));toggleConnection(connection.getSelectedItemPosition()==0);loadPairedDevices();
    ScrollView scroll=new ScrollView(this);scroll.addView(content);setContentView(scroll);
  }

  private void toggleConnection(boolean bluetooth){bluetoothFields.setVisibility(bluetooth?View.VISIBLE:View.GONE);networkFields.setVisibility(bluetooth?View.GONE:View.VISIBLE);}
  private void loadPairedDevices(){if(device==null)return;if(Build.VERSION.SDK_INT>=31&&checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT,Manifest.permission.BLUETOOTH_SCAN},BLUETOOTH_PERMISSION_REQUEST);return;}BluetoothManager manager=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);BluetoothAdapter adapter=manager==null?null:manager.getAdapter();List<String> labels=new ArrayList<>();deviceAddresses.clear();if(adapter!=null){Set<BluetoothDevice> bonded=adapter.getBondedDevices();List<BluetoothDevice> sorted=new ArrayList<>(bonded);sorted.sort(Comparator.comparing(d->{String n=d.getName();return n==null?"":n.toLowerCase(Locale.US);}));for(BluetoothDevice item:sorted){String n=item.getName();labels.add((n==null||n.isBlank()?"Thermal printer":n)+"  ·  "+item.getAddress());deviceAddresses.add(item.getAddress());}}if(labels.isEmpty())labels.add("No paired printer found");device.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,labels));if(!editingId.isEmpty()&&address!=null){String current=address.getText().toString();int index=deviceAddresses.indexOf(current);if(index>=0)device.setSelection(index);}}

  private void save(){String printerName=name.getText().toString().trim();boolean bluetooth=connection.getSelectedItemPosition()==0;String target=bluetooth?(deviceAddresses.isEmpty()?"":deviceAddresses.get(Math.min(device.getSelectedItemPosition(),deviceAddresses.size()-1))):address.getText().toString().trim();int targetPort=9100;try{targetPort=Integer.parseInt(port.getText().toString().trim());}catch(Exception ignored){}if(printerName.isEmpty()){name.setError("Enter a printer name");return;}if(target.isEmpty()){Toast.makeText(this,bluetooth?"Pair and select a Bluetooth printer":"Enter the printer IP address",Toast.LENGTH_LONG).show();return;}String selectedRole=role.getSelectedItemPosition()==1?"bill":role.getSelectedItemPosition()==2?"kot":"both";PosDatabase.PrinterProfile profile=new PosDatabase.PrinterProfile(editingId,printerName,bluetooth?"bluetooth":"network",target,targetPort,paper.getSelectedItemPosition()==1?58:80,selectedRole,primary.isChecked());db.savePrinter(profile);Toast.makeText(this,"Printer saved",Toast.LENGTH_SHORT).show();PrintDispatcher.processAsync(this);showList();}
  private void test(PosDatabase.PrinterProfile profile,Button button){button.setEnabled(false);button.setText("Sending…");PrintDispatcher.testAsync(this,profile,(success,message)->runOnUiThread(()->{button.setEnabled(true);button.setText("Test print");Toast.makeText(this,message,success?Toast.LENGTH_SHORT:Toast.LENGTH_LONG).show();}));}
  private void confirmDelete(PosDatabase.PrinterProfile profile){new AlertDialog.Builder(this).setTitle("Delete printer?").setMessage(profile.name+" will no longer receive bills or KOTs.").setNegativeButton("Cancel",null).setPositiveButton("Delete",(d,w)->{db.removePrinter(profile.id);Toast.makeText(this,"Printer deleted",Toast.LENGTH_SHORT).show();showList();}).show();}
  private String roleLabel(String value){return "bill".equals(value)?"Bills":"kot".equals(value)?"KOT":"Bills + KOT";}

  private LinearLayout header(String title,String detail,Runnable back){LinearLayout head=row();head.setGravity(Gravity.CENTER_VERTICAL);Button close=button("‹",Color.WHITE,ink);close.setTextSize(24);close.setOnClickListener(v->back.run());head.addView(close,new LinearLayout.LayoutParams(dp(44),dp(44)));LinearLayout copy=column();copy.setPadding(dp(11),0,dp(8),0);copy.addView(text(title,25,ink,true));copy.addView(text(detail,13,muted,false));head.addView(copy,new LinearLayout.LayoutParams(0,-2,1));return head;}
  private LinearLayout section(String title,String detail){LinearLayout box=column();box.addView(text(title,18,ink,true));box.addView(text(detail,13,muted,false),top(3));return box;}
  private LinearLayout field(String label,View control){LinearLayout box=column();box.addView(text(label,13,muted,true));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(48));p.topMargin=dp(6);box.addView(control,p);LinearLayout.LayoutParams outer=new LinearLayout.LayoutParams(-1,-2);outer.topMargin=dp(15);box.setLayoutParams(outer);return box;}
  private EditText input(String hint){EditText value=new EditText(this);value.setHint(hint);value.setHintTextColor(muted);value.setSingleLine();value.setTextSize(15);value.setTextColor(ink);value.setPadding(dp(12),0,dp(12),0);value.setBackground(shape(Color.rgb(248,250,252),9,1,line));return value;}
  private Spinner spinner(String[] values){Spinner value=new Spinner(this);value.setPadding(dp(8),0,dp(8),0);value.setBackground(shape(Color.rgb(248,250,252),9,1,line));value.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,values));return value;}
  private TextView tag(String value){TextView tag=text(value,12,teal,true);tag.setGravity(Gravity.CENTER);tag.setPadding(dp(10),0,dp(10),0);tag.setBackground(shape(Color.rgb(229,247,249),18,1,Color.rgb(148,210,218)));return tag;}
  private void clearEditorReferences(){name=null;address=null;port=null;connection=null;device=null;paper=null;role=null;primary=null;networkFields=null;bluetoothFields=null;editingId="";}
  private LinearLayout column(){LinearLayout value=new LinearLayout(this);value.setOrientation(LinearLayout.VERTICAL);return value;}private LinearLayout row(){LinearLayout value=new LinearLayout(this);value.setOrientation(LinearLayout.HORIZONTAL);return value;}private TextView text(String value,int size,int color,boolean bold){TextView view=new TextView(this);view.setText(value);view.setTextSize(size);view.setTextColor(color);if(bold)view.setTypeface(Typeface.DEFAULT_BOLD);return view;}private Button button(String value,int fill,int color){Button view=new Button(this);view.setText(value);view.setAllCaps(false);view.setTextColor(color);view.setTypeface(Typeface.DEFAULT_BOLD);view.setBackground(shape(fill,9,1,line));return view;}private GradientDrawable shape(int fill,int radius,int stroke,int strokeColor){GradientDrawable value=new GradientDrawable();value.setColor(fill);value.setCornerRadius(dp(radius));if(stroke>0)value.setStroke(dp(stroke),strokeColor);return value;}private LinearLayout.LayoutParams top(int margin){LinearLayout.LayoutParams value=new LinearLayout.LayoutParams(-1,-2);value.topMargin=dp(margin);return value;}private LinearLayout.LayoutParams left(int margin){LinearLayout.LayoutParams value=new LinearLayout.LayoutParams(-2,dp(34));value.leftMargin=dp(margin);return value;}private int dp(int value){return(int)(value*getResources().getDisplayMetrics().density);}
}
