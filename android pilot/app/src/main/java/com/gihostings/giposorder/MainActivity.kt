package com.gihostings.giposorder

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.Gravity
import android.view.Menu
import android.view.MenuItem as AndroidMenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.GridView
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import kotlin.math.max

class MainActivity : Activity() {
  private val ink = Color.rgb(18, 32, 51)
  private val red = Color.rgb(199, 22, 55)
  private val teal = Color.rgb(8, 127, 140)
  private val muted = Color.rgb(99, 115, 138)
  private val line = Color.rgb(217, 226, 236)
  private val surface = Color.rgb(244, 247, 250)
  private val soft = Color.rgb(240, 247, 249)

  private var bootstrap = Bootstrap()
  private var loginUsers = emptyList<StaffUser>()
  private var sessionToken = ""
  private var currentUser: StaffUser? = null
  private var selectedTable: TableInfo? = null
  private var activeOrder: OpenOrder? = null
  private var selectedCategoryId: String? = null
  private var searchText = ""
  private var selectedPrinterId = ""
  private val cart = linkedMapOf<String, CartLine>()

  private lateinit var root: LinearLayout
  private lateinit var content: LinearLayout
  private lateinit var statusView: TextView
  private lateinit var titleView: TextView
  private lateinit var subtitleView: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    title = "GI POS Pilot"
    window.statusBarColor = surface
    window.navigationBarColor = ink

