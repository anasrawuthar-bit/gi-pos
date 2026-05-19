import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgePercent,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  Clock3,
  CreditCard,
  Flame,
  Globe2,
  Heart,
  Home,
  ImagePlus,
  Landmark,
  LogOut,
  Minus,
  Monitor,
  MoreVertical,
  Moon,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Star,
  Sun,
  Trash2,
  Truck,
  User,
  UtensilsCrossed,
  Wifi,
  X,
} from 'lucide-react'
import type { CSSProperties, DragEvent } from 'react'
import './App.css'
import type {
  AppUpdateStatus,
  LocalDbSnapshot,
  LocalDbSyncChange,
  PrinterInfo,
  ReceiptPrinterSettings,
} from './types/electron'

type OrderType = 'Dining' | 'Delivery' | 'Take Away' | 'Online'
type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Due' | 'Part'
type PartTenderMethod = 'upi' | 'card'
type ThemeMode = 'light' | 'dark'
type AppView = 'home' | 'pos' | 'reports' | 'profile' | 'sync' | 'users' | 'about'
type ReportPeriodMode = 'custom' | 'monthly' | 'yearly'
type StaffPermission =
  | 'pos_access'
  | 'reports'
  | 'business_profile'
  | 'menu_manage'
  | 'printer_manage'
  | 'cloud_sync'
  | 'user_manage'
  | 'discount_manage'
  | 'due_manage'
  | 'order_delete'

type ReportPeriod = {
  mode: ReportPeriodMode
  from: Date
  to: Date
  label: string
}

type ReportTrendPoint = {
  label: string
  total: number
  cash: number
  bank: number
  due: number
}

type Category = {
  id: string
  label: string
  priority?: number
}

type MenuItem = {
  id: string
  name: string
  category: string
  price: number
  tags?: string[]
  imageDataUrl?: string
}

type CartLine = {
  id: string
  itemId: string
  name: string
  price: number
  qty: number
  taxRate: number
  discountPercent?: number
  description?: string
}

type ItemTag = 'special' | 'hot' | 'favourite'
type OrderStatus = 'unclosed' | 'hold' | 'paid'
type OrderListMode = 'unclosed' | 'hold' | 'orders'
type LineEditMode = 'discount' | 'price' | 'description'
type SuccessAction = 'saved' | 'printed'
type CustomerFilter = 'all' | 'due' | 'clear'
type CustomerSort = 'recent' | 'name' | 'due'

type LineEditor = {
  lineId: string
  mode: LineEditMode
  value: string
}

type OrderTotals = {
  subtotal: number
  discount: number
  tax: number
  serviceCharge: number
  total: number
  paid: number
  balance: number
  change: number
}

type PaymentBreakdown = {
  cash: number
  upi: number
  card: number
}

type SavedOrder = {
  id: string
  billNo: string
  status: OrderStatus
  orderType: OrderType
  table: string
  customerId?: string
  customer: string
  cart: CartLine[]
  discountPercent: number
  servicePercent: number
  paymentMethod: PaymentMethod
  paymentBreakdown: PaymentBreakdown
  amountReceived: number
  totals: OrderTotals
  creditApplied?: boolean
  createdAt: string
  updatedAt: string
}

type CustomerProfile = {
  id: string
  name: string
  phone: string
  address: string
  creditBalance: number
  totalCredit: number
  createdAt: string
  updatedAt: string
}

type ItemDraft = {
  name: string
  category: string
  price: string
  tags: string
  imageDataUrl: string
}

type MenuDisplaySettings = {
  fontSize: number
  itemWidth: number
  itemHeight: number
  sidePanelWidth: number
}

type MenuGridStyle = CSSProperties & {
  '--menu-item-width': string
  '--menu-item-height': string
  '--menu-item-font-size': string
  '--left-menu-width': string
}

type PrinterProfile = {
  id: string
  name: string
  settings: ReceiptPrinterSettings
  createdAt: string
  updatedAt: string
}

type BusinessProfile = {
  businessName: string
  ownerName: string
  branch: string
  phone: string
  email: string
  address: string
  gstin: string
  receiptFooter: string
  logoDataUrl: string
}

type CloudSyncSettings = {
  apiUrl: string
  restaurantId: string
  restaurantName: string
  restaurantOwnerName: string
  restaurantPhone: string
  restaurantEmail: string
  deviceId: string
  deviceName: string
  apiKey: string
  subscriptionPlan: string
  subscriptionStatus: string
  subscriptionExpiresAt: string
  autoSync: boolean
  lastSyncAt: string
}

type CloudPullChange = {
  key: string
  value: unknown
  updatedAt?: string
}

type StaffUserDirectoryEntry = {
  id: string
  name: string
  active: boolean
  updatedAt: string
  lastLoginAt?: string
}

type StaffPinResetCommand = {
  id: string
  staffUserId: string
  staffUserName?: string
  pinSalt: string
  pinHash: string
  requestedAt: string
  requestedBy?: string
}

type CloudPairResponse = {
  restaurant?: {
    id?: string
    name?: string
    owner_name?: string
    ownerName?: string
    phone?: string
    email?: string
    status?: string
  }
  device?: {
    id?: string
    name?: string
  }
  subscription?: {
    plan_name?: string
    status?: string
    expires_at?: string
    max_devices?: number
  }
  apiKey?: string
  replacedOldDevice?: boolean
  transferApplied?: boolean
  loggedOutDevices?: Array<{
    id?: string
    name?: string
  }>
}

type CloudClientRestaurant = {
  id: string
  name: string
  owner_name?: string
  ownerName?: string
  phone?: string
  email?: string
  status: string
  subscription_status?: string
  plan_name?: string
  expires_at?: string
  max_devices?: number
  active_devices?: number
  total_devices?: number
  staffUsers?: StaffUserDirectoryEntry[]
}

type CloudLoginResponse = {
  token?: string
  account?: {
    ownerName?: string
    phone?: string
    email?: string
    status?: string
  }
}

type CloudMeResponse = {
  account?: CloudLoginResponse['account']
  restaurants?: CloudClientRestaurant[]
}

type CloudPullResponse = {
  changes?: CloudPullChange[]
  serverTime?: string
  subscription?: CloudPairResponse['subscription']
  restaurant?: CloudPairResponse['restaurant']
}

type SubscriptionLock = {
  reason: 'cloud_not_connected' | 'internet_required' | 'subscription_expired' | 'device_logged_out'
  message: string
  checkedAt: string
  expiresAt?: string
}

type StaffUser = {
  id: string
  name: string
  pinSalt: string
  pinHash: string
  recoverySalt?: string
  recoveryHash?: string
  recoveryCodeSetAt?: string
  permissions: StaffPermission[]
  active: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

type AuditLogEntry = {
  id: string
  userId: string
  userName: string
  action: string
  detail: string
  createdAt: string
}

const defaultCategories: Category[] = [
  { id: 'all', label: 'Menu' },
  { id: 'starters', label: 'Starters' },
  { id: 'soup', label: 'Soup' },
  { id: 'fresh-juice', label: 'Fresh Juice' },
  { id: 'shake', label: 'Shake' },
  { id: 'ice-cream-shake', label: 'Ice Cream Shake' },
  { id: 'mojito', label: 'Mojito' },
  { id: 'broasted', label: 'Broasted' },
  { id: 'fish-tawa', label: 'Fish Tawa' },
  { id: 'fish-grill', label: 'Fish Grill' },
  { id: 'bread', label: 'Bread' },
  { id: 'tea', label: 'Tea' },
  { id: 'rice', label: 'Fresh Rice' },
].map((category, index) => ({ ...category, priority: index * 10 }))

const defaultMenuItems: MenuItem[] = [
  { id: 'chicken-biriyani', name: 'Chicken Biriyani', category: 'rice', price: 150, tags: ['special', 'hot'] },
  { id: 'beef-biriyani', name: 'Beef Biriyani', category: 'rice', price: 170, tags: ['hot'] },
  { id: 'veg-biriyani', name: 'Veg Biriyani', category: 'rice', price: 115 },
  { id: 'green-salad', name: 'Green Salad', category: 'starters', price: 70, tags: ['favourite'] },
  { id: 'fresh-lime', name: 'Fresh Lime', category: 'fresh-juice', price: 25 },
  { id: 'orange-juice', name: 'Orange Juice', category: 'fresh-juice', price: 80 },
  { id: 'watermelon', name: 'Watermelon Juice', category: 'fresh-juice', price: 60 },
  { id: 'mango-shake', name: 'Mango Shake', category: 'shake', price: 100, tags: ['favourite'] },
  { id: 'vanilla-shake', name: 'Vanilla Shake', category: 'ice-cream-shake', price: 120 },
  { id: 'mint-mojito', name: 'Mint Mojito', category: 'mojito', price: 95 },
  { id: 'chicken-soup', name: 'Chicken Soup', category: 'soup', price: 95 },
  { id: 'porotta', name: 'Porotta', category: 'bread', price: 15 },
  { id: 'chapathi', name: 'Chapathi', category: 'bread', price: 10 },
  { id: 'kubbus', name: 'Kubbus', category: 'bread', price: 10 },
  { id: 'neypathal', name: 'Neypathal', category: 'bread', price: 12 },
  { id: 'nool-porotta', name: 'Nool Porotta', category: 'bread', price: 18 },
  { id: 'romali', name: 'Romali', category: 'bread', price: 15 },
  { id: 'wheat-porotta', name: 'Wheat Porotta', category: 'bread', price: 17 },
  { id: 'fish-tawa', name: 'King Fish Tawa', category: 'fish-tawa', price: 280, tags: ['special'] },
  { id: 'fish-grill', name: 'Pomfret Grill', category: 'fish-grill', price: 360 },
  { id: 'broasted-half', name: 'Broasted Half', category: 'broasted', price: 260, tags: ['hot'] },
  { id: 'black-tea', name: 'Black Tea', category: 'tea', price: 12 },
  { id: 'milk-tea', name: 'Milk Tea', category: 'tea', price: 15 },
]

const orderTypes: OrderType[] = ['Dining', 'Delivery', 'Take Away', 'Online']
const paymentMethods: PaymentMethod[] = ['Cash', 'UPI', 'Card', 'Due', 'Part']
const quickTags: Array<{ id: ItemTag; label: string }> = [
  { id: 'special', label: 'Special' },
  { id: 'hot', label: 'Hot Item' },
  { id: 'favourite', label: 'Favourite' },
]
const customerFilters: Array<{ id: CustomerFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'due', label: 'Due' },
  { id: 'clear', label: 'No Due' },
]
const customerSortOptions: Array<{ id: CustomerSort; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'name', label: 'Name' },
  { id: 'due', label: 'Due High' },
]
const staffPermissions: Array<{ id: StaffPermission; label: string; description: string }> = [
  { id: 'pos_access', label: 'POS Billing', description: 'Create, hold, save, and print bills' },
  { id: 'reports', label: 'Reports', description: 'View sales, cash, bank, and bill reports' },
  { id: 'business_profile', label: 'Business Profile', description: 'Change billing name, logo, GSTIN, and footer' },
  { id: 'menu_manage', label: 'Menu Setup', description: 'Create categories, items, prices, and photos' },
  { id: 'printer_manage', label: 'Printer Manage', description: 'Change bill and KOT printer profiles' },
  { id: 'cloud_sync', label: 'Cloud Sync', description: 'Change sync settings and run manual sync' },
  { id: 'user_manage', label: 'User Manage', description: 'Create staff and set permissions' },
  { id: 'discount_manage', label: 'Discounts', description: 'Apply bill or item discounts' },
  { id: 'due_manage', label: 'Due Management', description: 'Save credit and mark due as paid' },
  { id: 'order_delete', label: 'Delete Orders', description: 'Delete saved, hold, or unclosed orders' },
]
const allStaffPermissionIds = staffPermissions.map((permission) => permission.id)
const defaultCashierPermissions: StaffPermission[] = ['pos_access']
const maxLoginAttempts = 5
const loginLockMs = 2 * 60 * 1000
const idleLockMs = 10 * 60 * 1000
const autoSyncIntervalMs = 60 * 1000
const autoSyncStartupDelayMs = 5 * 1000

const firstBillNumber = 1
const tableList = Array.from({ length: 24 }, (_, index) => `T${index + 1}`)
const appName = 'GI POS Restaurant'
const appOwner = 'GI'
const appVersion = '1.1.19'
const appIconUrl = `${import.meta.env.BASE_URL}app_icon.ico`
const companyName = 'GI Hostings'
const companyWebsite = 'https://www.gihostings.com'
const staffDirectorySyncKey = 'pos-staff-user-directory'
const staffPinResetCommandKey = 'pos-staff-pin-reset-commands'
const mainAppDeviceName = 'Main App'
const companyWebsiteDisplay = 'gihostings.com'

const defaultBusinessProfile: BusinessProfile = {
  businessName: '',
  ownerName: '',
  branch: 'Main Branch',
  phone: '',
  email: '',
  address: '',
  gstin: '',
  receiptFooter: 'Thank you. Visit again.',
  logoDataUrl: '',
}

const defaultCloudSyncSettings: CloudSyncSettings = {
  apiUrl: 'https://goldensea.gihostings.in',
  restaurantId: '',
  restaurantName: '',
  restaurantOwnerName: '',
  restaurantPhone: '',
  restaurantEmail: '',
  deviceId: '',
  deviceName: '',
  apiKey: '',
  subscriptionPlan: '',
  subscriptionStatus: '',
  subscriptionExpiresAt: '',
  autoSync: false,
  lastSyncAt: '',
}

const defaultUpdateStatus: AppUpdateStatus = {
  state: 'idle',
  message: 'Update check not started',
  version: appVersion,
}

const defaultMenuDisplaySettings: MenuDisplaySettings = {
  fontSize: 12,
  itemWidth: 116,
  itemHeight: 122,
  sidePanelWidth: 86,
}

const menuDisplayLimits: Record<keyof MenuDisplaySettings, { min: number; max: number }> = {
  fontSize: { min: 10, max: 18 },
  itemWidth: { min: 90, max: 220 },
  itemHeight: { min: 88, max: 220 },
  sidePanelWidth: { min: 70, max: 150 },
}

const defaultPrinterSettings: ReceiptPrinterSettings = {
  mode: 'system',
  deviceName: '',
  ipAddress: '192.168.1.50',
  port: '9100',
  paperWidth: '80',
}

const defaultBillPrinterProfileId = 'bill-printer'

const initialCart: CartLine[] = []

