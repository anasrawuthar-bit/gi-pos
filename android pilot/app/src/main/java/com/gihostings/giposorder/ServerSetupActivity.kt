package com.gihostings.giposorder

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
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
    val root = ScrollView(this).apply {
      isFillViewport = true
      setBackgroundColor(Color.rgb(242, 246, 249))
    }
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(24.dp, 36.dp, 24.dp, 32.dp)
    }

    val brand = TextView(this).apply {
      text = "GI"
      textSize = 22f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      typeface = Typeface.DEFAULT_BOLD
      background = shape(Color.rgb(200, 22, 55), 14.dp)
    }
    content.addView(brand, LinearLayout.LayoutParams(56.dp, 56.dp))
    content.addView(text("GI POS Order", 30f, true).apply { gravity = Gravity.CENTER }.withTop(16.dp))
    content.addView(text("Connect this device to your restaurant Main PC", 15f, false).apply {
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(86, 103, 124))
    }.withTop(6.dp))

    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(20.dp, 22.dp, 20.dp, 20.dp)
      background = shape(Color.WHITE, 18.dp, Color.rgb(215, 224, 233))
      elevation = 2.dp.toFloat()
    }
    card.addView(text("Connect to Main PC", 21f, true))
    card.addView(text("Enter the address shown in Local POS Server. Both devices must use the same Wi-Fi.", 14f, false).apply {
      setTextColor(Color.rgb(86, 103, 124))
    }.withTop(6.dp))
    card.addView(text("Main PC address", 13f, true).withTop(24.dp))

    serverInput = EditText(this).apply {
      hint = "http://192.168.1.3:8080"
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
      setSingleLine(true)
      setText(ServerStore.get(this@ServerSetupActivity))
      setSelectAllOnFocus(false)
      setPadding(14.dp, 0, 14.dp, 0)
      background = shape(Color.rgb(248, 250, 252), 10.dp, Color.rgb(192, 207, 220))
    }
    card.addView(serverInput.withTop(8.dp).withHeight(52.dp))
    card.addView(text("Example: http://192.168.1.4:8080", 12f, false).apply {
      setTextColor(Color.rgb(97, 116, 138))
    }.withTop(8.dp))

    status = text("", 14f, false).apply { visibility = View.GONE }
    progress = ProgressBar(this).apply { visibility = View.GONE }
    saveButton = Button(this).apply {
      text = "Connect"
      isAllCaps = false
      setTextColor(Color.WHITE)
      typeface = Typeface.DEFAULT_BOLD
      background = shape(Color.rgb(8, 127, 140), 10.dp)
      setOnClickListener { testAndSave() }
    }
    card.addView(saveButton.withTop(24.dp).withHeight(52.dp))
    card.addView(progress.apply { foregroundGravity = Gravity.CENTER_HORIZONTAL }.withTop(12.dp))
    card.addView(status.apply {
      setPadding(12.dp, 10.dp, 12.dp, 10.dp)
    }.withTop(12.dp))

    if (ServerStore.get(this).isNotBlank()) {
      val changeButton = Button(this).apply {
        text = "Forget saved address"
        isAllCaps = false
        setOnClickListener {
          ServerStore.clear(this@ServerSetupActivity)
          serverInput.text.clear()
          showStatus("Server address cleared.", false)
        }
      }
      card.addView(changeButton.withTop(8.dp))
    }

    content.addView(card.withTop(30.dp))
    content.addView(text("Orders are saved on the Main PC. This phone is used for fast service and KOT actions.", 12f, false).apply {
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(107, 122, 140))
    }.withTop(18.dp))
    root.addView(content, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
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
    status.background = shape(
      if (isError) Color.rgb(255, 239, 241) else Color.rgb(232, 249, 244),
      8.dp,
      if (isError) Color.rgb(253, 164, 175) else Color.rgb(134, 239, 172),
    )
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

  private fun <T : View> T.withHeight(height: Int): T {
    layoutParams = (layoutParams as? LinearLayout.LayoutParams ?: LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      height,
    )).apply {
      this.height = height
    }
    return this
  }

  private fun shape(fill: Int, radius: Int, stroke: Int? = null): GradientDrawable = GradientDrawable().apply {
    setColor(fill)
    cornerRadius = radius.toFloat()
    stroke?.let { setStroke(1.dp, it) }
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
