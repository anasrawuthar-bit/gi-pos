package com.gihostings.giposorder

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

class ServerSetupActivity : Activity() {
  private lateinit var serverInput: EditText
  private lateinit var status: TextView
  private lateinit var saveButton: Button
  private lateinit var progress: ProgressBar

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    title = "Connect to Main PC"
    buildView()
  }

  private fun buildView() {
    val padding = 24.dp
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(padding, padding, padding, padding)
      setBackgroundColor(Color.rgb(243, 247, 250))
    }

    root.addView(text("GI POS Order", 28f, true))
    root.addView(text("Connect this phone to the restaurant Main PC. Orders, users, and printing remain on that PC.", 16f, false).withTop(8.dp))
    root.addView(text("Main PC address", 14f, true).withTop(28.dp))

    serverInput = EditText(this).apply {
      hint = "http://192.168.1.3:8080"
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
      setSingleLine(true)
      setText(ServerStore.get(this@ServerSetupActivity))
      setSelectAllOnFocus(false)
    }
    root.addView(serverInput.withTop(8.dp))
    root.addView(text("Use the Main PC address shown in Local POS Server. Keep both devices on the same Wi-Fi.", 13f, false).withTop(8.dp))

    status = text("", 14f, false).apply { visibility = View.GONE }
    progress = ProgressBar(this).apply { visibility = View.GONE }
    saveButton = Button(this).apply {
      text = "Connect"
      setOnClickListener { testAndSave() }
    }
    root.addView(saveButton.withTop(26.dp))
    root.addView(progress.withTop(16.dp))
    root.addView(status.withTop(12.dp))

    if (ServerStore.get(this).isNotBlank()) {
      val changeButton = Button(this).apply {
        text = "Clear saved server"
        setOnClickListener {
          ServerStore.clear(this@ServerSetupActivity)
          serverInput.text.clear()
          showStatus("Server address cleared.", false)
        }
      }
      root.addView(changeButton.withTop(12.dp))
    }

    setContentView(root)
  }

  private fun testAndSave() {
    val baseUrl = ServerStore.normalise(serverInput.text.toString())
    if (baseUrl == null) {
      showStatus("Enter a valid Main PC address, for example http://192.168.1.3:8080.", true)
      return
    }

    saveButton.isEnabled = false
    progress.visibility = View.VISIBLE
    showStatus("Connecting to Main PC...", false)

    Thread {
      val result = runCatching {
        val connection = URL("$baseUrl/api/health").openConnection() as HttpURLConnection
        connection.connectTimeout = 5000
        connection.readTimeout = 5000
        connection.requestMethod = "GET"
        connection.inputStream.use { stream ->
          JSONObject(stream.readBytes().toString(Charsets.UTF_8)).optBoolean("ok", false)
        }
      }.getOrElse { false }

      runOnUiThread {
        saveButton.isEnabled = true
        progress.visibility = View.GONE
        if (result) {
          ServerStore.save(this, baseUrl)
          setResult(RESULT_OK)
          finish()
        } else {
          showStatus("Cannot reach the Main PC. Confirm the address, Wi-Fi, and Windows Firewall.", true)
        }
      }
    }.start()
  }

  private fun showStatus(message: String, isError: Boolean) {
    status.visibility = View.VISIBLE
    status.text = message
    status.setTextColor(if (isError) Color.rgb(190, 24, 54) else Color.rgb(8, 127, 140))
  }

  private fun text(value: String, size: Float, strong: Boolean): TextView = TextView(this).apply {
    text = value
    textSize = size
    setTextColor(Color.rgb(8, 17, 31))
    if (strong) typeface = android.graphics.Typeface.DEFAULT_BOLD
  }

  private fun <T : View> T.withTop(top: Int): T {
    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      topMargin = top
    }
    return this
  }

  private val Int.dp: Int get() = (this * resources.displayMetrics.density).toInt()
}

object ServerStore {
  private const val PREFS = "gi_pos_order"
  private const val KEY_SERVER = "server_url"

  fun get(activity: Activity): String = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE).getString(KEY_SERVER, "") ?: ""

  fun save(activity: Activity, server: String) {
    activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE).edit().putString(KEY_SERVER, server).apply()
  }

  fun clear(activity: Activity) {
    activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE).edit().remove(KEY_SERVER).apply()
  }

  fun normalise(input: String): String? {
    val value = input.trim().removeSuffix("/")
    return runCatching {
      val uri = URI(value)
      if (uri.scheme !in setOf("http", "https") || uri.host.isNullOrBlank()) null else "${uri.scheme}://${uri.authority}"
    }.getOrNull()
  }
}