function App() {
  const [categoryList, setCategoryList] = useState<Category[]>(() =>
    normalizeCategories(loadStoredArray('pos-categories', defaultCategories)),
  )
  const [menuList, setMenuList] = useState<MenuItem[]>(() => loadStoredArray('pos-menu-items', defaultMenuItems))
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>(() =>
    loadStoredArray<SavedOrder>('pos-orders', []).map(normalizeSavedOrderPayment),
  )
  const [customers, setCustomers] = useState<CustomerProfile[]>(() => loadStoredArray('pos-customers', []))
  const [activeView, setActiveView] = useState<AppView>('home')
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() =>
    normalizeBusinessProfile(loadStoredObject('pos-business-profile', defaultBusinessProfile)),
  )
  const [cloudSyncSettings, setCloudSyncSettings] = useState<CloudSyncSettings>(() =>
    normalizeCloudSyncSettings(loadStoredObject('pos-cloud-sync-settings', defaultCloudSyncSettings)),
  )
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(() =>
    normalizeStaffUsers(loadStoredArray('pos-staff-users', [])),
  )
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() => loadStoredArray('pos-audit-log', []))
  const [menuDisplaySettings, setMenuDisplaySettings] = useState<MenuDisplaySettings>(() =>
    normalizeMenuDisplaySettings(loadStoredObject('pos-menu-display-settings', defaultMenuDisplaySettings)),
  )
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [activeOrderId, setActiveOrderId] = useState(() => createOrderId())
  const [billNumber, setBillNumber] = useState(() => getInitialBillNumber(savedOrders))
  const [activeCategory, setActiveCategory] = useState('bread')
  const [activeQuickTag, setActiveQuickTag] = useState<ItemTag | null>(null)
  const [search, setSearch] = useState('')
  const [orderType, setOrderType] = useState<OrderType>('Dining')
  const [cart, setCart] = useState<CartLine[]>(initialCart)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [table, setTable] = useState('')
  const [customer, setCustomer] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>('all')
  const [customerSort, setCustomerSort] = useState<CustomerSort>('recent')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [servicePercent, setServicePercent] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [amountReceivedOverride, setAmountReceivedOverride] = useState<number | null>(null)
  const [partTenderMethod, setPartTenderMethod] = useState<PartTenderMethod>('upi')
  const [printerOpen, setPrinterOpen] = useState(false)
  const [kotPrintOpen, setKotPrintOpen] = useState(false)
  const [menuEditorOpen, setMenuEditorOpen] = useState(false)
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false)
  const [tableSelectorOpen, setTableSelectorOpen] = useState(false)
  const [customerEditorOpen, setCustomerEditorOpen] = useState(false)
  const [discountEditorOpen, setDiscountEditorOpen] = useState(false)
  const [orderListMode, setOrderListMode] = useState<OrderListMode | null>(null)
  const [orderListDate, setOrderListDate] = useState(() => formatDateInputValue(new Date()))
  const [reportOpen, setReportOpen] = useState(false)
  const [reportPeriodMode, setReportPeriodMode] = useState<ReportPeriodMode>('monthly')
  const [reportFromDate, setReportFromDate] = useState(() => formatDateInputValue(startOfMonth(new Date())))
  const [reportToDate, setReportToDate] = useState(() => formatDateInputValue(new Date()))
  const [reportMonth, setReportMonth] = useState(() => formatMonthInputValue(new Date()))
  const [reportYear, setReportYear] = useState(() => String(new Date().getFullYear()))
  const [lineActionId, setLineActionId] = useState<string | null>(null)
  const [lineEditor, setLineEditor] = useState<LineEditor | null>(null)
  const [successOrder, setSuccessOrder] = useState<SavedOrder | null>(null)
  const [successAction, setSuccessAction] = useState<SuccessAction>('saved')
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem('pos-theme')
    return savedTheme === 'dark' ? 'dark' : 'light'
  })
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [itemDraft, setItemDraft] = useState<ItemDraft>(() => ({
    name: '',
    category: 'bread',
    price: '',
    tags: '',
    imageDataUrl: '',
  }))
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [printerStatus, setPrinterStatus] = useState('Ready')
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>(() => loadInitialPrinterProfiles())
  const [activePrinterProfileId, setActivePrinterProfileId] = useState(
    () => localStorage.getItem('active-printer-profile-id') || defaultBillPrinterProfileId,
  )
  const [billPrinterProfileId, setBillPrinterProfileId] = useState(
    () => localStorage.getItem('bill-printer-profile-id') || defaultBillPrinterProfileId,
  )
  const [printerProfileName, setPrinterProfileName] = useState('')
  const [storageReady, setStorageReady] = useState(() => !hasDesktopDataStore())
  const [localDatabasePath, setLocalDatabasePath] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState('Cloud sync not configured')
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [subscriptionLock, setSubscriptionLock] = useState<SubscriptionLock | null>(null)
  const [loginCheckingCloud, setLoginCheckingCloud] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus>(defaultUpdateStatus)
  const [accountPanelOpen, setAccountPanelOpen] = useState(false)
  const [forgotPinOpen, setForgotPinOpen] = useState(false)
  const [forgotRecoveryCode, setForgotRecoveryCode] = useState('')
  const [forgotNewPin, setForgotNewPin] = useState('')
  const [forgotNewPinConfirm, setForgotNewPinConfirm] = useState('')
  const [forgotStatus, setForgotStatus] = useState('')
  const skipPersistenceRef = useRef(false)
  const syncInFlightRef = useRef(false)
  const businessProfileRef = useRef(businessProfile)
  const cloudSyncSettingsRef = useRef(cloudSyncSettings)
  const staffUsersRef = useRef(staffUsers)
  const runCloudSyncRef = useRef<(trigger: 'manual' | 'auto') => Promise<boolean>>(async () => false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [loginUserId, setLoginUserId] = useState('')
  const [loginPin, setLoginPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [loginLockedUntil, setLoginLockedUntil] = useState(0)
  const [setupCloudApiUrl, setSetupCloudApiUrl] = useState(() => defaultCloudSyncSettings.apiUrl)
  const [setupCloudLogin, setSetupCloudLogin] = useState('')
  const [setupCloudPassword, setSetupCloudPassword] = useState('')
  const [setupTransferCode, setSetupTransferCode] = useState('')
  const [setupOwnerPin, setSetupOwnerPin] = useState('')
  const [setupOwnerPinConfirm, setSetupOwnerPinConfirm] = useState('')
  const [setupCloudToken, setSetupCloudToken] = useState('')
  const [setupRestaurants, setSetupRestaurants] = useState<CloudClientRestaurant[]>([])
  const [setupRestaurantId, setSetupRestaurantId] = useState('')
  const [setupStatus, setSetupStatus] = useState('')
  const [setupWorking, setSetupWorking] = useState(false)
  const [syncCloudLogin, setSyncCloudLogin] = useState('')
  const [syncCloudPassword, setSyncCloudPassword] = useState('')
  const [syncTransferCode, setSyncTransferCode] = useState('')
  const [syncCloudToken, setSyncCloudToken] = useState('')
  const [syncRestaurants, setSyncRestaurants] = useState<CloudClientRestaurant[]>([])
  const [syncRestaurantId, setSyncRestaurantId] = useState('')
  const [staffEditorId, setStaffEditorId] = useState<string | null>(null)
  const [staffName, setStaffName] = useState('')
  const [staffPin, setStaffPin] = useState('')
  const [staffPinConfirm, setStaffPinConfirm] = useState('')
  const [staffEditorPermissions, setStaffEditorPermissions] = useState<StaffPermission[]>(defaultCashierPermissions)
  const [staffEditorActive, setStaffEditorActive] = useState(true)
  const [staffEditorStatus, setStaffEditorStatus] = useState('')

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()

    return menuList.filter((item) => {
      const inCategory = activeCategory === 'all' || item.category === activeCategory
      const inQuickTag = !activeQuickTag || item.tags?.includes(activeQuickTag)
      const inSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(query))

      return inCategory && inQuickTag && inSearch
    })
  }, [activeCategory, activeQuickTag, menuList, search])

  const orderedCategoryList = useMemo(() => sortCategories(categoryList), [categoryList])

  const editableCategories = useMemo(
    () => orderedCategoryList.filter((category) => category.id !== 'all'),
    [orderedCategoryList],
  )

  const editorItems = useMemo(
    () =>
      menuList
        .filter((item) => itemDraft.category === 'all' || item.category === itemDraft.category)
        .sort((first, second) => first.name.localeCompare(second.name)),
    [itemDraft.category, menuList],
  )

  const openOrders = useMemo(
    () => savedOrders.filter((order) => order.status === 'unclosed' || order.status === 'hold'),
    [savedOrders],
  )

  const activeSavedOrder = useMemo(
    () => savedOrders.find((order) => order.id === activeOrderId),
    [activeOrderId, savedOrders],
  )

  const tableStatus = useMemo(() => {
    const status = new Map<string, SavedOrder>()
    openOrders.forEach((order) => {
      if (order.orderType === 'Dining' && order.table) {
        status.set(order.table, order)
      }
    })

    return status
  }, [openOrders])

  const selectedOrderListDay = useMemo(() => parseDateInputValue(orderListDate, new Date()), [orderListDate])

  const visibleOrders = useMemo(() => {
    let orders = savedOrders

    if (orderListMode === 'unclosed') {
      orders = savedOrders.filter((order) => order.status === 'unclosed')
    } else if (orderListMode === 'hold') {
      orders = savedOrders.filter((order) => order.status === 'hold')
    } else if (orderListMode === 'orders') {
      orders = savedOrders.filter((order) => isSameBusinessDay(order.createdAt, selectedOrderListDay))
    }

    return [...orders].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
  }, [orderListMode, savedOrders, selectedOrderListDay])

  const report = useMemo(() => buildReport(savedOrders), [savedOrders])
  const reportPeriod = useMemo(
    () => getReportPeriod(reportPeriodMode, reportFromDate, reportToDate, reportMonth, reportYear),
    [reportFromDate, reportMonth, reportPeriodMode, reportToDate, reportYear],
  )
  const periodReport = useMemo(() => buildReport(savedOrders, reportPeriod), [reportPeriod, savedOrders])
  const bestReportTrendPoint = useMemo(
    () =>
      periodReport.trendData.reduce<ReportTrendPoint | null>(
        (bestPoint, point) => (!bestPoint || point.total > bestPoint.total ? point : bestPoint),
        null,
      ),
    [periodReport.trendData],
  )
  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase()
    const matches = query
      ? customers.filter((profile) =>
          [profile.name, profile.phone, profile.address].some((value) => value.toLowerCase().includes(query)),
        )
      : customers
    const filteredMatches = matches.filter((profile) => {
      if (customerFilter === 'due') {
        return profile.creditBalance > 0
      }

      if (customerFilter === 'clear') {
        return profile.creditBalance <= 0
      }

      return true
    })

    return [...filteredMatches].sort((first, second) => {
      if (customerSort === 'name') {
        return first.name.localeCompare(second.name)
      }

      if (customerSort === 'due') {
        const dueDifference = second.creditBalance - first.creditBalance
        return dueDifference || first.name.localeCompare(second.name)
      }

      return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
    })
  }, [customerFilter, customerSearch, customerSort, customers])
  const customerStats = useMemo(() => {
    const dueCustomers = customers.filter((profile) => profile.creditBalance > 0)

    return {
      total: customers.length,
      dueCount: dueCustomers.length,
      dueTotal: roundMoney(dueCustomers.reduce((sum, profile) => sum + profile.creditBalance, 0)),
    }
  }, [customers])
  const selectedCustomerProfile = useMemo(
    () => customers.find((profile) => profile.id === selectedCustomerId),
    [customers, selectedCustomerId],
  )
  const activeStaffUsers = useMemo(() => staffUsers.filter((staffUser) => staffUser.active), [staffUsers])
  const selectedSetupRestaurant = useMemo(
    () => setupRestaurants.find((restaurant) => restaurant.id === setupRestaurantId) ?? null,
    [setupRestaurantId, setupRestaurants],
  )
  const selectedSetupStaffUsers = useMemo(
    () =>
      (selectedSetupRestaurant?.staffUsers ?? [])
        .filter((staffUser) => staffUser.active !== false)
        .sort((first, second) => first.name.localeCompare(second.name)),
    [selectedSetupRestaurant],
  )
  const selectedSyncRestaurant = useMemo(
    () => syncRestaurants.find((restaurant) => restaurant.id === syncRestaurantId) ?? null,
    [syncRestaurantId, syncRestaurants],
  )
  const selectedSyncStaffUsers = useMemo(
    () =>
      (selectedSyncRestaurant?.staffUsers ?? [])
        .filter((staffUser) => staffUser.active !== false)
        .sort((first, second) => first.name.localeCompare(second.name)),
    [selectedSyncRestaurant],
  )
  const cloudSignupBusinessProfile = useMemo(
    () =>
      normalizeCloudSignupBusinessProfile({
        name: cloudSyncSettings.restaurantName,
        ownerName: cloudSyncSettings.restaurantOwnerName,
        phone: cloudSyncSettings.restaurantPhone,
        email: cloudSyncSettings.restaurantEmail,
      }),
    [
      cloudSyncSettings.restaurantEmail,
      cloudSyncSettings.restaurantName,
      cloudSyncSettings.restaurantOwnerName,
      cloudSyncSettings.restaurantPhone,
    ],
  )
  const hasCloudSignupBusinessProfile = hasCloudSignupDetails(cloudSignupBusinessProfile)
  const currentUser = useMemo(
    () => staffUsers.find((staffUser) => staffUser.id === currentUserId && staffUser.active) ?? null,
    [currentUserId, staffUsers],
  )
  const selectedStaffEditorUser = useMemo(
    () => (staffEditorId ? (staffUsers.find((staffUser) => staffUser.id === staffEditorId) ?? null) : null),
    [staffEditorId, staffUsers],
  )
  const isOwnerStaffEditor = Boolean(selectedStaffEditorUser && isOwnerStaffUser(selectedStaffEditorUser))
  const currentPermissionSet = useMemo(
    () => new Set(currentUser?.permissions ?? []),
    [currentUser?.permissions],
  )
  const recentAuditLog = useMemo(() => auditLog.slice(0, 8), [auditLog])
  const billPrinterProfile = useMemo(
    () =>
      printerProfiles.find((profile) => profile.id === billPrinterProfileId) ??
      printerProfiles.find((profile) => profile.id === defaultBillPrinterProfileId) ??
      printerProfiles[0],
    [billPrinterProfileId, printerProfiles],
  )
  const activePrinterProfile = useMemo(
    () => printerProfiles.find((profile) => profile.id === activePrinterProfileId) ?? billPrinterProfile,
    [activePrinterProfileId, billPrinterProfile, printerProfiles],
  )
  const billPrinterSettings = billPrinterProfile?.settings ?? defaultPrinterSettings
  const activePrinterSettings = activePrinterProfile?.settings ?? defaultPrinterSettings

  const menuGridStyle = useMemo<MenuGridStyle>(
    () => ({
      '--menu-item-width': `${menuDisplaySettings.itemWidth}px`,
      '--menu-item-height': `${menuDisplaySettings.itemHeight}px`,
      '--menu-item-font-size': `${menuDisplaySettings.fontSize}px`,
      '--left-menu-width': `${menuDisplaySettings.sidePanelWidth}px`,
    }),
    [menuDisplaySettings],
  )

  const baseTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, line) => sum + lineTotal(line), 0)
    const discount = roundMoney((subtotal * discountPercent) / 100)
    const taxable = subtotal - discount
    const tax = roundMoney(cart.reduce((sum, line) => sum + (lineTotal(line) * line.taxRate) / 100, 0))
    const serviceCharge = roundMoney((taxable * servicePercent) / 100)
    const total = roundMoney(Math.max(0, taxable + tax + serviceCharge))

    return { subtotal, discount, tax, serviceCharge, total }
  }, [cart, discountPercent, servicePercent])

  const cashReceived =
    paymentMethod === 'Cash' || paymentMethod === 'Part'
      ? (amountReceivedOverride ?? (paymentMethod === 'Cash' ? baseTotals.total : 0))
      : 0
  const partAutoAmount =
    paymentMethod === 'Part' ? roundMoney(Math.max(baseTotals.total - Math.max(cashReceived, 0), 0)) : 0
  const paymentBreakdown: PaymentBreakdown = useMemo(
    () => {
      if (paymentMethod === 'Part') {
        return {
          cash: roundMoney(Math.max(cashReceived, 0)),
          upi: partTenderMethod === 'upi' ? partAutoAmount : 0,
          card: partTenderMethod === 'card' ? partAutoAmount : 0,
        }
      }

      if (paymentMethod === 'UPI') {
        return { cash: 0, upi: baseTotals.total, card: 0 }
      }

      if (paymentMethod === 'Card') {
        return { cash: 0, upi: 0, card: baseTotals.total }
      }

      return {
        cash: paymentMethod === 'Cash' ? roundMoney(Math.max(cashReceived, 0)) : 0,
        upi: 0,
        card: 0,
      }
    },
    [baseTotals.total, cashReceived, partAutoAmount, partTenderMethod, paymentMethod],
  )
  const amountReceived = roundMoney(paymentBreakdown.cash + paymentBreakdown.upi + paymentBreakdown.card)

  const totals = useMemo(() => {
    const paid = paymentMethod === 'Due' ? 0 : Math.min(amountReceived, baseTotals.total)
    const balance = roundMoney(Math.max(baseTotals.total - amountReceived, 0))
    const change = paymentMethod === 'Due' ? 0 : roundMoney(Math.max(amountReceived - baseTotals.total, 0))

    return { ...baseTotals, paid, balance, change }
  }, [amountReceived, baseTotals, paymentMethod])

  useEffect(() => {
    businessProfileRef.current = businessProfile
  }, [businessProfile])

  useEffect(() => {
    cloudSyncSettingsRef.current = cloudSyncSettings
  }, [cloudSyncSettings])

  useEffect(() => {
    staffUsersRef.current = staffUsers
  }, [staffUsers])

  useEffect(() => {
    let cancelled = false

    if (!window.posDb) {
      return
    }

    window.posDb
      .load()
      .then((snapshot) => {
        if (cancelled) {
          return
        }

        const loadedCategories = normalizeCategories(
          readDbValue(snapshot, 'pos-categories', loadStoredArray('pos-categories', defaultCategories)),
        )
        const loadedMenuItems = readDbValue(snapshot, 'pos-menu-items', loadStoredArray('pos-menu-items', defaultMenuItems))
        const loadedOrders = readDbValue<SavedOrder[]>(snapshot, 'pos-orders', loadStoredArray('pos-orders', [])).map(
          normalizeSavedOrderPayment,
        )
        const loadedCustomers = readDbValue<CustomerProfile[]>(
          snapshot,
          'pos-customers',
          loadStoredArray('pos-customers', []),
        )
        const loadedBusinessProfile = normalizeBusinessProfile(
          readDbValue(snapshot, 'pos-business-profile', loadStoredObject('pos-business-profile', defaultBusinessProfile)),
        )
        const loadedCloudSyncSettings = normalizeCloudSyncSettings(
          readDbValue(
            snapshot,
            'pos-cloud-sync-settings',
            loadStoredObject('pos-cloud-sync-settings', defaultCloudSyncSettings),
          ),
        )
        const loadedStaffUsers = normalizeStaffUsers(
          readDbValue(snapshot, 'pos-staff-users', loadStoredArray('pos-staff-users', [])),
        )
        const loadedAuditLog = readDbValue<AuditLogEntry[]>(
          snapshot,
          'pos-audit-log',
          loadStoredArray('pos-audit-log', []),
        )
        const loadedMenuDisplaySettings = normalizeMenuDisplaySettings(
          readDbValue(
            snapshot,
            'pos-menu-display-settings',
            loadStoredObject('pos-menu-display-settings', defaultMenuDisplaySettings),
          ),
        )
        const loadedPrinterProfiles = normalizePrinterProfiles(
          readDbValue(snapshot, 'printer-profiles', loadInitialPrinterProfiles()),
        )
        const loadedBillPrinterProfileId = readDbValue(
          snapshot,
          'bill-printer-profile-id',
          localStorage.getItem('bill-printer-profile-id') || defaultBillPrinterProfileId,
        )
        const loadedActivePrinterProfileId = readDbValue(
          snapshot,
          'active-printer-profile-id',
          localStorage.getItem('active-printer-profile-id') || defaultBillPrinterProfileId,
        )
        const loadedTheme = readDbValue(snapshot, 'pos-theme', localStorage.getItem('pos-theme') || 'light')

        setCategoryList(loadedCategories)
        setMenuList(loadedMenuItems)
        setSavedOrders(loadedOrders)
        setCustomers(loadedCustomers)
        businessProfileRef.current = loadedBusinessProfile
        setBusinessProfile(loadedBusinessProfile)
        setCloudSyncSettings(loadedCloudSyncSettings)
        setStaffUsers(loadedStaffUsers)
        setAuditLog(loadedAuditLog)
        setMenuDisplaySettings(loadedMenuDisplaySettings)
        setPrinterProfiles(loadedPrinterProfiles)
        setBillPrinterProfileId(loadedBillPrinterProfileId)
        setActivePrinterProfileId(loadedActivePrinterProfileId)
        setBillNumber(getInitialBillNumber(loadedOrders))
        setTheme(loadedTheme === 'dark' ? 'dark' : 'light')
        setLocalDatabasePath(snapshot.path)
        setPrinterStatus('Local SQLite database ready')
      })
      .catch((error) => {
        if (!cancelled) {
          setPrinterStatus(`Local DB load failed: ${getErrorMessage(error)}`)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStorageReady(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    persistStoredValue('printer-profiles', printerProfiles, storageReady && !skipPersistenceRef.current)
  }, [printerProfiles, storageReady])

  useEffect(() => {
    const validBillProfile = billPrinterProfile?.id ?? defaultBillPrinterProfileId
    persistStoredValue('bill-printer-profile-id', validBillProfile, storageReady && !skipPersistenceRef.current, validBillProfile)
  }, [billPrinterProfile?.id, storageReady])

  useEffect(() => {
    const validActiveProfile = activePrinterProfile?.id ?? billPrinterProfile?.id ?? defaultBillPrinterProfileId
    persistStoredValue(
      'active-printer-profile-id',
      validActiveProfile,
      storageReady && !skipPersistenceRef.current,
      validActiveProfile,
    )
  }, [activePrinterProfile?.id, billPrinterProfile?.id, storageReady])

  useEffect(() => {
    persistStoredValue('pos-categories', categoryList, storageReady && !skipPersistenceRef.current)
  }, [categoryList, storageReady])

  useEffect(() => {
    persistStoredValue('pos-menu-items', menuList, storageReady && !skipPersistenceRef.current)
  }, [menuList, storageReady])

  useEffect(() => {
    persistStoredValue('pos-orders', savedOrders, storageReady && !skipPersistenceRef.current)
  }, [savedOrders, storageReady])

  useEffect(() => {
    persistStoredValue('pos-customers', customers, storageReady && !skipPersistenceRef.current)
  }, [customers, storageReady])

  useEffect(() => {
    persistStoredValue('pos-business-profile', businessProfile, storageReady && !skipPersistenceRef.current)
  }, [businessProfile, storageReady])

  useEffect(() => {
    persistStoredValue('pos-cloud-sync-settings', cloudSyncSettings, storageReady && !skipPersistenceRef.current)
  }, [cloudSyncSettings, storageReady])

  useEffect(() => {
    persistStoredValue('pos-staff-users', staffUsers, storageReady && !skipPersistenceRef.current)
  }, [staffUsers, storageReady])

  useEffect(() => {
    if (!storageReady || skipPersistenceRef.current) {
      return
    }

    const directory = getStaffUserDirectory(staffUsers)
    const value = JSON.stringify(directory)
    localStorage.setItem(staffDirectorySyncKey, value)

    if (window.posDb) {
      void window.posDb.set(staffDirectorySyncKey, value).catch(() => undefined)
    }
  }, [staffUsers, storageReady])

  useEffect(() => {
    persistStoredValue('pos-audit-log', auditLog, storageReady && !skipPersistenceRef.current)
  }, [auditLog, storageReady])

  useEffect(() => {
    persistStoredValue('pos-menu-display-settings', menuDisplaySettings, storageReady && !skipPersistenceRef.current)
  }, [menuDisplaySettings, storageReady])

  useEffect(() => {
    persistStoredValue(
      'pos-next-bill-number',
      billNumber,
      storageReady && !skipPersistenceRef.current,
      String(billNumber),
    )
  }, [billNumber, storageReady])

  useEffect(() => {
    persistStoredValue('pos-theme', theme, storageReady && !skipPersistenceRef.current, theme)
  }, [theme, storageReady])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!window.posUpdater) {
      setUpdateStatus({
        ...defaultUpdateStatus,
        state: 'disabled',
        message: 'Auto update is available only inside the desktop app.',
      })
      return undefined
    }

    let mounted = true
    window.posUpdater.getStatus().then((status) => {
      if (mounted) {
        setUpdateStatus(normalizeUpdateStatus(status))
      }
    }).catch(() => undefined)

    const unsubscribe = window.posUpdater.onStatus((status) => {
      setUpdateStatus(normalizeUpdateStatus(status))
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (activeView !== 'sync') {
      return
    }

    let cancelled = false

    if (!window.posDb || !storageReady) {
      return
    }

    window.posDb
      .getPendingSync(500)
      .then((pending) => {
        if (!cancelled) {
          setPendingSyncCount(pending.changes.length)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPendingSyncCount(0)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeView, storageReady])

  useEffect(() => {
    if (!storageReady || !cloudSyncSettings.autoSync) {
      return undefined
    }

    if (!window.posDb) {
      setSyncStatus('Auto sync is available only inside the desktop app')
      return undefined
    }

    if (
      !normalizeApiUrl(cloudSyncSettings.apiUrl) ||
      !cloudSyncSettings.restaurantId.trim() ||
      !cloudSyncSettings.deviceId.trim() ||
      !cloudSyncSettings.apiKey.trim()
    ) {
      setSyncStatus('Auto sync enabled. Pair cloud device to start.')
      return undefined
    }

    let cancelled = false
    const runAutoSync = () => {
      if (!cancelled) {
        void runCloudSyncRef.current('auto')
      }
    }

    setSyncStatus((status) =>
      status.toLowerCase().includes('failed') ? status : 'Auto sync enabled. First sync will run shortly.',
    )
    const startupTimer = window.setTimeout(runAutoSync, autoSyncStartupDelayMs)
    const intervalTimer = window.setInterval(runAutoSync, autoSyncIntervalMs)
    window.addEventListener('online', runAutoSync)

    return () => {
      cancelled = true
      window.clearTimeout(startupTimer)
      window.clearInterval(intervalTimer)
      window.removeEventListener('online', runAutoSync)
    }
  }, [
    cloudSyncSettings.apiKey,
    cloudSyncSettings.apiUrl,
    cloudSyncSettings.autoSync,
    cloudSyncSettings.deviceId,
    cloudSyncSettings.restaurantId,
    storageReady,
  ])

  useEffect(() => {
    if (!currentUser) {
      return
    }

    let idleTimer = 0
    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        setCurrentUserId('')
        setLoginPin('')
        setLoginError('App locked after idle timeout')
        setActiveView('home')
      }, idleLockMs)
    }
    const events = ['pointerdown', 'keydown', 'touchstart']

    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer))
    resetIdleTimer()

    return () => {
      window.clearTimeout(idleTimer)
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer))
    }
  }, [currentUser])

  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0)
  const billingBusinessName = businessProfile.businessName.trim()
  const billingOwnerName = businessProfile.ownerName.trim()
  const billingDisplayName = billingBusinessName || 'Billing business not set'
  const receiptBusinessName = billingBusinessName || 'Restaurant'
  const hasCloudDeviceConnection = Boolean(
    cloudSyncSettings.restaurantId.trim() &&
      cloudSyncSettings.deviceId.trim() &&
      cloudSyncSettings.apiKey.trim(),
  )
  const hasSubscriptionAccess = !subscriptionLock

  function hasPermission(permission: StaffPermission) {
    return currentPermissionSet.has(permission)
  }

  function canOpenView(view: AppView) {
    if (!currentUser) {
      return false
    }

    if (view === 'home' || view === 'about') return true
    if (!hasSubscriptionAccess) {
      return view === 'sync' && hasPermission('cloud_sync')
    }

    if (view === 'pos') return hasPermission('pos_access')
    if (view === 'reports') return hasPermission('reports')
    if (view === 'profile') return hasPermission('business_profile')
    if (view === 'sync') return hasPermission('cloud_sync')
    if (view === 'users') return hasPermission('user_manage')

    return false
  }

  function goToView(view: AppView) {
    if (!canOpenView(view)) {
      setPrinterStatus(subscriptionLock?.message ?? 'Permission required')
      return
    }

    setActiveView(view)
  }

  function requirePermission(permission: StaffPermission, message = 'Permission required') {
    if (!hasSubscriptionAccess && permission !== 'cloud_sync') {
      setPrinterStatus(subscriptionLock?.message ?? 'Subscription check required')
      return false
    }

    if (hasPermission(permission)) {
      return true
    }

    setPrinterStatus(message)
    return false
  }

  function recordAudit(action: string, detail: string, user = currentUser) {
    const now = new Date().toISOString()
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId: user?.id ?? 'system',
      userName: user?.name ?? 'System',
      action,
      detail,
      createdAt: now,
    }

    setAuditLog((entries) => [entry, ...entries].slice(0, 250))
  }

  async function loginCloudForSetup() {
    const apiUrl = normalizeApiUrl(setupCloudApiUrl)
    const login = setupCloudLogin.trim()
    const password = setupCloudPassword

    if (!apiUrl || !login || !password) {
      setSetupStatus('Cloud URL, phone/email, and password are required')
      return
    }

    setSetupWorking(true)
    setSetupStatus('Logging in to cloud...')

    try {
      const loginResponse = await fetch(`${apiUrl}/api/v1/client/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login, password }),
      })
      const loginResult = await parseCloudResponse<CloudLoginResponse>(loginResponse)
      const token = String(loginResult.token || '')

      if (!token) {
        throw new Error('Cloud login response missing token')
      }

      const meResponse = await fetch(`${apiUrl}/api/v1/client/me`, {
        headers: { 'content-type': 'application/json', 'x-client-token': token },
      })
      const meResult = await parseCloudResponse<CloudMeResponse>(meResponse)
      const restaurants = Array.isArray(meResult.restaurants) ? meResult.restaurants : []
      const preferredRestaurant = restaurants.find((restaurant) => restaurant.status === 'approved') ?? restaurants[0]

      setSetupCloudApiUrl(apiUrl)
      setSetupCloudToken(token)
      setSetupRestaurants(restaurants)
      setSetupRestaurantId(preferredRestaurant?.id ?? '')
      setSetupStatus(
        restaurants.length
          ? 'Cloud login success. Select restaurant and restore data.'
          : 'Cloud login success, but no restaurant is linked to this account.',
      )
    } catch (error) {
      setSetupStatus(`Cloud login failed: ${getCloudErrorMessage(error, apiUrl)}`)
    } finally {
      setSetupWorking(false)
    }
  }

  async function restoreCloudDataForSetup() {
    if (!window.posDb) {
      setSetupStatus('Cloud restore works inside the desktop app only')
      return
    }

    const apiUrl = normalizeApiUrl(setupCloudApiUrl)
    const restaurantId = setupRestaurantId
    const deviceName = mainAppDeviceName
    const transferCode = normalizeTransferCode(setupTransferCode)
    const createOwnerLogin = selectedSetupStaffUsers.length === 0

    if (!apiUrl || !setupCloudToken || !restaurantId) {
      setSetupStatus('Login to cloud and select restaurant first')
      return
    }

    if (setupTransferCode.trim() && transferCode.length !== 6) {
      setSetupStatus('Transfer code must be 6 digits')
      return
    }

    if (createOwnerLogin) {
      const pinError = validatePin(setupOwnerPin, setupOwnerPinConfirm)
      if (pinError) {
        setSetupStatus(pinError)
        return
      }
    }

    setSetupWorking(true)
    setSetupStatus('Activating this device...')

    try {
      const activateResponse = await fetch(
        `${apiUrl}/api/v1/client/restaurants/${encodeURIComponent(restaurantId)}/devices/activate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-client-token': setupCloudToken },
          body: JSON.stringify({ deviceName, ...(transferCode ? { transferCode } : {}) }),
        },
      )
      const activateResult = await parseCloudResponse<CloudPairResponse>(activateResponse)
      const activatedRestaurantId = String(activateResult.restaurant?.id || restaurantId)
      const activatedDeviceId = String(activateResult.device?.id || '')
      const apiKey = String(activateResult.apiKey || '')

      if (!activatedRestaurantId || !activatedDeviceId || !apiKey) {
        throw new Error('Device activation response missing sync credentials')
      }

      setSetupStatus('Restoring server data to local SQLite...')
      const snapshot = await pullCloudSnapshot(apiUrl, activatedRestaurantId, activatedDeviceId, apiKey, '')
      const restoredStaffUsers = getStaffUsersFromCloudChanges(snapshot.changes)

      if (snapshot.changes.length) {
        await window.posDb.applyRemoteValues(
          snapshot.changes.map((change) => ({
            key: change.key,
            value: JSON.stringify(change.value),
            updatedAt: change.updatedAt,
          })),
        )
        await window.posDb.clearPendingSync()
        applyCloudPullChanges(snapshot.changes)
      }

      const cloudProfile = normalizeCloudSignupBusinessProfile(activateResult.restaurant, selectedSetupRestaurant)
      const nextCloudSettings: CloudSyncSettings = {
        ...cloudSyncSettingsRef.current,
        apiUrl,
        restaurantId: activatedRestaurantId,
        restaurantName: cloudProfile.businessName || String(activateResult.restaurant?.name || selectedSetupRestaurant?.name || ''),
        restaurantOwnerName: cloudProfile.ownerName || '',
        restaurantPhone: cloudProfile.phone || '',
        restaurantEmail: cloudProfile.email || '',
        deviceId: activatedDeviceId,
        deviceName: String(activateResult.device?.name || deviceName),
        apiKey,
        subscriptionPlan: String(activateResult.subscription?.plan_name || ''),
        subscriptionStatus: String(activateResult.subscription?.status || ''),
        subscriptionExpiresAt: String(activateResult.subscription?.expires_at || ''),
        autoSync: true,
        lastSyncAt: snapshot.serverTime,
      }

      cloudSyncSettingsRef.current = nextCloudSettings
      setCloudSyncSettings(nextCloudSettings)
      localStorage.setItem('pos-cloud-sync-settings', JSON.stringify(nextCloudSettings))
      await window.posDb.set('pos-cloud-sync-settings', JSON.stringify(nextCloudSettings))
      setSetupTransferCode('')
      setPendingSyncCount(0)
      applyCloudSignupBusinessProfile(cloudProfile)
      const transferNote = activateResult.transferApplied
        ? ` Old ${activateResult.loggedOutDevices?.length || 0} device(s) logged out.`
        : ''
      if (restoredStaffUsers.length) {
        setLoginUserId(restoredStaffUsers.find((staffUser) => staffUser.active)?.id ?? restoredStaffUsers[0].id)
        setLoginPin('')
        setLoginError('')
        setForgotPinOpen(false)
        setSetupStatus(
          `Cloud restore complete. ${snapshot.changes.length} item(s) restored.${transferNote} Login with your old app user PIN.`,
        )
      } else {
        const pin = await hashPin(setupOwnerPin)
        const now = new Date().toISOString()
        const ownerUser: StaffUser = {
          id: createStaffUserId(),
          name: 'Owner',
          pinSalt: pin.salt,
          pinHash: pin.hash,
          permissions: allStaffPermissionIds,
          active: true,
          createdAt: now,
          updatedAt: now,
        }
        const usersValue = JSON.stringify([ownerUser])
        const directoryValue = JSON.stringify(getStaffUserDirectory([ownerUser]))

        staffUsersRef.current = [ownerUser]
        setStaffUsers([ownerUser])
        localStorage.setItem('pos-staff-users', usersValue)
        localStorage.setItem(staffDirectorySyncKey, directoryValue)
        await window.posDb.set('pos-staff-users', usersValue)
        await window.posDb.set(staffDirectorySyncKey, directoryValue)
        setLoginUserId(ownerUser.id)
        setLoginPin('')
        setLoginError('')
        setForgotPinOpen(false)
        setSetupOwnerPin('')
        setSetupOwnerPinConfirm('')
        setSetupStatus(
          `Cloud restore complete.${transferNote} Owner login created. Login with the new Owner PIN.`,
        )
      }
    } catch (error) {
      setSetupStatus(`Cloud restore failed: ${getCloudErrorMessage(error, apiUrl)}`)
    } finally {
      setSetupWorking(false)
    }
  }

  async function checkCloudAccessForLogin(user: StaffUser) {
    const settings = cloudSyncSettingsRef.current
    const apiUrl = normalizeApiUrl(settings.apiUrl)
    const restaurantId = settings.restaurantId.trim()
    const deviceId = settings.deviceId.trim()
    const apiKey = settings.apiKey.trim()

    if (!apiUrl || !restaurantId || !deviceId || !apiKey) {
      return {
        status: 'blocked' as const,
        lock: createSubscriptionLock(
          'cloud_not_connected',
          'Cloud connection is required at login. Owner must connect Cloud Sync before billing.',
          settings.subscriptionExpiresAt,
        ),
      }
    }

    try {
      const snapshot = await pullCloudSnapshot(apiUrl, restaurantId, deviceId, apiKey, settings.lastSyncAt)

      if (snapshot.changes.length && window.posDb) {
        await window.posDb.applyRemoteValues(
          snapshot.changes.map((change) => ({
            key: change.key,
            value: JSON.stringify(change.value),
            updatedAt: change.updatedAt,
          })),
        )
        applyCloudPullChanges(snapshot.changes)
      }

      const subscription = snapshot.subscription
      const cloudProfile = normalizeCloudSignupBusinessProfile(snapshot.restaurant)
      const lastSyncAt = snapshot.serverTime || new Date().toISOString()
      const nextSettings: CloudSyncSettings = {
        ...settings,
        apiUrl,
        restaurantName: cloudProfile.businessName || settings.restaurantName,
        restaurantOwnerName: cloudProfile.ownerName || settings.restaurantOwnerName,
        restaurantPhone: cloudProfile.phone || settings.restaurantPhone,
        restaurantEmail: cloudProfile.email || settings.restaurantEmail,
        subscriptionPlan: String(subscription?.plan_name || settings.subscriptionPlan),
        subscriptionStatus: String(subscription?.status || settings.subscriptionStatus || 'active'),
        subscriptionExpiresAt: String(subscription?.expires_at || settings.subscriptionExpiresAt),
        lastSyncAt,
      }

      cloudSyncSettingsRef.current = nextSettings
      setCloudSyncSettings(nextSettings)
      localStorage.setItem('pos-cloud-sync-settings', JSON.stringify(nextSettings))
      await window.posDb?.set('pos-cloud-sync-settings', JSON.stringify(nextSettings))
      applyCloudSignupBusinessProfile(cloudProfile)

      const cloudStaffUsers = getStaffUsersFromCloudChanges(snapshot.changes)
      const latestStaffUsers = cloudStaffUsers.length ? cloudStaffUsers : staffUsersRef.current
      const latestUser =
        latestStaffUsers.find((staffUser) => staffUser.id === user.id) ??
        (cloudStaffUsers.length ? { ...user, active: false } : user)

      return {
        status: 'active' as const,
        user: latestUser,
        pulledCount: snapshot.changes.length,
      }
    } catch (error) {
      const message = getCloudErrorMessage(error, apiUrl)

      if (isCloudDeviceLoggedOutMessage(message)) {
        return {
          status: 'device_logged_out' as const,
          message: 'This device is logged out from cloud. Restore or connect this PC again from Cloud Sync.',
        }
      }

      const reason = isSubscriptionExpiredMessage(message) ? 'subscription_expired' : 'internet_required'
      const lockMessage =
        reason === 'subscription_expired'
          ? 'Subscription expired or inactive. Billing screens are locked until renewal.'
          : message

      return {
        status: 'blocked' as const,
        lock: createSubscriptionLock(reason, lockMessage, settings.subscriptionExpiresAt),
      }
    }
  }

  async function loginWithPin() {
    const userId = loginUserId || activeStaffUsers[0]?.id || ''
    const user = activeStaffUsers.find((staffUser) => staffUser.id === userId)
    const now = Date.now()

    if (loginLockedUntil > now) {
      setLoginError(`Too many wrong attempts. Try again at ${formatTime(new Date(loginLockedUntil))}`)
      return
    }

    if (!user) {
      setLoginError('Select active user')
      return
    }

    const ok = await verifyPin(loginPin, user.pinSalt, user.pinHash)
    if (!ok) {
      handleWrongPin(user)
      return
    }

    setLoginCheckingCloud(true)
    setLoginError('Checking cloud subscription...')

    try {
      const cloudCheck = await checkCloudAccessForLogin(user)

      if (cloudCheck.status === 'device_logged_out') {
        setLoginPin('')
        setLoginError(cloudCheck.message)
        await handleCloudDeviceLoggedOut()
        return
      }

      if (cloudCheck.status === 'blocked') {
        setSubscriptionLock(cloudCheck.lock)
        setActiveView('home')
        completePinLogin(user, 'limited')
        return
      }

      const latestUser = cloudCheck.user
      if (!latestUser.active) {
        setLoginPin('')
        setLoginError('This app user is disabled from cloud. Ask owner/admin to enable it.')
        recordAudit('login_blocked', `${latestUser.name} disabled by cloud`, latestUser)
        return
      }

      if (!(await verifyPin(loginPin, latestUser.pinSalt, latestUser.pinHash))) {
        handleWrongPin(latestUser, 'PIN changed from cloud. Enter the latest PIN.')
        return
      }

      setSubscriptionLock(null)
      completePinLogin(latestUser)
      setSyncStatus(`Subscription verified. Last checked ${formatTime(new Date())}.`)
    } finally {
      setLoginCheckingCloud(false)
    }
  }

  function handleWrongPin(user: StaffUser, messagePrefix = 'Wrong PIN') {
    const nextAttempts = loginAttempts + 1
    setLoginAttempts(nextAttempts)
    setLoginPin('')
    recordAudit('login_failed', `${messagePrefix} for ${user.name}`, user)

    if (nextAttempts >= maxLoginAttempts) {
      setLoginLockedUntil(Date.now() + loginLockMs)
      setLoginAttempts(0)
      setLoginError('Too many wrong attempts. Login locked for 2 minutes')
    } else {
      setLoginError(`${messagePrefix}. ${maxLoginAttempts - nextAttempts} attempt(s) left`)
    }
  }

  function completePinLogin(user: StaffUser, mode: 'full' | 'limited' = 'full') {
    const loginTime = new Date().toISOString()
    setStaffUsers((users) =>
      users.map((staffUser) => (staffUser.id === user.id ? { ...staffUser, lastLoginAt: loginTime } : staffUser)),
    )
    setCurrentUserId(user.id)
    setLoginUserId(user.id)
    setLoginPin('')
    setLoginError('')
    setLoginAttempts(0)
    setLoginLockedUntil(0)
    recordAudit(mode === 'limited' ? 'login_limited' : 'login_success', `${user.name} logged in`, user)
  }

  function lockApp() {
    if (currentUser) {
      recordAudit('app_locked', `${currentUser.name} locked the app`)
    }

    setCurrentUserId('')
    setLoginPin('')
    setActiveView('home')
  }

  function openAccountPanel() {
    setAccountPanelOpen(true)
  }

  function openAccountView(view: AppView) {
    setAccountPanelOpen(false)
    goToView(view)
  }

  async function resetPinWithRecovery() {
    const userId = loginUserId || activeStaffUsers[0]?.id || ''
    const user = activeStaffUsers.find((staffUser) => staffUser.id === userId)
    const pinError = validatePin(forgotNewPin, forgotNewPinConfirm)

    if (!user) {
      setForgotStatus('Select active user')
      return
    }

    if (!user.recoverySalt || !user.recoveryHash) {
      setForgotStatus('Recovery code not created for this user. Ask an admin to reset PIN from User Manage.')
      return
    }

    if (!forgotRecoveryCode.trim()) {
      setForgotStatus('Recovery code required')
      return
    }

    if (pinError) {
      setForgotStatus(pinError)
      return
    }

    const recoveryOk = await verifyPin(normalizeRecoveryCode(forgotRecoveryCode), user.recoverySalt, user.recoveryHash)
    if (!recoveryOk) {
      setForgotStatus('Recovery code is wrong')
      recordAudit('forgot_pin_failed', `Wrong recovery code for ${user.name}`, user)
      return
    }

    const pin = await hashPin(forgotNewPin)
    const now = new Date().toISOString()
    setStaffUsers((users) =>
      users.map((staffUser) =>
        staffUser.id === user.id ? { ...staffUser, pinSalt: pin.salt, pinHash: pin.hash, updatedAt: now } : staffUser,
      ),
    )
    setLoginUserId(user.id)
    setForgotRecoveryCode('')
    setForgotNewPin('')
    setForgotNewPinConfirm('')
    setForgotStatus('PIN reset successfully. Login with the new PIN.')
    setLoginError('')
    recordAudit('forgot_pin_reset', `${user.name} reset PIN using recovery code`, user)
  }

  function startNewStaffUser() {
    if (!requirePermission('user_manage')) {
      return
    }

    setStaffEditorId(null)
    setStaffName('')
    setStaffPin('')
    setStaffPinConfirm('')
    setStaffEditorPermissions(defaultCashierPermissions)
    setStaffEditorActive(true)
    setStaffEditorStatus('')
  }

  function editStaffUser(user: StaffUser) {
    if (!requirePermission('user_manage')) {
      return
    }

    setStaffEditorId(user.id)
    setStaffName(user.name)
    setStaffPin('')
    setStaffPinConfirm('')
    setStaffEditorPermissions(user.permissions)
    setStaffEditorActive(user.active)
    setStaffEditorStatus(
      isOwnerStaffUser(user)
        ? 'Owner user is protected. Permissions and status are read-only; enter a new PIN only if you want to change it.'
        : 'Leave PIN empty to keep current PIN',
    )
  }

  function toggleStaffPermission(permission: StaffPermission) {
    if (isOwnerStaffEditor) {
      setStaffEditorStatus('Owner permissions are read-only')
      return
    }

    setStaffEditorPermissions((permissions) =>
      permissions.includes(permission)
        ? permissions.filter((savedPermission) => savedPermission !== permission)
        : [...permissions, permission],
    )
  }

  async function saveStaffUser() {
    if (!requirePermission('user_manage')) {
      return
    }

    const name = staffName.trim()
    const existing = staffEditorId ? staffUsers.find((staffUser) => staffUser.id === staffEditorId) : undefined
    const pinRequired = !existing
    const pinError = staffPin || staffPinConfirm || pinRequired ? validatePin(staffPin, staffPinConfirm) : ''

    if (!name) {
      setStaffEditorStatus('Staff name required')
      return
    }

    if (!staffEditorPermissions.length) {
      setStaffEditorStatus('Select at least one permission')
      return
    }

    if (existing?.id === currentUser?.id && (!staffEditorActive || !staffEditorPermissions.includes('user_manage'))) {
      setStaffEditorStatus('Cannot remove your own admin access')
      return
    }

    if (existing?.active && !staffEditorActive && activeStaffUsers.length <= 1) {
      setStaffEditorStatus('At least one active user is required')
      return
    }

    if (pinError) {
      setStaffEditorStatus(pinError)
      return
    }

    const now = new Date().toISOString()
    const pin = staffPin ? await hashPin(staffPin) : null

    if (existing && isOwnerStaffUser(existing)) {
      if (!pin) {
        setStaffEditorStatus('Owner user is read-only. Enter a new PIN to change PIN.')
        return
      }

      const updatedOwner = {
        ...existing,
        pinSalt: pin.salt,
        pinHash: pin.hash,
        updatedAt: now,
      }
      setStaffUsers((users) =>
        users.map((staffUser) => (staffUser.id === existing.id ? updatedOwner : staffUser)),
      )
      setStaffPin('')
      setStaffPinConfirm('')
      setStaffEditorStatus('Owner PIN changed successfully')
      recordAudit('owner_pin_changed', `${existing.name} PIN changed from User Manage`)
      return
    }

    const user: StaffUser = {
      id: existing?.id ?? createStaffUserId(),
      name,
      pinSalt: pin?.salt ?? existing?.pinSalt ?? '',
      pinHash: pin?.hash ?? existing?.pinHash ?? '',
      permissions: staffEditorPermissions,
      active: staffEditorActive,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastLoginAt: existing?.lastLoginAt,
    }

    setStaffUsers((users) => {
      if (existing) {
        return users.map((staffUser) => (staffUser.id === existing.id ? user : staffUser))
      }

      return [user, ...users]
    })
    setStaffEditorStatus(`${name} saved`)
    setStaffPin('')
    setStaffPinConfirm('')
    setStaffEditorId(user.id)
    recordAudit(existing ? 'user_updated' : 'user_created', `${name} permissions saved`)
  }

  function updateBusinessProfile(field: keyof BusinessProfile, value: string) {
    if (!requirePermission('business_profile')) {
      return
    }

    setBusinessProfile((profile) => ({ ...profile, [field]: value }))
  }

  function updateCloudSyncSetting(field: keyof CloudSyncSettings, value: string | boolean) {
    if (!requirePermission('cloud_sync')) {
      return
    }

    setCloudSyncSettings((settings) => ({ ...settings, [field]: value }))
  }

  function terminateCloudConnection() {
    if (!requirePermission('cloud_sync')) {
      return
    }

    const confirmed = window.confirm(
      'Terminate this cloud connection and return to the fresh cloud login screen? Local bills and menu data stay on this PC.',
    )

    if (!confirmed) {
      return
    }

    const apiUrl = normalizeApiUrl(cloudSyncSettingsRef.current.apiUrl) || defaultCloudSyncSettings.apiUrl
    const nextSettings: CloudSyncSettings = {
      ...defaultCloudSyncSettings,
      apiUrl,
      restaurantId: '',
      restaurantName: '',
      restaurantOwnerName: '',
      restaurantPhone: '',
      restaurantEmail: '',
      deviceId: '',
      deviceName: '',
      apiKey: '',
      autoSync: false,
      lastSyncAt: '',
    }
    const emptyStaffUsers: StaffUser[] = []
    const emptyDirectory: StaffUserDirectoryEntry[] = []
    const settingsValue = JSON.stringify(nextSettings)
    const usersValue = JSON.stringify(emptyStaffUsers)
    const directoryValue = JSON.stringify(emptyDirectory)

    cloudSyncSettingsRef.current = nextSettings
    staffUsersRef.current = emptyStaffUsers
    setCloudSyncSettings(nextSettings)
    setStaffUsers(emptyStaffUsers)
    setCurrentUserId('')
    setLoginUserId('')
    setLoginPin('')
    setLoginError('')
    setLoginAttempts(0)
    setLoginLockedUntil(0)
    setSubscriptionLock(null)
    setAccountPanelOpen(false)
    setActiveView('home')
    setSetupCloudApiUrl(apiUrl)
    setSetupCloudLogin('')
    setSetupCloudPassword('')
    setSetupCloudToken('')
    setSetupRestaurants([])
    setSetupRestaurantId('')
    setSetupTransferCode('')
    setSetupStatus('Connection terminated. Login with cloud account to restore app users again.')
    setSyncCloudToken('')
    setSyncRestaurants([])
    setSyncRestaurantId('')
    setSyncCloudPassword('')
    setSyncTransferCode('')
    setSyncStatus('Connection terminated')
    localStorage.setItem('pos-cloud-sync-settings', settingsValue)
    localStorage.setItem('pos-staff-users', usersValue)
    localStorage.setItem(staffDirectorySyncKey, directoryValue)
    void window.posDb?.set('pos-cloud-sync-settings', settingsValue).catch(() => undefined)
    void window.posDb?.set('pos-staff-users', usersValue).catch(() => undefined)
    void window.posDb?.set(staffDirectorySyncKey, directoryValue).catch(() => undefined)
  }

  function saveBusinessProfile(nextProfile: BusinessProfile) {
    const normalizedProfile = normalizeBusinessProfile(nextProfile)

    businessProfileRef.current = normalizedProfile
    setBusinessProfile(normalizedProfile)
    localStorage.setItem('pos-business-profile', JSON.stringify(normalizedProfile))
    void window.posDb?.set('pos-business-profile', JSON.stringify(normalizedProfile)).catch(() => undefined)
  }

  function applyCloudSignupBusinessProfile(cloudProfile: Partial<BusinessProfile>, overwrite = false) {
    if (!hasCloudSignupDetails(cloudProfile)) {
      return false
    }

    const currentProfile = businessProfileRef.current
    const nextProfile = mergeBusinessProfileWithCloudSignup(currentProfile, cloudProfile, overwrite)

    if (isSameBusinessProfile(currentProfile, nextProfile)) {
      return false
    }

    saveBusinessProfile(nextProfile)
    return true
  }

  function useCloudSignupInBusinessProfile() {
    if (!requirePermission('business_profile')) {
      return
    }

    if (applyCloudSignupBusinessProfile(cloudSignupBusinessProfile, true)) {
      setPrinterStatus('Business Profile updated from client signup details')
    } else {
      setPrinterStatus('No cloud signup details available to update Business Profile')
    }
  }

  async function refreshPendingSyncCount() {
    if (!window.posDb || !storageReady) {
      setPendingSyncCount(0)
      return
    }

    try {
      const pending = await window.posDb.getPendingSync(500)
      setPendingSyncCount(pending.changes.length)
    } catch {
      setPendingSyncCount(0)
    }
  }

  async function checkForAppUpdate() {
    if (!window.posUpdater) {
      setUpdateStatus({
        ...defaultUpdateStatus,
        state: 'disabled',
        message: 'Auto update is available only inside the desktop app.',
      })
      return
    }

    setUpdateStatus((status) => ({ ...status, state: 'checking', message: 'Checking for updates...' }))

    try {
      const status = await window.posUpdater.check()
      setUpdateStatus(normalizeUpdateStatus(status))
    } catch (error) {
      setUpdateStatus((status) => ({ ...status, state: 'error', message: getErrorMessage(error) }))
    }
  }

  async function installAppUpdate() {
    if (!window.posUpdater) {
      return
    }

    try {
      const status = await window.posUpdater.install()
      setUpdateStatus(normalizeUpdateStatus(status))
    } catch (error) {
      setUpdateStatus((status) => ({ ...status, state: 'error', message: getErrorMessage(error) }))
    }
  }

  async function loginCloudForSync() {
    if (!requirePermission('cloud_sync')) {
      return
    }

    const apiUrl = normalizeApiUrl(cloudSyncSettings.apiUrl)
    const login = syncCloudLogin.trim()
    const password = syncCloudPassword

    if (!apiUrl || !login || !password) {
      setSyncStatus('Cloud URL, phone/email, and password are required')
      return
    }

    setSyncing(true)
    setSyncStatus('Logging in to cloud account...')

    try {
      const loginResponse = await fetch(`${apiUrl}/api/v1/client/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login, password }),
      })
      const loginResult = await parseCloudResponse<CloudLoginResponse>(loginResponse)
      const token = String(loginResult.token || '')

      if (!token) {
        throw new Error('Cloud login response missing token')
      }

      const meResponse = await fetch(`${apiUrl}/api/v1/client/me`, {
        headers: { 'content-type': 'application/json', 'x-client-token': token },
      })
      const meResult = await parseCloudResponse<CloudMeResponse>(meResponse)
      const restaurants = Array.isArray(meResult.restaurants) ? meResult.restaurants : []
      const preferredRestaurant =
        restaurants.find((restaurant) => restaurant.id === cloudSyncSettings.restaurantId) ??
        restaurants.find((restaurant) => restaurant.status === 'approved') ??
        restaurants[0]

      setSyncCloudToken(token)
      setSyncRestaurants(restaurants)
      setSyncRestaurantId(preferredRestaurant?.id ?? '')
      setSyncStatus(
        restaurants.length
          ? 'Cloud login success. Select restaurant and connect this device.'
          : 'Cloud login success, but no restaurant is linked to this account.',
      )
    } catch (error) {
      setSyncStatus(`Cloud login failed: ${getCloudErrorMessage(error, apiUrl)}`)
    } finally {
      setSyncing(false)
    }
  }

  async function connectCloudDeviceFromAccount() {
    if (!requirePermission('cloud_sync')) {
      return
    }

    const apiUrl = normalizeApiUrl(cloudSyncSettings.apiUrl)
    const restaurantId = syncRestaurantId
    const deviceName = mainAppDeviceName
    const transferCode = normalizeTransferCode(syncTransferCode)

    if (!apiUrl || !syncCloudToken || !restaurantId) {
      setSyncStatus('Login to cloud and select restaurant first')
      return
    }

    if (syncTransferCode.trim() && transferCode.length !== 6) {
      setSyncStatus('Transfer code must be 6 digits')
      return
    }

    setSyncing(true)
    setSyncStatus('Activating this device...')

    try {
      const activateResponse = await fetch(
        `${apiUrl}/api/v1/client/restaurants/${encodeURIComponent(restaurantId)}/devices/activate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-client-token': syncCloudToken },
          body: JSON.stringify({ deviceName, ...(transferCode ? { transferCode } : {}) }),
        },
      )
      const result = await parseCloudResponse<CloudPairResponse>(activateResponse)
      const activatedRestaurantId = String(result.restaurant?.id || restaurantId)
      const deviceId = String(result.device?.id || '')
      const apiKey = String(result.apiKey || '')

      if (!activatedRestaurantId || !deviceId || !apiKey) {
        throw new Error('Device activation response missing sync credentials')
      }

      const cloudProfile = normalizeCloudSignupBusinessProfile(result.restaurant, selectedSyncRestaurant)
      const nextSettings: CloudSyncSettings = {
        ...cloudSyncSettingsRef.current,
        apiUrl,
        restaurantId: activatedRestaurantId,
        restaurantName: cloudProfile.businessName || String(result.restaurant?.name || selectedSyncRestaurant?.name || ''),
        restaurantOwnerName: cloudProfile.ownerName || '',
        restaurantPhone: cloudProfile.phone || '',
        restaurantEmail: cloudProfile.email || '',
        deviceId,
        deviceName: String(result.device?.name || deviceName),
        apiKey,
        subscriptionPlan: String(result.subscription?.plan_name || ''),
        subscriptionStatus: String(result.subscription?.status || ''),
        subscriptionExpiresAt: String(result.subscription?.expires_at || ''),
        autoSync: true,
        lastSyncAt: '',
      }

      cloudSyncSettingsRef.current = nextSettings
      setCloudSyncSettings(nextSettings)
      localStorage.setItem('pos-cloud-sync-settings', JSON.stringify(nextSettings))
      await window.posDb?.set('pos-cloud-sync-settings', JSON.stringify(nextSettings))
      setSyncCloudPassword('')
      setSyncTransferCode('')
      applyCloudSignupBusinessProfile(cloudProfile)
      setSyncStatus(
        result.transferApplied
          ? `Device transferred. Old ${result.loggedOutDevices?.length || 0} device(s) logged out. Running first cloud sync...`
          : 'Device connected. Running first cloud sync...',
      )
      await runCloudSync('manual')
    } catch (error) {
      setSyncStatus(`Device connect failed: ${getCloudErrorMessage(error, apiUrl)}`)
    } finally {
      setSyncing(false)
    }
  }

  async function syncCloudNow() {
    if (!requirePermission('cloud_sync')) {
      return
    }

    await runCloudSync('manual')
  }

  async function handleCloudDeviceLoggedOut() {
    const nextSettings: CloudSyncSettings = {
      ...cloudSyncSettingsRef.current,
      deviceId: '',
      apiKey: '',
      autoSync: false,
      lastSyncAt: '',
    }

    cloudSyncSettingsRef.current = nextSettings
    setCloudSyncSettings(nextSettings)
    localStorage.setItem('pos-cloud-sync-settings', JSON.stringify(nextSettings))
    await window.posDb?.set('pos-cloud-sync-settings', JSON.stringify(nextSettings))
    setCurrentUserId('')
    setLoginPin('')
    setActiveView('home')
    setSyncStatus('This device was logged out because cloud access moved to another PC.')
  }

  async function runCloudSync(trigger: 'manual' | 'auto') {
    if (!window.posDb) {
      if (trigger === 'manual') {
        setSyncStatus('Run inside desktop app for cloud sync')
      }
      return false
    }

    if (syncInFlightRef.current) {
      if (trigger === 'manual') {
        setSyncStatus('Sync already running')
      }
      return false
    }

    const settings = cloudSyncSettingsRef.current
    const apiUrl = normalizeApiUrl(settings.apiUrl)
    const restaurantId = settings.restaurantId.trim()
    const deviceId = settings.deviceId.trim()
    const apiKey = settings.apiKey.trim()

    if (!apiUrl || !restaurantId || !deviceId || !apiKey) {
      if (trigger === 'manual') {
        setSyncStatus('Cloud URL, Restaurant ID, Device ID, and API Key required')
      }
      return false
    }

    syncInFlightRef.current = true
    setSyncing(true)
    setSyncStatus(trigger === 'auto' ? 'Auto sync running...' : 'Syncing pending local changes...')

    try {
      await window.posDb.set('pos-staff-users', JSON.stringify(staffUsersRef.current))
      await window.posDb.set(staffDirectorySyncKey, JSON.stringify(getStaffUserDirectory(staffUsersRef.current)))
      const pending = await window.posDb.getPendingSync(500)
      const pushedCount = await pushCloudChanges(apiUrl, restaurantId, deviceId, apiKey, pending.changes)

      setSyncStatus('Pulling latest cloud data...')
      const pulledSnapshot = await pullCloudSnapshot(apiUrl, restaurantId, deviceId, apiKey, settings.lastSyncAt)
      const pulledChanges = pulledSnapshot.changes
      const cloudProfile = normalizeCloudSignupBusinessProfile(pulledSnapshot.restaurant)

      if (pulledChanges.length) {
        await window.posDb.applyRemoteValues(
          pulledChanges.map((change) => ({
            key: change.key,
            value: JSON.stringify(change.value),
            updatedAt: change.updatedAt,
          })),
        )
        applyCloudPullChanges(pulledChanges)
      }

      const lastSyncAt = pulledSnapshot.serverTime || new Date().toISOString()
      setSubscriptionLock(null)
      setCloudSyncSettings((settings) => {
        const nextSettings = {
          ...settings,
          apiUrl,
          restaurantName: cloudProfile.businessName || settings.restaurantName,
          restaurantOwnerName: cloudProfile.ownerName || settings.restaurantOwnerName,
          restaurantPhone: cloudProfile.phone || settings.restaurantPhone,
          restaurantEmail: cloudProfile.email || settings.restaurantEmail,
          subscriptionPlan: String(pulledSnapshot.subscription?.plan_name || settings.subscriptionPlan),
          subscriptionStatus: String(pulledSnapshot.subscription?.status || settings.subscriptionStatus || 'active'),
          subscriptionExpiresAt: String(pulledSnapshot.subscription?.expires_at || settings.subscriptionExpiresAt),
          lastSyncAt,
        }
        cloudSyncSettingsRef.current = nextSettings
        return nextSettings
      })
      applyCloudSignupBusinessProfile(cloudProfile)
      setPendingSyncCount(0)
      setSyncStatus(
        `${trigger === 'auto' ? 'Auto sync complete' : 'Sync complete'}. Pushed ${pushedCount}, pulled ${pulledChanges.length}.`,
      )
      return true
    } catch (error) {
      const message = getCloudErrorMessage(error, apiUrl)
      if (isCloudDeviceLoggedOutMessage(message)) {
        await handleCloudDeviceLoggedOut()
      } else if (isSubscriptionExpiredMessage(message)) {
        setSubscriptionLock(
          createSubscriptionLock(
            'subscription_expired',
            'Subscription expired or inactive. Billing screens are locked until renewal.',
            settings.subscriptionExpiresAt,
          ),
        )
        setActiveView('home')
        setSyncStatus(`${trigger === 'auto' ? 'Auto sync' : 'Sync'} failed: ${message}`)
      } else {
        setSyncStatus(`${trigger === 'auto' ? 'Auto sync' : 'Sync'} failed: ${message}`)
      }
      return false
    } finally {
      syncInFlightRef.current = false
      setSyncing(false)
    }
  }

  runCloudSyncRef.current = runCloudSync

  async function pushCloudChanges(
    apiUrl: string,
    restaurantId: string,
    deviceId: string,
    apiKey: string,
    changes: LocalDbSyncChange[],
  ) {
    if (!changes.length) {
      return 0
    }

    const response = await fetch(`${apiUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: getCloudSyncHeaders(restaurantId, deviceId, apiKey),
      body: JSON.stringify({ changes }),
    })
    const result = await parseCloudResponse<{ acceptedIds?: string[] }>(response)
    const acceptedIds = Array.isArray(result.acceptedIds) ? result.acceptedIds : []

    if (acceptedIds.length) {
      await window.posDb?.markSynced(acceptedIds)
    }

    return acceptedIds.length
  }

  async function pullCloudSnapshot(apiUrl: string, restaurantId: string, deviceId: string, apiKey: string, since: string) {
    const response = await fetch(`${apiUrl}/api/v1/sync/pull?since=${encodeURIComponent(since || '')}`, {
      headers: getCloudSyncHeaders(restaurantId, deviceId, apiKey),
    })
    const result = await parseCloudResponse<CloudPullResponse>(response)

    return {
      changes: Array.isArray(result.changes) ? result.changes : [],
      serverTime: String(result.serverTime || new Date().toISOString()),
      subscription: result.subscription,
      restaurant: result.restaurant,
    }
  }

  function applyCloudPullChanges(changes: CloudPullChange[]) {
    skipPersistenceRef.current = true
    window.setTimeout(() => {
      skipPersistenceRef.current = false
    }, 350)

    for (const change of changes) {
      switch (change.key) {
        case 'pos-business-profile':
          {
            const nextBusinessProfile = normalizeBusinessProfile(change.value as BusinessProfile)
            businessProfileRef.current = nextBusinessProfile
            setBusinessProfile(nextBusinessProfile)
          }
          break
        case 'pos-categories':
          setCategoryList(normalizeCategories(Array.isArray(change.value) ? (change.value as Category[]) : defaultCategories))
          break
        case 'pos-customers':
          setCustomers(Array.isArray(change.value) ? (change.value as CustomerProfile[]) : [])
          break
        case 'pos-menu-items':
          setMenuList(Array.isArray(change.value) ? (change.value as MenuItem[]) : defaultMenuItems)
          break
        case 'pos-orders':
          {
            const restoredOrders = Array.isArray(change.value)
              ? (change.value as SavedOrder[]).map(normalizeSavedOrderPayment)
              : []
            setSavedOrders(restoredOrders)
            setBillNumber(getInitialBillNumber(restoredOrders))
          }
          break
        case 'pos-staff-users':
          setStaffUsers(normalizeStaffUsers(Array.isArray(change.value) ? (change.value as StaffUser[]) : []))
          break
        case staffPinResetCommandKey:
          applyStaffPinResetCommands(change.value)
          break
        default:
          break
      }
    }
  }

  function applyStaffPinResetCommands(value: unknown) {
    const commands = normalizeStaffPinResetCommands(value)

    if (!commands.length) {
      return
    }

    setStaffUsers((users) => {
      let changed = false
      const nextUsers = users.map((staffUser) => {
        const command = commands
          .filter((entry) => entry.staffUserId === staffUser.id && entry.pinSalt && entry.pinHash)
          .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime())
          .at(-1)

        if (!command || (staffUser.pinSalt === command.pinSalt && staffUser.pinHash === command.pinHash)) {
          return staffUser
        }

        changed = true
        return {
          ...staffUser,
          pinSalt: command.pinSalt,
          pinHash: command.pinHash,
          updatedAt: command.requestedAt || new Date().toISOString(),
        }
      })

      if (!changed) {
        return users
      }

      const usersValue = JSON.stringify(nextUsers)
      const directoryValue = JSON.stringify(getStaffUserDirectory(nextUsers))
      localStorage.setItem('pos-staff-users', usersValue)
      localStorage.setItem(staffDirectorySyncKey, directoryValue)
      void window.posDb?.set('pos-staff-users', usersValue).catch(() => undefined)
      void window.posDb?.set(staffDirectorySyncKey, directoryValue).catch(() => undefined)

      return nextUsers
    })
  }

  function openMenuSetup() {
    if (!requirePermission('menu_manage', 'Menu setup permission required')) {
      return
    }

    setMenuEditorOpen(true)
    setItemDraft((draft) => ({
      ...draft,
      category: activeCategory === 'all' ? (editableCategories[0]?.id ?? 'all') : activeCategory,
    }))
  }

  function openPrinterManager() {
    if (!requirePermission('printer_manage', 'Printer manage permission required')) {
      return
    }

    setPrinterOpen(true)
    refreshPrinters()
  }

  function handleLogoUpload(file?: File) {
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateBusinessProfile('logoDataUrl', reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleItemPhotoUpload(file?: File) {
    if (!file) {
      return
    }

    try {
      const imageDataUrl = await resizeImageFile(file)
      setItemDraft((draft) => ({ ...draft, imageDataUrl }))
    } catch {
      setPrinterStatus('Could not load item photo')
    }
  }

  function updateMenuDisplaySetting(field: keyof MenuDisplaySettings, value: number) {
    setMenuDisplaySettings((settings) => ({
      ...settings,
      [field]: clampSetting(field, value),
    }))
  }

  function resetMenuDisplaySettings() {
    setMenuDisplaySettings(defaultMenuDisplaySettings)
  }

  function addItem(item: MenuItem) {
    setCart((lines) => {
      const existing = lines.find((line) => line.itemId === item.id)

      if (existing) {
        return lines.map((line) => (line.itemId === item.id ? { ...line, qty: line.qty + 1 } : line))
      }

      return [
        ...lines,
        {
          id: `line-${item.id}-${Date.now()}`,
          itemId: item.id,
          name: item.name,
          price: item.price,
          qty: 1,
          taxRate: 0,
          discountPercent: 0,
          description: '',
        },
      ]
    })

    if (orderType === 'Dining' && !table) {
      setTableSelectorOpen(true)
    }
  }

  function changeQty(lineId: string, amount: number) {
    setCart((lines) =>
      lines
        .map((line) => (line.id === lineId ? { ...line, qty: Math.max(0, line.qty + amount) } : line))
        .filter((line) => line.qty > 0),
    )
  }

  function removeLine(lineId: string) {
    setCart((lines) => lines.filter((line) => line.id !== lineId))
    if (lineActionId === lineId) {
      setLineActionId(null)
    }
    if (lineEditor?.lineId === lineId) {
      setLineEditor(null)
    }
  }

  function openLineEditor(line: CartLine, mode: LineEditMode) {
    if (mode === 'discount' && !requirePermission('discount_manage', 'Discount permission required')) {
      return
    }

    const value =
      mode === 'discount'
        ? String(line.discountPercent ?? 0)
        : mode === 'price'
          ? String(line.price)
          : (line.description ?? '')

    setLineActionId(null)
    setLineEditor({ lineId: line.id, mode, value })
  }

  function saveLineEditor() {
    if (!lineEditor) {
      return
    }

    if (lineEditor.mode === 'discount' && !requirePermission('discount_manage', 'Discount permission required')) {
      return
    }

    setCart((lines) =>
      lines.map((line) => {
        if (line.id !== lineEditor.lineId) {
          return line
        }

        if (lineEditor.mode === 'discount') {
          return { ...line, discountPercent: clamp(numberFromInput(lineEditor.value), 0, 100) }
        }

        if (lineEditor.mode === 'price') {
          return { ...line, price: Math.max(0, numberFromInput(lineEditor.value)) }
        }

        const description = normalizeLineDescription(lineEditor.value)
        return { ...line, description }
      }),
    )

    setLineEditor(null)
  }

  function newOrder() {
    const hasCurrentItems = cart.length > 0

    if (hasCurrentItems && !ensureTableSelected()) {
      return
    }

    if (hasCurrentItems && activeSavedOrder?.status !== 'paid') {
      saveCurrentOrder('unclosed')
      setPrinterStatus('Current bill moved to Unclosed')
    } else {
      setPrinterStatus('New bill ready')
    }

    startBlankOrder(hasCurrentItems)
  }

  function startBlankOrder(advanceBill = true) {
    setCart([])
    setDiscountPercent(0)
    setServicePercent(0)
    setSelectedCustomerId('')
    setCustomer('')
    setCustomerPhone('')
    setCustomerAddress('')
    setTable('')
    setPaymentMethod('Cash')
    setAmountReceivedOverride(null)
    setPartTenderMethod('upi')
    setOrderType('Dining')
    setActiveOrderId(createOrderId())
    if (advanceBill) {
      setBillNumber((value) => getNextBillNumber(savedOrders, value))
    }
  }

  function saveCurrentOrder(status: OrderStatus, creditCustomer?: CustomerProfile) {
    const now = new Date().toISOString()
    const existingOrder = savedOrders.find((order) => order.id === activeOrderId)
    const savedCustomerId = creditCustomer?.id ?? selectedCustomerId
    const savedCustomerName = creditCustomer?.name ?? customer
    const order: SavedOrder = {
      id: activeOrderId,
      billNo: String(billNumber),
      status,
      orderType,
      table,
      customerId: savedCustomerId || undefined,
      customer: savedCustomerName,
      cart,
      discountPercent,
      servicePercent,
      paymentMethod,
      paymentBreakdown,
      amountReceived,
      totals,
      creditApplied: existingOrder?.creditApplied ?? false,
      createdAt: existingOrder?.createdAt ?? now,
      updatedAt: now,
    }

    setSavedOrders((orders) => {
      const existingIndex = orders.findIndex((savedOrder) => savedOrder.id === activeOrderId)

      if (existingIndex === -1) {
        return [order, ...orders]
      }

      return orders.map((savedOrder) => (savedOrder.id === activeOrderId ? order : savedOrder))
    })

    return order
  }

  function savePaidOrder() {
    if (!cart.length) {
      setPrinterStatus('Add items before saving bill')
      return
    }

    if (!ensureTableSelected()) {
      return
    }

    const creditCustomer = ensureCreditCustomer()
    if (!creditCustomer) {
      return
    }

    const order = saveCurrentOrder('paid', creditCustomer === true ? undefined : creditCustomer)
    completeBill(order, 'saved')
  }

  function holdCurrentOrder() {
    if (!cart.length) {
      setPrinterStatus('Add items before holding order')
      return
    }

    if (!ensureTableSelected()) {
      return
    }

    if (activeSavedOrder?.status === 'paid') {
      setPrinterStatus('Paid bill cannot be moved to Hold')
      return
    }

    saveCurrentOrder('hold')
    startBlankOrder()
    setPrinterStatus('Order moved to Hold')
  }

  function loadOrder(order: SavedOrder) {
    setActiveOrderId(order.id)
    setBillNumber(Number(order.billNo) || billNumber)
    setOrderType(order.orderType)
    setTable(order.table)
    setSelectedCustomerId(order.customerId ?? '')
    setCustomer(order.customer)
    const savedCustomer = customers.find((profile) => profile.id === order.customerId)
    setCustomerPhone(savedCustomer?.phone ?? '')
    setCustomerAddress(savedCustomer?.address ?? '')
    setCart(order.cart)
    setDiscountPercent(order.discountPercent)
    setServicePercent(order.servicePercent)
    setPaymentMethod(order.paymentMethod)
    setAmountReceivedOverride(order.paymentBreakdown?.cash ?? order.amountReceived)
    setPartTenderMethod((order.paymentBreakdown?.card ?? 0) > (order.paymentBreakdown?.upi ?? 0) ? 'card' : 'upi')
    setOrderListMode(null)
    setTableSelectorOpen(false)
    setPrinterStatus(`Loaded bill ${order.billNo}`)
  }

  function deleteOrder(orderId: string) {
    if (!requirePermission('order_delete', 'Delete order permission required')) {
      return
    }

    setSavedOrders((orders) => orders.filter((order) => order.id !== orderId))
    recordAudit('order_deleted', `Order ${orderId} deleted`)
  }

  function selectTable(tableNo: string) {
    const tableOrder = tableStatus.get(tableNo)

    if (tableOrder && tableOrder.id !== activeOrderId) {
      if (cart.length && activeSavedOrder?.status !== 'paid') {
        saveCurrentOrder('unclosed')
      }

      loadOrder(tableOrder)
      return
    }

    setOrderType('Dining')
    setTable(tableNo)
    setTableSelectorOpen(false)
    setPrinterStatus(`${tableNo} selected`)
  }

  function ensureTableSelected() {
    if (orderType === 'Dining' && !table) {
      setTableSelectorOpen(true)
      setPrinterStatus('Select table before continuing')
      return false
    }

    return true
  }

  function ensureCreditCustomer() {
    if (paymentMethod !== 'Due' && totals.balance <= 0) {
      return true
    }

    if (!requirePermission('due_manage', 'Due management permission required')) {
      return false
    }

    const savedCustomer = ensureCustomerProfile()
    if (!savedCustomer) {
      setCustomerEditorOpen(true)
      setPrinterStatus('Create or select customer for credit')
      return false
    }

    return savedCustomer
  }

  function completeBill(order: SavedOrder, action: SuccessAction) {
    applyCustomerCredit(order)
    setSuccessOrder(order)
    setSuccessAction(action)
    setTableSelectorOpen(false)
    setCustomerEditorOpen(false)
    setDiscountEditorOpen(false)
    setLineActionId(null)
    setLineEditor(null)
    startBlankOrder(true)
    setPrinterStatus(`Bill ${order.billNo} ${action === 'printed' ? 'printed' : 'saved'}. Next bill ready`)
  }

  function ensureCustomerProfile() {
    if (selectedCustomerId) {
      return customers.find((profile) => profile.id === selectedCustomerId) ?? null
    }

    const name = customer.trim()
    if (!name) {
      return null
    }

    return saveCustomerProfile()
  }

  function saveCustomerProfile() {
    const name = customer.trim()
    if (!name) {
      return null
    }

    const now = new Date().toISOString()
    const existing = selectedCustomerId
      ? customers.find((profile) => profile.id === selectedCustomerId)
      : customers.find(
          (profile) =>
            profile.name.trim().toLowerCase() === name.toLowerCase() &&
            (!customerPhone.trim() || profile.phone.trim() === customerPhone.trim()),
        )

    const profile: CustomerProfile = {
      id: existing?.id ?? createCustomerId(),
      name,
      phone: customerPhone.trim(),
      address: customerAddress.trim(),
      creditBalance: existing?.creditBalance ?? 0,
      totalCredit: existing?.totalCredit ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    setCustomers((list) => {
      if (existing) {
        return list.map((customerProfile) => (customerProfile.id === existing.id ? profile : customerProfile))
      }

      return [profile, ...list]
    })
    setSelectedCustomerId(profile.id)
    setCustomer(profile.name)
    setCustomerPhone(profile.phone)
    setCustomerAddress(profile.address)
    setPrinterStatus(`${profile.name} customer profile saved`)

    return profile
  }

  function selectCustomerProfile(profile: CustomerProfile) {
    setSelectedCustomerId(profile.id)
    setCustomer(profile.name)
    setCustomerSearch(profile.name)
    setCustomerPhone(profile.phone)
    setCustomerAddress(profile.address)
  }

  function clearCustomerProfile() {
    setSelectedCustomerId('')
    setCustomer('')
    setCustomerSearch('')
    setCustomerPhone('')
    setCustomerAddress('')
  }

  function markSelectedCustomerDuePaid() {
    if (!requirePermission('due_manage', 'Due management permission required')) {
      return
    }

    if (!selectedCustomerProfile || selectedCustomerProfile.creditBalance <= 0) {
      return
    }

    setCustomers((list) =>
      list.map((profile) =>
        profile.id === selectedCustomerProfile.id
          ? { ...profile, creditBalance: 0, updatedAt: new Date().toISOString() }
          : profile,
      ),
    )
    setPrinterStatus(`${selectedCustomerProfile.name} due marked as paid`)
    recordAudit('due_marked_paid', `${selectedCustomerProfile.name} due marked as paid`)
  }

  function applyCustomerCredit(order: SavedOrder) {
    if (order.creditApplied || order.status !== 'paid' || order.totals.balance <= 0 || !order.customerId) {
      return
    }

    setCustomers((list) =>
      list.map((profile) =>
        profile.id === order.customerId
          ? {
              ...profile,
              creditBalance: roundMoney(profile.creditBalance + order.totals.balance),
              totalCredit: roundMoney(profile.totalCredit + order.totals.balance),
              updatedAt: new Date().toISOString(),
            }
          : profile,
      ),
    )

    setSavedOrders((orders) =>
      orders.map((savedOrder) => (savedOrder.id === order.id ? { ...savedOrder, creditApplied: true } : savedOrder)),
    )
  }

  function saveCategory() {
    if (!requirePermission('menu_manage', 'Menu setup permission required')) {
      return
    }

    const label = categoryName.trim()

    if (!label) {
      return
    }

    if (editingCategoryId) {
      setCategoryList((list) =>
        sortCategories(
          list.map((category) => (category.id === editingCategoryId ? { ...category, label } : category)),
        ),
      )
    } else {
      const id = makeUniqueId(label, categoryList.map((category) => category.id))
      const priority = getNextCategoryPriority(editableCategories)
      setCategoryList((list) => sortCategories([...list, { id, label, priority }]))
      setActiveCategory(id)
      setItemDraft((draft) => ({ ...draft, category: id }))
    }

    setCategoryName('')
    setEditingCategoryId(null)
  }

  function editCategory(category: Category) {
    if (category.id === 'all') {
      return
    }

    setEditingCategoryId(category.id)
    setCategoryName(category.label)
  }

  function handleCategoryDragStart(event: DragEvent<HTMLDivElement>, categoryId: string) {
    setDraggedCategoryId(categoryId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', categoryId)
  }

  function handleCategoryDrop(event: DragEvent<HTMLDivElement>, targetCategoryId: string) {
    event.preventDefault()
    const sourceCategoryId = draggedCategoryId || event.dataTransfer.getData('text/plain')

    if (!sourceCategoryId || sourceCategoryId === targetCategoryId) {
      setDraggedCategoryId(null)
      return
    }

    const targetBox = event.currentTarget.getBoundingClientRect()
    const insertAfterTarget = event.clientY > targetBox.top + targetBox.height / 2

    setCategoryList((list) => reorderCategoryList(list, sourceCategoryId, targetCategoryId, insertAfterTarget))
    setDraggedCategoryId(null)
  }

  function deleteCategory(categoryId: string) {
    if (!requirePermission('menu_manage', 'Menu setup permission required')) {
      return
    }

    if (categoryId === 'all') {
      return
    }

    const replacementCategory = editableCategories.find((category) => category.id !== categoryId)?.id ?? 'all'
    setCategoryList((list) => list.filter((category) => category.id !== categoryId))
    setMenuList((list) => list.filter((item) => item.category !== categoryId))

    if (activeCategory === categoryId) {
      setActiveCategory(replacementCategory)
    }

    if (itemDraft.category === categoryId) {
      setItemDraft((draft) => ({ ...draft, category: replacementCategory }))
    }
  }

  function saveMenuItem() {
    if (!requirePermission('menu_manage', 'Menu setup permission required')) {
      return
    }

    const name = itemDraft.name.trim()
    const price = Number(itemDraft.price)
    const category = itemDraft.category || editableCategories[0]?.id || 'all'
    const tags = normalizeTags(itemDraft.tags)
    const imageDataUrl = itemDraft.imageDataUrl || undefined

    if (!name || !Number.isFinite(price) || price <= 0) {
      return
    }

    if (editingItemId) {
      setMenuList((list) =>
        list.map((item) =>
          item.id === editingItemId ? { ...item, name, price, category, tags, imageDataUrl } : item,
        ),
      )
    } else {
      const id = makeUniqueId(name, menuList.map((item) => item.id))
      setMenuList((list) => [...list, { id, name, category, price, tags, imageDataUrl }])
      setActiveCategory(category)
    }

    resetItemDraft(category)
  }

  function editMenuItem(item: MenuItem) {
    setEditingItemId(item.id)
    setItemDraft({
      name: item.name,
      category: item.category,
      price: String(item.price),
      tags: item.tags?.join(', ') ?? '',
      imageDataUrl: item.imageDataUrl ?? '',
    })
  }

  function deleteMenuItem(itemId: string) {
    if (!requirePermission('menu_manage', 'Menu setup permission required')) {
      return
    }

    setMenuList((list) => list.filter((item) => item.id !== itemId))

    if (editingItemId === itemId) {
      resetItemDraft(itemDraft.category)
    }
  }

  function resetItemDraft(category = itemDraft.category) {
    setEditingItemId(null)
    setItemDraft({
      name: '',
      category,
      price: '',
      tags: '',
      imageDataUrl: '',
    })
  }

  function toggleDraftTag(tag: ItemTag) {
    const tags = normalizeTags(itemDraft.tags)
    const nextTags = tags.includes(tag) ? tags.filter((savedTag) => savedTag !== tag) : [...tags, tag]
    setItemDraft((draft) => ({ ...draft, tags: nextTags.join(', ') }))
  }

  async function refreshPrinters() {
    if (!window.posPrinter) {
      setPrinterStatus('Run inside desktop app for printers')
      return
    }

    try {
      const printerList = await window.posPrinter.listPrinters()
      setPrinters(printerList)

      if (billPrinterProfile && !billPrinterProfile.settings.deviceName) {
        const defaultPrinter = printerList.find((printer) => printer.isDefault)
        if (defaultPrinter) {
          updatePrinterProfileSettings(billPrinterProfile.id, { deviceName: defaultPrinter.name })
        }
      }

      setPrinterStatus(`${printerList.length} printer(s) found`)
    } catch (error) {
      setPrinterStatus(getErrorMessage(error))
    }
  }

  function updatePrinterProfileSettings(profileId: string, next: Partial<ReceiptPrinterSettings>) {
    setPrinterProfiles((profiles) =>
      profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              settings: normalizePrinterSettings({ ...profile.settings, ...next }),
              updatedAt: new Date().toISOString(),
            }
          : profile,
      ),
    )
  }

  function updateActivePrinterProfileSettings(next: Partial<ReceiptPrinterSettings>) {
    if (!activePrinterProfile) {
      return
    }

    updatePrinterProfileSettings(activePrinterProfile.id, next)
  }

  function updateActivePrinterProfileName(name: string) {
    if (!activePrinterProfile) {
      return
    }

    setPrinterProfiles((profiles) =>
      profiles.map((profile) =>
        profile.id === activePrinterProfile.id ? { ...profile, name, updatedAt: new Date().toISOString() } : profile,
      ),
    )
  }

  function addPrinterProfile() {
    const name = printerProfileName.trim()
    if (!name) {
      setPrinterStatus('Enter printer profile name')
      return
    }

    const now = new Date().toISOString()
    const defaultPrinter = printers.find((printer) => printer.isDefault)
    const profile: PrinterProfile = {
      id: createPrinterProfileId(),
      name,
      settings: normalizePrinterSettings({
        ...defaultPrinterSettings,
        deviceName: defaultPrinter?.name ?? '',
      }),
      createdAt: now,
      updatedAt: now,
    }

    setPrinterProfiles((profiles) => [...profiles, profile])
    setActivePrinterProfileId(profile.id)
    setPrinterProfileName('')
    setPrinterStatus(`${profile.name} printer profile added`)
  }

  function deleteActivePrinterProfile() {
    if (!activePrinterProfile || activePrinterProfile.id === billPrinterProfile?.id) {
      setPrinterStatus('Bill printer profile cannot be deleted')
      return
    }

    setPrinterProfiles((profiles) => profiles.filter((profile) => profile.id !== activePrinterProfile.id))
    setActivePrinterProfileId(billPrinterProfile?.id ?? defaultBillPrinterProfileId)
    setPrinterStatus(`${activePrinterProfile.name} printer profile deleted`)
  }

  async function printReceipt(saveBeforePrint = true) {
    if (!window.posPrinter) {
      if (saveBeforePrint) {
        if (!cart.length) {
          setPrinterStatus('Add items before printing')
          return
        }

        if (!ensureTableSelected()) {
          return
        }

        const creditCustomer = ensureCreditCustomer()
        if (!creditCustomer) {
          return
        }

        const order = saveCurrentOrder('paid', creditCustomer === true ? undefined : creditCustomer)
        completeBill(order, 'printed')
      }
      window.print()
      return
    }

    if (!cart.length) {
      setPrinterStatus('Add items before printing')
      return
    }

    if (!ensureTableSelected()) {
      return
    }

    const creditCustomer = saveBeforePrint ? ensureCreditCustomer() : true
    if (!creditCustomer) {
      return
    }

    const order =
      saveBeforePrint && creditCustomer !== true
        ? saveCurrentOrder('paid', creditCustomer)
        : saveBeforePrint
          ? saveCurrentOrder('paid')
          : null

    if (saveBeforePrint) {
      setPrinterStatus('Saving and printing receipt...')
    } else {
      setPrinterStatus('Printing receipt...')
    }

    try {
      await window.posPrinter.printReceipt({
        settings: billPrinterSettings,
        order: buildReceiptOrder(),
      })
      if (order) {
        completeBill(order, 'printed')
      } else {
        setPrinterStatus('Receipt sent to printer')
      }
    } catch (error) {
      setPrinterStatus(getErrorMessage(error))
    }
  }

  async function printKot(profileId: string) {
    const profile = printerProfiles.find((savedProfile) => savedProfile.id === profileId)
    if (!profile) {
      setPrinterStatus('Select printer profile')
      return
    }

    if (!window.posPrinter) {
      setPrinterStatus('Run inside desktop app for KOT printer')
      return
    }

    if (!cart.length) {
      setPrinterStatus('Add items before printing KOT')
      return
    }

    if (!ensureTableSelected()) {
      return
    }

    if (activeSavedOrder?.status !== 'paid') {
      saveCurrentOrder('unclosed')
    }

    setPrinterStatus(`Printing ${profile.name} KOT...`)
    try {
      await window.posPrinter.printKot({
        settings: profile.settings,
        kot: buildKotOrder(profile.name),
      })
      setKotPrintOpen(false)
      setPrinterStatus(`${profile.name} KOT sent`)
    } catch (error) {
      setPrinterStatus(getErrorMessage(error))
    }
  }

  async function testPrinter(profileId = activePrinterProfile?.id) {
    if (!window.posPrinter) {
      setPrinterStatus('Run inside desktop app for printers')
      return
    }

    const profile = printerProfiles.find((savedProfile) => savedProfile.id === profileId)
    if (!profile) {
      setPrinterStatus('Select printer profile')
      return
    }

    setPrinterStatus(`Sending ${profile.name} test print...`)
    try {
      await window.posPrinter.printTest(profile.settings)
      setPrinterStatus(`${profile.name} test print sent`)
    } catch (error) {
      setPrinterStatus(getErrorMessage(error))
    }
  }

  async function testKotPrinter(profileId = activePrinterProfile?.id) {
    if (!window.posPrinter) {
      setPrinterStatus('Run inside desktop app for printers')
      return
    }

    const profile = printerProfiles.find((savedProfile) => savedProfile.id === profileId)
    if (!profile) {
      setPrinterStatus('Select printer profile')
      return
    }

    setPrinterStatus(`Sending ${profile.name} KOT test...`)
    try {
      await window.posPrinter.printKotTest({
        settings: profile.settings,
        station: profile.name,
      })
      setPrinterStatus(`${profile.name} KOT test sent`)
    } catch (error) {
      setPrinterStatus(getErrorMessage(error))
    }
  }

  function buildReceiptOrder() {
    return {
      billNo: String(billNumber),
      business: {
        name: receiptBusinessName,
        owner: billingOwnerName,
        branch: businessProfile.branch.trim(),
        phone: businessProfile.phone.trim(),
        email: businessProfile.email.trim(),
        address: businessProfile.address.trim(),
        gstin: businessProfile.gstin.trim(),
        footerNote: businessProfile.receiptFooter.trim(),
        logoDataUrl: businessProfile.logoDataUrl,
      },
      orderType,
      table,
      customer,
      cashier: 'Admin',
      paymentMethod,
      paymentBreakdown,
      items: cart.map((line) => ({
        name: line.name,
        qty: line.qty,
        price: line.price,
        total: lineTotal(line),
        description: line.description ?? '',
        discountPercent: line.discountPercent ?? 0,
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      serviceCharge: totals.serviceCharge,
      total: totals.total,
      paid: totals.paid,
      balance: totals.balance,
      change: totals.change,
      createdAt: new Date().toISOString(),
    }
  }

  function buildKotOrder(station: string) {
    return {
      billNo: String(billNumber),
      station,
      orderType,
      table,
      customer,
      cashier: 'Admin',
      items: cart.map((line) => ({
        name: line.name,
        qty: line.qty,
        description: line.description ?? '',
      })),
      createdAt: new Date().toISOString(),
    }
  }

  function openOrderList(mode: OrderListMode) {
    if (mode === 'orders') {
      setOrderListDate(formatDateInputValue(new Date()))
    }

    setOrderListMode(mode)
  }

  if (!storageReady) {
    return (
      <main className="pos-shell auth-shell" data-theme={theme}>
        <section className="auth-card auth-loading-card">
          <div className="auth-hero">
            <div className="brand-mark auth-mark">
              <img src={appIconUrl} alt="" />
            </div>
            <div>
              <h1>{appName}</h1>
              <p>Starting secure local database</p>
            </div>
          </div>
          <div className="auth-loading-line">
            <RefreshCw size={18} />
            Loading local SQLite database...
          </div>
        </section>
      </main>
    )
  }

  if (!staffUsers.length) {
    return (
      <main className="pos-shell auth-shell" data-theme={theme}>
        <section className="auth-card setup-card">
          <div className="auth-hero">
            <div className="brand-mark auth-mark">
              <img src={appIconUrl} alt="" />
            </div>
            <div>
              <span>Cloud Restore</span>
              <h1>{appName}</h1>
              <p>Login with your cloud account and restore the saved POS users before billing.</p>
            </div>
            <div className="auth-badges">
              <span>Cloud Backup</span>
              <span>Local SQLite</span>
              <span>PIN Login</span>
            </div>
          </div>
          <div className="auth-form-panel">
            <div>
              <h2>Cloud Login</h2>
              <p>Use the registered phone/email and password. Restored app users can login with their old PIN.</p>
            </div>
            <div className="setup-cloud-panel">
              <label className="wide">
                Cloud URL
                <input
                  value={setupCloudApiUrl}
                  onChange={(event) => setSetupCloudApiUrl(event.target.value)}
                  placeholder="https://goldensea.gihostings.in"
                />
              </label>
              <div className="auth-field-grid">
                <label>
                  Phone or Email
                  <input
                    autoComplete="username"
                    value={setupCloudLogin}
                    onChange={(event) => setSetupCloudLogin(event.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    autoComplete="current-password"
                    type="password"
                    value={setupCloudPassword}
                    onChange={(event) => setSetupCloudPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void loginCloudForSetup()
                      }
                    }}
                  />
                </label>
              </div>
              <button className="small-button primary" type="button" onClick={() => void loginCloudForSetup()} disabled={setupWorking}>
                <Globe2 size={16} />
                {setupWorking ? 'Working' : 'Login Cloud'}
              </button>

              {setupCloudToken && (
                <>
                  <div className="auth-field-grid">
                    <label>
                      Restaurant
                      <select value={setupRestaurantId} onChange={(event) => setSetupRestaurantId(event.target.value)}>
                        {setupRestaurants.map((restaurant) => (
                          <option key={restaurant.id} value={restaurant.id}>
                            {restaurant.name} - {titleCase(restaurant.status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Transfer Code
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Optional 6 digit code"
                        value={setupTransferCode}
                        onChange={(event) => setSetupTransferCode(normalizeTransferCode(event.target.value))}
                      />
                    </label>
                  </div>
                  <div className="setup-user-preview">
                    <strong>Previous App Users</strong>
                    {selectedSetupStaffUsers.length ? (
                      <div>
                        {selectedSetupStaffUsers.map((staffUser) => (
                          <span key={staffUser.id}>{staffUser.name}</span>
                        ))}
                      </div>
                    ) : (
                      <small>No synced app users found for this restaurant yet.</small>
                    )}
                  </div>
                  {!selectedSetupStaffUsers.length && (
                    <div className="setup-owner-pin">
                      <strong>Create Owner Login</strong>
                      <span>No previous app users are in cloud yet. Set an Owner PIN to open this POS after restore.</span>
                      <div className="auth-field-grid">
                        <label>
                          Owner PIN
                          <input
                            type="password"
                            inputMode="numeric"
                            value={setupOwnerPin}
                            onChange={(event) => setSetupOwnerPin(event.target.value)}
                          />
                        </label>
                        <label>
                          Confirm PIN
                          <input
                            type="password"
                            inputMode="numeric"
                            value={setupOwnerPinConfirm}
                            onChange={(event) => setSetupOwnerPinConfirm(event.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  <button
                    className="small-button primary"
                    type="button"
                    onClick={() => void restoreCloudDataForSetup()}
                    disabled={setupWorking || !setupRestaurantId}
                  >
                    <RefreshCw size={16} />
                    {selectedSetupStaffUsers.length ? 'Restore Server Data' : 'Restore & Create Owner'}
                  </button>
                </>
              )}

              {setupStatus && <div className="sync-message">{setupStatus}</div>}
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (!currentUser) {
    const selectedLoginUserId = loginUserId || activeStaffUsers[0]?.id || ''

    return (
      <main className="pos-shell auth-shell" data-theme={theme}>
        <section className="login-card-modern">
          <div className="login-brand-panel">
            <div className="brand-mark login-brand-mark">
              <img src={appIconUrl} alt="" />
            </div>
            <div>
              <span>Staff Login</span>
              <h1>{appName}</h1>
              <p>Fast PIN login for billing, reports, and admin tools.</p>
            </div>
            <div className="login-badges">
              <span>Auto lock</span>
              <span>{formatTime(currentDate)}</span>
            </div>
          </div>
          <div className="login-form-panel">
            <div>
              <h2>Welcome Back</h2>
              <p>Choose your user and enter PIN to continue.</p>
            </div>
            <label>
              User
              <select
                value={selectedLoginUserId}
                onChange={(event) => {
                  setLoginUserId(event.target.value)
                  setForgotStatus('')
                }}
              >
                {activeStaffUsers.map((staffUser) => (
                  <option key={staffUser.id} value={staffUser.id}>
                    {staffUser.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              PIN
              <input
                autoFocus
                className="pin-input"
                type="password"
                inputMode="numeric"
                value={loginPin}
                disabled={loginCheckingCloud}
                onChange={(event) => setLoginPin(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void loginWithPin()
                  }
                }}
              />
            </label>
            {loginError && <div className="auth-error">{loginError}</div>}
            <button
              className="home-action primary auth-submit"
              type="button"
              onClick={() => void loginWithPin()}
              disabled={loginCheckingCloud}
            >
              <User size={18} />
              {loginCheckingCloud ? 'Checking Cloud' : 'Login'}
            </button>
            <button
              className="auth-link-button"
              type="button"
              onClick={() => {
                setForgotPinOpen((open) => !open)
                setForgotStatus('')
              }}
            >
              Forgot PIN?
            </button>
            {forgotPinOpen && (
              <div className="auth-recovery-panel">
                <strong>Reset PIN With Recovery Code</strong>
                <span>
                  {activeStaffUsers.find((staffUser) => staffUser.id === selectedLoginUserId)?.recoveryHash
                    ? 'Enter the recovery code created earlier, or ask an admin to reset this PIN.'
                    : 'Recovery code is not set for this user. Ask an admin to reset PIN from User Manage.'}
                </span>
                <label>
                  Recovery Code
                  <input
                    value={forgotRecoveryCode}
                    onChange={(event) => setForgotRecoveryCode(event.target.value)}
                    placeholder="XXXX-XXXX-XXXX"
                  />
                </label>
                <div className="auth-field-grid">
                  <label>
                    New PIN
                    <input
                      type="password"
                      inputMode="numeric"
                      value={forgotNewPin}
                      onChange={(event) => setForgotNewPin(event.target.value)}
                    />
                  </label>
                  <label>
                    Confirm PIN
                    <input
                      type="password"
                      inputMode="numeric"
                      value={forgotNewPinConfirm}
                      onChange={(event) => setForgotNewPinConfirm(event.target.value)}
                    />
                  </label>
                </div>
                <button className="small-button primary" type="button" onClick={() => void resetPinWithRecovery()}>
                  <Save size={15} />
                  Reset PIN
                </button>
                {forgotStatus && <div className="auth-error">{forgotStatus}</div>}
              </div>
            )}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={activeView === 'pos' ? 'pos-shell pos-active-shell' : 'pos-shell'} data-theme={theme}>
      <header className={activeView === 'pos' ? 'topbar pos-topbar' : 'topbar'}>
        <button className="brand-block app-brand-button" type="button" onClick={() => goToView('home')}>
          <div className="brand-mark">
            <img src={appIconUrl} alt="" />
          </div>
          <div>
            <div className="brand-name">{appName}</div>
            <div className="brand-date">GI App - v{appVersion}</div>
          </div>
        </button>

        <div className="clock-block">
          <Clock3 size={18} />
          <div>
            <span>{formatInputDate(currentDate)}</span>
            <strong>{formatTime(currentDate)}</strong>
          </div>
        </div>

        {activeView === 'pos' ? (
          <div className="pos-header-actions" aria-label="POS controls">
            <div className="pos-top-summary" aria-label="POS status">
              <span>{billingDisplayName}</span>
            </div>
            <button
              className="tool-button"
              type="button"
              title="Dining"
              onClick={() => {
                setOrderType('Dining')
                setTableSelectorOpen(true)
              }}
            >
              <UtensilsCrossed size={16} />
              Dining
            </button>
            <button className="tool-button" type="button" title="Unclosed orders" onClick={() => openOrderList('unclosed')}>
              <Bell size={16} />
              Unclosed
            </button>
            <button className="tool-button" type="button" title="Orders" onClick={() => openOrderList('orders')}>
              <ReceiptText size={16} />
              Orders
            </button>
            <button className="tool-button" type="button" title="Hold orders" onClick={() => openOrderList('hold')}>
              <Clock3 size={16} />
              Hold
            </button>
            <button className="tool-button" type="button" title="Account" onClick={openAccountPanel}>
              <User size={16} />
              Account
            </button>
            <button className="tool-button" type="button" title="Lock app" onClick={lockApp}>
              <LogOut size={16} />
              {currentUser?.name || 'User'}
            </button>
            <button className="new-order" type="button" onClick={newOrder}>
              <Plus size={17} />
              New Order
            </button>
          </div>
        ) : (
          <div className="top-controls app-nav-controls">
            <nav className="view-tabs" aria-label="App views">
              <button
                className={activeView === 'home' ? 'view-tab active' : 'view-tab'}
                type="button"
                onClick={() => goToView('home')}
              >
                <Home size={17} />
                Home
              </button>
              {hasSubscriptionAccess && hasPermission('pos_access') && (
                <button
                  className="view-tab"
                  type="button"
                  onClick={() => goToView('pos')}
                >
                  <ShoppingCart size={17} />
                  POS Sale
                </button>
              )}
              {hasSubscriptionAccess && hasPermission('reports') && (
                <button
                  className={activeView === 'reports' ? 'view-tab active' : 'view-tab'}
                  type="button"
                  onClick={() => goToView('reports')}
                >
                  <BarChart3 size={17} />
                  Report
                </button>
              )}
              {hasSubscriptionAccess && hasPermission('menu_manage') && (
                <button className="view-tab utility-tab" type="button" onClick={openMenuSetup}>
                  <Pencil size={17} />
                  Menu Setup
                </button>
              )}
              {hasSubscriptionAccess && hasPermission('printer_manage') && (
                <button className="view-tab utility-tab" type="button" onClick={openPrinterManager}>
                  <Printer size={17} />
                  Printer Manage
                </button>
              )}
              <button
                className={activeView === 'about' ? 'view-tab active' : 'view-tab'}
                type="button"
                onClick={() => goToView('about')}
              >
                <Globe2 size={17} />
                About
              </button>
            </nav>
            <button
              className={
                activeView === 'profile' || activeView === 'sync' || activeView === 'users'
                  ? 'theme-toggle user-lock-button active'
                  : 'theme-toggle user-lock-button'
              }
              type="button"
              title="Account"
              onClick={openAccountPanel}
            >
              <User size={17} />
              Account
            </button>
            <button className="theme-toggle user-lock-button" type="button" title="Lock app" onClick={lockApp}>
              <span className="user-name">{currentUser?.name || 'User'}</span>
              <LogOut size={17} />
            </button>
            {activeView === 'home' && (
              <button
                className="theme-toggle"
                type="button"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={() => setTheme((mode) => (mode === 'dark' ? 'light' : 'dark'))}
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            )}
          </div>
        )}
      </header>

      {activeView === 'home' && (
        <section className="home-view page-view">
          {subscriptionLock && (
            <section className="home-card subscription-lock-card">
              <div>
                <span>Cloud Access Locked</span>
                <h2>{subscriptionLock.reason === 'subscription_expired' ? 'Subscription Renewal Required' : 'Cloud Check Required'}</h2>
                <p>{subscriptionLock.message}</p>
                <small>
                  Last check: {formatDateTime(new Date(subscriptionLock.checkedAt))}
                  {subscriptionLock.expiresAt ? ` / Cached expiry: ${formatDateTime(new Date(subscriptionLock.expiresAt))}` : ''}
                </small>
              </div>
              <div className="subscription-lock-actions">
                {hasPermission('cloud_sync') && (
                  <button className="home-action primary" type="button" onClick={() => goToView('sync')}>
                    <Wifi size={18} />
                    Cloud Sync
                  </button>
                )}
                <button className="home-action" type="button" onClick={lockApp}>
                  <LogOut size={18} />
                  Logout
                </button>
              </div>
            </section>
          )}
          <div className="home-launcher-grid" aria-label="Home shortcuts">
            {hasSubscriptionAccess && hasPermission('pos_access') && (
            <button className="home-launch-tile primary" type="button" onClick={() => goToView('pos')}>
              <ShoppingCart size={34} />
              <strong>POS Sale</strong>
              <span>Billing screen</span>
            </button>
            )}
            {hasSubscriptionAccess && hasPermission('reports') && (
            <button className="home-launch-tile" type="button" onClick={() => goToView('reports')}>
              <BarChart3 size={34} />
              <strong>Report</strong>
              <span>Sales graph and bills</span>
            </button>
            )}
            {hasSubscriptionAccess && hasPermission('menu_manage') && (
            <button className="home-launch-tile" type="button" onClick={openMenuSetup}>
              <Pencil size={34} />
              <strong>Menu Setup</strong>
              <span>Categories and items</span>
            </button>
            )}
            {hasSubscriptionAccess && hasPermission('printer_manage') && (
            <button className="home-launch-tile" type="button" onClick={openPrinterManager}>
              <Printer size={34} />
              <strong>Printer Manage</strong>
              <span>Bill and KOT printers</span>
            </button>
            )}
            {(hasPermission('business_profile') || hasPermission('cloud_sync') || hasPermission('user_manage')) && (
            <button className="home-launch-tile" type="button" onClick={openAccountPanel}>
              <User size={34} />
              <strong>Account</strong>
              <span>Profile, sync, and users</span>
            </button>
            )}
          </div>
        </section>
      )}

      {activeView === 'reports' && (
        <section className="reports-view page-view">
          <div className="page-head report-page-head">
            <div>
              <span>Reports</span>
              <h1>Detailed Report</h1>
              <p>{billingDisplayName} - {periodReport.periodLabel}</p>
            </div>
            <button className="home-action primary" type="button" onClick={() => goToView('pos')}>
              <ShoppingCart size={18} />
              POS Sale
            </button>
          </div>

          <section className="report-control-panel">
            <div className="period-tabs" aria-label="Report period">
              {(['custom', 'monthly', 'yearly'] as ReportPeriodMode[]).map((mode) => (
                <button
                  className={reportPeriodMode === mode ? 'active' : ''}
                  type="button"
                  onClick={() => setReportPeriodMode(mode)}
                  key={mode}
                >
                  {getReportModeLabel(mode)}
                </button>
              ))}
            </div>

            <div className="period-inputs">
              {reportPeriodMode === 'custom' && (
                <>
                  <label>
                    From
                    <input
                      type="date"
                      value={reportFromDate}
                      onChange={(event) => setReportFromDate(event.currentTarget.value)}
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="date"
                      value={reportToDate}
                      onChange={(event) => setReportToDate(event.currentTarget.value)}
                    />
                  </label>
                </>
              )}

              {reportPeriodMode === 'monthly' && (
                <label>
                  Month
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(event) => setReportMonth(event.currentTarget.value)}
                  />
                </label>
              )}

              {reportPeriodMode === 'yearly' && (
                <label>
                  Year
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={reportYear}
                    onChange={(event) => setReportYear(event.currentTarget.value)}
                  />
                </label>
              )}

              <div className="period-summary">
                <span>Showing</span>
                <strong>{periodReport.periodLabel}</strong>
              </div>
            </div>
          </section>

          <div className="report-grid detailed report-kpi-grid">
            <div className="report-card featured">
              <span>Period Sales</span>
              <strong>{money(periodReport.salesTotal)}</strong>
              <small>Previous: {money(periodReport.previousSalesTotal)}</small>
            </div>
            <div className="report-card">
              <span>Variation</span>
              <strong className={periodReport.variationPercent >= 0 ? 'positive' : 'negative'}>
                {formatVariation(periodReport.variationPercent, periodReport.previousSalesTotal)}
              </strong>
              <small>Compared to previous period</small>
            </div>
            <div className="report-card">
              <span>Paid Bills</span>
              <strong>{periodReport.paidCount}</strong>
              <small>Average: {money(periodReport.averageBill)}</small>
            </div>
            <div className="report-card">
              <span>Cash In Hand</span>
              <strong>{money(periodReport.cashInHand)}</strong>
              <small>After return amount</small>
            </div>
            <div className="report-card">
              <span>Bank</span>
              <strong>{money(periodReport.bankTotal)}</strong>
              <small>UPI + Card</small>
            </div>
            <div className="report-card">
              <span>Due Balance</span>
              <strong>{money(periodReport.balanceTotal)}</strong>
              <small>Customer credit</small>
            </div>
            <div className="report-card">
              <span>Discount</span>
              <strong>{money(periodReport.discountTotal)}</strong>
              <small>Period discount</small>
            </div>
            <div className="report-card">
              <span>Open Amount</span>
              <strong>{money(periodReport.openTotal)}</strong>
              <small>{periodReport.openCount} open bills</small>
            </div>
          </div>

          <div className="report-chart-layout">
            <section className="home-card report-chart-card">
              <div className="section-title">
                <div>
                  <strong>Sales Variation</strong>
                  <span>{periodReport.trendLabel}</span>
                </div>
                <span className={periodReport.variationPercent >= 0 ? 'trend-pill positive' : 'trend-pill negative'}>
                  {formatVariation(periodReport.variationPercent, periodReport.previousSalesTotal)}
                </span>
              </div>
              <ReportTrendChart points={periodReport.trendData} />
            </section>

            <section className="home-card report-insight-card">
              <h3>Quick View</h3>
              <div className="report-insight-row">
                <span>Best point</span>
                <strong>
                  {bestReportTrendPoint && bestReportTrendPoint.total > 0
                    ? `${bestReportTrendPoint.label} - ${money(bestReportTrendPoint.total)}`
                    : 'No sales'}
                </strong>
              </div>
              <div className="report-insight-row">
                <span>Previous sales</span>
                <strong>{money(periodReport.previousSalesTotal)}</strong>
              </div>
              <div className="report-insight-row">
                <span>Tax collected</span>
                <strong>{money(periodReport.taxTotal)}</strong>
              </div>
              <div className="report-insight-row">
                <span>Service charge</span>
                <strong>{money(periodReport.serviceTotal)}</strong>
              </div>
            </section>
          </div>

          <div className="detail-report-layout report-analytics-layout">
            <section className="home-card report-section">
              <h3>Payment Summary</h3>
              {paymentMethods.map((method) => (
                <div className="report-line" key={method}>
                  <span>{method}</span>
                  <strong>{money(periodReport.paymentTotals[method] ?? 0)}</strong>
                </div>
              ))}
              <div className="report-line highlight">
                <span>Cash actual</span>
                <strong>{money(periodReport.cashInHand)}</strong>
              </div>
              <div className="report-line highlight">
                <span>Bank actual</span>
                <strong>{money(periodReport.bankTotal)}</strong>
              </div>
            </section>

            <section className="home-card report-section">
              <h3>Order Type</h3>
              {orderTypes.map((type) => (
                <div className="report-line" key={type}>
                  <span>{type} x {periodReport.orderTypeTotals[type].count}</span>
                  <strong>{money(periodReport.orderTypeTotals[type].total)}</strong>
                </div>
              ))}
            </section>

            <section className="home-card report-section">
              <h3>Top Items</h3>
              {periodReport.topItems.map((item) => (
                <div className="report-line" key={item.name}>
                  <span>{item.name} x {item.qty}</span>
                  <strong>{money(item.total)}</strong>
                </div>
              ))}
              {!periodReport.topItems.length && <div className="empty-list">No item sales yet</div>}
            </section>

            <section className="home-card report-table-card">
              <h3>Bill Details</h3>
              <div className="detail-table">
                <div className="detail-row head">
                  <span>Bill</span>
                  <span>Date</span>
                  <span>Type</span>
                  <span>Customer</span>
                  <span>Payment</span>
                  <span>Status</span>
                  <span>Total</span>
                </div>
                {periodReport.recentOrders.map((order) => (
                  <div className="detail-row" key={order.id}>
                    <span>#{order.billNo}</span>
                    <span>{formatDateTime(new Date(order.createdAt))}</span>
                    <span>{order.orderType}{order.table ? ` / ${order.table}` : ''}</span>
                    <span>{order.customer || 'Walk-in'}</span>
                    <span>{order.paymentMethod}</span>
                    <span>{order.status}</span>
                    <strong>{money(order.totals.total)}</strong>
                  </div>
                ))}
                {!periodReport.recentOrders.length && <div className="empty-list">No bills found</div>}
              </div>
            </section>
          </div>
        </section>
      )}

      {activeView === 'profile' && (
        <section className="profile-view page-view">
          <div className="page-head">
            <div>
              <span>Profile</span>
              <h1>Business Profile</h1>
              <p>{appName} - v{appVersion}</p>
            </div>
            <button className="home-action primary" type="button" onClick={() => goToView('pos')}>
              <ShoppingCart size={18} />
              POS Sale
            </button>
          </div>

          <div className="profile-layout">
            <section className="home-card logo-card">
              <div className="profile-logo-preview">
                {businessProfile.logoDataUrl ? (
                  <img src={businessProfile.logoDataUrl} alt="" />
                ) : (
                  getBusinessInitials(receiptBusinessName)
                )}
              </div>
              <label className="upload-button">
                <ImagePlus size={18} />
                Add Logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleLogoUpload(event.currentTarget.files?.[0])}
                />
              </label>
              <button className="small-button" type="button" onClick={() => updateBusinessProfile('logoDataUrl', '')}>
                <Trash2 size={16} />
                Remove Logo
              </button>
            </section>

            <section className="home-card profile-form-card">
              {hasCloudSignupBusinessProfile && (
                <div className="cloud-profile-import">
                  <div>
                    <strong>Client Signup Details</strong>
                    <span>
                      {[
                        cloudSignupBusinessProfile.businessName,
                        cloudSignupBusinessProfile.ownerName,
                        cloudSignupBusinessProfile.phone,
                        cloudSignupBusinessProfile.email,
                      ]
                        .filter(Boolean)
                        .join(' - ')}
                    </span>
                  </div>
                  <button className="small-button" type="button" onClick={useCloudSignupInBusinessProfile}>
                    <Globe2 size={15} />
                    Use Signup Details
                  </button>
                </div>
              )}
              <div className="profile-form">
                <label>
                  Business Name
                  <input
                    value={businessProfile.businessName}
                    onChange={(event) => updateBusinessProfile('businessName', event.target.value)}
                  />
                </label>
                <label>
                  Owner
                  <input
                    value={businessProfile.ownerName}
                    onChange={(event) => updateBusinessProfile('ownerName', event.target.value)}
                  />
                </label>
                <label>
                  Branch
                  <input
                    value={businessProfile.branch}
                    onChange={(event) => updateBusinessProfile('branch', event.target.value)}
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={businessProfile.phone}
                    onChange={(event) => updateBusinessProfile('phone', event.target.value)}
                  />
                </label>
                <label>
                  Email
                  <input
                    value={businessProfile.email}
                    onChange={(event) => updateBusinessProfile('email', event.target.value)}
                  />
                </label>
                <label>
                  GSTIN
                  <input
                    value={businessProfile.gstin}
                    onChange={(event) => updateBusinessProfile('gstin', event.target.value)}
                  />
                </label>
                <label>
                  Receipt Footer
                  <input
                    value={businessProfile.receiptFooter}
                    onChange={(event) => updateBusinessProfile('receiptFooter', event.target.value)}
                  />
                </label>
                <label className="wide">
                  Address
                  <textarea
                    value={businessProfile.address}
                    onChange={(event) => updateBusinessProfile('address', event.target.value)}
                  />
                </label>
              </div>
            </section>

          </div>
        </section>
      )}

      {activeView === 'users' && (
        <section className="users-view page-view">
          <div className="page-head">
            <div>
              <span>Security</span>
              <h1>User Manage</h1>
              <p>PIN login, role permissions, lockout, and audit log</p>
            </div>
            <button className="home-action primary" type="button" onClick={startNewStaffUser}>
              <Plus size={18} />
              New User
            </button>
          </div>

          <div className="user-layout">
            <section className="home-card user-list-card">
              <div className="section-title">
                <strong>Staff Users</strong>
                <span>{staffUsers.length} user(s)</span>
              </div>
              <div className="user-list">
                {staffUsers.map((staffUser) => (
                  <button
                    className={staffEditorId === staffUser.id ? 'user-row active' : 'user-row'}
                    key={staffUser.id}
                    type="button"
                    onClick={() => editStaffUser(staffUser)}
                  >
                    <User size={18} />
                    <span>
                      <strong>{staffUser.name}</strong>
                      <small>{staffUser.active ? 'Active' : 'Disabled'} - {staffUser.permissions.length} permission(s)</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="home-card user-editor-card">
              <div className="section-title">
                <strong>{staffEditorId ? 'Edit User' : 'New User'}</strong>
                <span>{isOwnerStaffEditor ? 'PIN change only' : 'Secure PIN'}</span>
              </div>
              {isOwnerStaffEditor && (
                <div className="sync-message">
                  Owner permissions and status are read-only. Enter a new PIN only when you need to change it.
                </div>
              )}
              <div className="profile-form user-form">
                <label>
                  Name
                  <input
                    value={staffName}
                    disabled={isOwnerStaffEditor}
                    onChange={(event) => setStaffName(event.target.value)}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={staffEditorActive ? 'active' : 'disabled'}
                    disabled={isOwnerStaffEditor}
                    onChange={(event) => setStaffEditorActive(event.target.value === 'active')}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
                <label>
                  PIN
                  <input
                    type="password"
                    inputMode="numeric"
                    value={staffPin}
                    onChange={(event) => setStaffPin(event.target.value)}
                  />
                </label>
                <label>
                  Confirm PIN
                  <input
                    type="password"
                    inputMode="numeric"
                    value={staffPinConfirm}
                    onChange={(event) => setStaffPinConfirm(event.target.value)}
                  />
                </label>
              </div>

              <div className="permission-grid">
                {staffPermissions.map((permission) => (
                  <label
                    className={isOwnerStaffEditor ? 'permission-tile readonly' : 'permission-tile'}
                    key={permission.id}
                  >
                    <input
                      type="checkbox"
                      disabled={isOwnerStaffEditor}
                      checked={staffEditorPermissions.includes(permission.id)}
                      onChange={() => toggleStaffPermission(permission.id)}
                    />
                    <span>
                      <strong>{permission.label}</strong>
                      <small>{permission.description}</small>
                    </span>
                  </label>
                ))}
              </div>

              {staffEditorStatus && <div className="sync-message">{staffEditorStatus}</div>}
              <div className="user-editor-actions">
                <button className="small-button" type="button" onClick={startNewStaffUser}>
                  <RefreshCw size={16} />
                  Clear
                </button>
                <button className="small-button primary" type="button" onClick={() => void saveStaffUser()}>
                  <Save size={16} />
                  {isOwnerStaffEditor ? 'Save PIN' : 'Save User'}
                </button>
              </div>
            </section>

            <section className="home-card audit-card">
              <div className="section-title">
                <strong>Audit Log</strong>
                <span>Recent actions</span>
              </div>
              <div className="audit-list">
                {recentAuditLog.map((entry) => (
                  <div className="audit-row" key={entry.id}>
                    <strong>{entry.action.replaceAll('_', ' ')}</strong>
                    <span>{entry.detail}</span>
                    <small>{entry.userName} - {formatDateTime(new Date(entry.createdAt))}</small>
                  </div>
                ))}
                {!recentAuditLog.length && <div className="empty-list">No audit entries yet</div>}
              </div>
            </section>
          </div>
        </section>
      )}

      {activeView === 'sync' && (
        <section className="sync-view page-view">
          <div className="page-head">
            <div>
              <span>Cloud</span>
              <h1>Cloud Sync</h1>
              <p>{cloudSyncSettings.apiUrl || 'Cloud API not set'}</p>
            </div>
          </div>

          <div className="sync-layout">
            <section className="home-card profile-form-card sync-settings-card">
              <div className="section-title">
                <strong>Connection</strong>
                <button className="small-button" type="button" onClick={() => void refreshPendingSyncCount()}>
                  <RefreshCw size={15} />
                  Refresh
                </button>
              </div>
              <div className="profile-form sync-form">
                <div className="wide sync-connection-summary">
                  <span>{hasCloudDeviceConnection ? 'Connected Device' : 'Cloud Not Connected'}</span>
                  <strong>{cloudSyncSettings.restaurantName || cloudSyncSettings.restaurantId || 'Not paired'}</strong>
                  <small>
                    {hasCloudDeviceConnection
                      ? 'Main cloud connection active'
                      : 'Login once with the client cloud account to connect this device.'}
                  </small>
                  <small>{cloudSyncSettings.apiUrl || defaultCloudSyncSettings.apiUrl}</small>
                  <div className="sync-summary-actions">
                    {hasCloudDeviceConnection && (
                      <button className="small-button danger" type="button" onClick={terminateCloudConnection}>
                        <LogOut size={15} />
                        Terminate Connection
                      </button>
                    )}
                    {hasCloudDeviceConnection && (
                      <button className="small-button primary" type="button" onClick={syncCloudNow} disabled={syncing}>
                        <RefreshCw size={15} />
                        {syncing ? 'Syncing' : 'Manual Sync'}
                      </button>
                    )}
                  </div>
                </div>

                {!hasCloudDeviceConnection && (
                  <>
                    <div className="wide sync-reconnect-title">
                      <strong>Connect Cloud Account</strong>
                      <span>Phone/email and password are needed only for first connection or account change.</span>
                    </div>
                    <div className="wide sync-url-row">
                      <label>
                        Cloud API URL
                        <input
                          value={cloudSyncSettings.apiUrl}
                          onChange={(event) => {
                            updateCloudSyncSetting('apiUrl', event.target.value)
                            setSyncCloudToken('')
                            setSyncRestaurants([])
                          }}
                          placeholder="https://goldensea.gihostings.in"
                        />
                      </label>
                      <button
                        className="small-button"
                        type="button"
                        onClick={() => {
                          updateCloudSyncSetting('apiUrl', defaultCloudSyncSettings.apiUrl)
                          setSyncCloudToken('')
                          setSyncRestaurants([])
                        }}
                      >
                        Use GI Cloud
                      </button>
                    </div>
                    <label>
                      Phone or Email
                      <input
                        autoComplete="username"
                        value={syncCloudLogin}
                        onChange={(event) => setSyncCloudLogin(event.target.value)}
                      />
                    </label>
                    <label>
                      Cloud Password
                      <input
                        autoComplete="current-password"
                        type="password"
                        value={syncCloudPassword}
                        onChange={(event) => setSyncCloudPassword(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            void loginCloudForSync()
                          }
                        }}
                      />
                    </label>
                    <div className="wide sync-action-row">
                      <button className="home-action primary" type="button" onClick={() => void loginCloudForSync()} disabled={syncing}>
                        <Wifi size={18} />
                        Login Cloud
                      </button>
                    </div>
                    {syncCloudToken && (
                      <>
                        <label>
                          Restaurant
                          <select value={syncRestaurantId} onChange={(event) => setSyncRestaurantId(event.target.value)}>
                            {syncRestaurants.map((restaurant) => (
                              <option key={restaurant.id} value={restaurant.id}>
                                {restaurant.name} - {titleCase(restaurant.status)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Transfer Code
                          <input
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Optional 6 digit code"
                            value={syncTransferCode}
                            onChange={(event) => setSyncTransferCode(normalizeTransferCode(event.target.value))}
                          />
                        </label>
                        <div className="wide setup-user-preview">
                          <strong>Cloud App Users</strong>
                          {selectedSyncStaffUsers.length ? (
                            <div>
                              {selectedSyncStaffUsers.map((staffUser) => (
                                <span key={staffUser.id}>{staffUser.name}</span>
                              ))}
                            </div>
                          ) : (
                            <small>No app users are published yet. Update old POS and run Manual Sync once.</small>
                          )}
                        </div>
                        <div className="wide sync-action-row">
                          <button
                            className="home-action primary"
                            type="button"
                            onClick={() => void connectCloudDeviceFromAccount()}
                            disabled={syncing || !syncRestaurantId}
                          >
                            <RefreshCw size={18} />
                            Connect & Sync
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
                <label className="wide sync-toggle">
                  <input
                    type="checkbox"
                    checked={cloudSyncSettings.autoSync}
                    onChange={(event) => updateCloudSyncSetting('autoSync', event.target.checked)}
                  />
                  <span>
                    <strong>Auto Sync</strong>
                    <small>Sync every 60 seconds after this device is connected.</small>
                  </span>
                </label>
                <details className="wide advanced-sync">
                  <summary>Advanced manual credentials</summary>
                  <div className="profile-form sync-form compact">
                    <label>
                      Restaurant ID
                      <input
                        value={cloudSyncSettings.restaurantId}
                        onChange={(event) => updateCloudSyncSetting('restaurantId', event.target.value)}
                      />
                    </label>
                    <label>
                      Device ID
                      <input
                        value={cloudSyncSettings.deviceId}
                        onChange={(event) => updateCloudSyncSetting('deviceId', event.target.value)}
                      />
                    </label>
                    <label className="wide">
                      API Key
                      <input
                        type="password"
                        value={cloudSyncSettings.apiKey}
                        onChange={(event) => updateCloudSyncSetting('apiKey', event.target.value)}
                      />
                    </label>
                  </div>
                </details>
              </div>
            </section>

            <section className="home-card sync-status-card">
              <div className="section-title">
                <strong>Sync Status</strong>
                <span>{syncing ? 'Working' : 'Ready'}</span>
              </div>
              <div className="sync-status-grid">
                <div>
                  <span>Pending</span>
                  <strong>{pendingSyncCount}</strong>
                </div>
                <div>
                  <span>Last Sync</span>
                  <strong>
                    {cloudSyncSettings.lastSyncAt ? formatDateTime(new Date(cloudSyncSettings.lastSyncAt)) : 'Not synced'}
                  </strong>
                </div>
                <div>
                  <span>Subscription</span>
                  <strong>
                    {cloudSyncSettings.subscriptionStatus
                      ? `${titleCase(cloudSyncSettings.subscriptionStatus)}${cloudSyncSettings.subscriptionExpiresAt ? ` till ${formatDate(new Date(cloudSyncSettings.subscriptionExpiresAt))}` : ''}`
                      : 'Not paired'}
                  </strong>
                </div>
                <div>
                  <span>Local DB</span>
                  <strong>{localDatabasePath ? 'SQLite Ready' : 'Browser Mode'}</strong>
                </div>
                <div>
                  <span>Server</span>
                  <strong>{normalizeApiUrl(cloudSyncSettings.apiUrl) || 'Not set'}</strong>
                </div>
                <div>
                  <span>Mode</span>
                  <strong>{cloudSyncSettings.autoSync ? 'Auto' : 'Manual'}</strong>
                </div>
              </div>
              <div className="sync-message">{syncStatus}</div>
            </section>
          </div>
        </section>
      )}

      {activeView === 'about' && (
        <section className="about-view page-view">
          <div className="page-head">
            <div>
              <span>Company</span>
              <h1>About & Terms</h1>
              <p>{companyName} - {companyWebsiteDisplay}</p>
            </div>
            <button className="home-action primary" type="button" onClick={() => goToView('pos')}>
              <ShoppingCart size={18} />
              POS Sale
            </button>
          </div>

          <div className="about-layout">
            <section className="home-card app-about-card">
              <h3>App Details</h3>
              <div className="business-lines">
                <div>
                  <Settings size={17} />
                  <span>{appName}</span>
                </div>
                <div>
                  <Landmark size={17} />
                  <span>App Owner: {appOwner}</span>
                </div>
                <div>
                  <Globe2 size={17} />
                  <span>{companyWebsiteDisplay}</span>
                </div>
                <div>
                  <ReceiptText size={17} />
                  <span>Version {appVersion}</span>
                </div>
                <div>
                  <Monitor size={17} />
                  <span>{localDatabasePath ? 'Local SQLite database' : 'Browser local storage'}</span>
                </div>
                {localDatabasePath && (
                  <div>
                    <Save size={17} />
                    <span title={localDatabasePath}>{localDatabasePath}</span>
                  </div>
                )}
              </div>
              <div className="app-update-panel">
                <div>
                  <strong>App Update</strong>
                  <span>{updateStatus.message}</span>
                </div>
                {typeof updateStatus.percent === 'number' && updateStatus.state === 'downloading' && (
                  <div className="update-progress">
                    <span style={{ width: `${Math.min(100, Math.max(0, updateStatus.percent))}%` }} />
                  </div>
                )}
                <div className="update-actions">
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => void checkForAppUpdate()}
                    disabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
                  >
                    <RefreshCw size={15} />
                    Check Update
                  </button>
                  {updateStatus.state === 'downloaded' && (
                    <button className="small-button primary" type="button" onClick={() => void installAppUpdate()}>
                      <Save size={15} />
                      Restart & Install
                    </button>
                  )}
                </div>
                <small>{updateStatus.updateUrl || 'Update server not set'}</small>
              </div>
            </section>

            <section className="home-card company-info-card about-company-card">
              <div className="section-title">
                <strong>About Us</strong>
                <a href={companyWebsite} target="_blank" rel="noreferrer">
                  {companyWebsiteDisplay}
                </a>
              </div>
              <p>
                {companyName} builds reliable digital solutions for businesses that need dependable online and
                in-store operations. Our services focus on hosting, domains, business websites, and practical software
                tools that help companies work faster, serve customers better, and manage daily operations with
                confidence.
              </p>
              <p>
                {appName} is developed as a desktop restaurant POS solution for billing, menu management, customer
                credit, reports, and thermal printer workflows. The product is designed for speed, simplicity, and
                long-term business use.
              </p>
            </section>

            <section className="home-card company-info-card terms-card">
              <div className="section-title">
                <strong>Terms & Conditions</strong>
                
              </div>
              <ul>
                <li>The software is provided for restaurant billing, sales recording, reporting, and related POS operations.</li>
                <li>Business, tax, menu, customer, printer, and billing information must be verified by the user before use.</li>
                <li>Users are responsible for maintaining backups of sales data, customer credit records, and business settings.</li>
                <li>Printer, network, device, and operating system issues may affect billing or printing and should be tested before live use.</li>
                <li>{companyName} may provide updates, improvements, and support, but business decisions and statutory compliance remain the responsibility of the business owner.</li>
              </ul>
            </section>
          </div>
        </section>
      )}

      {activeView === 'pos' && (
        <section className="pos-view">
          <section className="workspace" style={menuGridStyle}>
        <aside className="category-rail" aria-label="Menu categories">
          {orderedCategoryList.map((category) => (
            <button
              className={category.id === activeCategory ? 'category active' : 'category'}
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </aside>

        <section className="menu-pane">
          <div className="search-row">
            <div className="search-box">
              <Search size={18} />
              <input
                placeholder="Search by Name / Description / Alias"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="quick-filters">
              {quickTags.map((tag) => (
                <button
                  className={activeQuickTag === tag.id ? 'active' : ''}
                  key={tag.id}
                  type="button"
                  title={tag.label}
                  onClick={() => setActiveQuickTag((value) => (value === tag.id ? null : tag.id))}
                >
                  {getTagIcon(tag.id)}
                  <span>{tag.label}</span>
                </button>
              ))}
              <button
                className={displaySettingsOpen ? 'layout-settings-toggle active' : 'layout-settings-toggle'}
                type="button"
                title="Item view settings"
                onClick={() => setDisplaySettingsOpen((open) => !open)}
              >
                <Settings size={17} />
                <span>View</span>
              </button>
              {displaySettingsOpen && (
                <div className="menu-display-panel">
                  <div className="display-panel-head">
                    <strong>Item View</strong>
                    <button type="button" onClick={resetMenuDisplaySettings}>
                      <RefreshCw size={15} />
                      Reset
                    </button>
                  </div>

                  <div className="display-control">
                    <span>Font Size</span>
                    <div className="step-control">
                      <button
                        type="button"
                        onClick={() => updateMenuDisplaySetting('fontSize', menuDisplaySettings.fontSize - 1)}
                      >
                        <Minus size={14} />
                      </button>
                      <strong>{menuDisplaySettings.fontSize}px</strong>
                      <button
                        type="button"
                        onClick={() => updateMenuDisplaySetting('fontSize', menuDisplaySettings.fontSize + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <label className="display-control">
                    <span>Column Width</span>
                    <input
                      type="range"
                      min={menuDisplayLimits.itemWidth.min}
                      max={menuDisplayLimits.itemWidth.max}
                      value={menuDisplaySettings.itemWidth}
                      onChange={(event) => updateMenuDisplaySetting('itemWidth', numberFromInput(event.target.value))}
                    />
                    <input
                      type="number"
                      min={menuDisplayLimits.itemWidth.min}
                      max={menuDisplayLimits.itemWidth.max}
                      value={menuDisplaySettings.itemWidth}
                      onChange={(event) => updateMenuDisplaySetting('itemWidth', numberFromInput(event.target.value))}
                    />
                  </label>

                  <label className="display-control">
                    <span>Item Height</span>
                    <input
                      type="range"
                      min={menuDisplayLimits.itemHeight.min}
                      max={menuDisplayLimits.itemHeight.max}
                      value={menuDisplaySettings.itemHeight}
                      onChange={(event) => updateMenuDisplaySetting('itemHeight', numberFromInput(event.target.value))}
                    />
                    <input
                      type="number"
                      min={menuDisplayLimits.itemHeight.min}
                      max={menuDisplayLimits.itemHeight.max}
                      value={menuDisplaySettings.itemHeight}
                      onChange={(event) => updateMenuDisplaySetting('itemHeight', numberFromInput(event.target.value))}
                    />
                  </label>

                  <label className="display-control">
                    <span>Left Menu</span>
                    <input
                      type="range"
                      min={menuDisplayLimits.sidePanelWidth.min}
                      max={menuDisplayLimits.sidePanelWidth.max}
                      value={menuDisplaySettings.sidePanelWidth}
                      onChange={(event) =>
                        updateMenuDisplaySetting('sidePanelWidth', numberFromInput(event.target.value))
                      }
                    />
                    <input
                      type="number"
                      min={menuDisplayLimits.sidePanelWidth.min}
                      max={menuDisplayLimits.sidePanelWidth.max}
                      value={menuDisplaySettings.sidePanelWidth}
                      onChange={(event) =>
                        updateMenuDisplaySetting('sidePanelWidth', numberFromInput(event.target.value))
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="category-result">
            <UtensilsCrossed size={19} />
            <div>
              <strong>Category Results</strong>
              <span>{filteredItems.length} items found</span>
            </div>
          </div>

          <div className="item-section-title">{getCategoryLabel(activeCategory, categoryList)}</div>

          <div className="item-grid">
            {filteredItems.map((item) => (
              <button className="menu-item" type="button" key={item.id} onClick={() => addItem(item)}>
                {item.imageDataUrl ? (
                  <img className="menu-item-photo" src={item.imageDataUrl} alt="" />
                ) : (
                  <span className="menu-item-photo empty-photo">
                    <ImagePlus size={19} />
                  </span>
                )}
                <span className="price">Rs. {item.price.toFixed(2)}</span>
                <span className="item-name">{item.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="bill-pane" aria-label="Current bill">
          <div className="order-type-tabs">
            {orderTypes.map((type) => (
              <button
                key={type}
                className={type === orderType ? 'order-tab active' : 'order-tab'}
                type="button"
                onClick={() => setOrderType(type)}
              >
                {getOrderIcon(type)}
                {type}
              </button>
            ))}
          </div>

          <div className="bill-head">
            <div className="bill-number-head">
              <span>Bill#</span>
              <strong>{billNumber}</strong>
            </div>
            <button type="button" className="icon-action" title="Seating" onClick={() => setTableSelectorOpen(true)}>
              <UtensilsCrossed size={19} />
              <span>{table || 'Seating'}</span>
            </button>
            <button type="button" className="icon-action" title="Customer" onClick={() => setCustomerEditorOpen(true)}>
              <User size={19} />
              <span>{customer || 'Customer'}</span>
            </button>
            <button
              type="button"
              className="icon-action"
              title="Discount"
              onClick={() => {
                if (requirePermission('discount_manage', 'Discount permission required')) {
                  setDiscountEditorOpen(true)
                }
              }}
            >
              <BadgePercent size={19} />
              <span>{discountPercent ? `${discountPercent}%` : 'Discount'}</span>
            </button>
          </div>

          <div className="cart-title">
            <span>Cart</span>
            <strong>{itemCount} item(s)</strong>
          </div>

          <div className="cart-list">
            {cart.map((line) => (
              <article className="cart-line" key={line.id}>
                <div className="cart-item-main">
                  <span>Item Name</span>
                  <strong>{line.name}</strong>
                  {getCartLineNote(line) && <em>{getCartLineNote(line)}</em>}
                </div>
                <div className="cart-meta">
                  <span>Price</span>
                  <strong>{line.price.toFixed(2)}</strong>
                </div>
                <div className="cart-meta">
                  <span>Qty</span>
                  <strong>{line.qty.toFixed(3)}</strong>
                </div>
                <div className="cart-meta">
                  <span>Tax</span>
                  <strong>{line.taxRate}%</strong>
                </div>
                <div className="quantity-stepper" aria-label={`Quantity for ${line.name}`}>
                  <button type="button" onClick={() => changeQty(line.id, -1)}>
                    <Minus size={15} />
                  </button>
                  <strong>{line.qty}</strong>
                  <button type="button" onClick={() => changeQty(line.id, 1)}>
                    <Plus size={15} />
                  </button>
                </div>
                <div className="line-total">
                  <span>Items Total</span>
                  <strong>{money(lineTotal(line))}</strong>
                </div>
                <button className="delete-line" type="button" onClick={() => removeLine(line.id)} title="Delete item">
                  <Trash2 size={18} />
                </button>
                <button
                  className="more-line"
                  type="button"
                  title="More"
                  onClick={() => setLineActionId((lineId) => (lineId === line.id ? null : line.id))}
                >
                  <MoreVertical size={18} />
                </button>
                {lineActionId === line.id && (
                  <div className="line-menu">
                    <button type="button" onClick={() => openLineEditor(line, 'discount')}>
                      <BadgePercent size={15} />
                      Discount
                    </button>
                    <button type="button" onClick={() => openLineEditor(line, 'price')}>
                      <Pencil size={15} />
                      Price Change
                    </button>
                    <button type="button" onClick={() => openLineEditor(line, 'description')}>
                      <ReceiptText size={15} />
                      Description
                    </button>
                  </div>
                )}
              </article>
            ))}

            {!cart.length && (
              <div className="empty-cart">
                <ShoppingCart size={26} />
                <span>Select an item to begin this bill</span>
              </div>
            )}
          </div>

          <footer className="payment-dock">
            <div className="payment-left">
              <div className="totals-strip">
                <span>Paid: {money(totals.paid)}</span>
                <span>Due: {money(totals.balance)}</span>
                <span>Return: {money(totals.change)}</span>
              </div>

              <div className="payment-methods">
                {paymentMethods.map((method) => (
                  <button
                    key={method}
                    className={paymentMethod === method ? 'payment active' : 'payment'}
                    type="button"
                    onClick={() => {
                      if (method === 'Due' && !requirePermission('due_manage', 'Due management permission required')) {
                        return
                      }

                      setPaymentMethod(method)
                      setAmountReceivedOverride(method === 'Cash' ? null : 0)
                      setPartTenderMethod('upi')
                    }}
                  >
                    {getPaymentIcon(method)}
                    {method}
                  </button>
                ))}
              </div>

              {paymentMethod === 'Due' ? (
                <div className="credit-hint">
                  <span>Credit customer</span>
                  <strong>{customer || 'Select customer'}</strong>
                </div>
              ) : paymentMethod === 'UPI' || paymentMethod === 'Card' ? (
                <div className="credit-hint bank-hint">
                  <span>{paymentMethod} payment</span>
                  <strong>{money(baseTotals.total)}</strong>
                </div>
              ) : paymentMethod === 'Part' ? (
                <div className="part-payment-grid">
                  <label className="part-cash-field">
                    Cash
                    <input
                      type="number"
                      min="0"
                      value={cashReceived}
                      onChange={(event) => setAmountReceivedOverride(numberFromInput(event.target.value))}
                    />
                  </label>
                  <div className="part-method-select">
                    <span>Remaining By</span>
                    <div className="part-method-buttons">
                      <button
                        className={partTenderMethod === 'upi' ? 'active' : ''}
                        type="button"
                        onClick={() => setPartTenderMethod('upi')}
                      >
                        <Wifi size={15} />
                        UPI
                      </button>
                      <button
                        className={partTenderMethod === 'card' ? 'active' : ''}
                        type="button"
                        onClick={() => setPartTenderMethod('card')}
                      >
                        <CreditCard size={15} />
                        Card
                      </button>
                    </div>
                  </div>
                  <div className="part-auto-amount">
                    <span>{partTenderMethod === 'upi' ? 'UPI Amount' : 'Card Amount'}</span>
                    <strong>{money(partAutoAmount)}</strong>
                  </div>
                </div>
              ) : (
                <label className="amount-field">
                  Cash Received
                  <input
                    type="number"
                    min="0"
                    value={cashReceived}
                    onChange={(event) => setAmountReceivedOverride(numberFromInput(event.target.value))}
                  />
                </label>
              )}

              <div className="grand-total">
                <span>Total</span>
                <strong>{money(totals.total)}</strong>
              </div>
            </div>

            <div className="checkout-actions">
              <div className="right-actions">
                <button className="action warn" type="button" onClick={holdCurrentOrder}>
                  <Clock3 size={18} />
                  Hold
                </button>
                <button className="action success" type="button" onClick={savePaidOrder}>
                  <Save size={18} />
                  Save Bill
                </button>
                <button className="action kot" type="button" onClick={() => setKotPrintOpen(true)}>
                  <Printer size={18} />
                  Print KOT
                </button>
                <button className="action primary" type="button" onClick={() => printReceipt(true)}>
                  <Printer size={18} />
                  Save & Print
                </button>
                <button className="action dark" type="button" onClick={() => printReceipt(true)}>
                  <ReceiptText size={18} />
                  Print Bill
                </button>
              </div>
            </div>
          </footer>
        </section>
          </section>
        </section>
      )}

      {successOrder && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Bill success">
          <div className="success-panel">
            <div className="success-icon">
              <Save size={38} />
            </div>
            <div className="success-title">
              <strong>Bill {successAction === 'printed' ? 'Printed' : 'Saved'} Successfully</strong>
              <span>Next bill is ready. Table has been cleared.</span>
            </div>

            <div className="success-summary">
              <div>
                <span>Bill No</span>
                <strong>{successOrder.billNo}</strong>
              </div>
              <div>
                <span>Order</span>
                <strong>
                  {successOrder.orderType}
                  {successOrder.table ? ` / ${successOrder.table}` : ''}
                </strong>
              </div>
              <div>
                <span>Customer</span>
                <strong>{successOrder.customer || 'Walk-in'}</strong>
              </div>
              <div>
                <span>Items</span>
                <strong>{successOrder.cart.reduce((sum, line) => sum + line.qty, 0)}</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong>{successOrder.paymentMethod}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{money(successOrder.totals.total)}</strong>
              </div>
              <div>
                <span>Paid</span>
                <strong>{money(successOrder.totals.paid)}</strong>
              </div>
              <div>
                <span>Balance</span>
                <strong>{money(successOrder.totals.balance)}</strong>
              </div>
              <div>
                <span>Return</span>
                <strong>{money(successOrder.totals.change)}</strong>
              </div>
              {successOrder.totals.balance > 0 && (
                <div>
                  <span>Credit Saved</span>
                  <strong>{successOrder.customer || 'Customer'}</strong>
                </div>
              )}
            </div>

            <div className="success-items">
              {successOrder.cart.slice(0, 5).map((line) => (
                <div className="success-line" key={line.id}>
                  <span>
                    {line.name} x {line.qty}
                  </span>
                  <strong>{money(lineTotal(line))}</strong>
                </div>
              ))}
              {successOrder.cart.length > 5 && (
                <div className="success-line">
                  <span>More items</span>
                  <strong>{successOrder.cart.length - 5}</strong>
                </div>
              )}
            </div>

            <div className="panel-actions">
              <button
                className="small-button"
                type="button"
                onClick={() => {
                  loadOrder(successOrder)
                  setSuccessOrder(null)
                }}
              >
                <ReceiptText size={16} />
                Open Bill
              </button>
              <button className="small-button primary" type="button" onClick={() => setSuccessOrder(null)}>
                <Plus size={16} />
                New Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {tableSelectorOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Table selection">
          <div className="table-panel">
            <div className="panel-head">
              <div>
                <strong>Select Table</strong>
                <span>Occupied tables open saved unclosed or hold orders</span>
              </div>
              <button type="button" onClick={() => setTableSelectorOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="table-grid">
              {tableList.map((tableNo) => {
                const savedOrder = tableStatus.get(tableNo)
                const isSelected = table === tableNo
                const className = [
                  'table-tile',
                  isSelected ? 'active' : '',
                  savedOrder ? savedOrder.status : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button className={className} key={tableNo} type="button" onClick={() => selectTable(tableNo)}>
                    <strong>{tableNo}</strong>
                    <span>{savedOrder ? `${savedOrder.status} - ${money(savedOrder.totals.total)}` : 'Free'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {customerEditorOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Customer">
          <div className="quick-panel customer-panel">
            <div className="panel-head">
              <div>
                <strong>Customer Profile</strong>
                <span>{customerStats.total} customers / {customerStats.dueCount} due</span>
              </div>
              <button type="button" onClick={() => setCustomerEditorOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="customer-stat-grid">
              <div>
                <span>Total Customers</span>
                <strong>{customerStats.total}</strong>
              </div>
              <div>
                <span>Due Customers</span>
                <strong>{customerStats.dueCount}</strong>
              </div>
              <div>
                <span>Total Due</span>
                <strong>{money(customerStats.dueTotal)}</strong>
              </div>
            </div>

            <div className="customer-workspace">
              <section className="customer-search-panel">
                <div className="customer-search-box">
                  <Search size={17} />
                  <input
                    autoFocus
                    placeholder="Search customer name / phone"
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                  />
                </div>

                <div className="customer-tools">
                  <div className="customer-filter-tabs">
                    {customerFilters.map((filter) => (
                      <button
                        className={customerFilter === filter.id ? 'active' : ''}
                        key={filter.id}
                        type="button"
                        onClick={() => setCustomerFilter(filter.id)}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  <label className="customer-sort-field">
                    Sort
                    <select value={customerSort} onChange={(event) => setCustomerSort(event.target.value as CustomerSort)}>
                      {customerSortOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="customer-list-head">
                  <strong>Saved Customers</strong>
                  <span>{filteredCustomers.length} shown</span>
                </div>

                <div className="customer-picker-list">
                  {filteredCustomers.length ? (
                    filteredCustomers.map((profile) => (
                      <button
                        className={[
                          selectedCustomerId === profile.id ? 'active' : '',
                          profile.creditBalance > 0 ? 'has-due' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        key={profile.id}
                        type="button"
                        onClick={() => selectCustomerProfile(profile)}
                      >
                        <div className="customer-row-head">
                          <strong className="customer-name-with-badge">
                            {profile.name}
                            {profile.creditBalance > 0 && <small className="due-badge">DUE</small>}
                          </strong>
                          {profile.creditBalance > 0 && <span>{money(profile.creditBalance)}</span>}
                        </div>
                        <span>{profile.phone || 'No phone'}</span>
                        {profile.address && <small>{profile.address}</small>}
                      </button>
                    ))
                  ) : (
                    <div className="empty-customer-list">
                      {customers.length ? 'No matching customer' : 'No saved customers yet'}
                    </div>
                  )}
                </div>
              </section>

              <section className="customer-detail-panel">
                <div className="customer-summary-card">
                  <div>
                    <span>Selected Customer</span>
                    <strong>{customer || 'Walk-in'}</strong>
                  </div>
                  <div>
                    <span>Credit Balance</span>
                    <strong className="customer-name-with-badge">
                      {money(selectedCustomerProfile?.creditBalance ?? 0)}
                      {(selectedCustomerProfile?.creditBalance ?? 0) > 0 && <small className="due-badge">DUE</small>}
                    </strong>
                  </div>
                  <div>
                    <span>Phone</span>
                    <strong>{selectedCustomerProfile?.phone || customerPhone || 'Not set'}</strong>
                  </div>
                  <div>
                    <span>Total Credit</span>
                    <strong>{money(selectedCustomerProfile?.totalCredit ?? 0)}</strong>
                  </div>
                </div>

                <div className="dialog-grid">
                  <label className="dialog-field">
                    Customer Name
                    <input
                      placeholder="Customer name"
                      value={customer}
                      onChange={(event) => setCustomer(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && saveCustomerProfile()) {
                          setCustomerEditorOpen(false)
                        }
                      }}
                    />
                  </label>

                  <label className="dialog-field">
                    Phone
                    <input
                      placeholder="Mobile number"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                    />
                  </label>
                </div>

                <label className="dialog-field">
                  Address
                  <textarea
                    placeholder="Billing address"
                    value={customerAddress}
                    onChange={(event) => setCustomerAddress(event.target.value)}
                  />
                </label>

                <div className="panel-actions customer-actions">
                  <button className="small-button" type="button" onClick={clearCustomerProfile}>
                    <Plus size={16} />
                    New
                  </button>
                  <button
                    className="small-button due-paid-button"
                    type="button"
                    disabled={!selectedCustomerProfile || selectedCustomerProfile.creditBalance <= 0}
                    onClick={markSelectedCustomerDuePaid}
                  >
                    <BadgePercent size={16} />
                    Mark Paid
                  </button>
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => {
                      if (saveCustomerProfile()) {
                        setCustomerEditorOpen(false)
                      }
                    }}
                  >
                    <Save size={16} />
                    Save Customer
                  </button>
                  <button className="small-button primary" type="button" onClick={() => setCustomerEditorOpen(false)}>
                    <User size={16} />
                    Done
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {discountEditorOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Bill discount">
          <div className="quick-panel">
            <div className="panel-head">
              <div>
                <strong>Bill Discount</strong>
                <span>Apply discount to the full bill</span>
              </div>
              <button type="button" onClick={() => setDiscountEditorOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="dialog-grid single">
              <label className="dialog-field">
                Discount %
                <input
                  autoFocus
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(event) => setDiscountPercent(clamp(numberFromInput(event.target.value), 0, 100))}
                />
              </label>
            </div>

            <div className="panel-actions">
              <button
                className="small-button"
                type="button"
                onClick={() => {
                  setDiscountPercent(0)
                  setServicePercent(0)
                }}
              >
                <X size={16} />
                Clear
              </button>
              <button className="small-button primary" type="button" onClick={() => setDiscountEditorOpen(false)}>
                <Save size={16} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {lineEditor && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Item action">
          <div className="quick-panel">
            <div className="panel-head">
              <div>
                <strong>{getLineEditorTitle(lineEditor.mode)}</strong>
                <span>{cart.find((line) => line.id === lineEditor.lineId)?.name}</span>
              </div>
              <button type="button" onClick={() => setLineEditor(null)} title="Close">
                <X size={18} />
              </button>
            </div>

            <label className="dialog-field">
              {getLineEditorLabel(lineEditor.mode)}
              {lineEditor.mode === 'description' ? (
                <textarea
                  autoFocus
                  rows={4}
                  placeholder="Less spicy, no onion..."
                  value={lineEditor.value}
                  onChange={(event) => setLineEditor({ ...lineEditor, value: event.target.value })}
                />
              ) : (
                <input
                  autoFocus
                  type="number"
                  min="0"
                  max={lineEditor.mode === 'discount' ? '100' : undefined}
                  value={lineEditor.value}
                  onChange={(event) => setLineEditor({ ...lineEditor, value: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      saveLineEditor()
                    }
                  }}
                />
              )}
            </label>

            <div className="panel-actions">
              <button
                className="small-button"
                type="button"
                onClick={() => setLineEditor({ ...lineEditor, value: lineEditor.mode === 'description' ? '' : '0' })}
              >
                <X size={16} />
                Clear
              </button>
              <button className="small-button primary" type="button" onClick={saveLineEditor}>
                <Save size={16} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {orderListMode && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Orders">
          <div className={orderListMode === 'orders' ? 'orders-panel has-date-filter' : 'orders-panel'}>
            <div className="panel-head">
              <div>
                <strong>{getOrderListTitle(orderListMode)}</strong>
                <span>
                  {visibleOrders.length} bill(s)
                  {orderListMode === 'orders' ? ` on ${formatDate(selectedOrderListDay)}` : ''}
                </span>
              </div>
              <button type="button" onClick={() => setOrderListMode(null)} title="Close">
                <X size={18} />
              </button>
            </div>

            {orderListMode === 'orders' && (
              <div className="orders-date-filter">
                <label>
                  Bill Date
                  <input
                    type="date"
                    value={orderListDate}
                    onChange={(event) => setOrderListDate(event.currentTarget.value)}
                  />
                </label>
                <strong>{formatDate(selectedOrderListDay)}</strong>
              </div>
            )}

            <div className="orders-list">
              {visibleOrders.map((order) => (
                <article className={`saved-order ${order.status}`} key={order.id}>
                  <div>
                    <span>Bill #{order.billNo}</span>
                    <strong>{order.orderType} {order.table ? `/ ${order.table}` : ''}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{order.status}</strong>
                  </div>
                  <div>
                    <span>Items</span>
                    <strong>{order.cart.reduce((sum, line) => sum + line.qty, 0)}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>{money(order.totals.total)}</strong>
                  </div>
                  <button type="button" className="small-button primary" onClick={() => loadOrder(order)}>
                    Open
                  </button>
                  <button type="button" className="small-button" onClick={() => deleteOrder(order.id)}>
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}

              {!visibleOrders.length && <div className="empty-list">No orders found</div>}
            </div>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Report">
          <div className="report-panel">
            <div className="panel-head">
              <div>
                <strong>Sales Report</strong>
                <span>Based on saved bills in this desktop app</span>
              </div>
              <button type="button" onClick={() => setReportOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="report-grid">
              <div className="report-card">
                <span>Paid Bills</span>
                <strong>{report.paidCount}</strong>
              </div>
              <div className="report-card">
                <span>Sales</span>
                <strong>{money(report.salesTotal)}</strong>
              </div>
              <div className="report-card">
                <span>Today Cash In Hand</span>
                <strong>{money(report.todayCashInHand)}</strong>
              </div>
              <div className="report-card">
                <span>Today Bank</span>
                <strong>{money(report.todayBank)}</strong>
              </div>
              <div className="report-card">
                <span>Open Bills</span>
                <strong>{report.openCount}</strong>
              </div>
              <div className="report-card">
                <span>Open Amount</span>
                <strong>{money(report.openTotal)}</strong>
              </div>
            </div>

            <div className="report-columns">
              <section>
                <h3>Payment Summary</h3>
                {paymentMethods.map((method) => (
                  <div className="report-line" key={method}>
                    <span>{method}</span>
                    <strong>{money(report.paymentTotals[method] ?? 0)}</strong>
                  </div>
                ))}
              </section>
              <section>
                <h3>Top Items</h3>
                {report.topItems.map((item) => (
                  <div className="report-line" key={item.name}>
                    <span>{item.name} x {item.qty}</span>
                    <strong>{money(item.total)}</strong>
                  </div>
                ))}
                {!report.topItems.length && <div className="empty-list">Save bills to build item report</div>}
              </section>
            </div>
          </div>
        </div>
      )}

      {accountPanelOpen && currentUser && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="My account">
          <div className="quick-panel account-panel">
            <div className="panel-head">
              <div>
                <strong>My Account</strong>
                <span>{isOwnerStaffUser(currentUser) ? 'Owner account' : 'Staff account'}</span>
              </div>
              <button type="button" onClick={() => setAccountPanelOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="account-profile-summary">
              <div className="account-avatar">
                <User size={22} />
              </div>
              <div>
                <strong>{currentUser.name}</strong>
                <span>{isOwnerStaffUser(currentUser) ? 'Owner account' : 'Staff account'}</span>
              </div>
            </div>

            <div className="account-shortcut-grid">
              {hasSubscriptionAccess && hasPermission('business_profile') && (
                <button type="button" onClick={() => openAccountView('profile')}>
                  <Building2 size={20} />
                  <span>
                    <strong>Business Profile</strong>
                    <small>Billing details</small>
                  </span>
                </button>
              )}
              {hasPermission('cloud_sync') && (
                <button type="button" onClick={() => openAccountView('sync')}>
                  <Wifi size={20} />
                  <span>
                    <strong>Cloud Sync</strong>
                    <small>Backup and devices</small>
                  </span>
                </button>
              )}
              {hasSubscriptionAccess && hasPermission('user_manage') && (
                <button type="button" onClick={() => openAccountView('users')}>
                  <User size={20} />
                  <span>
                    <strong>User Manage</strong>
                    <small>PIN and permissions</small>
                  </span>
                </button>
              )}
            </div>

            <div className="account-panel-actions">
              <button className="small-button" type="button" onClick={() => setAccountPanelOpen(false)}>
                Close
              </button>
              <button className="small-button primary" type="button" onClick={lockApp}>
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {menuEditorOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Menu editor">
          <div className="menu-editor-panel">
            <div className="panel-head">
              <div>
                <strong>Menu Editor</strong>
                <span>Add or edit categories and items</span>
              </div>
              <button type="button" onClick={() => setMenuEditorOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="editor-layout">
              <section className="editor-section">
                <div className="editor-title">
                  <strong>Categories</strong>
                  <span>{editableCategories.length} active</span>
                </div>

                <div className="inline-form">
                  <input
                    placeholder="Category name"
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        saveCategory()
                      }
                    }}
                  />
                  <button type="button" className="small-button primary" onClick={saveCategory}>
                    <Save size={16} />
                    {editingCategoryId ? 'Update' : 'Add'}
                  </button>
                </div>

                <div className="editor-list">
                  {editableCategories.map((category, index) => (
                    <div
                      className={
                        draggedCategoryId === category.id
                          ? 'editor-row category-editor-row dragging'
                          : 'editor-row category-editor-row'
                      }
                      draggable
                      key={category.id}
                      onDragStart={(event) => handleCategoryDragStart(event, category.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleCategoryDrop(event, category.id)}
                      onDragEnd={() => setDraggedCategoryId(null)}
                    >
                      <span className="category-drag-handle" title="Drag to reorder">
                        <MoreVertical size={16} />
                      </span>
                      <button
                        className={category.id === activeCategory ? 'row-main category-row-main active' : 'row-main category-row-main'}
                        type="button"
                        onClick={() => {
                          setActiveCategory(category.id)
                          setItemDraft((draft) => ({ ...draft, category: category.id }))
                        }}
                      >
                        <span>{index + 1}</span>
                        <strong>{category.label}</strong>
                      </button>
                      <button type="button" title="Edit category" onClick={() => editCategory(category)}>
                        <Pencil size={16} />
                      </button>
                      <button type="button" title="Delete category" onClick={() => deleteCategory(category.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="editor-section">
                <div className="editor-title">
                  <strong>{editingItemId ? 'Edit Item' : 'Add Item'}</strong>
                  <span>{editorItems.length} in selected category</span>
                </div>

                <div className="item-photo-editor">
                  <div className="item-photo-preview">
                    {itemDraft.imageDataUrl ? (
                      <img src={itemDraft.imageDataUrl} alt="" />
                    ) : (
                      <ImagePlus size={24} />
                    )}
                  </div>
                  <div className="item-photo-actions">
                    <label className="small-button primary">
                      <ImagePlus size={16} />
                      Item Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleItemPhotoUpload(event.currentTarget.files?.[0])}
                      />
                    </label>
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => setItemDraft((draft) => ({ ...draft, imageDataUrl: '' }))}
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </div>
                </div>

                <div className="item-form">
                  <label>
                    Item Name
                    <input
                      placeholder="Porotta"
                      value={itemDraft.name}
                      onChange={(event) => setItemDraft((draft) => ({ ...draft, name: event.target.value }))}
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={itemDraft.category}
                      onChange={(event) => setItemDraft((draft) => ({ ...draft, category: event.target.value }))}
                    >
                      {editableCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Price
                    <input
                      type="number"
                      min="0"
                      placeholder="15"
                      value={itemDraft.price}
                      onChange={(event) => setItemDraft((draft) => ({ ...draft, price: event.target.value }))}
                    />
                  </label>
                  <label>
                    Tags
                    <input
                      placeholder="special, hot"
                      value={itemDraft.tags}
                      onChange={(event) => setItemDraft((draft) => ({ ...draft, tags: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="tag-toggle-row">
                  {quickTags.map((tag) => (
                    <button
                      className={normalizeTags(itemDraft.tags).includes(tag.id) ? 'active' : ''}
                      key={tag.id}
                      type="button"
                      onClick={() => toggleDraftTag(tag.id)}
                    >
                      {getTagIcon(tag.id)}
                      {tag.label}
                    </button>
                  ))}
                </div>

                <div className="editor-actions">
                  <button type="button" className="small-button primary" onClick={saveMenuItem}>
                    <Save size={16} />
                    {editingItemId ? 'Update Item' : 'Add Item'}
                  </button>
                  <button type="button" className="small-button" onClick={() => resetItemDraft()}>
                    <X size={16} />
                    Clear
                  </button>
                </div>

                <div className="editor-list item-editor-list">
                  {editorItems.map((item) => (
                    <div className="editor-row item-editor-row" key={item.id}>
                      <button className="row-main" type="button" onClick={() => editMenuItem(item)}>
                        <span className="item-row-thumb">
                          {item.imageDataUrl ? <img src={item.imageDataUrl} alt="" /> : <ImagePlus size={14} />}
                        </span>
                        <span>{item.name}</span>
                        <strong>Rs. {item.price.toFixed(2)}</strong>
                      </button>
                      <button type="button" title="Edit item" onClick={() => editMenuItem(item)}>
                        <Pencil size={16} />
                      </button>
                      <button type="button" title="Delete item" onClick={() => deleteMenuItem(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {kotPrintOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Print KOT">
          <div className="quick-panel kot-print-panel">
            <div className="panel-head">
              <div>
                <strong>Print KOT</strong>
                <span>Select printer profile for this order</span>
              </div>
              <button type="button" onClick={() => setKotPrintOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="kot-station-grid">
              {printerProfiles.map((profile) => (
                <button className="kot-station-card" type="button" key={profile.id} onClick={() => printKot(profile.id)}>
                  <Printer size={22} />
                  <strong>{profile.name}</strong>
                  <span>
                    {profile.id === billPrinterProfile?.id ? 'Bill default / ' : ''}
                    {describePrinterSettings(profile.settings)}
                  </span>
                </button>
              ))}
            </div>

            <div className="panel-actions">
              <button
                className="small-button"
                type="button"
                onClick={() => {
                  setKotPrintOpen(false)
                  setPrinterOpen(true)
                  refreshPrinters()
                }}
              >
                <Printer size={16} />
                Printer Manage
              </button>
            </div>
          </div>
        </div>
      )}

      {printerOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Printer settings">
          <div className="printer-panel">
            <div className="panel-head">
              <div>
                <strong>Printer Manager</strong>
                <span>Create printer profiles for bill, kitchen, juice, counter, or any section</span>
              </div>
              <button type="button" onClick={() => setPrinterOpen(false)} title="Close">
                <MoreVertical size={18} />
              </button>
            </div>

            <div className="printer-manager-layout">
              <aside className="printer-profile-sidebar">
                <div className="printer-section-title">
                  <strong>Profiles</strong>
                  <span>{printerStatus}</span>
                </div>

                <div className="profile-add-row">
                  <input
                    placeholder="Profile name"
                    value={printerProfileName}
                    onChange={(event) => setPrinterProfileName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        addPrinterProfile()
                      }
                    }}
                  />
                  <button type="button" onClick={addPrinterProfile} title="Add profile">
                    <Plus size={17} />
                  </button>
                </div>

                <div className="printer-profile-list">
                  {printerProfiles.map((profile) => (
                    <button
                      className={activePrinterProfile?.id === profile.id ? 'active' : ''}
                      key={profile.id}
                      type="button"
                      onClick={() => setActivePrinterProfileId(profile.id)}
                    >
                      <strong>{profile.name || 'Printer Profile'}</strong>
                      <span>
                        {profile.id === billPrinterProfile?.id ? 'Bill default / ' : ''}
                        {describePrinterSettings(profile.settings)}
                      </span>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="printer-profile-editor">
                <div className="printer-section-title">
                  <strong>{activePrinterProfile?.name || 'Printer Profile'}</strong>
                  <span>
                    {activePrinterProfile?.id === billPrinterProfile?.id
                      ? 'Default bill printer'
                      : 'Printer profile'}
                  </span>
                </div>

                <label className="dialog-field">
                  Profile Name
                  <input
                    value={activePrinterProfile?.name ?? ''}
                    onChange={(event) => updateActivePrinterProfileName(event.target.value)}
                  />
                </label>

                <div className="segmented">
                  <button
                    className={activePrinterSettings.mode === 'system' ? 'active' : ''}
                    type="button"
                    onClick={() => updateActivePrinterProfileSettings({ mode: 'system' })}
                  >
                    <Monitor size={17} />
                    Windows / USB
                  </button>
                  <button
                    className={activePrinterSettings.mode === 'network' ? 'active' : ''}
                    type="button"
                    onClick={() => updateActivePrinterProfileSettings({ mode: 'network' })}
                  >
                    <Wifi size={17} />
                    LAN ESC/POS
                  </button>
                </div>

                {activePrinterSettings.mode === 'system' ? (
                  <div className="panel-grid">
                    <label>
                      System Printer
                      <select
                        value={activePrinterSettings.deviceName}
                        onChange={(event) => updateActivePrinterProfileSettings({ deviceName: event.target.value })}
                      >
                        <option value="">Select printer</option>
                        {printers.map((printer) => (
                          <option key={printer.name} value={printer.name}>
                            {printer.displayName || printer.name}
                            {printer.isDefault ? ' (Default)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="small-button" onClick={refreshPrinters}>
                      <RefreshCw size={16} />
                      Refresh
                    </button>
                  </div>
                ) : (
                  <div className="panel-grid two">
                    <label>
                      Printer IP
                      <input
                        value={activePrinterSettings.ipAddress}
                        onChange={(event) => updateActivePrinterProfileSettings({ ipAddress: event.target.value })}
                      />
                    </label>
                    <label>
                      Port
                      <input
                        value={activePrinterSettings.port}
                        onChange={(event) => updateActivePrinterProfileSettings({ port: event.target.value })}
                      />
                    </label>
                  </div>
                )}

                <div className="paper-row">
                  <span>Paper Width</span>
                  <button
                    className={activePrinterSettings.paperWidth === '80' ? 'active' : ''}
                    type="button"
                    onClick={() => updateActivePrinterProfileSettings({ paperWidth: '80' })}
                  >
                    80mm
                  </button>
                  <button
                    className={activePrinterSettings.paperWidth === '58' ? 'active' : ''}
                    type="button"
                    onClick={() => updateActivePrinterProfileSettings({ paperWidth: '58' })}
                  >
                    58mm
                  </button>
                </div>

                <div className="profile-status-card">
                  <span>Bill Printer</span>
                  <strong>{billPrinterProfile?.name || 'Bill Printer'}</strong>
                </div>

                <div className="panel-actions">
                  {activePrinterProfile?.id !== billPrinterProfile?.id && (
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => {
                        if (activePrinterProfile) {
                          setBillPrinterProfileId(activePrinterProfile.id)
                          setPrinterStatus(`${activePrinterProfile.name} set as bill printer`)
                        }
                      }}
                    >
                      <ReceiptText size={16} />
                      Use for Bill
                    </button>
                  )}
                  <button className="small-button" type="button" onClick={() => testPrinter()}>
                    <Printer size={16} />
                    Test Print
                  </button>
                  <button className="small-button" type="button" onClick={() => testKotPrinter()}>
                    <Printer size={16} />
                    Test KOT
                  </button>
                  {activePrinterProfile?.id !== billPrinterProfile?.id && (
                    <button className="small-button" type="button" onClick={deleteActivePrinterProfile}>
                      <Trash2 size={16} />
                      Delete
                    </button>
                  )}
                  <button className="small-button primary" type="button" onClick={() => printReceipt(false)}>
                    <ReceiptText size={16} />
                    Print Receipt
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function getCategoryLabel(categoryId: string, categoryList: Category[]) {
  return categoryList.find((category) => category.id === categoryId)?.label.toUpperCase() || 'MENU'
}

function getOrderIcon(type: OrderType) {
  if (type === 'Dining') return <UtensilsCrossed size={17} />
  if (type === 'Delivery') return <Truck size={17} />
  if (type === 'Take Away') return <ShoppingBag size={17} />
  return <Globe2 size={17} />
}

function getPaymentIcon(method: PaymentMethod) {
  if (method === 'Cash') return <Banknote size={18} />
  if (method === 'UPI') return <Wifi size={18} />
  if (method === 'Card') return <CreditCard size={18} />
  if (method === 'Due') return <Clock3 size={18} />
  return <CreditCard size={18} />
}

function getLineEditorTitle(mode: LineEditMode) {
  if (mode === 'discount') return 'Item Discount'
  if (mode === 'price') return 'Price Change'
  return 'Item Description'
}

function getLineEditorLabel(mode: LineEditMode) {
  if (mode === 'discount') return 'Discount %'
  if (mode === 'price') return 'New Price'
  return 'Description'
}

function getTagIcon(tag: ItemTag) {
  if (tag === 'special') return <Star size={17} />
  if (tag === 'hot') return <Flame size={17} />
  return <Heart size={17} />
}

function getOrderListTitle(mode: OrderListMode) {
  if (mode === 'unclosed') return 'Unclosed Orders'
  if (mode === 'hold') return 'Hold Orders'
  return 'All Orders'
}

function numberFromInput(value: string) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function lineTotal(line: CartLine) {
  const gross = Number(line.qty || 0) * Number(line.price || 0)
  const discount = (gross * clamp(Number(line.discountPercent ?? 0), 0, 100)) / 100
  return roundMoney(Math.max(0, gross - discount))
}

function normalizeLineDescription(value: unknown) {
  const description = String(value ?? '').trim()
  return description && description !== '0' ? description : ''
}

function getCartLineNote(line: CartLine) {
  const description = normalizeLineDescription(line.description)
  const itemDiscount = clamp(Number(line.discountPercent ?? 0), 0, 100)

  return [description, itemDiscount > 0 ? `${itemDiscount}% item discount` : ''].filter(Boolean).join(' / ')
}

function money(value: number) {
  return value.toFixed(2)
}

function formatTime(value: Date) {
  return value.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDate(value: Date) {
  return value.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: Date) {
  return value.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatInputDate(value: Date) {
  const day = String(value.getDate()).padStart(2, '0')
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const year = value.getFullYear()
  return `${day}-${month}-${year}`
}

function formatDateInputValue(value: Date) {
  const day = String(value.getDate()).padStart(2, '0')
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const year = value.getFullYear()
  return `${year}-${month}-${day}`
}

function formatMonthInputValue(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  return `${value.getFullYear()}-${month}`
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0)
}

function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999)
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0)
}

function endOfMonth(value: Date) {
  return endOfDay(new Date(value.getFullYear(), value.getMonth() + 1, 0))
}

function startOfYear(value: Date) {
  return new Date(value.getFullYear(), 0, 1, 0, 0, 0, 0)
}

function endOfYear(value: Date) {
  return endOfDay(new Date(value.getFullYear(), 11, 31))
}

function addDays(value: Date, days: number) {
  const nextDate = new Date(value)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function addMonths(value: Date, months: number) {
  const nextDate = new Date(value)
  nextDate.setMonth(nextDate.getMonth() + months)
  return nextDate
}

function parseDateInputValue(value: string, fallback: Date) {
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)

  if (
    Number.isFinite(parsed.getTime()) &&
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  ) {
    return parsed
  }

  return fallback
}

function parseMonthInputValue(value: string, fallback: Date) {
  const [year, month] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, 1)

  if (Number.isFinite(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() === month - 1) {
    return parsed
  }

  return fallback
}

function getReportPeriod(
  mode: ReportPeriodMode,
  fromDate: string,
  toDate: string,
  monthValue: string,
  yearValue: string,
  fallbackDate = new Date(),
): ReportPeriod {
  if (mode === 'monthly') {
    const monthDate = parseMonthInputValue(monthValue, fallbackDate)
    const from = startOfMonth(monthDate)
    const to = endOfMonth(monthDate)
    return { mode, from, to, label: monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
  }

  if (mode === 'yearly') {
    const year = Number(yearValue)
    const safeYear = Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : fallbackDate.getFullYear()
    const yearDate = new Date(safeYear, 0, 1)
    return { mode, from: startOfYear(yearDate), to: endOfYear(yearDate), label: String(safeYear) }
  }

  const fallbackFrom = startOfMonth(fallbackDate)
  const fallbackTo = fallbackDate
  const parsedFrom = parseDateInputValue(fromDate, fallbackFrom)
  const parsedTo = parseDateInputValue(toDate, fallbackTo)
  const from = startOfDay(parsedFrom <= parsedTo ? parsedFrom : parsedTo)
  const to = endOfDay(parsedFrom <= parsedTo ? parsedTo : parsedFrom)

  return { mode, from, to, label: `${formatDate(from)} to ${formatDate(to)}` }
}

function getPreviousReportPeriod(period: ReportPeriod): ReportPeriod {
  if (period.mode === 'monthly') {
    const previousMonth = addMonths(startOfMonth(period.from), -1)
    return {
      mode: period.mode,
      from: startOfMonth(previousMonth),
      to: endOfMonth(previousMonth),
      label: previousMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    }
  }

  if (period.mode === 'yearly') {
    const previousYear = period.from.getFullYear() - 1
    const previousYearDate = new Date(previousYear, 0, 1)
    return {
      mode: period.mode,
      from: startOfYear(previousYearDate),
      to: endOfYear(previousYearDate),
      label: String(previousYear),
    }
  }

  const dayMs = 24 * 60 * 60 * 1000
  const rangeDays = Math.max(1, Math.floor((endOfDay(period.to).getTime() - startOfDay(period.from).getTime()) / dayMs) + 1)
  const previousTo = endOfDay(addDays(startOfDay(period.from), -1))
  const previousFrom = startOfDay(addDays(startOfDay(period.from), -rangeDays))

  return {
    mode: period.mode,
    from: previousFrom,
    to: previousTo,
    label: `${formatDate(previousFrom)} to ${formatDate(previousTo)}`,
  }
}

function getReportModeLabel(mode: ReportPeriodMode) {
  if (mode === 'custom') return 'Custom'
  if (mode === 'monthly') return 'Monthly'
  return 'Yearly'
}

function formatVariation(variationPercent: number, previousTotal: number) {
  if (!previousTotal) {
    return 'New'
  }

  return `${variationPercent >= 0 ? '+' : ''}${variationPercent.toFixed(1)}%`
}

function isSameBusinessDay(value: string, day: Date) {
  const date = new Date(value)
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  )
}

function getBusinessInitials(value: string) {
  const letters = value
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return letters || 'GI'
}

function resizeImageFile(file: File, maxSize = 420) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error('Unable to read image'))
    reader.onload = () => {
      const image = new Image()

      image.onerror = () => reject(new Error('Unable to load image'))
      image.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * ratio))
        canvas.height = Math.max(1, Math.round(image.height * ratio))

        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Unable to process image'))
          return
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.76))
      }

      image.src = String(reader.result)
    }

    reader.readAsDataURL(file)
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Printer error'
}

function getCloudErrorMessage(error: unknown, apiUrl: string) {
  const message = getErrorMessage(error)
  if (message.toLowerCase().includes('failed to fetch')) {
    if (isLocalCloudUrl(apiUrl)) {
      return `Cannot reach ${apiUrl || 'local cloud server'}.  ${defaultCloudSyncSettings.apiUrl}.`
    }

    return `Cannot reach ${apiUrl || 'cloud server'}. Please check your internet connection and try again.`
  }

  return message
}

function isCloudDeviceLoggedOutMessage(message: string) {
  const lowerMessage = message.toLowerCase()
  return lowerMessage.includes('invalid device credentials') || lowerMessage.includes('missing device credentials')
}

function isSubscriptionExpiredMessage(message: string) {
  const lowerMessage = message.toLowerCase()
  return (
    lowerMessage.includes('subscription is not active') ||
    lowerMessage.includes('subscription expired') ||
    lowerMessage.includes('subscription is not active or expired')
  )
}

function createSubscriptionLock(
  reason: SubscriptionLock['reason'],
  message: string,
  expiresAt = '',
): SubscriptionLock {
  return {
    reason,
    message,
    checkedAt: new Date().toISOString(),
    expiresAt,
  }
}

function normalizeTransferCode(value: string) {
  return value.replace(/\D/g, '').slice(0, 6)
}

function normalizeTags(value: string) {
  const aliases: Record<string, ItemTag> = {
    favorite: 'favourite',
    favourites: 'favourite',
    favourite: 'favourite',
    hot: 'hot',
    'hot-item': 'hot',
    special: 'special',
  }

  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => aliases[slugify(tag)] ?? null)
        .filter((tag): tag is ItemTag => Boolean(tag)),
    ),
  )
}

function createOrderId() {
  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createCustomerId() {
  return `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createStaffUserId() {
  return `staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createPrinterProfileId() {
  return `printer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getInitialBillNumber(orders: SavedOrder[]) {
  const highestSavedBill = getHighestBillNumber(orders)

  if (highestSavedBill > 0) {
    return highestSavedBill + 1
  }

  return firstBillNumber
}

function getNextBillNumber(orders: SavedOrder[], currentBillNumber: number) {
  return Math.max(currentBillNumber, getHighestBillNumber(orders), firstBillNumber - 1) + 1
}

function getHighestBillNumber(orders: SavedOrder[]) {
  return orders.reduce((highest, order) => Math.max(highest, Number(order.billNo) || 0), 0)
}

function buildReport(orders: SavedOrder[], period?: ReportPeriod) {
  const scopedOrders = period ? orders.filter((order) => isOrderInsidePeriod(order, period)) : orders
  const paidOrders = scopedOrders.filter((order) => order.status === 'paid')
  const openOrders = scopedOrders.filter((order) => order.status !== 'paid')
  const previousPeriod = period ? getPreviousReportPeriod(period) : null
  const previousPaidOrders = previousPeriod
    ? orders.filter((order) => order.status === 'paid' && isOrderInsidePeriod(order, previousPeriod))
    : []
  const today = new Date()
  const todayPaidOrders = paidOrders.filter((order) => isSameBusinessDay(order.createdAt, today))
  const paymentTotals = paymentMethods.reduce(
    (totals, method) => ({ ...totals, [method]: 0 }),
    {} as Record<PaymentMethod, number>,
  )
  const orderTypeTotals = orderTypes.reduce(
    (totals, type) => ({ ...totals, [type]: { count: 0, total: 0 } }),
    {} as Record<OrderType, { count: number; total: number }>,
  )
  const itemTotals = new Map<string, { name: string; qty: number; total: number }>()

  paidOrders.forEach((order) => {
    paymentTotals[order.paymentMethod] = roundMoney((paymentTotals[order.paymentMethod] ?? 0) + order.totals.total)
    orderTypeTotals[order.orderType].count += 1
    orderTypeTotals[order.orderType].total = roundMoney(orderTypeTotals[order.orderType].total + order.totals.total)

    order.cart.forEach((line) => {
      const savedItem = itemTotals.get(line.name) ?? { name: line.name, qty: 0, total: 0 }
      savedItem.qty += line.qty
      savedItem.total = roundMoney(savedItem.total + lineTotal(line))
      itemTotals.set(line.name, savedItem)
    })
  })

  const salesTotal = roundMoney(paidOrders.reduce((sum, order) => sum + order.totals.total, 0))
  const previousSalesTotal = roundMoney(previousPaidOrders.reduce((sum, order) => sum + order.totals.total, 0))
  const variationPercent = previousSalesTotal
    ? roundMoney(((salesTotal - previousSalesTotal) / previousSalesTotal) * 100)
    : 0

  return {
    paidCount: paidOrders.length,
    openCount: openOrders.length,
    salesTotal,
    previousSalesTotal,
    variationPercent,
    todaySales: roundMoney(todayPaidOrders.reduce((sum, order) => sum + order.totals.total, 0)),
    todayCashInHand: roundMoney(todayPaidOrders.reduce((sum, order) => sum + getOrderCashInHand(order), 0)),
    todayBank: roundMoney(todayPaidOrders.reduce((sum, order) => sum + getOrderBankReceived(order), 0)),
    cashInHand: roundMoney(paidOrders.reduce((sum, order) => sum + getOrderCashInHand(order), 0)),
    bankTotal: roundMoney(paidOrders.reduce((sum, order) => sum + getOrderBankReceived(order), 0)),
    openTotal: roundMoney(openOrders.reduce((sum, order) => sum + order.totals.total, 0)),
    discountTotal: roundMoney(paidOrders.reduce((sum, order) => sum + order.totals.discount, 0)),
    taxTotal: roundMoney(paidOrders.reduce((sum, order) => sum + order.totals.tax, 0)),
    serviceTotal: roundMoney(paidOrders.reduce((sum, order) => sum + order.totals.serviceCharge, 0)),
    balanceTotal: roundMoney(paidOrders.reduce((sum, order) => sum + order.totals.balance, 0)),
    averageBill: paidOrders.length
      ? roundMoney(paidOrders.reduce((sum, order) => sum + order.totals.total, 0) / paidOrders.length)
      : 0,
    paymentTotals,
    orderTypeTotals,
    topItems: Array.from(itemTotals.values())
      .sort((first, second) => second.total - first.total)
      .slice(0, 12),
    trendData: period ? buildReportTrend(paidOrders, period) : [],
    trendLabel: period ? getReportTrendLabel(period) : 'All time',
    periodLabel: period?.label ?? 'All time',
    recentOrders: [...scopedOrders]
      .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime())
      .slice(0, 30),
  }
}

function isOrderInsidePeriod(order: SavedOrder, period: ReportPeriod) {
  const orderDate = new Date(order.createdAt)
  return Number.isFinite(orderDate.getTime()) && orderDate >= period.from && orderDate <= period.to
}

function getReportTrendLabel(period: ReportPeriod) {
  if (period.mode === 'yearly') return 'Monthly sales movement'

  const dayMs = 24 * 60 * 60 * 1000
  const rangeDays = Math.max(1, Math.floor((period.to.getTime() - period.from.getTime()) / dayMs) + 1)
  return rangeDays > 62 ? 'Monthly sales movement' : 'Daily sales movement'
}

function buildReportTrend(paidOrders: SavedOrder[], period: ReportPeriod): ReportTrendPoint[] {
  const dayMs = 24 * 60 * 60 * 1000
  const rangeDays = Math.max(1, Math.floor((period.to.getTime() - period.from.getTime()) / dayMs) + 1)
  const useDailyBuckets = period.mode === 'monthly' || (period.mode === 'custom' && rangeDays <= 62)
  const bucketMap = new Map<string, ReportTrendPoint>()

  if (useDailyBuckets) {
    for (let date = startOfDay(period.from); date <= period.to; date = addDays(date, 1)) {
      bucketMap.set(formatDateInputValue(date), {
        label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        total: 0,
        cash: 0,
        bank: 0,
        due: 0,
      })
    }
  } else {
    for (let date = startOfMonth(period.from); date <= period.to; date = addMonths(date, 1)) {
      bucketMap.set(formatMonthInputValue(date), {
        label: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        total: 0,
        cash: 0,
        bank: 0,
        due: 0,
      })
    }
  }

  paidOrders.forEach((order) => {
    const date = new Date(order.createdAt)
    const key = useDailyBuckets ? formatDateInputValue(date) : formatMonthInputValue(date)
    const bucket = bucketMap.get(key)

    if (!bucket) return

    bucket.total = roundMoney(bucket.total + order.totals.total)
    bucket.cash = roundMoney(bucket.cash + getOrderCashInHand(order))
    bucket.bank = roundMoney(bucket.bank + getOrderBankReceived(order))
    bucket.due = roundMoney(bucket.due + order.totals.balance)
  })

  return Array.from(bucketMap.values())
}

function ReportTrendChart({ points }: { points: ReportTrendPoint[] }) {
  const hasSales = points.some((point) => point.total > 0)

  if (!points.length || !hasSales) {
    return (
      <div className="trend-chart-empty">
        <BarChart3 size={28} />
        <strong>No sales in this period</strong>
        <span>Select another period or complete a bill to see the graph.</span>
      </div>
    )
  }

  const width = 720
  const height = 238
  const paddingX = 42
  const paddingTop = 20
  const paddingBottom = 32
  const chartHeight = height - paddingTop - paddingBottom
  const baseY = paddingTop + chartHeight
  const maxTotal = Math.max(...points.map((point) => point.total), 1)
  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1 ? width / 2 : paddingX + (index / Math.max(points.length - 1, 1)) * (width - paddingX * 2)
    const y = baseY - (point.total / maxTotal) * chartHeight
    return { ...point, x, y }
  })
  const linePoints = coordinates.map((point) => `${point.x},${point.y}`).join(' ')
  const firstPoint = coordinates[0]
  const lastPoint = coordinates[coordinates.length - 1]
  const areaPoints = `${firstPoint.x},${baseY} ${linePoints} ${lastPoint.x},${baseY}`
  const markerStep = Math.max(1, Math.ceil(points.length / 9))

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales variation graph">
        {[0, 0.5, 1].map((ratio) => {
          const y = baseY - ratio * chartHeight
          const label = money(maxTotal * ratio)

          return (
            <g className="trend-grid" key={ratio}>
              <line x1={paddingX} x2={width - paddingX} y1={y} y2={y} />
              <text x={paddingX - 10} y={y + 4} textAnchor="end">
                {label}
              </text>
            </g>
          )
        })}
        <polygon className="trend-area" points={areaPoints} />
        <polyline className="trend-line" points={linePoints} />
        {coordinates.map((point, index) => (
          <g className="trend-point" key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r={index % markerStep === 0 || index === coordinates.length - 1 ? 4 : 2} />
            <title>
              {point.label}: {money(point.total)}
            </title>
          </g>
        ))}
      </svg>
      <div className="trend-axis">
        <span>{points[0].label}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)].label}</span>}
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}