    if (ServerStore.get(this).isBlank()) {
      openServerSetup()
    } else {
      buildShell()
      loadLoginOptions()
    }
  }

  private fun buildShell() {
    root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(surface)
    }
    val header = LinearLayout(this).apply {
      gravity = Gravity.CENTER_VERTICAL
      setPadding(18.dp, 18.dp, 18.dp, 12.dp)
    }
    val logo = TextView(this).apply {
      text = "GI"
      textSize = 18f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      typeface = Typeface.DEFAULT_BOLD
      background = shape(red, 14.dp)
    }
    header.addView(logo, LinearLayout.LayoutParams(52.dp, 52.dp))
    val titleBlock = column().apply { setPadding(12.dp, 0, 0, 0) }
    titleView = text("GI POS Pilot", 24f, ink, true)
    subtitleView = text("Connecting...", 13f, muted, false)
    titleBlock.addView(titleView)
    titleBlock.addView(subtitleView)
    header.addView(titleBlock, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    val refresh = headerButton("Refresh").apply {
      setOnClickListener { if (currentUser == null) loadLoginOptions() else loadBootstrap() }
    }
    header.addView(refresh, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, 44.dp))
    root.addView(header)

    statusView = text("", 13f, muted, true).apply {
      visibility = View.GONE
      setPadding(12.dp, 10.dp, 12.dp, 10.dp)
    }
    val statusParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    statusParams.setMargins(18.dp, 0, 18.dp, 10.dp)
    root.addView(statusView, statusParams)

    content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(18.dp, 0, 18.dp, 18.dp)
    }
    val scroller = ScrollView(this)
    scroller.addView(content)
    root.addView(scroller, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
    setContentView(root)
  }

  private fun loadLoginOptions() {
    if (!::content.isInitialized) return
    showLoading("Connecting to Main PC...")
    Thread {
      val result = runCatching { getJson("/api/mobile/login-options") }
      runOnUiThread {
        result.onSuccess {
          loginUsers = it.optJSONArray("users").toStaffList()
          subtitleView.text = "Main PC / ${it.optString("version")}".trimEnd(' ', '/')
          renderLogin()
        }.onFailure {
          showStatus(it.message ?: "Cannot connect to Main PC", true)
          renderConnectionError()
        }
      }
    }.start()
  }

  private fun loadBootstrap() {
    if (!::content.isInitialized || sessionToken.isBlank()) return
    showLoading("Loading POS data...")
    Thread {
      val result = runCatching { getJson("/api/mobile/bootstrap", sessionToken) }
      runOnUiThread {
        result.onSuccess {
          bootstrap = Bootstrap.from(it)
          selectedPrinterId = bootstrap.printers.firstOrNull { printer -> printer.isBillPrinter }?.id
            ?: bootstrap.printers.firstOrNull()?.id.orEmpty()
          subtitleView.text = "${bootstrap.businessName} / ${bootstrap.version}"
          renderTables()
        }.onFailure { error ->
          if (error is ApiException && error.statusCode == 401) {
            sessionToken = ""
            currentUser = null
            showStatus("Session ended. Login again.", true)
            loadLoginOptions()
          } else {
            showStatus(error.message ?: "Cannot load Main PC data", true)
            renderConnectionError()
          }
        }
      }
    }.start()
  }

  private fun renderConnectionError() {
    content.removeAllViews()
    val card = card()
    card.addView(text("Main PC not reachable", 22f, ink, true))
    card.addView(text("Check server address, Wi-Fi, and Windows Firewall.", 15f, muted, false).withTop(8.dp))
    card.addView(primaryButton("Reconnect").apply { setOnClickListener { openServerSetup() } }.withTop(20.dp).withHeight(52.dp))
    content.addView(card)
  }

  private fun renderLogin() {
    content.removeAllViews()
    titleView.text = "Staff Login"
    val card = card()
    card.addView(text("Select user", 14f, muted, true))
    val userSpinner = Spinner(this)
    val users = loginUsers.filter { it.active }
    userSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, users.map { it.name })
    card.addView(userSpinner.withTop(8.dp).withHeight(50.dp))
    val pin = input("PIN", InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD)
    card.addView(text("PIN", 14f, muted, true).withTop(18.dp))
    card.addView(pin.withTop(8.dp).withHeight(52.dp))
    val login = primaryButton("Login")
    login.setOnClickListener {
      val user = users.getOrNull(userSpinner.selectedItemPosition)
      if (user == null) {
        showStatus("No active POS user found on Main PC.", true)
      } else {
        login(user, pin.text.toString())
      }
    }
    card.addView(login.withTop(22.dp).withHeight(54.dp))
    content.addView(card)
    showStatus("Enter local staff PIN to continue.", false)
  }

  private fun login(user: StaffUser, pin: String) {
    if (pin.isBlank()) {
      showStatus("Enter PIN.", true)
      return
    }
    showStatus("Checking...", false)
    Thread {
      val result = runCatching {
        postJson(
          "/api/mobile/login",
          JSONObject()
            .put("userId", user.id)
            .put("pin", pin)
            .put("deviceType", "mobile")
            .put("deviceName", android.os.Build.MODEL),
        )
      }
      runOnUiThread {
        result.onSuccess {
          sessionToken = it.optString("sessionToken")
          currentUser = StaffUser.from(it.optJSONObject("user") ?: JSONObject())
          loadBootstrap()
        }.onFailure {
          showStatus(it.message ?: "Login failed", true)
        }
      }
    }.start()
  }

  private fun renderTables() {
    content.removeAllViews()
    titleView.text = "Select Table"
    subtitleView.text = "${bootstrap.tables.size} tables / ${bootstrap.openOrders} open"
    showStatus("Tap a table to start or continue an order.", false)

    val floorBar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    val floors = linkedSetOf("All")
    bootstrap.tables.mapTo(floors) { it.floor.ifBlank { "Main" } }
    floors.forEach { floor ->
      floorBar.addView(chip(floor, floor == "All") {
        renderTableGrid(if (floor == "All") null else floor)
      }, chipParams())
    }
    val floorScroll = HorizontalScrollView(this).apply {
      isHorizontalScrollBarEnabled = false
      addView(floorBar)
    }
    content.addView(floorScroll)
    renderTableGrid(null)
  }

  private fun renderTableGrid(floor: String?) {
    while (content.childCount > 1) content.removeViewAt(1)
    val grid = GridView(this).apply {
      numColumns = if (resources.configuration.screenWidthDp >= 600) 5 else 3
      horizontalSpacing = 8.dp
      verticalSpacing = 8.dp
      stretchMode = GridView.STRETCH_COLUMN_WIDTH
      adapter = TableAdapter(bootstrap.tables.filter { floor == null || it.floor == floor })
    }
    content.addView(grid, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
  }

  private fun openTable(table: TableInfo) {
    selectedTable = table
    val open = bootstrap.openOrderList.firstOrNull { order ->
      order.orderType == "Dining" && order.tables.any { it.equals(table.name, ignoreCase = true) }
    }
    activeOrder = open
    cart.clear()
    open?.cart?.forEach { cart[it.itemId] = it.copy() }
    selectedCategoryId = null
    searchText = ""
    renderOrder()
  }

  private fun renderOrder() {
    content.removeAllViews()
    val table = selectedTable
    titleView.text = table?.name ?: "New Order"
    subtitleView.text = currentUser?.name ?: "Staff"

    val search = input("Search item", InputType.TYPE_CLASS_TEXT)
    search.addTextChangedListener(object : TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
        searchText = s?.toString().orEmpty()
        renderMenuArea()
      }
      override fun afterTextChanged(s: Editable?) {}
    })
    content.addView(search.withHeight(52.dp))

    val categoryScroll = HorizontalScrollView(this).apply { isHorizontalScrollBarEnabled = false }
    val categoryRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    categoryRow.addView(chip("All", selectedCategoryId == null) {
      selectedCategoryId = null
      renderMenuArea()
    }, chipParams())
    bootstrap.categories.forEach { category ->
      categoryRow.addView(chip(category.name, category.id == selectedCategoryId) {
        selectedCategoryId = category.id
        renderMenuArea()
      }, chipParams())
    }
    categoryScroll.addView(categoryRow)
    content.addView(categoryScroll.withTop(12.dp))

    val menuHolder = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      tag = "menuHolder"
    }
    content.addView(menuHolder.withTop(10.dp))

    val cartPanel = card().withTop(12.dp)
    cartPanel.tag = "cartPanel"
    content.addView(cartPanel)
    renderMenuArea()
    renderCartPanel()
  }

  private fun renderMenuArea() {
    val holder = content.findViewWithTag<LinearLayout>("menuHolder") ?: return
    holder.removeAllViews()
    val items = bootstrap.menuItems.filter {
      (selectedCategoryId == null || it.category == selectedCategoryId) &&
        (searchText.isBlank() || it.name.contains(searchText, ignoreCase = true))
    }
    val grid = GridView(this).apply {
      numColumns = if (resources.configuration.screenWidthDp >= 600) 4 else 2
      horizontalSpacing = 8.dp
      verticalSpacing = 8.dp
      stretchMode = GridView.STRETCH_COLUMN_WIDTH
      adapter = ItemAdapter(items)
    }
    holder.addView(grid)
  }

  private fun renderCartPanel() {
    val panel = content.findViewWithTag<LinearLayout>("cartPanel") ?: return
    panel.removeAllViews()
    val totalQty = cart.values.sumOf { it.qty }
    val total = cart.values.sumOf { it.price * it.qty }
    val head = row().apply { gravity = Gravity.CENTER_VERTICAL }
    val title = column()
    title.addView(text("Current Order", 20f, ink, true))
    title.addView(text("${formatQty(totalQty)} qty / Rs. ${money(total)}", 13f, muted, true))
    head.addView(title, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    head.addView(headerButton("Back").apply { setOnClickListener { renderTables() } })
    panel.addView(head)

    if (cart.isEmpty()) {
      panel.addView(emptyBox("Tap items to add to cart.").withTop(12.dp))
    } else {
      cart.values.forEach { line -> panel.addView(cartLineView(line).withTop(8.dp)) }
    }

    if (bootstrap.printers.isNotEmpty()) {
      val spinner = Spinner(this)
      spinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, bootstrap.printers.map { it.name })
      val index = bootstrap.printers.indexOfFirst { it.id == selectedPrinterId }.coerceAtLeast(0)
      spinner.setSelection(index)
      spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
        override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
          selectedPrinterId = bootstrap.printers.getOrNull(position)?.id.orEmpty()
        }
        override fun onNothingSelected(parent: AdapterView<*>?) {}
      }
      panel.addView(text("KOT Printer", 13f, muted, true).withTop(12.dp))
      panel.addView(spinner.withTop(6.dp).withHeight(50.dp))
    }

    val actions = row().apply { gravity = Gravity.CENTER_VERTICAL }
    actions.addView(actionButton("Hold", Color.rgb(255, 247, 220), ink) { saveOrder("hold", reset = true) }, weight())
    actions.addView(gap())
    actions.addView(actionButton("Print KOT", teal, Color.WHITE) { printKot() }, weight())
    panel.addView(actions.withTop(12.dp))
  }

  private fun addItem(item: MenuItem) {
    val existing = cart[item.id]
    if (existing == null) {
      cart[item.id] = CartLine(item.id, item.name, item.price, 1.0, item.taxRate)
    } else {
      existing.qty += 1.0
    }
    renderMenuArea()
    renderCartPanel()
  }

  private fun changeQty(itemId: String, delta: Double) {
    val line = cart[itemId] ?: return
    line.qty += delta
    if (line.qty <= 0.0) cart.remove(itemId)
    renderMenuArea()
    renderCartPanel()
  }

  private fun saveOrder(status: String, reset: Boolean) {
    val table = selectedTable
    if (table == null || cart.isEmpty()) {
      showStatus("Select table and items first.", true)
      return
    }
    showStatus(if (status == "hold") "Holding order..." else "Saving order...", false)
    Thread {
      val body = buildOrderPayload(status, table)
      val result = runCatching { postJson("/api/mobile/orders/save", body, sessionToken) }
      runOnUiThread {
        result.onSuccess {
          showStatus(if (status == "hold") "Order moved to Hold." else "Order saved.", false)
          if (reset) {
            selectedTable = null
            activeOrder = null
            cart.clear()
            loadBootstrap()
          } else {
            activeOrder = OpenOrder.from(it.optJSONObject("order") ?: JSONObject())
          }
        }.onFailure { showStatus(it.message ?: "Save failed", true) }
      }
    }.start()
  }

  private fun printKot() {
    val table = selectedTable
    if (table == null || cart.isEmpty()) {
      showStatus("Select table and items first.", true)
      return
    }
    showStatus("Printing KOT...", false)
    Thread {
      val body = buildOrderPayload("unclosed", table).put("printerProfileId", selectedPrinterId)
      val result = runCatching { postJson("/api/mobile/kot/print", body, sessionToken) }
      runOnUiThread {
        result.onSuccess {
          val printer = it.optJSONObject("printerProfile")?.optString("name").orEmpty()
          Toast.makeText(this, "KOT sent${if (printer.isBlank()) "" else " to $printer"}", Toast.LENGTH_SHORT).show()
          selectedTable = null
          activeOrder = null
          cart.clear()
          loadBootstrap()
        }.onFailure { showStatus(it.message ?: "KOT print failed", true) }
      }
    }.start()
  }

  private fun buildOrderPayload(status: String, table: TableInfo): JSONObject {
    val lines = JSONArray()
    cart.values.forEach {
      lines.put(
        JSONObject()
          .put("itemId", it.itemId)
          .put("name", it.name)
          .put("price", it.price)
          .put("qty", it.qty)
          .put("taxRate", it.taxRate),
      )
    }
    return JSONObject()
      .put("orderId", activeOrder?.id.orEmpty())
      .put("billNo", activeOrder?.billNo.orEmpty())
      .put("expectedUpdatedAt", activeOrder?.updatedAt.orEmpty())
      .put("status", status)
      .put("orderType", "Dining")
      .put("seatingMode", "individual")
      .put("table", table.name)
      .put("tables", JSONArray().put(table.name))
      .put("diningGroupName", "")
      .put("cart", lines)
  }

  private fun getJson(path: String, token: String = ""): JSONObject = request("GET", path, null, token)

  private fun postJson(path: String, body: JSONObject, token: String = ""): JSONObject = request("POST", path, body, token)

  private fun request(method: String, path: String, body: JSONObject?, token: String): JSONObject {
    val baseUrl = ServerStore.get(this).removeSuffix("/")
    val connection = URL("$baseUrl$path").openConnection() as HttpURLConnection
    connection.connectTimeout = 7000
    connection.readTimeout = 10000
    connection.requestMethod = method
    connection.setRequestProperty("Accept", "application/json")
    connection.setRequestProperty("X-GI-Device-Type", "mobile")
    connection.setRequestProperty("X-GI-Device-Name", android.os.Build.MODEL)
    if (token.isNotBlank()) connection.setRequestProperty("Authorization", "Bearer $token")
    if (body != null) {
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
    }
    val statusCode = connection.responseCode
    val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
    val responseText = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
    val json = runCatching { JSONObject(responseText) }.getOrElse {
      throw ApiException(statusCode, "Main PC returned an invalid response")
    }
    if (!json.optBoolean("ok", false)) {
      throw ApiException(
        statusCode,
        json.optString("error", "Request failed"),
        json.optString("code"),
        json.optBoolean("retryable", false),
      )
    }
    return json
  }

  private inner class TableAdapter(private val tables: List<TableInfo>) : BaseAdapter() {
    override fun getCount() = tables.size
    override fun getItem(position: Int) = tables[position]
    override fun getItemId(position: Int) = position.toLong()
    override fun getView(position: Int, old: View?, parent: ViewGroup?): View {
      val table = tables[position]
      val open = bootstrap.openOrderList.firstOrNull { it.tables.any { name -> name.equals(table.name, true) } }
      val card = column().apply {
        gravity = Gravity.CENTER
        setPadding(8.dp, 14.dp, 8.dp, 12.dp)
        setBackgroundColor(Color.TRANSPARENT)
        background = shape(if (open == null) Color.WHITE else Color.rgb(229, 247, 249), 14.dp, 2.dp, if (open == null) Color.rgb(205, 216, 227) else teal)
        setOnClickListener { openTable(table) }
      }
      card.addView(text(table.name, 23f, ink, true).apply { gravity = Gravity.CENTER })
      val label = if (open == null) "${table.seats} seats" else "${open.status.uppercase(Locale.US)} / Rs. ${money(open.total)}"
      card.addView(text(label, 12f, if (open == null) muted else teal, true).apply { gravity = Gravity.CENTER }.withTop(6.dp))
      return card
    }
  }

  private inner class ItemAdapter(private val items: List<MenuItem>) : BaseAdapter() {
    override fun getCount() = items.size
    override fun getItem(position: Int) = items[position]
    override fun getItemId(position: Int) = position.toLong()
    override fun getView(position: Int, old: View?, parent: ViewGroup?): View {
      val item = items[position]
      val active = cart[item.id]
      val card = column().apply {
        setPadding(10.dp, 10.dp, 10.dp, 10.dp)
        background = shape(if (active == null) Color.WHITE else Color.rgb(229, 247, 249), 12.dp, if (active == null) 1.dp else 2.dp, if (active == null) line else teal)
        setOnClickListener { addItem(item) }
      }
      card.addView(text(item.name, 16f, ink, true).apply { maxLines = 2 })
      card.addView(text("Rs. ${money(item.price)}", 13f, if (active == null) muted else teal, true).withTop(5.dp))
      if (active == null) {
        card.addView(text("+ Add", 12f, teal, true).apply {
          gravity = Gravity.CENTER
          setPadding(0, 7.dp, 0, 7.dp)
          background = shape(Color.rgb(240, 249, 250), 8.dp, 1.dp, Color.rgb(190, 224, 228))
        }.withTop(10.dp))
      } else {
        card.addView(quantityControls(active).withTop(10.dp))
      }
      return card
    }
  }

  private fun cartLineView(lineItem: CartLine): View {
    val row = row().apply {
      gravity = Gravity.CENTER_VERTICAL
      setPadding(10.dp, 9.dp, 10.dp, 9.dp)
      background = shape(soft, 10.dp, 1.dp, line)
    }
    val copy = column()
    copy.addView(text(lineItem.name, 15f, ink, true))
    copy.addView(text("Rs. ${money(lineItem.price)} x ${formatQty(lineItem.qty)} = Rs. ${money(lineItem.price * lineItem.qty)}", 12f, muted, true))
    row.addView(copy, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    row.addView(quantityControls(lineItem), LinearLayout.LayoutParams(126.dp, 38.dp))
    return row
  }

  private fun quantityControls(lineItem: CartLine): View {
    val controls = row().apply { gravity = Gravity.CENTER_VERTICAL }
    controls.addView(compactButton("-") { changeQty(lineItem.itemId, -1.0) }, LinearLayout.LayoutParams(38.dp, 38.dp))
    controls.addView(text(formatQty(lineItem.qty), 15f, ink, true).apply { gravity = Gravity.CENTER }, LinearLayout.LayoutParams(0, 38.dp, 1f))
    controls.addView(compactButton("+") { changeQty(lineItem.itemId, 1.0) }, LinearLayout.LayoutParams(38.dp, 38.dp))
    return controls
  }

  override fun onCreateOptionsMenu(menu: Menu): Boolean {
    menu.add(0, MENU_SERVER, 0, "Server").setShowAsAction(AndroidMenuItem.SHOW_AS_ACTION_NEVER)
    menu.add(0, MENU_LOGOUT, 1, "Logout").setShowAsAction(AndroidMenuItem.SHOW_AS_ACTION_NEVER)
    return true
  }

  override fun onOptionsItemSelected(item: AndroidMenuItem): Boolean {
    return when (item.itemId) {
      MENU_SERVER -> {
        openServerSetup()
        true
      }
      MENU_LOGOUT -> {
        val token = sessionToken
        currentUser = null
        sessionToken = ""
        Thread { runCatching { postJson("/api/mobile/logout", JSONObject(), token) } }.start()
        loadLoginOptions()
        true
      }
      else -> super.onOptionsItemSelected(item)
    }
  }

  @Deprecated("Deprecated in Java")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode == REQUEST_SERVER && resultCode == RESULT_OK) {
      buildShell()
      loadLoginOptions()
    }
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    when {
      selectedTable != null -> {
        selectedTable = null
        activeOrder = null
        cart.clear()
        renderTables()
      }
      currentUser != null -> renderLogin()
      else -> super.onBackPressed()
    }
  }

  private fun openServerSetup() {
    startActivityForResult(Intent(this, ServerSetupActivity::class.java), REQUEST_SERVER)
  }

  private fun showLoading(message: String) {
    content.removeAllViews()
    val progress = ProgressBar(this)
    val box = column().apply {
      gravity = Gravity.CENTER
      addView(progress, LinearLayout.LayoutParams(54.dp, 54.dp))
      addView(text(message, 15f, muted, true).withTop(14.dp))
    }
    content.addView(box, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 360.dp))
  }

  private fun showStatus(message: String, error: Boolean) {
    statusView.visibility = View.VISIBLE
    statusView.text = message
    statusView.setTextColor(if (error) Color.rgb(185, 28, 28) else teal)
    statusView.background = shape(if (error) Color.rgb(255, 241, 242) else Color.rgb(232, 249, 244), 9.dp, 1.dp, if (error) Color.rgb(254, 205, 211) else Color.rgb(134, 239, 172))
  }

  private fun card(): LinearLayout = column().apply {
    setPadding(18.dp, 18.dp, 18.dp, 18.dp)
    background = shape(Color.WHITE, 16.dp, 1.dp, line)
    elevation = 2.dp.toFloat()
  }

  private fun emptyBox(value: String): TextView = text(value, 15f, muted, true).apply {
    gravity = Gravity.CENTER
    setPadding(12.dp, 22.dp, 12.dp, 22.dp)
    background = shape(soft, 10.dp, 1.dp, line)
  }

  private fun input(hintText: String, inputTypeValue: Int): EditText = EditText(this).apply {
    hint = hintText
    inputType = inputTypeValue
    setSingleLine(true)
    setTextColor(ink)
    setHintTextColor(Color.rgb(126, 144, 166))
    textSize = 16f
    typeface = Typeface.DEFAULT_BOLD
    setPadding(14.dp, 0, 14.dp, 0)
    background = shape(Color.WHITE, 11.dp, 1.dp, Color.rgb(192, 207, 220))
  }

  private fun headerButton(label: String): Button = Button(this).apply {
    text = label
    isAllCaps = false
    setTextColor(ink)
    typeface = Typeface.DEFAULT_BOLD
    background = shape(Color.WHITE, 10.dp, 1.dp, line)
  }

  private fun primaryButton(label: String): Button = Button(this).apply {
    text = label
    isAllCaps = false
    setTextColor(Color.WHITE)
    typeface = Typeface.DEFAULT_BOLD
    background = shape(red, 12.dp)
  }

  private fun actionButton(label: String, fill: Int, color: Int, onClick: () -> Unit): Button = Button(this).apply {
    text = label
    isAllCaps = false
    setTextColor(color)
    typeface = Typeface.DEFAULT_BOLD
    background = shape(fill, 10.dp, 1.dp, if (fill == Color.WHITE) line else fill)
    setOnClickListener { onClick() }
  }

  private fun chip(label: String, active: Boolean, onClick: () -> Unit): Button = Button(this).apply {
    text = label
    isAllCaps = false
    setTextColor(if (active) Color.WHITE else ink)
    typeface = Typeface.DEFAULT_BOLD
    background = shape(if (active) red else Color.WHITE, 10.dp, 1.dp, if (active) red else line)
    setOnClickListener { onClick() }
  }

  private fun compactButton(label: String, onClick: () -> Unit): Button = Button(this).apply {
    text = label
    textSize = 18f
    isAllCaps = false
    setTextColor(if (label == "+") Color.WHITE else ink)
    typeface = Typeface.DEFAULT_BOLD
    minWidth = 0
    minimumWidth = 0
    minHeight = 0
    minimumHeight = 0
    setPadding(0, 0, 0, 0)
    background = shape(if (label == "+") teal else Color.WHITE, 9.dp, 1.dp, line)
    setOnClickListener { onClick() }
  }

  private fun column() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
  private fun row() = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
  private fun text(value: String, size: Float, color: Int, bold: Boolean) = TextView(this).apply {
    text = value
    textSize = size
    setTextColor(color)
    if (bold) typeface = Typeface.DEFAULT_BOLD
  }
  private fun shape(fill: Int, radius: Int, stroke: Int = 0, strokeColor: Int = fill) = GradientDrawable().apply {
    setColor(fill)
    cornerRadius = radius.toFloat()
    if (stroke > 0) setStroke(stroke, strokeColor)
  }
  private fun LinearLayout.withTop(top: Int): LinearLayout {
    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = top }
    return this
  }
  private fun <T : View> T.withTop(top: Int): T {
    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = top }
    return this
  }
  private fun <T : View> T.withHeight(height: Int): T {
    layoutParams = (layoutParams as? LinearLayout.LayoutParams ?: LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, height)).apply { this.height = height }
    return this
  }
  private fun chipParams() = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, 42.dp).apply { rightMargin = 8.dp }
  private fun weight() = LinearLayout.LayoutParams(0, 50.dp, 1f)
  private fun gap() = View(this).apply { layoutParams = LinearLayout.LayoutParams(8.dp, 1) }
  private fun money(value: Double) = String.format(Locale.US, "%.2f", value)
  private fun formatQty(value: Double) = if (value == value.toLong().toDouble()) value.toLong().toString() else String.format(Locale.US, "%.2f", value)
  private val Int.dp: Int get() = (this * resources.displayMetrics.density).toInt()

  private companion object {
    const val REQUEST_SERVER = 700
    const val MENU_SERVER = 701
    const val MENU_LOGOUT = 702
  }
}

