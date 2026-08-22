package com.GIHOSTINGS.giposapp;

import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.content.Intent;
import android.provider.Settings;
import android.os.Bundle;
import android.text.InputType;
import android.text.method.PasswordTransformationMethod;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends InsetActivity {
  private final int ink = Color.rgb(18, 32, 51), red = Color.rgb(199, 22, 55), muted = Color.rgb(99,115,138);
  private EditText serverAddress, account, password;
  private TextView status;
  private Button signInButton;

  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    SecureStore.Session session = SecureStore.load(this);
    if (session != null && session.isActive() && !SecureStore.isSignedOut(this)) { if(SecureStore.hasPin(this))showPinUnlock();else openDashboard(); return; }
    showActivation();
  }

  private void showPinUnlock() {
    LinearLayout root=column();root.setGravity(Gravity.CENTER_HORIZONTAL);root.setPadding(dp(24),dp(44),dp(24),dp(30));root.setBackgroundColor(Color.rgb(244,247,250));
    ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.app_logo);logo.setScaleType(ImageView.ScaleType.CENTER_CROP);logo.setContentDescription("GI POS logo");root.addView(logo,new LinearLayout.LayoutParams(dp(64),dp(64)));
    TextView title=text("Unlock GI POS",27,ink,true);title.setGravity(Gravity.CENTER);root.addView(title,top(18));TextView detail=text("Enter your optional device PIN",14,muted,false);detail.setGravity(Gravity.CENTER);root.addView(detail,top(5));
    LinearLayout card=column();card.setPadding(dp(20),dp(20),dp(20),dp(18));card.setBackground(shape(Color.WHITE,12,1,Color.rgb(217,226,236)));EditText pin=input("Enter PIN",InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_VARIATION_PASSWORD);pin.setTransformationMethod(PasswordTransformationMethod.getInstance());card.addView(FormControls.field(this,"Device PIN",pin));TextView error=text("",13,Color.rgb(185,28,28),false);error.setVisibility(View.GONE);card.addView(error,top(9));Button unlock=button("Unlock",red,Color.WHITE);Runnable unlockAction=()->{String value=pin.getText().toString();pin.setText("");if(SecureStore.verifyPin(this,value))openDashboard();else{error.setText("Incorrect PIN");error.setVisibility(View.VISIBLE);pin.requestFocus();}};unlock.setOnClickListener(v->unlockAction.run());FormControls.submitOnDone(pin,unlockAction);card.addView(unlock,topHeight(16,50));Button passwordLogin=button("Use account password",Color.rgb(241,245,249),ink);passwordLogin.setOnClickListener(v->{SecureStore.signOut(this);showActivation();});card.addView(passwordLogin,topHeight(9,46));root.addView(card,top(28));setContentView(root);pin.requestFocus();
  }

  private void showActivation() {
    ScrollView root = new ScrollView(this); root.setFillViewport(true); root.setBackgroundColor(Color.rgb(244,247,250));
    LinearLayout content = column(); content.setGravity(Gravity.CENTER_HORIZONTAL); content.setPadding(dp(22),dp(30),dp(22),dp(28));
    ImageView logo = new ImageView(this); logo.setImageResource(R.drawable.app_logo); logo.setScaleType(ImageView.ScaleType.CENTER_CROP); logo.setContentDescription("GI POS logo"); logo.setBackground(shape(Color.rgb(16,21,24),15,0,0)); logo.setClipToOutline(true);
    content.addView(logo, new LinearLayout.LayoutParams(dp(58),dp(58)));
    TextView title = text("GI POS Mobile",28,ink,true); title.setGravity(Gravity.CENTER); content.addView(title, top(16));
    TextView sub = text("Sign in to connect your account",15,muted,false); sub.setGravity(Gravity.CENTER); content.addView(sub,top(6));

    LinearLayout card = column(); card.setPadding(dp(20),dp(22),dp(20),dp(20)); card.setElevation(dp(2)); card.setBackground(shape(Color.WHITE,12,1,Color.rgb(217,226,236)));
    card.addView(text("Sign in",21,ink,true));
    card.addView(text("Enter your account credentials to continue.",14,muted,false),top(6));
    serverAddress = input("https://goldensea.gihostings.in",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);
    serverAddress.setText("https://goldensea.gihostings.in");
    card.addView(FormControls.field(this,"Server address",serverAddress),top(24));
    account = input("Registered phone number or email",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS); card.addView(FormControls.field(this,"Phone or email",account),top(16));
    password = input("Enter your password",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD); password.setTransformationMethod(PasswordTransformationMethod.getInstance()); FormControls.submitOnDone(password,this::activate); card.addView(FormControls.field(this,"Password",password),top(16));
    signInButton = new Button(this); signInButton.setText("Sign in"); signInButton.setAllCaps(false); signInButton.setTextColor(Color.WHITE); signInButton.setTextSize(16); signInButton.setTypeface(Typeface.DEFAULT_BOLD); signInButton.setBackground(shape(red,10,0,0)); signInButton.setOnClickListener(v -> activate()); card.addView(signInButton,topHeight(24,52));
    status = text("",13,muted,false); status.setPadding(dp(12),dp(10),dp(12),dp(10)); status.setVisibility(View.GONE); card.addView(status,top(12));
    content.addView(card,top(30));
    root.addView(content); setContentView(root);
  }

  private void activate() {
    if (serverAddress.getText().toString().trim().isEmpty()) { status("Enter the server address.",true); return; }
    if (account.getText().toString().trim().isEmpty() || password.getText().toString().isEmpty()) { status("Enter your phone/email and password.",true); return; }
    signInButton.setEnabled(false); status("Connecting securely...",false);String passwordValue=password.getText().toString();password.setText("");
    String fingerprint = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
    new Thread(() -> {
      try {
        CloudClient.Result result = CloudClient.activate(serverAddress.getText().toString(), account.getText().toString(), passwordValue, fingerprint, SecureStore.load(this));
        SecureStore.save(this, result.session);
        SecureStore.clearPin(this);
        PosDatabase.get(this).getWritableDatabase();
        if (new SecureStore.Session(result.session).hasFeature("cloudSync")) CloudSyncManager.initialSync(this);
        runOnUiThread(this::openDashboard);
      } catch (Exception error) {
        runOnUiThread(() -> { signInButton.setEnabled(true); status(error.getMessage() == null ? "Unable to connect to the server." : error.getMessage(), true); });
      }
    }).start();
  }
  private void openDashboard(){startActivity(new Intent(this,DashboardActivity.class));finish();}
  private LinearLayout column(){ LinearLayout v=new LinearLayout(this); v.setOrientation(LinearLayout.VERTICAL); return v; }
  private TextView label(String s){return text(s,13,ink,true);}
  private Button button(String s,int fill,int color){Button b=new Button(this);b.setText(s);b.setAllCaps(false);b.setTextColor(color);b.setTypeface(Typeface.DEFAULT_BOLD);b.setBackground(shape(fill,10,0,0));return b;}
  private EditText input(String hint,int type){return FormControls.input(this,hint,type);}
  private TextView text(String s,int size,int color,boolean bold){ TextView v=new TextView(this); v.setText(s); v.setTextSize(size); v.setTextColor(color); if(bold)v.setTypeface(Typeface.DEFAULT_BOLD); return v; }
  private void status(String s,boolean error){status.setVisibility(View.VISIBLE);status.setText(s);status.setTextColor(error?Color.rgb(185,28,28):Color.rgb(5,116,100));status.setBackground(shape(error?Color.rgb(254,242,242):Color.rgb(236,253,245),8,1,error?Color.rgb(252,165,165):Color.rgb(110,231,183)));}
  private LinearLayout.LayoutParams top(int px){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(px);return p;}
  private LinearLayout.LayoutParams topHeight(int margin,int height){LinearLayout.LayoutParams p=top(margin);p.height=dp(height);return p;}
  private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density);}
  private GradientDrawable shape(int fill,int radius,int stroke,int strokeColor){GradientDrawable d=new GradientDrawable();d.setColor(fill);d.setCornerRadius(dp(radius));if(stroke>0)d.setStroke(dp(stroke),strokeColor);return d;}
}