function getOrderCashInHand(order: SavedOrder) {
  const cash = Math.max(0, Number(order.paymentBreakdown?.cash ?? 0))
  const returnAmount = Math.max(0, Number(order.totals.change ?? 0))
  return roundMoney(Math.max(0, cash - returnAmount))
}

function getOrderBankReceived(order: SavedOrder) {
  const upi = Math.max(0, Number(order.paymentBreakdown?.upi ?? 0))
  const card = Math.max(0, Number(order.paymentBreakdown?.card ?? 0))
  return roundMoney(upi + card)
}

function hasDesktopDataStore() {
  return typeof window !== 'undefined' && Boolean(window.posDb)
}

function readDbValue<T>(snapshot: LocalDbSnapshot, key: string, fallback: T): T {
  const value = snapshot.values[key]

  if (typeof value !== 'string') {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return value as T
  }
}

function persistStoredValue(key: string, value: unknown, storageReady: boolean, localStorageValue?: string) {
  if (!storageReady) {
    return
  }

  localStorage.setItem(key, localStorageValue ?? JSON.stringify(value))

  if (window.posDb) {
    void window.posDb.set(key, JSON.stringify(value)).catch(() => undefined)
  }
}

function normalizeApiUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

function isLocalCloudUrl(value: string) {
  const normalizedValue = normalizeApiUrl(value)

  if (!normalizedValue) {
    return false
  }

  try {
    const parsedUrl = new URL(normalizedValue)
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname)
  } catch {
    const lowerValue = normalizedValue.toLowerCase()
    return lowerValue.includes('localhost') || lowerValue.includes('127.0.0.1')
  }
}