private class ApiException(
  val statusCode: Int,
  override val message: String,
  val code: String = "",
  val retryable: Boolean = false,
) : IllegalStateException(message)

data class Bootstrap(
  val version: String = "",
  val businessName: String = "Restaurant",
  val categories: List<CategoryInfo> = emptyList(),
  val tables: List<TableInfo> = emptyList(),
  val menuItems: List<MenuItem> = emptyList(),
  val staff: List<StaffUser> = emptyList(),
  val printers: List<PrinterInfo> = emptyList(),
  val openOrderList: List<OpenOrder> = emptyList(),
  val openOrders: Int = 0,
) {
  companion object {
    fun from(json: JSONObject): Bootstrap {
      val groups = json.optJSONArray("diningTableGroups") ?: JSONArray()
      val tables = mutableListOf<TableInfo>()
      for (i in 0 until groups.length()) {
        val group = groups.optJSONObject(i) ?: continue
        val floor = group.optString("label", "Main")
        val groupTables = group.optJSONArray("tables") ?: JSONArray()
        for (j in 0 until groupTables.length()) {
          val raw = groupTables.opt(j)
          val table = if (raw is JSONObject) raw.optString("name") else raw.toString()
          if (table.isNotBlank()) tables.add(TableInfo(table, floor, 4))
        }
      }
      return Bootstrap(
        version = json.optString("version"),
        businessName = json.optJSONObject("businessProfile")?.optString("businessName")?.ifBlank { null }
          ?: json.optJSONObject("businessProfile")?.optString("ownerName")?.ifBlank { null }
          ?: "Restaurant",
        categories = json.optJSONArray("categories").toCategoryList(),
        tables = tables,
        menuItems = json.optJSONArray("menuItems").toMenuList(),
        staff = json.optJSONArray("staffUsers").toStaffList(),
        printers = json.optJSONArray("printerProfiles").toPrinterList(),
        openOrderList = json.optJSONArray("openOrderList").toOpenOrderList(),
        openOrders = json.optInt("openOrders", 0),
      )
    }
  }
}

