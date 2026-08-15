package com.GIHOSTINGS.giposapp;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

/** Keeps every screen clear of the Android status and navigation bars. */
public abstract class InsetActivity extends AppCompatActivity {
  @Override protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    getWindow().setNavigationBarColor(Color.rgb(18, 32, 51));
    WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
        .setAppearanceLightStatusBars(true);
  }

  @Override public void setContentView(View view) {
    super.setContentView(view);
    applySystemInsets(view);
  }

  @Override public void setContentView(View view, ViewGroup.LayoutParams params) {
    super.setContentView(view, params);
    applySystemInsets(view);
  }

  private void applySystemInsets(View root) {
    int initialLeft = root.getPaddingLeft();
    int initialTop = root.getPaddingTop();
    int initialRight = root.getPaddingRight();
    int initialBottom = root.getPaddingBottom();
    ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
      Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
      view.setPadding(
          initialLeft + bars.left,
          initialTop + bars.top,
          initialRight + bars.right,
          initialBottom + bars.bottom
      );
      return windowInsets;
    });
    ViewCompat.requestApplyInsets(root);
  }

  protected boolean requireFeature(String... features) {
    SecureStore.Session session = SecureStore.load(this);
    if (session == null || features == null || features.length == 0) {
      return true;
    }
    for (String feature : features) {
      if (session.hasFeature(feature)) {
        return true;
      }
    }
    Toast.makeText(this, "This feature is not included in the active plan.", Toast.LENGTH_LONG).show();
    finish();
    return false;
  }
}