function getCloudSyncHeaders(restaurantId: string, deviceId: string, apiKey: string) {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'x-device-id': deviceId,
    'x-restaurant-id': restaurantId,
  }
}

async function parseCloudResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))

  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || `Cloud request failed (${response.status})`)
  }

  return body as T
}

function loadStoredArray<T>(key: string, fallback: T[]) {
  try {
    const saved = localStorage.getItem(key)
    if (!saved) {
      return fallback
    }

    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch {
    return fallback
  }
}

function loadStoredObject<T extends object>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    if (!saved) {
      return fallback
    }

    const parsed = JSON.parse(saved)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...fallback, ...parsed } : fallback
  } catch {
    return fallback
  }
}

function normalizePaymentMethod(value: unknown): PaymentMethod {
  if (value === 'Cash' || value === 'UPI' || value === 'Card' || value === 'Due' || value === 'Part') {
    return value
  }

  if (value === 'Wallet') {
    return 'Part'
  }

  return 'Cash'
}

function normalizeSavedOrderPayment(order: SavedOrder): SavedOrder {
  const legacyOrder = order as SavedOrder & {
    paymentBreakdown?: Partial<PaymentBreakdown>
    paymentMethod?: unknown
    totals?: Partial<OrderTotals>
    amountReceived?: number
  }
  const paymentMethod = normalizePaymentMethod(legacyOrder.paymentMethod)
  const fallbackReceived = Number(legacyOrder.amountReceived ?? legacyOrder.totals?.paid ?? 0)
  const paymentBreakdown: PaymentBreakdown = {
    cash: roundMoney(
      Number(legacyOrder.paymentBreakdown?.cash ?? (paymentMethod === 'Cash' ? fallbackReceived : 0)),
    ),
    upi: roundMoney(
      Number(
        legacyOrder.paymentBreakdown?.upi ??
          (paymentMethod === 'UPI' || paymentMethod === 'Part' ? fallbackReceived : 0),
      ),
    ),
    card: roundMoney(
      Number(legacyOrder.paymentBreakdown?.card ?? (paymentMethod === 'Card' ? fallbackReceived : 0)),
    ),
  }
  const amountReceived = roundMoney(paymentBreakdown.cash + paymentBreakdown.upi + paymentBreakdown.card)
  const total = Number(legacyOrder.totals?.total ?? 0)
  const paid = Number(
    legacyOrder.totals?.paid ?? (paymentMethod === 'Due' ? 0 : Math.min(amountReceived, total)),
  )
  const balance = Number(legacyOrder.totals?.balance ?? Math.max(total - amountReceived, 0))
  const change = Number(legacyOrder.totals?.change ?? (paymentMethod === 'Due' ? 0 : Math.max(amountReceived - total, 0)))

  return {
    ...order,
    customerId: order.customerId || undefined,
    paymentMethod,
    paymentBreakdown,
    amountReceived,
    totals: {
      subtotal: Number(legacyOrder.totals?.subtotal ?? 0),
      discount: Number(legacyOrder.totals?.discount ?? 0),
      tax: Number(legacyOrder.totals?.tax ?? 0),
      serviceCharge: Number(legacyOrder.totals?.serviceCharge ?? 0),
      total,
      paid: roundMoney(paid),
      balance: roundMoney(balance),
      change: roundMoney(change),
    },
    creditApplied: Boolean(order.creditApplied),
  }
}

