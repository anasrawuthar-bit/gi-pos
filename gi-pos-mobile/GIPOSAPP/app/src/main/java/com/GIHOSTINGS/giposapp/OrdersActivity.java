package com.GIHOSTINGS.giposapp;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class OrdersActivity extends InsetActivity {
  private final int ink=Color.rgb(18,32,51),red=Color.rgb(199,22,55),muted=Color.rgb(99,115,138),teal=Color.rgb(8,127,140),line=Color.rgb(217,226,236);
  private final ArrayList<PosDatabase.OrderListItem> orders=new ArrayList<>();
  private PosDatabase db; private ListView list; private TextView summary,empty; private Button activeButton,completedButton; private boolean active=true;

  @Override public void onCreate(Bundle saved){super.onCreate(saved);if(!requireFeature("billing"))return;db=PosDatabase.get(this);build();}
  @Override protected void onResume(){super.onResume();load();}

  private void build(){
    LinearLayout root=column();root.setPadding(dp(16),dp(14),dp(16),dp(14));root.setBackgroundColor(Color.rgb(244,247,250));
    LinearLayout header=row();header.setGravity(Gravity.CENTER_VERTICAL);Button back=button("<",Color.WHITE,ink);back.setTextSize(20);back.setOnClickListener(v->finish());header.addView(back,new LinearLayout.LayoutParams(dp(44),dp(44)));LinearLayout title=column();title.setPadding(dp(10),0,0,0);title.addView(text("Orders",24,ink,true));title.addView(text("Resume service or review today's bills",13,muted,false));header.addView(title,new LinearLayout.LayoutParams(0,-2,1));root.addView(header);
    LinearLayout filters=row();activeButton=button("Open",red,Color.WHITE);completedButton=button("Completed Today",Color.WHITE,ink);activeButton.setOnClickListener(v->{active=true;styleFilters();load();});completedButton.setOnClickListener(v->{active=false;styleFilters();load();});filters.addView(activeButton,new LinearLayout.LayoutParams(0,dp(46),1));filters.addView(gap());filters.addView(completedButton,new LinearLayout.LayoutParams(0,dp(46),1));root.addView(filters,top(16));
    summary=text("Loading",13,muted,true);summary.setPadding(dp(13),dp(11),dp(13),dp(11));summary.setBackground(shape(Color.WHITE,10,1,line));root.addView(summary,top(10));
    list=new ListView(this);list.setDivider(null);list.setDividerHeight(dp(8));list.setPadding(0,dp(10),0,0);list.setClipToPadding(false);list.setAdapter(new OrderAdapter());list.setOnItemClickListener((parent,view,position,id)->open(orders.get(position)));root.addView(list,new LinearLayout.LayoutParams(-1,0,1));
    empty=text("No open orders",17,muted,true);empty.setGravity(Gravity.CENTER);empty.setPadding(dp(20),dp(40),dp(20),dp(40));list.setEmptyView(empty);root.addView(empty,new LinearLayout.LayoutParams(-1,0,1));
    setContentView(root);styleFilters();
  }

  private void load(){
    final boolean requestedActive=active;
    new Thread(()->{List<PosDatabase.OrderListItem> result;if(requestedActive)result=db.activeOrders();else{LocalDate day=LocalDate.now();long from=day.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();long to=day.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();result=db.completedOrders(from,to);}double total=0;for(PosDatabase.OrderListItem item:result)total+=item.total;final double amount=total;runOnUiThread(()->{if(requestedActive!=active)return;orders.clear();orders.addAll(result);((BaseAdapter)list.getAdapter()).notifyDataSetChanged();summary.setText(result.size()+" order(s)  /  Rs. "+money(amount));empty.setText(requestedActive?"No open orders":"No completed bills today");});}).start();
  }

  private void open(PosDatabase.OrderListItem item){Intent intent;if("paid".equals(item.status)||"due".equals(item.status)){intent=new Intent(this,SaleSuccessActivity.class);intent.putExtra("orderId",item.id);}else{intent=new Intent(this,OrderActivity.class);intent.putExtra("orderId",item.id);intent.putExtra("tableName",item.tableName);}startActivity(intent);}
  private void styleFilters(){activeButton.setBackground(shape(active?red:Color.WHITE,9,1,active?red:line));activeButton.setTextColor(active?Color.WHITE:ink);completedButton.setBackground(shape(active?Color.WHITE:red,9,1,active?line:red));completedButton.setTextColor(active?ink:Color.WHITE);}

  private final class OrderAdapter extends BaseAdapter {
    public int getCount(){return orders.size();}public Object getItem(int p){return orders.get(p);}public long getItemId(int p){return p;}
    public View getView(int position,View old,ViewGroup parent){PosDatabase.OrderListItem item=orders.get(position);LinearLayout card=row();card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(14),dp(13),dp(12),dp(13));int fill="held".equals(item.status)?Color.rgb(255,248,220):"unclosed".equals(item.status)||"kot".equals(item.status)?Color.rgb(235,248,250):Color.WHITE;card.setBackground(shape(fill,11,1,line));LinearLayout main=column();String number=item.billNumber!=null?"Bill #"+item.billNumber:item.kotNumber!=null?"KOT #"+item.kotNumber:"New order";main.addView(text(item.tableName+"  /  "+number,16,ink,true));main.addView(text(item.itemCount+" item(s)  /  "+date(item.updatedAt),12,muted,false),top(4));card.addView(main,new LinearLayout.LayoutParams(0,-2,1));LinearLayout right=column();right.setGravity(Gravity.END);right.addView(text(item.status.toUpperCase(Locale.US),11,"held".equals(item.status)?Color.rgb(154,96,0):teal,true));right.addView(text("Rs. "+money(item.total),16,ink,true),top(5));card.addView(right);return card;}
  }

  private String date(long value){return DateTimeFormatter.ofPattern("hh:mm a",Locale.US).format(java.time.Instant.ofEpochMilli(value).atZone(ZoneId.systemDefault()));}
  private String money(double value){return String.format(Locale.US,"%.2f",value);}private LinearLayout column(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v;}private LinearLayout row(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.HORIZONTAL);return v;}private TextView text(String s,int z,int c,boolean b){TextView v=new TextView(this);v.setText(s);v.setTextSize(z);v.setTextColor(c);if(b)v.setTypeface(Typeface.DEFAULT_BOLD);return v;}private Button button(String s,int fill,int color){Button b=new Button(this);b.setText(s);b.setAllCaps(false);b.setTextColor(color);b.setTypeface(Typeface.DEFAULT_BOLD);b.setBackground(shape(fill,9,1,line));return b;}private GradientDrawable shape(int fill,int radius,int stroke,int strokeColor){GradientDrawable d=new GradientDrawable();d.setColor(fill);d.setCornerRadius(dp(radius));if(stroke>0)d.setStroke(dp(stroke),strokeColor);return d;}private LinearLayout.LayoutParams top(int m){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(m);return p;}private View gap(){View v=new View(this);v.setLayoutParams(new LinearLayout.LayoutParams(dp(8),1));return v;}private int dp(int v){return(int)(v*getResources().getDisplayMetrics().density);}
}
