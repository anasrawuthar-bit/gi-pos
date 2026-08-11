package com.gihostings.giposorder

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

class MainActivity : Activity() {
  private lateinit var webView: WebView
  private lateinit var loading: ProgressBar

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    title = "GI POS Order"
    createWebView()

    if (ServerStore.get(this).isBlank()) {
      openServerSetup()
    } else {
      loadOrderingApp()
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  private fun createWebView() {
    val root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(243, 247, 250)) }
    webView = WebView(this).apply {
      layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.databaseEnabled = true
      settings.cacheMode = WebSettings.LOAD_DEFAULT
      settings.mediaPlaybackRequiresUserGesture = true
      settings.setSupportZoom(false)
      overScrollMode = WebView.OVER_SCROLL_NEVER
      webViewClient = WebViewClient()
      webChromeClient = object : WebChromeClient() {
        override fun onProgressChanged(view: WebView?, progress: Int) {
          loading.visibility = if (progress in 1..99) View.VISIBLE else View.GONE
        }
      }
    }

    loading = ProgressBar(this).apply {
      layoutParams = FrameLayout.LayoutParams(48.dp, 48.dp, Gravity.CENTER)
      visibility = ProgressBar.GONE
    }

    root.addView(webView)
    root.addView(loading)
    setContentView(root)
    CookieManager.getInstance().setAcceptCookie(true)
  }

  private fun loadOrderingApp() {
    val baseUrl = ServerStore.get(this)
    if (baseUrl.isBlank()) {
      openServerSetup()
      return
    }
    webView.loadUrl("${baseUrl.removeSuffix("/")}/login")
  }

  private fun openServerSetup() {
    startActivityForResult(Intent(this, ServerSetupActivity::class.java), REQUEST_SERVER)
  }

  override fun onCreateOptionsMenu(menu: Menu): Boolean {
    menu.add(0, MENU_SERVER, 0, "Server").setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS)
    return true
  }

  override fun onOptionsItemSelected(item: MenuItem): Boolean {
    return if (item.itemId == MENU_SERVER) {
      openServerSetup()
      true
    } else {
      super.onOptionsItemSelected(item)
    }
  }

  @Deprecated("Deprecated in Java")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode == REQUEST_SERVER && resultCode == RESULT_OK) {
      loadOrderingApp()
    }
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    if (::webView.isInitialized && webView.canGoBack()) {
      webView.goBack()
    } else {
      super.onBackPressed()
    }
  }

  private val Int.dp: Int get() = (this * resources.displayMetrics.density).toInt()

  private companion object {
    const val REQUEST_SERVER = 700
    const val MENU_SERVER = 701
  }
}