function normalizeCategories(categories: Category[]) {
  return sortCategories(
    categories.map((category, index) => ({
      ...category,
      priority:
        category.id === 'all'
          ? 0
          : Number.isFinite(Number(category.priority))
            ? Number(category.priority)
            : (index + 1) * 10,
    })),
  )
}

function sortCategories(categories: Category[]) {
  return [...categories].sort((first, second) => {
    if (first.id === 'all') return -1
    if (second.id === 'all') return 1

    const firstPriority = Number.isFinite(Number(first.priority)) ? Number(first.priority) : Number.MAX_SAFE_INTEGER
    const secondPriority = Number.isFinite(Number(second.priority)) ? Number(second.priority) : Number.MAX_SAFE_INTEGER

    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority
    }

    return first.label.localeCompare(second.label)
  })
}

function getNextCategoryPriority(categories: Category[]) {
  const highestPriority = categories.reduce(
    (highest, category) =>
      Math.max(highest, Number.isFinite(Number(category.priority)) ? Number(category.priority) : 0),
    0,
  )

  return highestPriority + 10
}

function reorderCategoryList(categories: Category[], sourceCategoryId: string, targetCategoryId: string, insertAfterTarget: boolean) {
  const sortedCategories = sortCategories(categories)
  const fixedCategories = sortedCategories.filter((category) => category.id === 'all')
  const editableCategories = sortedCategories.filter((category) => category.id !== 'all')
  const sourceIndex = editableCategories.findIndex((category) => category.id === sourceCategoryId)
  const targetIndex = editableCategories.findIndex((category) => category.id === targetCategoryId)

  if (sourceIndex < 0 || targetIndex < 0) {
    return categories
  }

  const nextEditableCategories = [...editableCategories]
  const [movedCategory] = nextEditableCategories.splice(sourceIndex, 1)
  const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  const insertIndex = adjustedTargetIndex + (insertAfterTarget ? 1 : 0)

  nextEditableCategories.splice(insertIndex, 0, movedCategory)

  return sortCategories([
    ...fixedCategories.map((category) => ({ ...category, priority: 0 })),
    ...nextEditableCategories.map((category, index) => ({ ...category, priority: (index + 1) * 10 })),
  ])
}

