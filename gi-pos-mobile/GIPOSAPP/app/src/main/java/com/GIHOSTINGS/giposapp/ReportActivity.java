package com.GIHOSTINGS.giposapp;

import android.app.DatePickerDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

public class ReportActivity extends InsetActivity {
  private static final int EXPORT_CSV=401;
  private final int ink=Color.rgb(18,32,51),red=Color.rgb(199,22,55),muted=Color.rgb(99,115,138),teal=Color.rgb(8,127,140),line=Color.rgb(217,226,236),surface=Color.rgb(244,247,250);
  private PosDatabase db;private LocalDate selected=LocalDate.now();private PosDatabase.ReportSummary report;
  private LinearLayout root;

  @Override public void onCreate(Bundle state){super.onCreate(state);if(!requireFeature("reports"))return;db=PosDatabase.get(this);load();}
  private void load(){long from=selected.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli(),to=selected.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();new Thread(()->{PosDatabase.ReportSummary value=db.report(from,to);runOnUiThread(()->{report=value;render();});}).start();}
  private void render(){root=column();root.setPadding(dp(18),dp(18),dp(18),dp(28));root.setBackgroundColor(surface);LinearLayout head=row();head.setGravity(Gravity.CENTER_VERTICAL);LinearLayout title=column();title.addView(text("Daily Report",25,ink,true));title.addView(text(selected.format(DateTimeFormatter.ofPattern("dd MMM yyyy")),13,muted,false));head.addView(title,new LinearLayout.LayoutParams(0,-2,1));root.addView(head);
    LinearLayout toolbar=row();Button date=button("Choose date",Color.WHITE,ink);date.setOnClickListener(v->pickDate());toolbar.addView(date,new LinearLayout.LayoutParams(0,dp(44),1));toolbar.addView(gap());Button print=button("Print",Color.rgb(229,247,249),teal);print.setOnClickListener(v->print());toolbar.addView(print,new LinearLayout.LayoutParams(0,dp(44),1));toolbar.addView(gap());Button csv=button("Export CSV",Color.WHITE,ink);csv.setOnClickListener(v->exportCsv());toolbar.addView(csv,new LinearLayout.LayoutParams(0,dp(44),1));root.addView(toolbar,top(18));
    LinearLayout hero=column();hero.setPadding(dp(18),dp(17),dp(18),dp(17));hero.setBackground(shape(red,14,0,red));hero.addView(text("Total sales",13,Color.rgb(255,220,227),true));hero.addView(text("Rs. "+money(report.sales),30,Color.WHITE,true),top(3));hero.addView(text(report.bills+" bill(s)  ·  "+qty(report.totalQuantity)+" item(s)",13,Color.WHITE,false),top(5));root.addView(hero,top(16));
    LinearLayout payments=panel("Payment summary");payments.addView(pair("Cash",report.cash));payments.addView(pair("UPI",report.upi),top(9));payments.addView(pair("Card",report.card),top(9));if(report.due>0)payments.addView(pair("Due",report.due),top(9));root.addView(payments,top(12));
    LinearLayout summary=panel("Sales details");summary.addView(pair("Tax collected",report.tax));summary.addView(pair("Discount",report.discount),top(9));summary.addView(pair("Average bill",report.bills==0?0:report.sales/report.bills),top(9));root.addView(summary,top(12));
    LinearLayout sold=panel("Items sold");if(report.items.isEmpty())sold.addView(text("No completed sales for this date.",14,muted,false),top(12));else{LinearLayout labels=row();labels.addView(text("Item",12,muted,true),new LinearLayout.LayoutParams(0,-2,1));labels.addView(right("Qty",12,muted,true,dp(58)));labels.addView(right("Amount",12,muted,true,dp(92)));sold.addView(labels,top(12));for(PosDatabase.ReportItem item:report.items){LinearLayout itemRow=row();itemRow.setGravity(Gravity.CENTER_VERTICAL);TextView name=text(item.name,14,ink,false);name.setMaxLines(2);itemRow.addView(name,new LinearLayout.LayoutParams(0,-2,1));itemRow.addView(right(qty(item.quantity),14,ink,true,dp(58)));itemRow.addView(right(money(item.amount),14,ink,true,dp(92)));sold.addView(itemRow,top(11));}}root.addView(sold,top(12));ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.addView(root);setContentView(MobileBottomNavigation.wrap(this,scroll,MobileBottomNavigation.Destination.REPORT));}
  private void pickDate(){DatePickerDialog dialog=new DatePickerDialog(this,(picker,year,month,day)->{selected=LocalDate.of(year,month+1,day);load();},selected.getYear(),selected.getMonthValue()-1,selected.getDayOfMonth());dialog.getDatePicker().setMaxDate(System.currentTimeMillis());dialog.show();}
  private void print(){if(report==null)return;boolean queued=db.queueReportPrint(report);PrintDispatcher.processAsync(this);Toast.makeText(this,queued?"Report queued for printing":"Report is already queued",Toast.LENGTH_SHORT).show();}
  private void exportCsv(){if(report==null)return;Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("text/csv");intent.putExtra(Intent.EXTRA_TITLE,"gi-pos-report-"+selected+".csv");startActivityForResult(intent,EXPORT_CSV);}
  @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request!=EXPORT_CSV||result!=RESULT_OK||data==null||data.getData()==null)return;Uri uri=data.getData();try(OutputStream output=getContentResolver().openOutputStream(uri)){if(output==null)throw new IllegalStateException("Cannot open selected file");output.write(csv().getBytes(StandardCharsets.UTF_8));Toast.makeText(this,"Report exported",Toast.LENGTH_SHORT).show();}catch(Exception error){Toast.makeText(this,"Export failed: "+error.getMessage(),Toast.LENGTH_LONG).show();}}
  private String csv(){StringBuilder out=new StringBuilder("GI POS Daily Report,").append(selected).append("\n\nSummary,Amount\nTotal sales,").append(money(report.sales)).append("\nBills,").append(report.bills).append("\nTotal quantity,").append(qty(report.totalQuantity)).append("\nCash,").append(money(report.cash)).append("\nUPI,").append(money(report.upi)).append("\nCard,").append(money(report.card)).append("\nDue,").append(money(report.due)).append("\nTax,").append(money(report.tax)).append("\nDiscount,").append(money(report.discount)).append("\n\nItem,Quantity,Amount\n");for(PosDatabase.ReportItem item:report.items)out.append('"').append(item.name.replace("\"","\"\"")).append("\",").append(qty(item.quantity)).append(',').append(money(item.amount)).append('\n');return out.toString();}
  private LinearLayout panel(String title){LinearLayout value=column();value.setPadding(dp(16),dp(15),dp(16),dp(16));value.setBackground(shape(Color.WHITE,13,1,line));value.addView(text(title,17,ink,true));return value;}private LinearLayout pair(String label,double amount){LinearLayout value=row();value.setGravity(Gravity.CENTER_VERTICAL);value.addView(text(label,14,muted,false),new LinearLayout.LayoutParams(0,-2,1));value.addView(text("Rs. "+money(amount),15,ink,true));return value;}private TextView right(String value,int size,int color,boolean bold,int width){TextView view=text(value,size,color,bold);view.setGravity(Gravity.RIGHT);view.setLayoutParams(new LinearLayout.LayoutParams(width,-2));return view;}private LinearLayout column(){LinearLayout value=new LinearLayout(this);value.setOrientation(LinearLayout.VERTICAL);return value;}private LinearLayout row(){LinearLayout value=new LinearLayout(this);value.setOrientation(LinearLayout.HORIZONTAL);return value;}private TextView text(String value,int size,int color,boolean bold){TextView view=new TextView(this);view.setText(value);view.setTextSize(size);view.setTextColor(color);if(bold)view.setTypeface(Typeface.DEFAULT_BOLD);return view;}private Button button(String value,int fill,int color){Button view=new Button(this);view.setText(value);view.setAllCaps(false);view.setTextColor(color);view.setTypeface(Typeface.DEFAULT_BOLD);view.setBackground(shape(fill,9,1,line));return view;}private GradientDrawable shape(int fill,int radius,int stroke,int strokeColor){GradientDrawable value=new GradientDrawable();value.setColor(fill);value.setCornerRadius(dp(radius));if(stroke>0)value.setStroke(dp(stroke),strokeColor);return value;}private LinearLayout.LayoutParams top(int margin){LinearLayout.LayoutParams value=new LinearLayout.LayoutParams(-1,-2);value.topMargin=dp(margin);return value;}private View gap(){View value=new View(this);value.setLayoutParams(new LinearLayout.LayoutParams(dp(7),1));return value;}private String money(double value){return String.format(Locale.US,"%.2f",value);}private String qty(double value){return Math.rint(value)==value?String.valueOf((long)value):String.format(Locale.US,"%.2f",value);}private int dp(int value){return(int)(value*getResources().getDisplayMetrics().density);}
}