data class CategoryInfo(val id: String, val name: String)
data class TableInfo(val name: String, val floor: String, val seats: Int)
data class MenuItem(val id: String, val name: String, val category: String, val price: Double, val taxRate: Double)
data class StaffUser(val id: String, val name: String, val active: Boolean) {
  companion object {
    fun from(json: JSONObject) = StaffUser(json.optString("id"), json.optString("name", "User"), json.optBoolean("active", true))
  }
}
data class PrinterInfo(val id: String, val name: String, val isBillPrinter: Boolean)
data class CartLine(val itemId: String, val name: String, val price: Double, var qty: Double, val taxRate: Double) {
  fun copy() = CartLine(itemId, name, price, qty, taxRate)
}
data class OpenOrder(
  val id: String,
  val billNo: String,
  val status: String,
  val orderType: String,
  val tables: List<String>,
  val cart: List<CartLine>,
  val total: Double,
  val updatedAt: String,
) {
  companion object {
    fun from(json: JSONObject): OpenOrder {
      return OpenOrder(
        json.optString("id"),
        json.optString("billNo"),
        json.optString("status"),
        json.optString("orderType", "Dining"),
        json.optJSONArray("tables").toStringList(),
        json.optJSONArray("cart").toCartList(),
        json.optJSONObject("totals")?.optDouble("total", 0.0) ?: 0.0,
        json.optString("updatedAt"),
      )
    }
  }
}