function normalizePrinterSettings(settings?: Partial<ReceiptPrinterSettings>): ReceiptPrinterSettings {
  const merged = { ...defaultPrinterSettings, ...(settings ?? {}) }
  return {
    ...merged,
    mode: merged.mode === 'network' ? 'network' : 'system',
    paperWidth: merged.paperWidth === '58' ? '58' : '80',
  }
}

function loadInitialPrinterProfiles() {
  const savedProfiles = loadStoredArray<PrinterProfile>('printer-profiles', [])
  if (savedProfiles.length) {
    return normalizePrinterProfiles(savedProfiles)
  }

  return normalizePrinterProfiles(getLegacyPrinterProfiles())
}

function normalizePrinterProfiles(profiles: PrinterProfile[]) {
  const now = new Date().toISOString()
  const cleanedProfiles = profiles
    .filter((profile) => profile && typeof profile === 'object')
    .map((profile, index) => ({
      id: profile.id || (index === 0 ? defaultBillPrinterProfileId : createPrinterProfileId()),
      name: profile.name?.trim() || (index === 0 ? 'Bill Printer' : `Printer ${index + 1}`),
      settings: normalizePrinterSettings(profile.settings),
      createdAt: profile.createdAt || now,
      updatedAt: profile.updatedAt || now,
    }))

  const hasBillProfile = cleanedProfiles.some((profile) => profile.id === defaultBillPrinterProfileId)
  const profilesWithBill = hasBillProfile
    ? cleanedProfiles
    : [createPrinterProfile(defaultBillPrinterProfileId, 'Bill Printer', defaultPrinterSettings), ...cleanedProfiles]

  return profilesWithBill.filter(
    (profile, index, list) => list.findIndex((savedProfile) => savedProfile.id === profile.id) === index,
  )
}

