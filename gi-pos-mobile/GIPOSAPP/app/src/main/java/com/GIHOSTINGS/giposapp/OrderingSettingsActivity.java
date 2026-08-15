package com.GIHOSTINGS.giposapp;

import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

public class OrderingSettingsActivity extends InsetActivity {
  private final int ink=Color.rgb(18,32,51),red=Color.rgb(199,22,55),muted=Color.rgb(99,115,138),teal=Color.rgb(8,127,140),line=Color.rgb(217,226,236),surface=Color.rgb(244,247,250);
  private PosDatabase db; private String browseMode; private int columns; private Button items,categories,two,three;

  @Override public void onCreate(Bundle state){super.onCreate(state);db=PosDatabase.get(this);PosDatabase.OrderingPreferences current=db.orderingPreferences();browseMode=current.browseMode;columns=current.columns;build();}

  private void build(){
    LinearLayout page=column();page.setPadding(dp(18),dp(16),dp(18),dp(28));page.setBackgroundColor(surface);
    LinearLayout head=row();head.setGravity(Gravity.CENTER_VERTICAL);Button back=button("‹",Color.WHITE,ink);back.setTextSize(22);back.setOnClickListener(v->finish());head.addView(back,new LinearLayout.LayoutParams(dp(44),dp(44)));LinearLayout title=column();title.setPadding(dp(11),0,0,0);title.addView(text("Ordering Layout",24,ink,true));title.addView(text("Choose the fastest menu flow for this device",13,muted,false));head.addView(title,new LinearLayout.LayoutParams(0,-2,1));page.addView(head);

    LinearLayout browse=panel("Menu browsing");browse.addView(text("Choose what the waiter sees first after opening a table.",13,muted,false),top(4));LinearLayout browseOptions=row();items=option("Items first","Search and add directly");items.setOnClickListener(v->{browseMode="items";refresh();});categories=option("Category first","Choose a section, then items");categories.setOnClickListener(v->{browseMode="categories";refresh();});browseOptions.addView(items,new LinearLayout.LayoutParams(0,dp(72),1));browseOptions.addView(gap());browseOptions.addView(categories,new LinearLayout.LayoutParams(0,dp(72),1));browse.addView(browseOptions,top(13));page.addView(browse,top(18));

    LinearLayout density=panel("Items per row");density.addView(text("Three columns show more products. Two columns provide larger names, images, and quantity controls.",13,muted,false),top(4));LinearLayout densityOptions=row();two=option("2 columns","Large and easy to tap");two.setOnClickListener(v->{columns=2;refresh();});three=option("3 columns","Compact for large menus");three.setOnClickListener(v->{columns=3;refresh();});densityOptions.addView(two,new LinearLayout.LayoutParams(0,dp(72),1));densityOptions.addView(gap());densityOptions.addView(three,new LinearLayout.LayoutParams(0,dp(72),1));density.addView(densityOptions,top(13));page.addView(density,top(14));

    LinearLayout note=column();note.setPadding(dp(14),dp(12),dp(14),dp(12));note.setBackground(shape(Color.rgb(229,247,249),11,1,Color.rgb(148,210,218)));note.addView(text("Applies to new order screens immediately",13,teal,true));note.addView(text("Existing carts and quantities are never changed.",12,muted,false),top(3));page.addView(note,top(14));
    Button save=button("Save",red,Color.WHITE);save.setOnClickListener(v->{db.saveOrderingPreferences(browseMode,columns);CloudSyncManager.syncAsync(this);Toast.makeText(this,"Ordering layout saved",Toast.LENGTH_SHORT).show();finish();});page.addView(save,topHeight(18,52));
    refresh();ScrollView scroll=new ScrollView(this);scroll.addView(page);setContentView(scroll);
  }

  private Button option(String title,String detail){Button value=button(title+"\n"+detail,Color.WHITE,ink);value.setTextSize(14);value.setGravity(Gravity.CENTER);value.setPadding(dp(8),dp(5),dp(8),dp(5));return value;}
  private void refresh(){style(items,"items".equals(browseMode));style(categories,"categories".equals(browseMode));style(two,columns==2);style(three,columns==3);}
  private void style(Button value,boolean active){if(value==null)return;value.setTextColor(active?Color.WHITE:ink);value.setBackground(shape(active?teal:Color.WHITE,10,active?2:1,active?teal:line));}
  private LinearLayout panel(String title){LinearLayout value=column();value.setPadding(dp(15),dp(14),dp(15),dp(16));value.setBackground(shape(Color.WHITE,12,1,line));value.addView(text(title,17,ink,true));return value;}
  private LinearLayout column(){LinearLayout value=new LinearLayout(this);value.setOrientation(LinearLayout.VERTICAL);return value;}private LinearLayout row(){LinearLayout value=new LinearLayout(this);value.setOrientation(LinearLayout.HORIZONTAL);return value;}private TextView text(String value,int size,int color,boolean bold){TextView view=new TextView(this);view.setText(value);view.setTextSize(size);view.setTextColor(color);if(bold)view.setTypeface(Typeface.DEFAULT_BOLD);return view;}private Button button(String value,int fill,int color){Button view=new Button(this);view.setText(value);view.setAllCaps(false);view.setTextColor(color);view.setTypeface(Typeface.DEFAULT_BOLD);view.setBackground(shape(fill,9,1,line));return view;}private GradientDrawable shape(int fill,int radius,int stroke,int strokeColor){GradientDrawable value=new GradientDrawable();value.setColor(fill);value.setCornerRadius(dp(radius));if(stroke>0)value.setStroke(dp(stroke),strokeColor);return value;}private LinearLayout.LayoutParams top(int margin){LinearLayout.LayoutParams value=new LinearLayout.LayoutParams(-1,-2);value.topMargin=dp(margin);return value;}private LinearLayout.LayoutParams topHeight(int margin,int height){LinearLayout.LayoutParams value=new LinearLayout.LayoutParams(-1,dp(height));value.topMargin=dp(margin);return value;}private View gap(){View value=new View(this);value.setLayoutParams(new LinearLayout.LayoutParams(dp(8),1));return value;}private int dp(int value){return(int)(value*getResources().getDisplayMetrics().density);}
}