private fun JSONArray?.toCategoryList(): List<CategoryInfo> {
  if (this == null) return emptyList()
  return (0 until length()).mapNotNull {
    val item = optJSONObject(it) ?: return@mapNotNull null
    CategoryInfo(item.optString("id"), item.optString("label", item.optString("name"))).takeIf { value -> value.id.isNotBlank() && value.name.isNotBlank() }
  }
}

private fun JSONArray?.toMenuList(): List<MenuItem> {
  if (this == null) return emptyList()
  return (0 until length()).mapNotNull {
    val item = optJSONObject(it) ?: return@mapNotNull null
    if (!item.optBoolean("available", true)) return@mapNotNull null
    MenuItem(
      item.optString("id"),
      item.optString("name"),
      item.optString("category"),
      max(0.0, item.optDouble("price", 0.0)),
      max(0.0, item.optDouble("taxRate", 0.0)),
    ).takeIf { value -> value.id.isNotBlank() && value.name.isNotBlank() }
  }
}

private fun JSONArray?.toStaffList(): List<StaffUser> {
  if (this == null) return emptyList()
  return (0 until length()).mapNotNull { optJSONObject(it)?.let(StaffUser::from) }.filter { it.id.isNotBlank() }
}

private fun JSONArray?.toPrinterList(): List<PrinterInfo> {
  if (this == null) return emptyList()
  return (0 until length()).mapNotNull {
    val item = optJSONObject(it) ?: return@mapNotNull null
    PrinterInfo(item.optString("id"), item.optString("name"), item.optBoolean("isBillPrinter")).takeIf { value -> value.id.isNotBlank() }
  }
}

private fun JSONArray?.toOpenOrderList(): List<OpenOrder> {
  if (this == null) return emptyList()
  return (0 until length()).mapNotNull { optJSONObject(it)?.let(OpenOrder::from) }
}

private fun JSONArray?.toStringList(): List<String> {
  if (this == null) return emptyList()
  return (0 until length()).mapNotNull { optString(it).takeIf(String::isNotBlank) }
}

private fun JSONArray?.toCartList(): List<CartLine> {
  if (this == null) return emptyList()
  return (0 until length()).mapNotNull {
    val item = optJSONObject(it) ?: return@mapNotNull null
    CartLine(
      item.optString("itemId"),
      item.optString("name"),
      item.optDouble("price", 0.0),
      item.optDouble("qty", 0.0),
      item.optDouble("taxRate", 0.0),
    ).takeIf { value -> value.itemId.isNotBlank() && value.qty > 0 }
  }
}