function getLegacyPrinterProfiles() {
  const receiptSettings = loadStoredObject<ReceiptPrinterSettings>('receipt-printer-settings', defaultPrinterSettings)
  const profiles = [createPrinterProfile(defaultBillPrinterProfileId, 'Bill Printer', receiptSettings)]
  const legacyKotSettings = loadStoredObject<Record<string, ReceiptPrinterSettings>>('kot-printer-settings', {})

  Object.entries(legacyKotSettings).forEach(([key, settings]) => {
    if (hasConfiguredPrinterSettings(settings)) {
      profiles.push(createPrinterProfile(`legacy-${slugify(key)}`, titleCase(key), settings))
    }
  })

  return profiles
}

function createPrinterProfile(id: string, name: string, settings: Partial<ReceiptPrinterSettings>): PrinterProfile {
  const now = new Date().toISOString()
  return {
    id,
    name,
    settings: normalizePrinterSettings(settings),
    createdAt: now,
    updatedAt: now,
  }
}

function hasConfiguredPrinterSettings(settings?: Partial<ReceiptPrinterSettings>) {
  if (!settings) {
    return false
  }

  if (settings.mode === 'system') {
    return Boolean(settings.deviceName?.trim())
  }

  if (settings.mode === 'network') {
    return Boolean(settings.ipAddress?.trim()) && settings.ipAddress !== defaultPrinterSettings.ipAddress
  }

  return false
}

function describePrinterSettings(settings: ReceiptPrinterSettings) {
  if (settings.mode === 'network') {
    return `${settings.ipAddress || 'LAN printer'}:${settings.port || '9100'}`
  }

  return settings.deviceName || 'System printer'
}

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ')
}

function normalizeBusinessProfile(profile: Partial<BusinessProfile> = defaultBusinessProfile) {
  const normalizedProfile: BusinessProfile = {
    businessName: String(profile.businessName ?? defaultBusinessProfile.businessName),
    ownerName: String(profile.ownerName ?? defaultBusinessProfile.ownerName),
    branch: String(profile.branch ?? defaultBusinessProfile.branch),
    phone: String(profile.phone ?? defaultBusinessProfile.phone),
    email: String(profile.email ?? defaultBusinessProfile.email),
    address: String(profile.address ?? defaultBusinessProfile.address),
    gstin: String(profile.gstin ?? defaultBusinessProfile.gstin),
    receiptFooter: String(profile.receiptFooter ?? defaultBusinessProfile.receiptFooter),
    logoDataUrl: String(profile.logoDataUrl ?? defaultBusinessProfile.logoDataUrl),
  }
  const hasRealBillingDetails = Boolean(
    normalizedProfile.phone.trim() ||
      normalizedProfile.email.trim() ||
      normalizedProfile.address.trim() ||
      normalizedProfile.gstin.trim() ||
      normalizedProfile.logoDataUrl,
  )
  const usesOldAppIdentity =
    normalizedProfile.businessName.trim() === appName &&
    (normalizedProfile.ownerName.trim() === appName || normalizedProfile.ownerName.trim() === appOwner)

  if (usesOldAppIdentity && !hasRealBillingDetails) {
    return { ...normalizedProfile, businessName: '', ownerName: '' }
  }

  return normalizedProfile
}

type CloudSignupBusinessSource = {
  name?: string
  businessName?: string
  owner_name?: string
  ownerName?: string
  phone?: string
  email?: string
} | null

function normalizeCloudSignupBusinessProfile(
  ...sources: Array<CloudSignupBusinessSource | undefined>
): Partial<BusinessProfile> {
  const getFirst = (...values: Array<unknown>) =>
    values.map((value) => String(value ?? '').trim()).find(Boolean) ?? ''
  const profile: Partial<BusinessProfile> = {}

  for (const source of sources) {
    if (!source) continue
    profile.businessName ||= getFirst(source.businessName, source.name)
    profile.ownerName ||= getFirst(source.ownerName, source.owner_name)
    profile.phone ||= getFirst(source.phone)
    profile.email ||= getFirst(source.email)
  }

  return profile
}

function hasCloudSignupDetails(profile: Partial<BusinessProfile>) {
  return Boolean(profile.businessName?.trim() || profile.ownerName?.trim() || profile.phone?.trim() || profile.email?.trim())
}

function mergeBusinessProfileWithCloudSignup(
  profile: BusinessProfile,
  cloudProfile: Partial<BusinessProfile>,
  overwrite: boolean,
) {
  const nextProfile = { ...profile }
  const assign = (field: 'businessName' | 'ownerName' | 'phone' | 'email') => {
    const value = String(cloudProfile[field] ?? '').trim()
    if (value && (overwrite || !nextProfile[field].trim())) {
      nextProfile[field] = value
    }
  }

  assign('businessName')
  assign('ownerName')
  assign('phone')
  assign('email')

  return normalizeBusinessProfile(nextProfile)
}

function isSameBusinessProfile(first: BusinessProfile, second: BusinessProfile) {
  return JSON.stringify(first) === JSON.stringify(second)
}

function normalizeCloudSyncSettings(settings: Partial<CloudSyncSettings> = defaultCloudSyncSettings): CloudSyncSettings {
  return {
    apiUrl: String(settings.apiUrl ?? defaultCloudSyncSettings.apiUrl),
    restaurantId: String(settings.restaurantId ?? defaultCloudSyncSettings.restaurantId),
    restaurantName: String(settings.restaurantName ?? defaultCloudSyncSettings.restaurantName),
    restaurantOwnerName: String(settings.restaurantOwnerName ?? defaultCloudSyncSettings.restaurantOwnerName),
    restaurantPhone: String(settings.restaurantPhone ?? defaultCloudSyncSettings.restaurantPhone),
    restaurantEmail: String(settings.restaurantEmail ?? defaultCloudSyncSettings.restaurantEmail),
    deviceId: String(settings.deviceId ?? defaultCloudSyncSettings.deviceId),
    deviceName: String(settings.deviceName ?? defaultCloudSyncSettings.deviceName),
    apiKey: String(settings.apiKey ?? defaultCloudSyncSettings.apiKey),
    subscriptionPlan: String(settings.subscriptionPlan ?? defaultCloudSyncSettings.subscriptionPlan),
    subscriptionStatus: String(settings.subscriptionStatus ?? defaultCloudSyncSettings.subscriptionStatus),
    subscriptionExpiresAt: String(settings.subscriptionExpiresAt ?? defaultCloudSyncSettings.subscriptionExpiresAt),
    autoSync: Boolean(settings.autoSync),
    lastSyncAt: String(settings.lastSyncAt ?? defaultCloudSyncSettings.lastSyncAt),
  }
}

function normalizeUpdateStatus(status: Partial<AppUpdateStatus> = defaultUpdateStatus): AppUpdateStatus {
  const knownStates: AppUpdateStatus['state'][] = [
    'idle',
    'checking',
    'available',
    'downloading',
    'downloaded',
    'installing',
    'not-available',
    'disabled',
    'error',
  ]
  const state = knownStates.includes(status.state ?? 'idle') ? (status.state ?? 'idle') : 'idle'

  return {
    state,
    message: String(status.message ?? defaultUpdateStatus.message),
    version: String(status.version ?? appVersion),
    latestVersion: status.latestVersion ? String(status.latestVersion) : undefined,
    updateUrl: status.updateUrl ? String(status.updateUrl) : undefined,
    updatedAt: status.updatedAt ? String(status.updatedAt) : undefined,
    percent: typeof status.percent === 'number' ? status.percent : undefined,
    error: status.error ? String(status.error) : undefined,
  }
}

function normalizeStaffUsers(users: StaffUser[]) {
  return users
    .filter((user) => user && typeof user === 'object')
    .map((user) => ({
      ...user,
      name: String(user.name ?? '').trim() || 'Staff',
      pinSalt: String(user.pinSalt ?? ''),
      pinHash: String(user.pinHash ?? ''),
      recoverySalt: user.recoverySalt ? String(user.recoverySalt) : undefined,
      recoveryHash: user.recoveryHash ? String(user.recoveryHash) : undefined,
      recoveryCodeSetAt: user.recoveryCodeSetAt ? String(user.recoveryCodeSetAt) : undefined,
      permissions: normalizeStaffPermissions(user.permissions),
      active: user.active !== false,
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString(),
    }))
    .filter((user) => user.pinSalt && user.pinHash)
}

function isOwnerStaffUser(user: StaffUser) {
  const name = user.name.trim().toLowerCase()
  return name === 'owner' || allStaffPermissionIds.every((permission) => user.permissions.includes(permission))
}

function getStaffUsersFromCloudChanges(changes: CloudPullChange[]) {
  const staffChange = changes.find((change) => change.key === 'pos-staff-users')
  return normalizeStaffUsers(Array.isArray(staffChange?.value) ? (staffChange.value as StaffUser[]) : [])
}

function getStaffUserDirectory(users: StaffUser[]): StaffUserDirectoryEntry[] {
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    active: user.active,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  }))
}

function normalizeStaffPinResetCommands(value: unknown): StaffPinResetCommand[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((command) => ({
      id: String(command?.id ?? '').trim(),
      staffUserId: String(command?.staffUserId ?? '').trim(),
      staffUserName: command?.staffUserName ? String(command.staffUserName) : undefined,
      pinSalt: String(command?.pinSalt ?? '').trim(),
      pinHash: String(command?.pinHash ?? '').trim(),
      requestedAt: String(command?.requestedAt ?? new Date().toISOString()),
      requestedBy: command?.requestedBy ? String(command.requestedBy) : undefined,
    }))
    .filter((command) => command.id && command.staffUserId && command.pinSalt && command.pinHash)
}

function normalizeStaffPermissions(permissions: StaffPermission[] = defaultCashierPermissions) {
  const allowed = new Set(allStaffPermissionIds)
  const normalized = permissions.filter((permission) => allowed.has(permission))
  return normalized.length ? normalized : defaultCashierPermissions
}

function validatePin(pin: string, confirmPin: string) {
  if (!/^\d{4,8}$/.test(pin)) {
    return 'PIN must be 4 to 8 digits'
  }

  if (pin !== confirmPin) {
    return 'PIN confirmation does not match'
  }

  return ''
}

async function hashPin(pin: string, salt = createSalt()) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`))
  return { salt, hash: bufferToHex(hashBuffer) }
}

async function verifyPin(pin: string, salt: string, expectedHash: string) {
  const result = await hashPin(pin, salt)
  return result.hash === expectedHash
}

function normalizeRecoveryCode(value: string) {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return cleaned.length === 12 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}` : value.trim().toUpperCase()
}

function createSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeMenuDisplaySettings(settings: MenuDisplaySettings) {
  return {
    fontSize: clampSetting('fontSize', settings.fontSize),
    itemWidth: clampSetting('itemWidth', settings.itemWidth),
    itemHeight: clampSetting('itemHeight', settings.itemHeight),
    sidePanelWidth:
      settings.sidePanelWidth > menuDisplayLimits.sidePanelWidth.max
        ? defaultMenuDisplaySettings.sidePanelWidth
        : clampSetting('sidePanelWidth', settings.sidePanelWidth),
  }
}

function clampSetting(field: keyof MenuDisplaySettings, value: number) {
  const limit = menuDisplayLimits[field]
  const numericValue = Number.isFinite(value) ? value : defaultMenuDisplaySettings[field]
  return Math.round(clamp(numericValue, limit.min, limit.max))
}

function makeUniqueId(label: string, existingIds: string[]) {
  const base = slugify(label)
  let id = base
  let index = 2

  while (existingIds.includes(id)) {
    id = `${base}-${index}`
    index += 1
  }

  return id
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || `item-${Date.now()}`
}

export default App
