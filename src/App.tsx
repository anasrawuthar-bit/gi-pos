import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as QRCodeGenerator from 'qrcode'
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
  Keyboard,
  LogOut,
  Minus,
  Monitor,
  MoreVertical,
  Moon,
  Pencil,
  Plus,
  Printer,
  QrCode,
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
  LocalDbBackup,
  LocalDbSnapshot,
  LocalDbSyncChange,
  LocalServerStatus,
  PrinterInfo,
  ReceiptPrinterSettings,
} from './types/electron'

type OrderType = 'Dining' | 'Delivery' | 'Take Away' | 'Online'
type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Due' | 'Part'
type PartTenderMethod = 'upi' | 'card'
type ThemeMode = 'light' | 'dark'
type AppMode = 'cloud' | 'offline'
type AppView =
  | 'home'
  | 'pos'
  | 'reports'
  | 'expenses'
  | 'profile'
  | 'sync'
  | 'users'
  | 'network'
  | 'about'
  | 'menu'
  | 'printers'
  | 'printer_config'
  | 'service_staff'
  | 'settings'
  | 'configuration'
  | 'keyboard_shortcuts'
type ReportPeriodMode = 'custom' | 'monthly' | 'yearly'
type DiscountMode = 'percent' | 'amount'
type ShortcutScope = 'global' | 'home' | 'pos'
type ShortcutActionId =
  | 'global-lock'
  | 'global-theme'
  | 'home-pos'
  | 'home-report'
  | 'home-settings'
  | 'pos-print-bill'
  | 'pos-save-print'
  | 'pos-save-bill'
  | 'pos-hold'
  | 'pos-kot'
  | 'pos-new-order'
  | 'pos-orders'
type StaffPermission =
  | 'pos_access'
  | 'reports'
  | 'business_profile'
  | 'menu_manage'
  | 'printer_manage'
  | 'cloud_sync'
  | 'user_manage'
  | 'expense_manage'
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

type DiningTableGroup = {
  id: string
  label: string
  tables: string[]
}

type MenuItem = {
  id: string
  name: string
  category: string
  price: number
  tags?: string[]
  imageDataUrl?: string
  available?: boolean
  unavailableReason?: string
  taxRate?: number
}

type ExpensePaymentMethod = 'Cash' | 'Bank'

type ExpenseEntry = {
  id: string
  date: string
  category: string
  amount: number
  paymentMethod: ExpensePaymentMethod
  vendor: string
  note: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

type CartLine = {
  id: string
  itemId: string
  name: string
  category?: string
  price: number
  qty: number
  taxRate: number
  discountMode?: DiscountMode
  discountPercent?: number
  discountAmount?: number
  description?: string
}

type ItemTag = 'special' | 'hot' | 'favourite'
type OrderStatus = 'unclosed' | 'hold' | 'paid'
type OrderListMode = 'unclosed' | 'hold' | 'orders'
type LineEditMode = 'discount' | 'price' | 'description'
type SuccessAction = 'saved' | 'printed'
type CustomerFilter = 'all' | 'due' | 'clear'
type CustomerSort = 'recent' | 'name' | 'due'
type SeatingMode = 'individual' | 'group'

type LineEditor = {
  lineId: string
  mode: LineEditMode
  value: string
  discountMode?: DiscountMode
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
  seatingMode: SeatingMode
  tables: string[]
  diningGroupName: string
  customerId?: string
  customer: string
  serviceStaffId?: string
  serviceStaffName?: string
  serviceStaffCode?: string
  cart: CartLine[]
  discountMode: DiscountMode
  discountPercent: number
  discountAmount: number
  servicePercent: number
  paymentMethod: PaymentMethod
  paymentBreakdown: PaymentBreakdown
  amountReceived: number
  totals: OrderTotals
  taxExempt?: boolean
  creditApplied?: boolean
  createdAt: string
  updatedAt: string
}

type KeyboardShortcutDefinition = {
  id: ShortcutActionId
  scope: ShortcutScope
  key: string
  action: string
  description: string
  permission?: StaffPermission
}

type ServiceStaff = {
  id: string
  name: string
  code: string
  active: boolean
  createdAt: string
  updatedAt: string
}

type QrOrderStatus = 'pending' | 'accepted' | 'rejected'

type QrPendingOrder = {
  id: string
  shortId?: string
  status: QrOrderStatus
  source: 'table-qr'
  table: string
  tables: string[]
  customerName: string
  customerPhone: string
  note: string
  cart: CartLine[]
  totals: OrderTotals
  createdAt: string
  updatedAt: string
}

type TableQrPreview = {
  tableName: string
  url: string
  dataUrl: string
}

type AccessPrompt = {
  title: string
  message: string
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
  available: boolean
  unavailableReason: string
  taxRate: string
}

type ExpenseDraft = {
  date: string
  category: string
  amount: string
  paymentMethod: ExpensePaymentMethod
  vendor: string
  note: string
}

type MenuDisplaySettings = {
  fontSize: number
  itemWidth: number
  itemHeight: number
  sidePanelWidth: number
}

type AppConfiguration = {
  showServiceStaffSelector: boolean
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
  categoryIds: string[]
  tableGroupIds: string[]
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
  defaultGstRate: number
  gstType: 'exclusive' | 'inclusive'
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
  subscriptionMaxDevices: number
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
    plan_id?: string
    plan_subtitle?: string
    plan_local_pos?: boolean
    plan_counter_label?: string
    status?: string
    expires_at?: string
    max_devices?: number
  }
  apiKey?: string
  offlineLicense?: OfflineLicense
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
  plan_id?: string
  plan_subtitle?: string
  plan_local_pos?: boolean
  plan_counter_label?: string
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

type OfflineLicense = {
  plan: 'offline'
  licenseId: string
  licenseKey: string
  businessName: string
  phone: string
  deviceFingerprint: string
  deviceName: string
  activatedAt: string
  expiresAt: string
  issuedAt: string
  signature: string
  subscriptionPlan: string
  subscriptionStatus: string
  subscriptionExpiresAt: string
  subscriptionMaxDevices: number
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

type ReportPrintRow = {
  label: string
  amount?: number
  count?: number
  total?: number
}

type ReportPrintPayload = {
  settings: ReceiptPrinterSettings
  report: {
    title: string
    periodLabel: string
    generatedAt: string
    business: {
      name: string
      branch: string
      phone: string
    }
    salesTotal: number
    receivedTotal: number
    paidCount: number
    openingCash: number
    cashReceivedTotal: number
    cashInHand: number
    upiTotal: number
    cardTotal: number
    bankReceivedTotal: number
    bankTotal: number
    balanceTotal: number
    discountTotal: number
    expenseTotal: number
    cashExpenseTotal: number
    bankExpenseTotal: number
    netTotal: number
    openTotal: number
    openCount: number
    orderTypeRows: ReportPrintRow[]
  }
}

type ReportExportData = {
  reportData: ReturnType<typeof buildReport>
  period: ReportPeriod
  orders: SavedOrder[]
  expenses: ExpenseEntry[]
  businessProfile: BusinessProfile
  businessName: string
  generatedAt: string
  openingCash: number
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
const expenseCategories = [
  'Purchase',
  'Salary',
  'Rent',
  'Electricity',
  'Gas',
  'Maintenance',
  'Delivery',
  'Petty Cash',
  'Other',
]
const staffPermissions: Array<{ id: StaffPermission; label: string; description: string }> = [
  { id: 'pos_access', label: 'POS Billing', description: 'Create, hold, save, and print bills' },
  { id: 'reports', label: 'Reports', description: 'View sales, cash, bank, and bill reports' },
  { id: 'business_profile', label: 'Business Profile', description: 'Change billing name, logo, GSTIN, and footer' },
  { id: 'menu_manage', label: 'Menu Setup', description: 'Create categories, items, prices, and photos' },
  { id: 'printer_manage', label: 'Printer Manage', description: 'Change bill and KOT printer profiles' },
  { id: 'cloud_sync', label: 'Cloud Sync', description: 'Change sync settings and run manual sync' },
  { id: 'user_manage', label: 'User Manage', description: 'Create staff and set permissions' },
  { id: 'expense_manage', label: 'Expenses', description: 'Add, edit, and delete restaurant expenses' },
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
const defaultDiningTableGroups: DiningTableGroup[] = [
  { id: 'main-hall', label: 'Main Hall', tables: Array.from({ length: 8 }, (_, index) => `T${index + 1}`) },
  { id: 'family', label: 'Family', tables: Array.from({ length: 8 }, (_, index) => `T${index + 9}`) },
  { id: 'ac-room', label: 'AC Room', tables: Array.from({ length: 4 }, (_, index) => `T${index + 17}`) },
  { id: 'outdoor', label: 'Outdoor', tables: Array.from({ length: 4 }, (_, index) => `T${index + 21}`) },
]
const appName = 'GI POS Restaurant'
const appOwner = 'GI'
const appVersion = '1.1.22'
const appIconUrl = `${import.meta.env.BASE_URL}app_icon.ico`
const companyName = 'GI Hostings'
const companyWebsite = 'https://www.gihostings.com'
const staffDirectorySyncKey = 'pos-staff-user-directory'
const staffPinResetCommandKey = 'pos-staff-pin-reset-commands'
const serviceStaffStorageKey = 'pos-service-staff'
const appConfigurationStorageKey = 'pos-app-configuration'
const openingCashStorageKey = 'pos-opening-cash-balances'
const appModeStorageKey = 'pos-app-mode'
const offlineLicenseStorageKey = 'pos-offline-license'
const deviceFingerprintStorageKey = 'pos-device-fingerprint'
const restaurantDataStorageKeys = [
  'pos-business-profile',
  'pos-categories',
  'pos-dining-table-groups',
  'pos-customers',
  'pos-menu-items',
  serviceStaffStorageKey,
  appConfigurationStorageKey,
  openingCashStorageKey,
  'pos-expenses',
  'pos-qr-orders',
  'pos-orders',
  'pos-staff-users',
  staffDirectorySyncKey,
  staffPinResetCommandKey,
  'pos-audit-log',
  'pos-cloud-sync-settings',
  appModeStorageKey,
  offlineLicenseStorageKey,
] as const
const mainAppDeviceName = 'Main App'
const companyWebsiteDisplay = 'gihostings.com'
const unlimitedDeviceLimit = 999999
const appPlanCatalog = {
  premium: {
    id: 'premium',
    name: 'Premium',
    subtitle: 'Single counter cloud POS',
    counterLabel: '1 counter only',
    localPos: false,
    features: ['One Windows billing counter', 'Cloud backup and restore', 'Client portal access'],
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    subtitle: 'Local POS server plus cloud',
    counterLabel: 'Main PC plus local counters',
    localPos: true,
    features: ['Main PC local POS server', 'Mobile / other PC LAN billing', 'Cloud backup and restore'],
  },
  offline: {
    id: 'offline',
    name: 'Offline',
    subtitle: 'Single PC one-time activation',
    counterLabel: 'Single Windows PC',
    localPos: false,
    features: ['Local SQLite billing', 'USB/System and LAN printer', 'No cloud backup or LAN POS server'],
  },
} as const

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
  defaultGstRate: 0,
  gstType: 'exclusive',
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
  subscriptionMaxDevices: 0,
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

const defaultAppConfiguration: AppConfiguration = {
  showServiceStaffSelector: true,
}

const menuDisplayLimits: Record<keyof MenuDisplaySettings, { min: number; max: number }> = {
  fontSize: { min: 10, max: 18 },
  itemWidth: { min: 90, max: 220 },
  itemHeight: { min: 88, max: 220 },
  sidePanelWidth: { min: 70, max: 150 },
}

const defaultPrinterSettings: ReceiptPrinterSettings = {
  mode: 'system',
  printMethod: 'driver',
  deviceName: '',
  ipAddress: '192.168.1.50',
  port: '9100',
  paperWidth: '80',
}

const defaultBillPrinterProfileId = 'bill-printer'
const keyboardShortcutsStorageKey = 'pos-keyboard-shortcuts'
const keyboardShortcutsEnabledStorageKey = 'pos-keyboard-shortcuts-enabled'
const defaultKeyboardShortcuts: KeyboardShortcutDefinition[] = [
  {
    id: 'global-lock',
    scope: 'global',
    key: 'L',
    action: 'Lock app',
    description: 'Return to the PIN login screen.',
  },
  {
    id: 'global-theme',
    scope: 'global',
    key: 'T',
    action: 'Switch theme',
    description: 'Toggle light and dark mode.',
  },
  {
    id: 'home-pos',
    scope: 'home',
    key: 'P',
    action: 'Open POS Sale',
    description: 'Open the billing screen from Home.',
    permission: 'pos_access',
  },
  {
    id: 'home-report',
    scope: 'home',
    key: 'R',
    action: 'Open Report',
    description: 'Open sales reports from Home.',
    permission: 'reports',
  },
  {
    id: 'home-settings',
    scope: 'home',
    key: 'S',
    action: 'Open Settings',
    description: 'Open app settings from Home.',
  },
  {
    id: 'pos-print-bill',
    scope: 'pos',
    key: 'Enter',
    action: 'Print Bill',
    description: 'Save the current bill and print it.',
    permission: 'pos_access',
  },
  {
    id: 'pos-save-print',
    scope: 'pos',
    key: 'P',
    action: 'Save & Print',
    description: 'Save the bill and send it to the bill printer.',
    permission: 'pos_access',
  },
  {
    id: 'pos-save-bill',
    scope: 'pos',
    key: 'S',
    action: 'Save Bill',
    description: 'Save the bill without printing.',
    permission: 'pos_access',
  },
  {
    id: 'pos-hold',
    scope: 'pos',
    key: 'H',
    action: 'Hold Bill',
    description: 'Move the current order to Hold.',
    permission: 'pos_access',
  },
  {
    id: 'pos-kot',
    scope: 'pos',
    key: 'K',
    action: 'Print KOT',
    description: 'Print kitchen order tickets by printer routing.',
    permission: 'pos_access',
  },
  {
    id: 'pos-new-order',
    scope: 'pos',
    key: 'N',
    action: 'New Order',
    description: 'Start a new order and protect the current bill.',
    permission: 'pos_access',
  },
  {
    id: 'pos-orders',
    scope: 'pos',
    key: 'O',
    action: 'Orders',
    description: 'Open the order list.',
    permission: 'pos_access',
  },
]

const initialCart: CartLine[] = []

function App() {
  const [categoryList, setCategoryList] = useState<Category[]>(() =>
    normalizeCategories(loadStoredArray('pos-categories', defaultCategories)),
  )
  const [diningTableGroups, setDiningTableGroups] = useState<DiningTableGroup[]>(() =>
    normalizeDiningTableGroups(loadStoredArray('pos-dining-table-groups', defaultDiningTableGroups)),
  )
  const [menuList, setMenuList] = useState<MenuItem[]>(() =>
    normalizeMenuItems(loadStoredArray('pos-menu-items', defaultMenuItems)),
  )
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>(() =>
    loadStoredArray<SavedOrder>('pos-orders', []).map(normalizeSavedOrderPayment),
  )
  const [qrOrders, setQrOrders] = useState<QrPendingOrder[]>(() =>
    normalizeQrOrders(loadStoredArray<QrPendingOrder>('pos-qr-orders', [])),
  )
  const [expenses, setExpenses] = useState<ExpenseEntry[]>(() =>
    normalizeExpenses(loadStoredArray<ExpenseEntry>('pos-expenses', [])),
  )
  const [customers, setCustomers] = useState<CustomerProfile[]>(() => loadStoredArray('pos-customers', []))
  const [serviceStaff, setServiceStaff] = useState<ServiceStaff[]>(() =>
    normalizeServiceStaff(loadStoredArray<ServiceStaff>(serviceStaffStorageKey, [])),
  )
  const [activeView, setActiveView] = useState<AppView>('home')
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() =>
    normalizeBusinessProfile(loadStoredObject('pos-business-profile', defaultBusinessProfile)),
  )
  const [cloudSyncSettings, setCloudSyncSettings] = useState<CloudSyncSettings>(() =>
    normalizeCloudSyncSettings(loadStoredObject('pos-cloud-sync-settings', defaultCloudSyncSettings)),
  )
  const [appMode, setAppMode] = useState<AppMode>(() => normalizeAppMode(localStorage.getItem(appModeStorageKey)))
  const [offlineLicense, setOfflineLicense] = useState<OfflineLicense | null>(() =>
    normalizeOfflineLicense(loadStoredObject<Partial<OfflineLicense>>(offlineLicenseStorageKey, {})),
  )
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(() =>
    normalizeStaffUsers(loadStoredArray('pos-staff-users', [])),
  )
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() => loadStoredArray('pos-audit-log', []))
  const [menuDisplaySettings, setMenuDisplaySettings] = useState<MenuDisplaySettings>(() =>
    normalizeMenuDisplaySettings(loadStoredObject('pos-menu-display-settings', defaultMenuDisplaySettings)),
  )
  const [appConfiguration, setAppConfiguration] = useState<AppConfiguration>(() =>
    normalizeAppConfiguration(loadStoredObject(appConfigurationStorageKey, defaultAppConfiguration)),
  )
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [activeOrderId, setActiveOrderId] = useState(() => createOrderId())
  const [billNumber, setBillNumber] = useState(() => getInitialBillNumber(savedOrders))
  const [billFinancialYear, setBillFinancialYear] = useState(() => getFinancialYearKey(new Date()))
  const [activeCategory, setActiveCategory] = useState('bread')
  const [activeQuickTag, setActiveQuickTag] = useState<ItemTag | null>(null)
  const [search, setSearch] = useState('')
  const [orderType, setOrderType] = useState<OrderType>('Dining')
  const [cart, setCart] = useState<CartLine[]>(initialCart)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [table, setTable] = useState('')
  const [seatingMode, setSeatingMode] = useState<SeatingMode>('individual')
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [diningGroupName, setDiningGroupName] = useState('')
  const [customer, setCustomer] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>('all')
  const [customerSort, setCustomerSort] = useState<CustomerSort>('recent')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [selectedServiceStaffId, setSelectedServiceStaffId] = useState('')
  const [selectedServiceStaffName, setSelectedServiceStaffName] = useState('')
  const [selectedServiceStaffCode, setSelectedServiceStaffCode] = useState('')
  const [discountMode, setDiscountMode] = useState<DiscountMode>('percent')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [servicePercent, setServicePercent] = useState(0)
  const [taxExempt, setTaxExempt] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [amountReceivedOverride, setAmountReceivedOverride] = useState<number | null>(null)
  const [partTenderMethod, setPartTenderMethod] = useState<PartTenderMethod>('upi')
  const [, setPrinterOpen] = useState(false)
  const [kotPrintOpen, setKotPrintOpen] = useState(false)
  const [, setMenuEditorOpen] = useState(false)
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false)
  const [tableSelectorOpen, setTableSelectorOpen] = useState(false)
  const [staffCodePromptOpen, setStaffCodePromptOpen] = useState(false)
  const [staffCodeInput, setStaffCodeInput] = useState('')
  const [staffCodeStatus, setStaffCodeStatus] = useState('')
  const [tableSetupOpen, setTableSetupOpen] = useState(false)
  const [qrOrdersOpen, setQrOrdersOpen] = useState(false)
  const [tableQrPreview, setTableQrPreview] = useState<TableQrPreview | null>(null)
  const [activeTableGroupId, setActiveTableGroupId] = useState(defaultDiningTableGroups[0]?.id ?? '')
  const [editingTableGroupId, setEditingTableGroupId] = useState<string | null>(null)
  const [tableGroupName, setTableGroupName] = useState('')
  const [tableGroupTables, setTableGroupTables] = useState('')
  const [customerEditorOpen, setCustomerEditorOpen] = useState(false)
  const [customerDetailEditing, setCustomerDetailEditing] = useState(false)
  const [discountEditorOpen, setDiscountEditorOpen] = useState(false)
  const [orderListMode, setOrderListMode] = useState<OrderListMode | null>(null)
  const [orderListDate, setOrderListDate] = useState(() => formatDateInputValue(new Date()))
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [reportOpen, setReportOpen] = useState(false)
  const [reportPrintDate, setReportPrintDate] = useState(() => formatDateInputValue(new Date()))
  const [reportPeriodMode, setReportPeriodMode] = useState<ReportPeriodMode>('monthly')
  const [reportFromDate, setReportFromDate] = useState(() => formatDateInputValue(startOfMonth(new Date())))
  const [reportToDate, setReportToDate] = useState(() => formatDateInputValue(new Date()))
  const [reportMonth, setReportMonth] = useState(() => formatMonthInputValue(new Date()))
  const [reportYear, setReportYear] = useState(() => String(new Date().getFullYear()))
  const [openingCashBalances, setOpeningCashBalances] = useState<Record<string, number>>(() =>
    normalizeOpeningCashBalances(loadStoredObject<Record<string, number>>(openingCashStorageKey, {})),
  )
  const [lineActionId, setLineActionId] = useState<string | null>(null)
  const [lineEditor, setLineEditor] = useState<LineEditor | null>(null)
  const [pendingPriceItem, setPendingPriceItem] = useState<MenuItem | null>(null)
  const [pendingPriceValue, setPendingPriceValue] = useState('')
  const [successOrder, setSuccessOrder] = useState<SavedOrder | null>(null)
  const [successAction, setSuccessAction] = useState<SuccessAction>('saved')
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem('pos-theme')
    return savedTheme === 'dark' ? 'dark' : 'light'
  })
  const [keyboardShortcutOverrides, setKeyboardShortcutOverrides] = useState<Record<string, string>>(() =>
    normalizeKeyboardShortcutOverrides(loadStoredObject<Record<string, string>>(keyboardShortcutsStorageKey, {})),
  )
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(() =>
    normalizeKeyboardShortcutsEnabled(localStorage.getItem(keyboardShortcutsEnabledStorageKey)),
  )
  const [shortcutHintsVisible, setShortcutHintsVisible] = useState(false)
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
    available: true,
    unavailableReason: '',
    taxRate: '',
  }))
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() => ({
    date: formatDateInputValue(new Date()),
    category: expenseCategories[0],
    amount: '',
    paymentMethod: 'Cash',
    vendor: '',
    note: '',
  }))
  const [expenseStatus, setExpenseStatus] = useState('Ready')
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [printerStatus, setPrinterStatus] = useState('Ready')
  const [accessPrompt, setAccessPrompt] = useState<AccessPrompt | null>(null)
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>(() => loadInitialPrinterProfiles())
  const [activePrinterProfileId, setActivePrinterProfileId] = useState(
    () => localStorage.getItem('active-printer-profile-id') || defaultBillPrinterProfileId,
  )
  const [billPrinterProfileId, setBillPrinterProfileId] = useState(
    () => localStorage.getItem('bill-printer-profile-id') || defaultBillPrinterProfileId,
  )
  const [printerRouteCategoryId, setPrinterRouteCategoryId] = useState('')
  const [printerRouteTableGroupId, setPrinterRouteTableGroupId] = useState('')
  const [pendingNewPrinterId, setPendingNewPrinterId] = useState('')
  const [printerDraftProfile, setPrinterDraftProfile] = useState<PrinterProfile | null>(null)
  const [storageReady, setStorageReady] = useState(() => !hasDesktopDataStore())
  const [localDatabasePath, setLocalDatabasePath] = useState('')
  const [localDatabaseDataDir, setLocalDatabaseDataDir] = useState('')
  const [localDatabaseBackupDir, setLocalDatabaseBackupDir] = useState('')
  const [databaseBackups, setDatabaseBackups] = useState<LocalDbBackup[]>([])
  const [selectedDatabaseBackup, setSelectedDatabaseBackup] = useState('')
  const [databaseBackupStatus, setDatabaseBackupStatus] = useState('Database backup ready')
  const [localServerStatus, setLocalServerStatus] = useState<LocalServerStatus | null>(null)
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
  const setupCloudLoginInputRef = useRef<HTMLInputElement | null>(null)
  const loginPinInputRef = useRef<HTMLInputElement | null>(null)
  const authFocusTimerRef = useRef<number[]>([])
  const businessProfileRef = useRef(businessProfile)
  const cloudSyncSettingsRef = useRef(cloudSyncSettings)
  const staffUsersRef = useRef(staffUsers)
  const savedOrdersRef = useRef(savedOrders)
  const customersRef = useRef(customers)
  const qrOrdersRef = useRef(qrOrders)
  const runCloudSyncRef = useRef<(trigger: 'manual' | 'auto') => Promise<boolean>>(async () => false)
  const shortcutActionRunnerRef = useRef<(actionId: ShortcutActionId) => void>(() => undefined)
  const refreshLocalServerStatus = useCallback(async () => {
    if (!window.posServer) {
      setLocalServerStatus({
        enabled: false,
        port: 8080,
        host: '0.0.0.0',
        appName,
        version: appVersion,
        computerName: 'Browser',
        urls: [],
        primaryUrl: '',
        startedAt: '',
        error: 'Local server runs only inside the desktop app',
        dbPath: '',
      })
      return
    }

    try {
      setLocalServerStatus(await window.posServer.getStatus())
    } catch (error) {
      setLocalServerStatus({
        enabled: false,
        port: 8080,
        host: '0.0.0.0',
        appName,
        version: appVersion,
        computerName: 'Main PC',
        urls: [],
        primaryUrl: '',
        startedAt: '',
        error: getErrorMessage(error),
        dbPath: localDatabasePath,
      })
    }
  }, [localDatabasePath])
  const refreshDatabaseBackups = useCallback(async () => {
    if (!window.posDb?.listBackups) {
      setDatabaseBackups([])
      return
    }

    try {
      const result = await window.posDb.listBackups()
      const backups = result.backups ?? []
      setDatabaseBackups(backups)
      setSelectedDatabaseBackup((current) => (current && backups.some((backup) => backup.fileName === current) ? current : backups[0]?.fileName ?? ''))
    } catch (error) {
      setDatabaseBackupStatus(`Backup list failed: ${getErrorMessage(error)}`)
    }
  }, [])

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

  useEffect(() => {
    authFocusTimerRef.current.forEach((timer) => window.clearTimeout(timer))
    authFocusTimerRef.current = []

    if (!storageReady || currentUserId) {
      return undefined
    }

    const focusTarget = () => {
      const target = staffUsers.length ? loginPinInputRef.current : setupCloudLoginInputRef.current
      if (!target || target.disabled) {
        return
      }

      target.focus({ preventScroll: true })
    }

    window.requestAnimationFrame(focusTarget)
    authFocusTimerRef.current = [60, 250, 600].map((delay) => window.setTimeout(focusTarget, delay))

    return () => {
      authFocusTimerRef.current.forEach((timer) => window.clearTimeout(timer))
      authFocusTimerRef.current = []
    }
  }, [currentUserId, staffUsers.length, storageReady])

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
  const [serviceStaffEditorId, setServiceStaffEditorId] = useState<string | null>(null)
  const [serviceStaffNameDraft, setServiceStaffNameDraft] = useState('')
  const [serviceStaffCodeDraft, setServiceStaffCodeDraft] = useState('')
  const [serviceStaffStatus, setServiceStaffStatus] = useState('Ready')
  const [generatedImageVariant, setGeneratedImageVariant] = useState(0)
  const [itemImageStatus, setItemImageStatus] = useState('')
  const [itemImagePreviewOpen, setItemImagePreviewOpen] = useState(false)
  const [itemImageSearching, setItemImageSearching] = useState(false)

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
  const pendingQrOrders = useMemo(
    () =>
      qrOrders
        .filter((order) => order.status === 'pending')
        .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()),
    [qrOrders],
  )

  const activeSavedOrder = useMemo(
    () => savedOrders.find((order) => order.id === activeOrderId),
    [activeOrderId, savedOrders],
  )

  const tableStatus = useMemo(() => {
    const status = new Map<string, SavedOrder>()
    openOrders.forEach((order) => {
      if (order.orderType === 'Dining') {
        getSavedOrderTables(order).forEach((tableNo) => status.set(tableNo, order))
      }
    })

    return status
  }, [openOrders])
  const tableList = useMemo(() => diningTableGroups.flatMap((group) => group.tables), [diningTableGroups])
  const activeTableGroup = useMemo(
    () => diningTableGroups.find((group) => group.id === activeTableGroupId) ?? diningTableGroups[0],
    [activeTableGroupId, diningTableGroups],
  )
  const visibleTableList = activeTableGroup?.tables ?? tableList

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
  const visibleOrderIds = useMemo(() => visibleOrders.map((order) => order.id), [visibleOrders])
  const visibleOrdersTotal = useMemo(
    () => roundMoney(visibleOrders.reduce((sum, order) => sum + order.totals.total, 0)),
    [visibleOrders],
  )
  const selectedVisibleOrders = useMemo(
    () => visibleOrders.filter((order) => selectedOrderIds.includes(order.id)),
    [selectedOrderIds, visibleOrders],
  )
  const selectedOrdersTotal = useMemo(
    () => roundMoney(selectedVisibleOrders.reduce((sum, order) => sum + order.totals.total, 0)),
    [selectedVisibleOrders],
  )
  const allVisibleOrdersSelected = visibleOrders.length > 0 && selectedVisibleOrders.length === visibleOrders.length

  const report = useMemo(() => buildReport(savedOrders, undefined, expenses), [expenses, savedOrders])
  const reportPeriod = useMemo(
    () => getReportPeriod(reportPeriodMode, reportFromDate, reportToDate, reportMonth, reportYear),
    [reportFromDate, reportMonth, reportPeriodMode, reportToDate, reportYear],
  )
  const periodReport = useMemo(() => buildReport(savedOrders, reportPeriod, expenses), [expenses, reportPeriod, savedOrders])
  const periodReportOrders = useMemo(
    () =>
      savedOrders
        .filter((order) => isOrderInsidePeriod(order, reportPeriod))
        .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()),
    [reportPeriod, savedOrders],
  )
  const periodReportExpenses = useMemo(
    () =>
      expenses
        .filter((expense) => isExpenseInsidePeriod(expense, reportPeriod))
        .sort((first, second) => first.date.localeCompare(second.date) || first.category.localeCompare(second.category)),
    [expenses, reportPeriod],
  )
  const periodOpeningCash = isSingleDayReportPeriod(reportPeriod)
    ? openingCashBalances[formatDateInputValue(reportPeriod.from)] ?? 0
    : 0
  const dailyReportDate = useMemo(() => parseDateInputValue(reportPrintDate, new Date()), [reportPrintDate])
  const dailyReportPeriod = useMemo(() => getDailyReportPeriod(dailyReportDate), [dailyReportDate])
  const dailyReport = useMemo(
    () => buildReport(savedOrders, dailyReportPeriod, expenses),
    [dailyReportPeriod, expenses, savedOrders],
  )
  const dailyOpeningCash = openingCashBalances[formatDateInputValue(dailyReportDate)] ?? 0
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
  const recentExpenses = useMemo(
    () =>
      [...expenses].sort(
        (first, second) =>
          new Date(second.date || second.createdAt).getTime() - new Date(first.date || first.createdAt).getTime(),
      ),
    [expenses],
  )
  const selectedCustomerProfile = useMemo(
    () => customers.find((profile) => profile.id === selectedCustomerId),
    [customers, selectedCustomerId],
  )
  const selectedCustomerUnpaidOrders = useMemo(() => {
    if (!selectedCustomerProfile || selectedCustomerProfile.creditBalance <= 0) {
      return []
    }

    return savedOrders
      .filter(
        (order) =>
          order.customerId === selectedCustomerProfile.id &&
          order.status === 'paid' &&
          order.creditApplied &&
          order.totals.balance > 0,
      )
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
  }, [savedOrders, selectedCustomerProfile])
  const selectedTableSetupGroup = useMemo(
    () => (editingTableGroupId ? (diningTableGroups.find((group) => group.id === editingTableGroupId) ?? null) : null),
    [diningTableGroups, editingTableGroupId],
  )
  const activeLineEditorLine = useMemo(
    () => (lineEditor ? (cart.find((line) => line.id === lineEditor.lineId) ?? null) : null),
    [cart, lineEditor],
  )
  const activeStaffUsers = useMemo(() => staffUsers.filter((staffUser) => staffUser.active), [staffUsers])
  const activeServiceStaff = useMemo(
    () => serviceStaff.filter((staffMember) => staffMember.active !== false),
    [serviceStaff],
  )
  const selectedServiceStaff = useMemo(
    () => activeServiceStaff.find((staffMember) => staffMember.id === selectedServiceStaffId) ?? null,
    [activeServiceStaff, selectedServiceStaffId],
  )
  const staffCodePreviewStaff = useMemo(() => {
    const code = normalizeStaffCode(staffCodeInput)
    return code ? (activeServiceStaff.find((staffMember) => normalizeStaffCode(staffMember.code) === code) ?? null) : null
  }, [activeServiceStaff, staffCodeInput])
  const selectedSetupRestaurant = useMemo(
    () => setupRestaurants.find((restaurant) => restaurant.id === setupRestaurantId) ?? null,
    [setupRestaurantId, setupRestaurants],
  )
  const selectedSetupPlanDetails = useMemo(
    () =>
      getAppPlanDetails(selectedSetupRestaurant?.plan_name ?? '', selectedSetupRestaurant?.max_devices ?? 0) ??
      appPlanCatalog.premium,
    [selectedSetupRestaurant],
  )
  const selectedSetupIsOfflinePlan = selectedSetupPlanDetails.id === 'offline'
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
    () => new Set(currentUser && isOwnerStaffUser(currentUser) ? allStaffPermissionIds : (currentUser?.permissions ?? [])),
    [currentUser],
  )
  const keyboardShortcuts = useMemo(
    () =>
      defaultKeyboardShortcuts.map((shortcut) => ({
        ...shortcut,
        key: keyboardShortcutOverrides[shortcut.id] || shortcut.key,
      })),
    [keyboardShortcutOverrides],
  )
  const availableKeyboardShortcuts = useMemo(
    () =>
      keyboardShortcutsEnabled
        ? keyboardShortcuts.filter(
            (shortcut) => !shortcut.permission || currentPermissionSet.has(shortcut.permission),
          )
        : [],
    [currentPermissionSet, keyboardShortcuts, keyboardShortcutsEnabled],
  )
  const currentKeyboardShortcuts = useMemo(
    () =>
      availableKeyboardShortcuts.filter(
        (shortcut) =>
          (activeView !== 'keyboard_shortcuts' && shortcut.scope === 'global') ||
          (activeView === 'home' && shortcut.scope === 'home') ||
          (activeView === 'pos' && shortcut.scope === 'pos'),
      ),
    [activeView, availableKeyboardShortcuts],
  )
  const currentShortcutKeyById = useMemo(
    () => new Map(currentKeyboardShortcuts.map((shortcut) => [shortcut.id, shortcut.key])),
    [currentKeyboardShortcuts],
  )
  const renderShortcutKey = (shortcutId: ShortcutActionId) => {
    const shortcutKey = currentShortcutKeyById.get(shortcutId)
    return shortcutHintsVisible && shortcutKey ? <kbd className="button-shortcut-key">{shortcutKey}</kbd> : null
  }
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
  const activePrinterDraft = printerDraftProfile ?? activePrinterProfile
  const activePrinterSettings = activePrinterDraft?.settings ?? defaultPrinterSettings

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
    const isInclusive = businessProfile.gstType === 'inclusive'
    const subtotal = cart.reduce((sum, line) => sum + lineTotal(line), 0)
    const discount = getDiscountValue(subtotal, discountMode, discountPercent, discountAmount)
    const taxable = subtotal - discount
    const tax = taxExempt
      ? 0
      : isInclusive
        ? roundMoney(cart.reduce((sum, line) => sum + (lineTotal(line) * line.taxRate) / (100 + line.taxRate), 0))
        : roundMoney(cart.reduce((sum, line) => sum + (lineTotal(line) * line.taxRate) / 100, 0))
    const serviceCharge = roundMoney((taxable * servicePercent) / 100)
    const total = roundMoney(Math.max(0, isInclusive ? taxable + serviceCharge : taxable + tax + serviceCharge))

    return { subtotal, discount, tax, serviceCharge, total }
  }, [cart, discountAmount, discountMode, discountPercent, servicePercent, businessProfile.gstType, taxExempt])

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
    savedOrdersRef.current = savedOrders
  }, [savedOrders])

  useEffect(() => {
    customersRef.current = customers
  }, [customers])

  useEffect(() => {
    qrOrdersRef.current = qrOrders
  }, [qrOrders])

  useEffect(() => {
    if (!diningTableGroups.some((group) => group.id === activeTableGroupId)) {
      setActiveTableGroupId(diningTableGroups[0]?.id ?? '')
    }

    if (editingTableGroupId && !diningTableGroups.some((group) => group.id === editingTableGroupId)) {
      setEditingTableGroupId(null)
      setTableGroupName('')
      setTableGroupTables('')
    }
  }, [activeTableGroupId, diningTableGroups, editingTableGroupId])

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
        const loadedDiningTableGroups = normalizeDiningTableGroups(
          readDbValue(
            snapshot,
            'pos-dining-table-groups',
            loadStoredArray('pos-dining-table-groups', defaultDiningTableGroups),
          ),
        )
        const loadedMenuItems = normalizeMenuItems(
          readDbValue(snapshot, 'pos-menu-items', loadStoredArray('pos-menu-items', defaultMenuItems)),
        )
        const loadedOrders = readDbValue<SavedOrder[]>(snapshot, 'pos-orders', loadStoredArray('pos-orders', [])).map(
          normalizeSavedOrderPayment,
        )
        const loadedQrOrders = normalizeQrOrders(
          readDbValue<QrPendingOrder[]>(snapshot, 'pos-qr-orders', loadStoredArray('pos-qr-orders', [])),
        )
        const loadedExpenses = normalizeExpenses(
          readDbValue(snapshot, 'pos-expenses', loadStoredArray<ExpenseEntry>('pos-expenses', [])),
        )
        const loadedOpeningCashBalances = normalizeOpeningCashBalances(
          readDbValue(snapshot, openingCashStorageKey, loadStoredObject<Record<string, number>>(openingCashStorageKey, {})),
        )
        const loadedCustomers = readDbValue<CustomerProfile[]>(
          snapshot,
          'pos-customers',
          loadStoredArray('pos-customers', []),
        )
        const loadedServiceStaff = normalizeServiceStaff(
          readDbValue(snapshot, serviceStaffStorageKey, loadStoredArray<ServiceStaff>(serviceStaffStorageKey, [])),
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
        const loadedAppMode = normalizeAppMode(
          readDbValue(snapshot, appModeStorageKey, localStorage.getItem(appModeStorageKey) || 'cloud'),
        )
        const loadedOfflineLicense = normalizeOfflineLicense(
          readDbValue(snapshot, offlineLicenseStorageKey, loadStoredObject<Partial<OfflineLicense>>(offlineLicenseStorageKey, {})),
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
        const loadedAppConfiguration = normalizeAppConfiguration(
          readDbValue(
            snapshot,
            appConfigurationStorageKey,
            loadStoredObject(appConfigurationStorageKey, defaultAppConfiguration),
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
        const loadedKeyboardShortcutsEnabled = normalizeKeyboardShortcutsEnabled(
          readDbValue(
            snapshot,
            keyboardShortcutsEnabledStorageKey,
            localStorage.getItem(keyboardShortcutsEnabledStorageKey),
          ),
        )

        setCategoryList(loadedCategories)
        setDiningTableGroups(loadedDiningTableGroups)
        setActiveTableGroupId(loadedDiningTableGroups[0]?.id ?? '')
        setMenuList(loadedMenuItems)
        setSavedOrders(loadedOrders)
        setQrOrders(loadedQrOrders)
        setExpenses(loadedExpenses)
        setOpeningCashBalances(loadedOpeningCashBalances)
        setCustomers(loadedCustomers)
        setServiceStaff(loadedServiceStaff)
        businessProfileRef.current = loadedBusinessProfile
        setBusinessProfile(loadedBusinessProfile)
        setCloudSyncSettings(loadedCloudSyncSettings)
        setAppMode(loadedAppMode)
        setOfflineLicense(loadedOfflineLicense)
        setStaffUsers(loadedStaffUsers)
        setAuditLog(loadedAuditLog)
        setMenuDisplaySettings(loadedMenuDisplaySettings)
        setAppConfiguration(loadedAppConfiguration)
        setPrinterProfiles(loadedPrinterProfiles)
        setBillPrinterProfileId(loadedBillPrinterProfileId)
        setActivePrinterProfileId(loadedActivePrinterProfileId)
        setBillNumber(getInitialBillNumber(loadedOrders))
        setBillFinancialYear(getFinancialYearKey(new Date()))
        setTheme(loadedTheme === 'dark' ? 'dark' : 'light')
        setKeyboardShortcutsEnabled(loadedKeyboardShortcutsEnabled)
        setLocalDatabasePath(snapshot.path)
        setLocalDatabaseDataDir(snapshot.dataDir ?? '')
        setLocalDatabaseBackupDir(snapshot.backupDir ?? '')
        void refreshDatabaseBackups()
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
  }, [refreshDatabaseBackups])

  useEffect(() => {
    void refreshLocalServerStatus()

    if (!window.posServer) {
      return
    }

    const interval = window.setInterval(() => {
      void refreshLocalServerStatus()
    }, 30000)

    return () => window.clearInterval(interval)
  }, [refreshLocalServerStatus])

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
    persistStoredValue('pos-dining-table-groups', diningTableGroups, storageReady && !skipPersistenceRef.current)
  }, [diningTableGroups, storageReady])

  useEffect(() => {
    persistStoredValue('pos-menu-items', menuList, storageReady && !skipPersistenceRef.current)
  }, [menuList, storageReady])

  useEffect(() => {
    persistStoredValue('pos-orders', savedOrders, storageReady && !skipPersistenceRef.current)
  }, [savedOrders, storageReady])

  useEffect(() => {
    persistStoredValue('pos-qr-orders', qrOrders, storageReady && !skipPersistenceRef.current)
  }, [qrOrders, storageReady])

  useEffect(() => {
    persistStoredValue('pos-expenses', expenses, storageReady && !skipPersistenceRef.current)
  }, [expenses, storageReady])

  useEffect(() => {
    persistStoredValue(openingCashStorageKey, openingCashBalances, storageReady && !skipPersistenceRef.current)
  }, [openingCashBalances, storageReady])

  useEffect(() => {
    persistStoredValue('pos-customers', customers, storageReady && !skipPersistenceRef.current)
  }, [customers, storageReady])

  useEffect(() => {
    persistStoredValue(serviceStaffStorageKey, serviceStaff, storageReady && !skipPersistenceRef.current)
  }, [serviceStaff, storageReady])

  useEffect(() => {
    persistStoredValue('pos-business-profile', businessProfile, storageReady && !skipPersistenceRef.current)
  }, [businessProfile, storageReady])

  useEffect(() => {
    persistStoredValue('pos-cloud-sync-settings', cloudSyncSettings, storageReady && !skipPersistenceRef.current)
  }, [cloudSyncSettings, storageReady])

  useEffect(() => {
    persistStoredValue(appModeStorageKey, appMode, storageReady && !skipPersistenceRef.current, appMode)
  }, [appMode, storageReady])

  useEffect(() => {
    persistStoredValue(offlineLicenseStorageKey, offlineLicense, storageReady && !skipPersistenceRef.current)
  }, [offlineLicense, storageReady])

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
    persistStoredValue(appConfigurationStorageKey, appConfiguration, storageReady && !skipPersistenceRef.current)
  }, [appConfiguration, storageReady])

  useEffect(() => {
    if (!storageReady || !currentUser || !window.posDb) {
      return
    }

    let cancelled = false
    const refreshQrOrders = async () => {
      try {
        const snapshot = await window.posDb?.load()
        if (!snapshot || cancelled) {
          return
        }

        const nextOrders = normalizeQrOrders(readDbValue(snapshot, 'pos-qr-orders', qrOrdersRef.current))
        if (JSON.stringify(nextOrders) !== JSON.stringify(qrOrdersRef.current)) {
          qrOrdersRef.current = nextOrders
          setQrOrders(nextOrders)
        }
      } catch {
        // The regular DB status surface already reports database errors.
      }
    }

    void refreshQrOrders()
    const interval = window.setInterval(refreshQrOrders, 5000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [currentUser, storageReady])

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
    persistStoredValue(
      keyboardShortcutsStorageKey,
      keyboardShortcutOverrides,
      storageReady && !skipPersistenceRef.current,
    )
  }, [keyboardShortcutOverrides, storageReady])

  useEffect(() => {
    persistStoredValue(
      keyboardShortcutsEnabledStorageKey,
      keyboardShortcutsEnabled,
      storageReady && !skipPersistenceRef.current,
      String(keyboardShortcutsEnabled),
    )
    if (!keyboardShortcutsEnabled) {
      setShortcutHintsVisible(false)
    }
  }, [keyboardShortcutsEnabled, storageReady])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const currentFinancialYear = getFinancialYearKey(currentDate)
    if (currentFinancialYear === billFinancialYear) {
      return
    }

    setBillFinancialYear(currentFinancialYear)
    if (!cart.length) {
      setBillNumber(getInitialBillNumber(savedOrders, currentDate))
    }
  }, [billFinancialYear, cart.length, currentDate, savedOrders])

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
    setSelectedOrderIds((ids) => ids.filter((id) => visibleOrderIds.includes(id)))
  }, [visibleOrderIds])

  useEffect(() => {
    setSelectedOrderIds([])
  }, [orderListMode, orderListDate])

  useEffect(() => {
    if (appMode === 'offline') {
      setSyncStatus('Offline mode active. Cloud sync is disabled.')
      return undefined
    }

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
    appMode,
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

  shortcutActionRunnerRef.current = (actionId: ShortcutActionId) => {
    if (actionId === 'global-lock') {
      lockApp()
    } else if (actionId === 'global-theme') {
      setTheme((mode) => (mode === 'dark' ? 'light' : 'dark'))
    } else if (actionId === 'home-pos') {
      goToView('pos')
    } else if (actionId === 'home-report') {
      goToView('reports')
    } else if (actionId === 'home-settings') {
      goToView('settings')
    } else if (actionId === 'pos-print-bill' || actionId === 'pos-save-print') {
      void printReceipt(true)
    } else if (actionId === 'pos-save-bill') {
      void savePaidOrder()
    } else if (actionId === 'pos-hold') {
      holdCurrentOrder()
    } else if (actionId === 'pos-kot') {
      void printKotByRouting()
    } else if (actionId === 'pos-new-order') {
      newOrder()
    } else if (actionId === 'pos-orders') {
      openOrderList('orders')
    }
  }

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false
      }

      const tagName = target.tagName.toLowerCase()
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
    }

    const hasActiveModal = () => Boolean(document.querySelector('.modal-layer'))

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        if (currentKeyboardShortcuts.length) {
          event.preventDefault()
          setShortcutHintsVisible(true)
        }
        return
      }

      if (event.repeat || !currentUser || isTypingTarget(event.target) || hasActiveModal()) {
        return
      }

      if (event.ctrlKey || event.metaKey) {
        return
      }

      const shortcut = currentKeyboardShortcuts.find((entry) => isShortcutKeyMatch(entry.key, event.key))
      if (shortcut) {
        event.preventDefault()
        shortcutActionRunnerRef.current(shortcut.id)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        setShortcutHintsVisible(false)
      }
    }

    const hideShortcutHints = () => setShortcutHintsVisible(false)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', hideShortcutHints)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', hideShortcutHints)
    }
  }, [currentKeyboardShortcuts, currentUser])

  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0)
  const billingBusinessName = businessProfile.businessName.trim()
  const billingOwnerName = businessProfile.ownerName.trim()
  const billingDisplayName = billingBusinessName || 'Billing business not set'
  const receiptBusinessName = billingBusinessName || 'Restaurant'
  const receiptCashierName = currentUser?.name?.trim() || 'Owner'
  const hasCloudDeviceConnection = Boolean(
    cloudSyncSettings.restaurantId.trim() &&
      cloudSyncSettings.deviceId.trim() &&
      cloudSyncSettings.apiKey.trim(),
  )
  const hasOfflineAccess = appMode === 'offline' && isOfflineLicenseValid(offlineLicense)
  const currentPlanDetails = hasOfflineAccess
    ? getAppPlanDetails(offlineLicense.subscriptionPlan, offlineLicense.subscriptionMaxDevices) ?? appPlanCatalog.offline
    : getAppPlanDetails(cloudSyncSettings.subscriptionPlan, cloudSyncSettings.subscriptionMaxDevices)
  const hasGoldLocalPlan = !hasOfflineAccess && currentPlanDetails?.id === 'gold'
  const hasCloudFeatureAccess = !hasOfflineAccess
  const hasSubscriptionAccess = hasOfflineAccess || !subscriptionLock
  const localServerUrls = localServerStatus?.urls ?? []
  const localServerPrimaryUrl = localServerStatus?.primaryUrl || localServerUrls[0] || ''
  const localDnsStatus = localServerStatus?.dns
  const localDnsUrls = localDnsStatus?.urls ?? []
  const currentLicenseRows = useMemo(() => {
    if (hasOfflineAccess && offlineLicense) {
      return [
        { label: 'Mode', value: 'Offline' },
        { label: 'Plan', value: currentPlanDetails?.name || offlineLicense.subscriptionPlan || 'Offline' },
        { label: 'Expiry Date', value: formatLicenseDate(offlineLicense.expiresAt || offlineLicense.subscriptionExpiresAt) },
        { label: 'Business', value: offlineLicense.businessName },
        { label: 'Phone', value: offlineLicense.phone },
      ]
    }

    return [
      { label: 'Mode', value: 'Cloud' },
      { label: 'Plan', value: currentPlanDetails?.name || cloudSyncSettings.subscriptionPlan || 'Not paired' },
      { label: 'Expiry Date', value: formatLicenseDate(cloudSyncSettings.subscriptionExpiresAt) },
      { label: 'Business', value: cloudSyncSettings.restaurantName || businessProfile.businessName || 'Not set' },
      { label: 'Owner', value: cloudSyncSettings.restaurantOwnerName || businessProfile.ownerName || 'Not set' },
      { label: 'Phone', value: cloudSyncSettings.restaurantPhone || businessProfile.phone || 'Not set' },
      { label: 'Email', value: cloudSyncSettings.restaurantEmail || businessProfile.email || 'Not set' },
      { label: 'Server', value: cloudSyncSettings.apiUrl || defaultCloudSyncSettings.apiUrl },
      { label: 'Last Sync', value: formatLicenseDate(cloudSyncSettings.lastSyncAt) },
    ]
  }, [businessProfile, cloudSyncSettings, currentPlanDetails?.name, hasOfflineAccess, offlineLicense])
  const licenseValueByLabel = useMemo(() => {
    return new Map(currentLicenseRows.map((row) => [row.label, row.value || 'Not set']))
  }, [currentLicenseRows])
  const licenseModeLabel = licenseValueByLabel.get('Mode') || 'Not set'
  const licensePlanLabel = licenseValueByLabel.get('Plan') || 'Not set'
  const licenseExpiryLabel = licenseValueByLabel.get('Expiry Date') || 'Not set'
  const licenseGroups = useMemo(() => {
    const pickRows = (labels: string[]) =>
      labels
        .map((label) => ({ label, value: licenseValueByLabel.get(label) || 'Not set' }))
        .filter((row) => row.value !== 'Not set')

    return [
      {
        title: 'License',
        rows: pickRows(['Mode', 'Plan', 'Expiry Date']),
      },
      {
        title: 'Business',
        rows: pickRows(['Business', 'Owner', 'Phone', 'Email']),
      },
      {
        title: 'Connection',
        rows: pickRows(['Server', 'Last Sync']),
      },
    ].filter((group) => group.rows.length)
  }, [licenseValueByLabel])

  function hasPermission(permission: StaffPermission) {
    return currentPermissionSet.has(permission)
  }

  function showAccessPrompt(message: string, title = 'Access restricted') {
    setPrinterStatus(message)
    setAccessPrompt({ title, message })
  }

  function getPermissionDeniedMessage(permission: StaffPermission) {
    const label = staffPermissions.find((staffPermission) => staffPermission.id === permission)?.label ?? 'this action'
    return `You don't have access to ${label}. Only an admin can do it.`
  }

  function getViewPermission(view: AppView): StaffPermission | null {
    if (view === 'pos') return 'pos_access'
    if (view === 'reports') return 'reports'
    if (view === 'expenses') return 'expense_manage'
    if (view === 'profile') return 'business_profile'
    if (view === 'sync') return 'cloud_sync'
    if (view === 'users') return 'user_manage'
    if (view === 'service_staff') return 'user_manage'
    if (view === 'menu') return 'menu_manage'
    if (view === 'printers') return 'printer_manage'
    if (view === 'printer_config') return 'printer_manage'
    if (view === 'settings') return null
    if (view === 'configuration') return 'user_manage'
    if (view === 'keyboard_shortcuts') return 'user_manage'
    if (view === 'network') return 'cloud_sync'
    return null
  }

  function canOpenView(view: AppView) {
    if (!currentUser) {
      return false
    }

    if (view === 'home' || view === 'about') return true
    if (hasOfflineAccess && (view === 'sync' || view === 'network')) {
      return false
    }

    if (!hasSubscriptionAccess) {
      return view === 'sync' && hasPermission('cloud_sync')
    }

    if (view === 'pos') return hasPermission('pos_access')
    if (view === 'reports') return hasPermission('reports')
    if (view === 'expenses') return hasPermission('expense_manage')
    if (view === 'profile') return hasPermission('business_profile')
    if (view === 'sync') return hasCloudFeatureAccess && hasPermission('cloud_sync')
    if (view === 'users') return hasPermission('user_manage')
    if (view === 'service_staff') return hasPermission('user_manage')
    if (view === 'menu') return hasPermission('menu_manage')
    if (view === 'printers') return hasPermission('printer_manage')
    if (view === 'printer_config') return hasPermission('printer_manage')
    if (view === 'settings') {
      return (
        hasPermission('user_manage') ||
        hasPermission('business_profile') ||
        hasPermission('menu_manage') ||
        hasPermission('printer_manage') ||
        (hasCloudFeatureAccess && hasPermission('cloud_sync'))
      )
    }
    if (view === 'configuration') return hasPermission('user_manage')
    if (view === 'keyboard_shortcuts') return hasPermission('user_manage')
    if (view === 'network') return hasPermission('cloud_sync') && hasGoldLocalPlan

    return false
  }

  function goToView(view: AppView) {
    if (!canOpenView(view)) {
      const viewPermission = getViewPermission(view)
      const message =
        hasOfflineAccess && (view === 'sync' || view === 'network')
          ? 'Offline plan does not include cloud sync or local POS server.'
          : view === 'network' && !hasGoldLocalPlan
            ? 'Local POS Server is included in Gold plan.'
            : subscriptionLock?.message ?? (viewPermission ? getPermissionDeniedMessage(viewPermission) : 'You do not have access to this section.')
      showAccessPrompt(message)
      return
    }

    setActiveView(view)
  }

  function requirePermission(permission: StaffPermission, message?: string) {
    if (hasOfflineAccess && permission === 'cloud_sync') {
      showAccessPrompt('Offline plan does not include cloud sync.')
      return false
    }

    if (!hasSubscriptionAccess && permission !== 'cloud_sync') {
      showAccessPrompt(subscriptionLock?.message ?? 'Subscription check required')
      return false
    }

    if (hasPermission(permission)) {
      return true
    }

    const deniedMessage = message && !/permission required/i.test(message) ? message : getPermissionDeniedMessage(permission)
    showAccessPrompt(deniedMessage)
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
    const isOfflineActivation = selectedSetupIsOfflinePlan

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
    setSetupStatus(isOfflineActivation ? 'Activating offline mode...' : 'Activating this device...')

    try {
      const deviceFingerprint = getOrCreateDeviceFingerprint()
      const activateResponse = await fetch(
        `${apiUrl}/api/v1/client/restaurants/${encodeURIComponent(restaurantId)}/devices/activate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-client-token': setupCloudToken },
          body: JSON.stringify({
            deviceName,
            activationMode: isOfflineActivation ? 'offline' : 'cloud',
            deviceFingerprint,
            ...(transferCode ? { transferCode } : {}),
          }),
        },
      )
      const activateResult = await parseCloudResponse<CloudPairResponse>(activateResponse)
      const activatedRestaurantId = String(activateResult.restaurant?.id || restaurantId)
      const activatedDeviceId = String(activateResult.device?.id || '')
      const apiKey = String(activateResult.apiKey || '')

      if (!activatedRestaurantId || !activatedDeviceId || !apiKey) {
        throw new Error('Device activation response missing sync credentials')
      }

      const nextOfflineLicense = isOfflineActivation
        ? normalizeOfflineLicense(activateResult.offlineLicense)
        : null

      if (isOfflineActivation && !isOfflineLicenseValid(nextOfflineLicense)) {
        throw new Error('Offline activation response missing license')
      }

      setSetupStatus('Clearing old local restaurant data...')
      await resetLocalRestaurantDataForAccountSwitch(apiUrl)

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
        deviceId: isOfflineActivation ? '' : activatedDeviceId,
        deviceName: String(activateResult.device?.name || deviceName),
        apiKey: isOfflineActivation ? '' : apiKey,
        subscriptionPlan: String(activateResult.subscription?.plan_name || ''),
        subscriptionStatus: String(activateResult.subscription?.status || ''),
        subscriptionExpiresAt: String(activateResult.subscription?.expires_at || ''),
        subscriptionMaxDevices: Number(activateResult.subscription?.max_devices || 0),
        autoSync: !isOfflineActivation,
        lastSyncAt: snapshot.serverTime,
      }

      cloudSyncSettingsRef.current = nextCloudSettings
      setCloudSyncSettings(nextCloudSettings)
      setAppMode(isOfflineActivation ? 'offline' : 'cloud')
      setOfflineLicense(nextOfflineLicense)
      localStorage.setItem('pos-cloud-sync-settings', JSON.stringify(nextCloudSettings))
      localStorage.setItem(appModeStorageKey, isOfflineActivation ? 'offline' : 'cloud')
      if (nextOfflineLicense) {
        localStorage.setItem(offlineLicenseStorageKey, JSON.stringify(nextOfflineLicense))
      } else {
        localStorage.removeItem(offlineLicenseStorageKey)
      }
      await window.posDb.set('pos-cloud-sync-settings', JSON.stringify(nextCloudSettings))
      await window.posDb.set(appModeStorageKey, JSON.stringify(isOfflineActivation ? 'offline' : 'cloud'))
      await window.posDb.set(offlineLicenseStorageKey, JSON.stringify(nextOfflineLicense))
      if (isOfflineActivation) {
        await window.posServer?.stop?.()
        await refreshLocalServerStatus()
      }
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
          `${isOfflineActivation ? 'Offline activation' : 'Cloud restore'} complete. ${snapshot.changes.length} item(s) restored.${transferNote} Login with your old app user PIN.`,
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
          `${isOfflineActivation ? 'Offline activation' : 'Cloud restore'} complete.${transferNote} Owner login created. Login with the new Owner PIN.`,
        )
      }
    } catch (error) {
      setSetupStatus(`${isOfflineActivation ? 'Offline activation' : 'Cloud restore'} failed: ${getCloudErrorMessage(error, apiUrl)}`)
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
        subscriptionMaxDevices: Number(subscription?.max_devices || settings.subscriptionMaxDevices || 0),
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
    setLoginError(appMode === 'offline' ? 'Checking offline license...' : 'Checking cloud subscription...')

    try {
      if (appMode === 'offline') {
        if (!isOfflineLicenseValid(offlineLicense)) {
          setLoginPin('')
          setLoginError('Offline license is missing or expired. Activate again from GI.')
          return
        }

        setSubscriptionLock(null)
        completePinLogin(user)
        return
      }

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
    closeBlockingPanelsForAuth()
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

  function startNewServiceStaff() {
    if (!requirePermission('user_manage')) {
      return
    }

    setServiceStaffEditorId(null)
    setServiceStaffNameDraft('')
    setServiceStaffCodeDraft('')
    setServiceStaffStatus('Ready')
  }

  function editServiceStaff(staffMember: ServiceStaff) {
    if (!requirePermission('user_manage')) {
      return
    }

    setServiceStaffEditorId(staffMember.id)
    setServiceStaffNameDraft(staffMember.name)
    setServiceStaffCodeDraft(staffMember.code)
    setServiceStaffStatus('Editing staff')
  }

  function saveServiceStaff() {
    if (!requirePermission('user_manage')) {
      return
    }

    const name = serviceStaffNameDraft.trim()
    const code = normalizeStaffCode(serviceStaffCodeDraft)
    const existing = serviceStaffEditorId
      ? serviceStaff.find((staffMember) => staffMember.id === serviceStaffEditorId)
      : undefined

    if (!name) {
      setServiceStaffStatus('Staff name required')
      return
    }

    if (!code) {
      setServiceStaffStatus('Staff code required')
      return
    }

    const duplicate = serviceStaff.find(
      (staffMember) => staffMember.id !== existing?.id && normalizeStaffCode(staffMember.code) === code,
    )
    if (duplicate) {
      setServiceStaffStatus(`Code already used by ${duplicate.name}`)
      return
    }

    const now = new Date().toISOString()
    const nextStaff: ServiceStaff = {
      id: existing?.id ?? createServiceStaffId(),
      name,
      code,
      active: true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    setServiceStaff((staffList) =>
      existing
        ? staffList.map((staffMember) => (staffMember.id === existing.id ? nextStaff : staffMember))
        : [nextStaff, ...staffList],
    )
    setServiceStaffEditorId(nextStaff.id)
    setServiceStaffNameDraft(nextStaff.name)
    setServiceStaffCodeDraft(nextStaff.code)
    setServiceStaffStatus(`${nextStaff.name} saved`)
    recordAudit(existing ? 'service_staff_updated' : 'service_staff_created', `${nextStaff.name} / ${nextStaff.code}`)
  }

  function deleteServiceStaff(staffMember: ServiceStaff) {
    if (!requirePermission('user_manage')) {
      return
    }

    if (!window.confirm(`Delete staff ${staffMember.name}? Existing bills will keep the saved staff name.`)) {
      return
    }

    setServiceStaff((staffList) => staffList.filter((savedStaff) => savedStaff.id !== staffMember.id))
    if (serviceStaffEditorId === staffMember.id) {
      startNewServiceStaff()
    }
    if (selectedServiceStaffId === staffMember.id) {
      clearSelectedServiceStaff()
    }
    setServiceStaffStatus(`${staffMember.name} deleted`)
    recordAudit('service_staff_deleted', `${staffMember.name} removed`)
  }

  function clearSelectedServiceStaff() {
    setSelectedServiceStaffId('')
    setSelectedServiceStaffName('')
    setSelectedServiceStaffCode('')
  }

  function updateBusinessProfile<K extends keyof BusinessProfile>(field: K, value: BusinessProfile[K]) {
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

  function updateOpeningCashBalance(date: Date, value: string) {
    if (!requirePermission('reports', 'Report permission required')) {
      return
    }

    const dateKey = formatDateInputValue(date)
    const amount = roundMoney(Math.max(0, Number(value) || 0))
    setOpeningCashBalances((balances) => ({ ...balances, [dateKey]: amount }))
  }

  async function createDatabaseBackupNow() {
    if (!window.posDb?.createBackup) {
      setDatabaseBackupStatus('Backup works only in the desktop app')
      return
    }

    try {
      const result = await window.posDb.createBackup()
      setDatabaseBackupStatus(`Backup created: ${result.fileName}`)
      await refreshDatabaseBackups()
    } catch (error) {
      setDatabaseBackupStatus(`Backup failed: ${getErrorMessage(error)}`)
    }
  }

  async function restoreSelectedDatabaseBackup() {
    if (!window.posDb?.restoreBackup || !selectedDatabaseBackup) {
      setDatabaseBackupStatus('Select a backup to restore')
      return
    }

    const confirmed = window.confirm(
      `Restore ${selectedDatabaseBackup}? Current data will be backed up before restore, then the app will reload.`,
    )
    if (!confirmed) {
      return
    }

    try {
      await window.posDb.restoreBackup(selectedDatabaseBackup)
      setDatabaseBackupStatus('Backup restored. Reloading app...')
      window.location.reload()
    } catch (error) {
      setDatabaseBackupStatus(`Restore failed: ${getErrorMessage(error)}`)
    }
  }

  async function resetLocalRestaurantDataForAccountSwitch(apiUrl: string) {
    const safeApiUrl = normalizeApiUrl(apiUrl) || defaultCloudSyncSettings.apiUrl
    const nextSettings = normalizeCloudSyncSettings({
      ...defaultCloudSyncSettings,
      apiUrl: safeApiUrl,
      autoSync: false,
      lastSyncAt: '',
    })
    const localOnlyEntries = [
      { key: 'printer-profiles', value: JSON.stringify(printerProfiles), localValue: JSON.stringify(printerProfiles) },
      { key: 'bill-printer-profile-id', value: JSON.stringify(billPrinterProfileId), localValue: billPrinterProfileId },
      { key: 'active-printer-profile-id', value: JSON.stringify(activePrinterProfileId), localValue: activePrinterProfileId },
      { key: 'pos-menu-display-settings', value: JSON.stringify(menuDisplaySettings), localValue: JSON.stringify(menuDisplaySettings) },
      { key: 'pos-theme', value: JSON.stringify(theme), localValue: theme },
      {
        key: keyboardShortcutsStorageKey,
        value: JSON.stringify(keyboardShortcutOverrides),
        localValue: JSON.stringify(keyboardShortcutOverrides),
      },
      {
        key: keyboardShortcutsEnabledStorageKey,
        value: JSON.stringify(keyboardShortcutsEnabled),
        localValue: String(keyboardShortcutsEnabled),
      },
      { key: 'pos-cloud-sync-settings', value: JSON.stringify(nextSettings), localValue: JSON.stringify(nextSettings) },
    ]

    skipPersistenceRef.current = true
    closeBlockingPanelsForAuth()

    try {
      await window.posDb?.resetAll()
      restaurantDataStorageKeys.forEach((key) => localStorage.removeItem(key))
      localOnlyEntries.forEach((entry) => localStorage.setItem(entry.key, entry.localValue))
      await window.posDb?.setMany(localOnlyEntries.map(({ key, value }) => ({ key, value })))

      businessProfileRef.current = defaultBusinessProfile
      cloudSyncSettingsRef.current = nextSettings
      staffUsersRef.current = []
      qrOrdersRef.current = []
      setCategoryList(defaultCategories)
      setDiningTableGroups(defaultDiningTableGroups.map((group) => ({ ...group, tables: [...group.tables] })))
      setActiveTableGroupId(defaultDiningTableGroups[0]?.id ?? '')
      setMenuList([])
      setSavedOrders([])
      setQrOrders([])
      setExpenses([])
      setOpeningCashBalances({})
      setCustomers([])
      setServiceStaff([])
      setAppConfiguration(defaultAppConfiguration)
      setBusinessProfile(defaultBusinessProfile)
      setCloudSyncSettings(nextSettings)
      setAppMode('cloud')
      setOfflineLicense(null)
      setStaffUsers([])
      setAuditLog([])
      setCurrentUserId('')
      setLoginUserId('')
      setLoginPin('')
      setLoginError('')
      setLoginAttempts(0)
      setLoginLockedUntil(0)
      setSubscriptionLock(null)
      setPendingSyncCount(0)
      setActiveView('home')
      startBlankOrder(false)
      setBillNumber(firstBillNumber)
    } finally {
      window.setTimeout(() => {
        skipPersistenceRef.current = false
      }, 500)
    }

    return nextSettings
  }

  async function terminateCloudConnection() {
    if (!requirePermission('cloud_sync')) {
      return
    }

    const confirmed = window.confirm(
      'Terminate this cloud connection and clear local restaurant data from this PC? Cloud backup data stays on the server.',
    )

    if (!confirmed) {
      return
    }

    const apiUrl = normalizeApiUrl(cloudSyncSettingsRef.current.apiUrl) || defaultCloudSyncSettings.apiUrl
    setSyncing(true)
    setSyncStatus('Clearing local restaurant data...')

    try {
      await resetLocalRestaurantDataForAccountSwitch(apiUrl)
      setSetupCloudApiUrl(apiUrl)
      setSetupCloudLogin('')
      setSetupCloudPassword('')
      setSetupCloudToken('')
      setSetupRestaurants([])
      setSetupRestaurantId('')
      setSetupTransferCode('')
      setSetupStatus('Connection terminated. Login with cloud account to restore this restaurant.')
      setSyncCloudToken('')
      setSyncRestaurants([])
      setSyncRestaurantId('')
      setSyncCloudPassword('')
      setSyncTransferCode('')
      setSyncStatus('Connection terminated. Local restaurant data cleared.')
    } catch (error) {
      setSyncStatus(`Connection terminate failed: ${getErrorMessage(error)}`)
    } finally {
      setSyncing(false)
    }
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

  function closeBlockingPanelsForAuth() {
    setPrinterOpen(false)
    setKotPrintOpen(false)
    setMenuEditorOpen(false)
    setDisplaySettingsOpen(false)
    setTableSelectorOpen(false)
    setStaffCodePromptOpen(false)
    setTableSetupOpen(false)
    setQrOrdersOpen(false)
    setTableQrPreview(null)
    setCustomerEditorOpen(false)
    setDiscountEditorOpen(false)
    setOrderListMode(null)
    setSelectedOrderIds([])
    setReportOpen(false)
    setLineActionId(null)
    setLineEditor(null)
    setPendingPriceItem(null)
    setSuccessOrder(null)
    setAccountPanelOpen(false)
    setForgotPinOpen(false)
  }

  async function completeActivationLogout() {
    if (!currentUser || !hasPermission('user_manage')) {
      setPrinterStatus('Owner permission required for complete logout')
      return
    }

    const confirmed = window.confirm(
      hasOfflineAccess
        ? 'Complete logout from this offline activation and clear local restaurant data from this PC? You must login with the client cloud account and activate again.'
        : 'Complete logout from this cloud account and clear local restaurant data from this PC? Cloud backup data stays on the server.',
    )

    if (!confirmed) {
      return
    }

    const apiUrl = normalizeApiUrl(cloudSyncSettingsRef.current.apiUrl) || defaultCloudSyncSettings.apiUrl
    setSyncing(true)
    setPrinterStatus('Completing logout...')

    try {
      await resetLocalRestaurantDataForAccountSwitch(apiUrl)
      setSetupCloudApiUrl(apiUrl)
      setSetupCloudLogin('')
      setSetupCloudPassword('')
      setSetupCloudToken('')
      setSetupRestaurants([])
      setSetupRestaurantId('')
      setSetupTransferCode('')
      setSetupStatus('Complete logout done. Login with cloud account or activate offline to continue.')
      setSyncStatus('Complete logout done. Local restaurant data cleared.')
    } catch (error) {
      setPrinterStatus(`Complete logout failed: ${getErrorMessage(error)}`)
    } finally {
      setSyncing(false)
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

  async function copyLocalServerText(value: string) {
    if (!value) {
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setPrinterStatus('Copied')
    } catch {
      setPrinterStatus(value)
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

    const currentRestaurantId = cloudSyncSettingsRef.current.restaurantId.trim()
    const isRestaurantSwitch = Boolean(currentRestaurantId && currentRestaurantId !== restaurantId)

    if (isRestaurantSwitch) {
      const confirmed = window.confirm(
        'This will change the cloud restaurant for this PC. Old local bills, reports, menu, customers, users, and pending sync data will be cleared before the new account is connected.',
      )

      if (!confirmed) {
        setSyncStatus('Account change cancelled')
        return
      }
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

      if (isRestaurantSwitch) {
        setSyncStatus('Clearing old local restaurant data...')
        await resetLocalRestaurantDataForAccountSwitch(apiUrl)

        setSyncStatus('Restoring selected cloud account data...')
        const pulledSnapshot = await pullCloudSnapshot(apiUrl, activatedRestaurantId, deviceId, apiKey, '')
        const pulledChanges = pulledSnapshot.changes
        const restoredStaffUsers = getStaffUsersFromCloudChanges(pulledChanges)
        const cloudProfile = normalizeCloudSignupBusinessProfile(result.restaurant, selectedSyncRestaurant, pulledSnapshot.restaurant)
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
          subscriptionPlan: String(pulledSnapshot.subscription?.plan_name || result.subscription?.plan_name || ''),
          subscriptionStatus: String(pulledSnapshot.subscription?.status || result.subscription?.status || ''),
          subscriptionExpiresAt: String(pulledSnapshot.subscription?.expires_at || result.subscription?.expires_at || ''),
          subscriptionMaxDevices: Number(pulledSnapshot.subscription?.max_devices || result.subscription?.max_devices || 0),
          autoSync: true,
          lastSyncAt: pulledSnapshot.serverTime,
        }

        if (pulledChanges.length) {
          await window.posDb?.applyRemoteValues(
            pulledChanges.map((change) => ({
              key: change.key,
              value: JSON.stringify(change.value),
              updatedAt: change.updatedAt,
            })),
          )
          await window.posDb?.clearPendingSync()
          applyCloudPullChanges(pulledChanges)
        }

        cloudSyncSettingsRef.current = nextSettings
        setCloudSyncSettings(nextSettings)
        localStorage.setItem('pos-cloud-sync-settings', JSON.stringify(nextSettings))
        await window.posDb?.set('pos-cloud-sync-settings', JSON.stringify(nextSettings))
        setSyncCloudPassword('')
        setSyncTransferCode('')
        setSyncCloudToken('')
        setSyncRestaurants([])
        setSyncRestaurantId('')
        setPendingSyncCount(0)
        applyCloudSignupBusinessProfile(cloudProfile)
        setLoginUserId(restoredStaffUsers.find((staffUser) => staffUser.active)?.id ?? restoredStaffUsers[0]?.id ?? '')
        setSetupCloudApiUrl(apiUrl)
        setSetupStatus(
          restoredStaffUsers.length
            ? `Cloud account changed. ${pulledChanges.length} item(s) restored. Login with the selected account's POS PIN.`
            : 'Cloud account changed. No app users found in this account; login to cloud restore and create Owner PIN.',
        )
        setSyncStatus(
          result.transferApplied
            ? `Account changed safely. Old ${result.loggedOutDevices?.length || 0} device(s) logged out.`
            : `Account changed safely. Pulled ${pulledChanges.length} item(s); old local data was not uploaded.`,
        )
        return
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
        subscriptionMaxDevices: Number(result.subscription?.max_devices || 0),
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
          subscriptionMaxDevices: Number(pulledSnapshot.subscription?.max_devices || settings.subscriptionMaxDevices || 0),
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
      localStorage.setItem(change.key, JSON.stringify(change.value ?? null))

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
        case 'pos-dining-table-groups':
          {
            const nextGroups = normalizeDiningTableGroups(
              Array.isArray(change.value) ? (change.value as DiningTableGroup[]) : defaultDiningTableGroups,
            )
            setDiningTableGroups(nextGroups)
            setActiveTableGroupId((groupId) =>
              nextGroups.some((group) => group.id === groupId) ? groupId : (nextGroups[0]?.id ?? ''),
            )
          }
          break
        case 'pos-customers':
          setCustomers(Array.isArray(change.value) ? (change.value as CustomerProfile[]) : [])
          break
        case serviceStaffStorageKey:
          setServiceStaff(normalizeServiceStaff(Array.isArray(change.value) ? (change.value as ServiceStaff[]) : []))
          break
        case 'pos-menu-items':
          setMenuList(normalizeMenuItems(Array.isArray(change.value) ? (change.value as MenuItem[]) : defaultMenuItems))
          break
        case 'pos-orders':
          {
            const restoredOrders = Array.isArray(change.value)
              ? (change.value as SavedOrder[]).map(normalizeSavedOrderPayment)
              : []
            setSavedOrders(restoredOrders)
            setBillNumber(getInitialBillNumber(restoredOrders))
            setBillFinancialYear(getFinancialYearKey(new Date()))
          }
          break
        case openingCashStorageKey:
          setOpeningCashBalances(normalizeOpeningCashBalances(change.value as Record<string, number>))
          break
        case 'pos-expenses':
          setExpenses(normalizeExpenses(Array.isArray(change.value) ? (change.value as ExpenseEntry[]) : []))
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

    setMenuEditorOpen(false)
    setActiveView('menu')
    setItemDraft((draft) => ({
      ...draft,
      category: activeCategory === 'all' ? (editableCategories[0]?.id ?? 'all') : activeCategory,
    }))
  }

  function openTableSetup() {
    if (!requirePermission('menu_manage', 'Table setup permission required')) {
      return
    }

    setTableSetupOpen(true)
    if (!selectedTableSetupGroup && diningTableGroups[0]) {
      editTableGroup(diningTableGroups[0])
    }
  }

  function openPrinterManager() {
    if (!requirePermission('printer_manage', 'Printer manage permission required')) {
      return
    }

    setPrinterOpen(false)
    setActiveView('printers')
    refreshPrinters()
  }

  function editTableGroup(group: DiningTableGroup) {
    setEditingTableGroupId(group.id)
    setTableGroupName(group.label)
    setTableGroupTables(group.tables.join(', '))
  }

  function newTableGroupDraft() {
    setEditingTableGroupId(null)
    setTableGroupName('')
    setTableGroupTables('')
  }

  function saveTableGroup() {
    const label = tableGroupName.trim()
    const tables = parseDiningTableNames(tableGroupTables)

    if (!label) {
      setPrinterStatus('Enter table area name')
      return
    }

    if (!tables.length) {
      setPrinterStatus('Enter at least one table')
      return
    }

    const duplicateTable = tables.find((tableName) =>
      diningTableGroups.some((group) => group.id !== editingTableGroupId && group.tables.includes(tableName)),
    )

    if (duplicateTable) {
      setPrinterStatus(`${duplicateTable} already exists in another area`)
      return
    }

    if (editingTableGroupId) {
      setDiningTableGroups((groups) =>
        normalizeDiningTableGroups(
          groups.map((group) => (group.id === editingTableGroupId ? { ...group, label, tables } : group)),
        ),
      )
      setPrinterStatus(`${label} updated`)
      return
    }

    const newGroup: DiningTableGroup = {
      id: createDiningTableGroupId(label),
      label,
      tables,
    }
    setDiningTableGroups((groups) => normalizeDiningTableGroups([...groups, newGroup]))
    setEditingTableGroupId(newGroup.id)
    setActiveTableGroupId(newGroup.id)
    setPrinterStatus(`${label} added`)
  }

  function deleteTableGroup(groupId: string) {
    const group = diningTableGroups.find((savedGroup) => savedGroup.id === groupId)
    if (!group) {
      return
    }

    if (diningTableGroups.length <= 1) {
      setPrinterStatus('At least one table area is required')
      return
    }

    if (!window.confirm(`Delete ${group.label}?`)) {
      return
    }

    const nextGroups = diningTableGroups.filter((savedGroup) => savedGroup.id !== groupId)
    setDiningTableGroups(normalizeDiningTableGroups(nextGroups))
    setActiveTableGroupId(nextGroups[0]?.id ?? '')
    newTableGroupDraft()
    setPrinterStatus(`${group.label} deleted`)
  }

  function getTableQrUrl(tableName: string) {
    const baseUrl = localServerPrimaryUrl.replace(/\/+$/, '')
    return baseUrl ? `${baseUrl}/qr/${encodeURIComponent(tableName)}` : ''
  }

  async function openTableQrPreview(tableName: string) {
    if (!hasCloudFeatureAccess || !hasGoldLocalPlan) {
      setPrinterStatus('Table QR requires Gold plan with local POS server.')
      return
    }

    const url = getTableQrUrl(tableName)

    if (!tableList.some((savedTableName) => savedTableName.toLowerCase() === tableName.toLowerCase())) {
      setPrinterStatus('Save table area before generating QR')
      return
    }

    if (!url) {
      setPrinterStatus('Start Local Server before generating table QR')
      return
    }

    try {
      const dataUrl = await QRCodeGenerator.toDataURL(url, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      setTableQrPreview({ tableName, url, dataUrl })
      setPrinterStatus(`${tableName} QR ready`)
    } catch (error) {
      setPrinterStatus(`QR create failed: ${getErrorMessage(error)}`)
    }
  }

  function printTableQrPreview() {
    if (!tableQrPreview) {
      return
    }

    const printWindow = window.open('', '_blank', 'width=420,height=620')
    if (!printWindow) {
      setPrinterStatus('Print window blocked')
      return
    }

    printWindow.document.open()
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapePrintHtml(tableQrPreview.tableName)} QR</title>
          <style>
            @page { margin: 8mm; size: 80mm auto; }
            body { margin: 0; color: #111; font-family: Arial, sans-serif; text-align: center; }
            h1 { margin: 0 0 4px; font-size: 20px; }
            p { margin: 0 0 10px; font-size: 12px; font-weight: 700; }
            img { width: 260px; height: 260px; }
            .url { margin-top: 8px; overflow-wrap: anywhere; font-size: 10px; }
          </style>
        </head>
        <body>
          <h1>${escapePrintHtml(receiptBusinessName)}</h1>
          <p>Scan to order - ${escapePrintHtml(tableQrPreview.tableName)}</p>
          <img alt="" src="${tableQrPreview.dataUrl}" />
          <div class="url">${escapePrintHtml(tableQrPreview.url)}</div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    setPrinterStatus(`${tableQrPreview.tableName} QR opened for printing`)
  }

  function acceptQrOrder(qrOrder: QrPendingOrder, printKotAfterAccept = false) {
    if (!requirePermission('pos_access', 'POS permission required')) {
      return
    }

    let sourceOrders = savedOrders
    if (cart.length && activeSavedOrder?.status !== 'paid') {
      if (!ensureTableSelected()) {
        setPrinterStatus('Save or clear current bill before accepting QR order')
        return
      }
      const preservedOrder = saveCurrentOrder('unclosed')
      sourceOrders = [preservedOrder, ...savedOrders.filter((order) => order.id !== preservedOrder.id)]
    }

    const currentQrOrder = qrOrders.find((order) => order.id === qrOrder.id)
    if (!currentQrOrder || currentQrOrder.status !== 'pending') {
      setPrinterStatus('QR order already handled')
      return
    }

    const now = new Date().toISOString()
    const incomingCart = currentQrOrder.cart.map((line, index) => ({
      ...line,
      id: `line-${currentQrOrder.id}-${index}-${Date.now()}`,
      description: normalizeLineDescription(
        [line.description, index === 0 ? currentQrOrder.note : ''].filter(Boolean).join(' / '),
      ),
    }))
    const existingOrder = sourceOrders.find(
      (order) => order.status !== 'paid' && order.orderType === 'Dining' && getSavedOrderTables(order).includes(currentQrOrder.table),
    )
    const acceptedOrder = existingOrder
      ? {
          ...existingOrder,
          customer: existingOrder.customer || currentQrOrder.customerName,
          cart: mergeCartLines(existingOrder.cart, incomingCart),
          updatedAt: now,
        }
      : {
          id: createOrderId(),
          billNo: String(getInitialBillNumber(sourceOrders)),
          status: 'unclosed' as OrderStatus,
          orderType: 'Dining' as OrderType,
          table: currentQrOrder.table,
          seatingMode: 'individual' as SeatingMode,
          tables: [currentQrOrder.table],
          diningGroupName: '',
          customerId: undefined,
          customer: currentQrOrder.customerName,
          cart: incomingCart,
          discountMode: 'percent' as DiscountMode,
          discountPercent: 0,
          discountAmount: 0,
          servicePercent: 0,
          paymentMethod: 'Cash' as PaymentMethod,
          paymentBreakdown: { cash: 0, upi: 0, card: 0 },
          amountReceived: 0,
          totals: buildCartOnlyTotals(incomingCart),
          creditApplied: false,
          createdAt: now,
          updatedAt: now,
        }
    const orderWithTotals = {
      ...acceptedOrder,
      totals: buildCartOnlyTotals(acceptedOrder.cart),
    }

    setSavedOrders((orders) => [orderWithTotals, ...orders.filter((order) => order.id !== orderWithTotals.id)])
    setQrOrders((orders) =>
      orders.map((order) =>
        order.id === currentQrOrder.id ? { ...order, status: 'accepted', updatedAt: now } : order,
      ),
    )
    recordAudit('qr_order_accepted', `${currentQrOrder.table} QR order accepted`)
    loadOrder(orderWithTotals)
    setQrOrdersOpen(false)
    setActiveView('pos')
    setPrinterStatus(`QR order added to ${currentQrOrder.table}`)
    if (printKotAfterAccept) {
      setKotPrintOpen(true)
    }
  }

  function rejectQrOrder(qrOrder: QrPendingOrder) {
    if (!requirePermission('pos_access', 'POS permission required')) {
      return
    }

    if (!window.confirm(`Reject QR order from ${qrOrder.table}?`)) {
      return
    }

    const now = new Date().toISOString()
    setQrOrders((orders) =>
      orders.map((order) => (order.id === qrOrder.id ? { ...order, status: 'rejected', updatedAt: now } : order)),
    )
    recordAudit('qr_order_rejected', `${qrOrder.table} QR order rejected`)
    setPrinterStatus(`${qrOrder.table} QR order rejected`)
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
      setItemImageStatus('Uploaded image ready')
    } catch {
      setPrinterStatus('Could not load item photo')
    }
  }

  async function generateItemImage() {
    if (!requirePermission('menu_manage', 'Menu setup permission required')) {
      return
    }

    if (itemImageSearching) {
      return
    }

    const name = itemDraft.name.trim()
    if (!name) {
      setItemImageStatus('Enter item name before generating image')
      return
    }

    const nextVariant = generatedImageVariant + 1
    const categoryLabel = editableCategories.find((category) => category.id === itemDraft.category)?.label || itemDraft.category
    const tags = normalizeTags(itemDraft.tags)
    setGeneratedImageVariant(nextVariant)
    setItemImageSearching(true)
    setItemImageStatus(`Fetching Pinterest image for ${name}...`)

    try {
      const result = await window.posImages?.searchFoodImage({
        name,
        category: categoryLabel,
        tags,
        variant: nextVariant,
      })

      if (result?.ok && result.dataUrl) {
        setItemDraft((draft) => ({ ...draft, imageDataUrl: result.dataUrl || '' }))
        setItemImageStatus(result.title ? `Pinterest image: ${result.title}` : `Pinterest image ready for ${name}`)
        return
      }

      setItemImageStatus(
        result?.error
          ? `${result.error}. No image attached. Try a clearer food name or upload manually.`
          : 'No exact food image found. No image attached.',
      )
    } catch (error) {
      setItemImageStatus(`${getErrorMessage(error)}. No image attached.`)
    } finally {
      setItemImageSearching(false)
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
    if (!isMenuItemAvailable(item)) {
      setPrinterStatus(`${item.name} is unavailable${item.unavailableReason ? `: ${item.unavailableReason}` : ''}`)
      return
    }

    const itemPrice = roundMoney(Number(item.price || 0))

    if (itemPrice <= 0) {
      setPendingPriceItem(item)
      setPendingPriceValue('')
      setPrinterStatus(`Enter amount for ${item.name}`)
      return
    }

    addItemWithPrice(item, itemPrice)
  }

  function toggleMenuItemAvailability(itemId: string) {
    if (!requirePermission('menu_manage', 'Menu setup permission required')) {
      return
    }

    setMenuList((list) =>
      list.map((item) =>
        item.id === itemId
          ? {
              ...item,
              available: item.available === false,
              unavailableReason: item.available === false ? '' : item.unavailableReason,
            }
          : item,
      ),
    )
  }

  function addItemWithPrice(item: MenuItem, price: number, mergeSamePrice = true) {
    const itemPrice = roundMoney(Math.max(0, price))

    setCart((lines) => {
      const existing = mergeSamePrice
        ? lines.find((line) => line.itemId === item.id && line.price === itemPrice && !line.description)
        : null

      if (existing) {
        return lines.map((line) => (line.id === existing.id ? { ...line, qty: line.qty + 1 } : line))
      }

      return [
        ...lines,
        {
          id: `line-${item.id}-${Date.now()}`,
          itemId: item.id,
          name: item.name,
          category: item.category,
          price: itemPrice,
          qty: 1,
          taxRate: typeof item.taxRate === 'number' ? item.taxRate : (businessProfile.defaultGstRate ?? 0),
          discountMode: 'percent',
          discountPercent: 0,
          discountAmount: 0,
          description: '',
        },
      ]
    })

    if (orderType === 'Dining' && !table) {
      setTableSelectorOpen(true)
    }
  }

  function savePendingPriceItem() {
    if (!pendingPriceItem) {
      return
    }

    const itemPrice = roundMoney(numberFromInput(pendingPriceValue))

    if (itemPrice <= 0) {
      setPrinterStatus('Item amount is required')
      return
    }

    addItemWithPrice(pendingPriceItem, itemPrice, false)
    setPrinterStatus(`${pendingPriceItem.name} added`)
    setPendingPriceItem(null)
    setPendingPriceValue('')
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
        ? String(line.discountMode === 'amount' ? (line.discountAmount ?? 0) : (line.discountPercent ?? 0))
        : mode === 'price'
          ? String(line.price)
          : (line.description ?? '')

    setLineActionId(null)
    setLineEditor({ lineId: line.id, mode, value, discountMode: line.discountMode ?? 'percent' })
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
          const mode = lineEditor.discountMode ?? 'percent'
          const gross = Number(line.qty || 0) * Number(line.price || 0)
          return {
            ...line,
            discountMode: mode,
            discountPercent: mode === 'percent' ? clamp(numberFromInput(lineEditor.value), 0, 100) : 0,
            discountAmount: mode === 'amount' ? clamp(numberFromInput(lineEditor.value), 0, gross) : 0,
          }
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

    if (hasCurrentItems && !ensureServiceStaffSelected()) {
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
    setDiscountMode('percent')
    setDiscountPercent(0)
    setDiscountAmount(0)
    setServicePercent(0)
    setTaxExempt(false)
    setSelectedCustomerId('')
    setCustomer('')
    setCustomerPhone('')
    setCustomerAddress('')
    clearSelectedServiceStaff()
    setTable('')
    setSeatingMode('individual')
    setSelectedTables([])
    setDiningGroupName('')
    setPaymentMethod('Cash')
    setAmountReceivedOverride(null)
    setPartTenderMethod('upi')
    setOrderType('Dining')
    setActiveOrderId(createOrderId())
    if (advanceBill) {
      const currentFinancialYear = getFinancialYearKey(new Date())
      setBillFinancialYear(currentFinancialYear)
      setBillNumber((value) =>
        getNextBillNumber(
          savedOrdersRef.current,
          billFinancialYear === currentFinancialYear ? value : firstBillNumber - 1,
          new Date(),
        ),
      )
    }
  }

  function buildCurrentOrderSnapshot(status: OrderStatus, creditCustomer?: CustomerProfile) {
    const now = new Date().toISOString()
    const existingOrder = savedOrdersRef.current.find((order) => order.id === activeOrderId)
    const savedCustomerId = creditCustomer?.id ?? selectedCustomerId
    const savedCustomerName = creditCustomer?.name ?? customer
    const savedTables = getCurrentDiningTables(seatingMode, table, selectedTables)
    const savedTableLabel = getSeatingDisplayLabel(seatingMode, table, savedTables, diningGroupName)
    const shouldUseServiceStaff = appConfiguration.showServiceStaffSelector
    const savedServiceStaff = shouldUseServiceStaff ? (selectedServiceStaff ?? null) : null

    return {
      id: activeOrderId,
      billNo: String(billNumber),
      status,
      orderType,
      table: savedTableLabel,
      seatingMode,
      tables: [...savedTables],
      diningGroupName: seatingMode === 'group' ? diningGroupName.trim() : '',
      customerId: savedCustomerId || undefined,
      customer: savedCustomerName,
      serviceStaffId: shouldUseServiceStaff ? savedServiceStaff?.id || selectedServiceStaffId || undefined : undefined,
      serviceStaffName: shouldUseServiceStaff ? savedServiceStaff?.name || selectedServiceStaffName || '' : '',
      serviceStaffCode: shouldUseServiceStaff ? savedServiceStaff?.code || selectedServiceStaffCode || '' : '',
      cart: cart.map((line) => ({ ...line })),
      discountMode,
      discountPercent,
      discountAmount,
      servicePercent,
      taxExempt,
      paymentMethod,
      paymentBreakdown: { ...paymentBreakdown },
      amountReceived,
      totals: { ...totals },
      creditApplied: existingOrder?.creditApplied ?? false,
      createdAt: existingOrder?.createdAt ?? now,
      updatedAt: now,
    }
  }

  function upsertSavedOrder(order: SavedOrder, orders = savedOrdersRef.current) {
    const existingIndex = orders.findIndex((savedOrder) => savedOrder.id === order.id)

    if (existingIndex === -1) {
      return [order, ...orders]
    }

    return orders.map((savedOrder) => (savedOrder.id === order.id ? order : savedOrder))
  }

  async function persistLocalValueNow(key: string, value: unknown) {
    const serializedValue = JSON.stringify(value)
    localStorage.setItem(key, serializedValue)

    if (window.posDb) {
      await window.posDb.set(key, serializedValue)
    }
  }

  async function persistSavedOrdersNow(nextOrders: SavedOrder[]) {
    await persistLocalValueNow('pos-orders', nextOrders)
  }

  function saveCurrentOrder(status: OrderStatus, creditCustomer?: CustomerProfile) {
    const order = buildCurrentOrderSnapshot(status, creditCustomer)
    const nextOrders = upsertSavedOrder(order)

    savedOrdersRef.current = nextOrders
    setSavedOrders(nextOrders)
    void persistSavedOrdersNow(nextOrders).catch((error) => {
      setPrinterStatus(`Order save failed: ${getErrorMessage(error)}`)
    })

    return order
  }

  async function saveCurrentOrderDurable(status: OrderStatus, creditCustomer?: CustomerProfile) {
    const order = buildCurrentOrderSnapshot(status, creditCustomer)
    const nextOrders = upsertSavedOrder(order)

    savedOrdersRef.current = nextOrders
    setSavedOrders(nextOrders)
    await persistSavedOrdersNow(nextOrders)

    return order
  }

  async function savePaidOrder() {
    if (!cart.length) {
      setPrinterStatus('Add items before saving bill')
      return
    }

    if (!ensureTableSelected()) {
      return
    }

    if (!ensureServiceStaffSelected()) {
      return
    }

    const creditCustomer = ensureCreditCustomer()
    if (!creditCustomer) {
      return
    }

    setPrinterStatus('Saving bill...')
    try {
      const order = await saveCurrentOrderDurable('paid', creditCustomer === true ? undefined : creditCustomer)
      completeBill(order, 'saved')
    } catch (error) {
      setPrinterStatus(`Bill not saved: ${getErrorMessage(error)}`)
    }
  }

  function holdCurrentOrder() {
    if (!cart.length) {
      setPrinterStatus('Add items before holding order')
      return
    }

    if (!ensureTableSelected()) {
      return
    }

    if (!ensureServiceStaffSelected()) {
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
    setSeatingMode(order.seatingMode ?? 'individual')
    setSelectedTables(getSavedOrderTables(order))
    setDiningGroupName(order.diningGroupName ?? '')
    setSelectedCustomerId(order.customerId ?? '')
    setCustomer(order.customer)
    if (appConfiguration.showServiceStaffSelector) {
      setSelectedServiceStaffId(order.serviceStaffId ?? '')
      setSelectedServiceStaffName(order.serviceStaffName ?? '')
      setSelectedServiceStaffCode(order.serviceStaffCode ?? '')
    } else {
      clearSelectedServiceStaff()
    }
    setActiveTableGroupId(getTableGroupId(getSavedOrderTables(order)[0] ?? order.table, diningTableGroups))
    const savedCustomer = customers.find((profile) => profile.id === order.customerId)
    setCustomerPhone(savedCustomer?.phone ?? '')
    setCustomerAddress(savedCustomer?.address ?? '')
    setCart(order.cart)
    setDiscountMode(order.discountMode ?? 'percent')
    setDiscountPercent(order.discountPercent)
    setDiscountAmount(order.discountAmount ?? 0)
    setServicePercent(order.servicePercent)
    setTaxExempt(order.taxExempt ?? false)
    setPaymentMethod(order.paymentMethod)
    setAmountReceivedOverride(order.paymentBreakdown?.cash ?? order.amountReceived)
    setPartTenderMethod((order.paymentBreakdown?.card ?? 0) > (order.paymentBreakdown?.upi ?? 0) ? 'card' : 'upi')
    setOrderListMode(null)
    setTableSelectorOpen(false)
    setPrinterStatus(`Loaded bill ${order.billNo}`)
  }

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((ids) =>
      ids.includes(orderId) ? ids.filter((id) => id !== orderId) : [...ids, orderId],
    )
  }

  function toggleAllVisibleOrders() {
    setSelectedOrderIds(allVisibleOrdersSelected ? [] : visibleOrderIds)
  }

  function deleteSelectedOrders() {
    if (!requirePermission('order_delete', 'Delete order permission required')) {
      return
    }

    if (!selectedVisibleOrders.length) {
      setPrinterStatus('Select orders to delete')
      return
    }

    const billList = selectedVisibleOrders
      .map((order) => `#${order.billNo}`)
      .slice(0, 6)
      .join(', ')
    const extraCount = Math.max(0, selectedVisibleOrders.length - 6)
    const label = `${selectedVisibleOrders.length} order(s) (${billList}${extraCount ? ` +${extraCount} more` : ''})`

    if (!window.confirm(`Delete selected ${label}? This cannot be undone.`)) {
      return
    }

    const selectedIds = new Set(selectedVisibleOrders.map((order) => order.id))
    setSavedOrders((orders) => orders.filter((order) => !selectedIds.has(order.id)))
    setSelectedOrderIds([])
    recordAudit('orders_deleted', `${label} deleted / ${money(selectedOrdersTotal)}`)
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
    setSeatingMode('individual')
    setTable(tableNo)
    setSelectedTables([tableNo])
    setDiningGroupName('')
    setActiveTableGroupId(getTableGroupId(tableNo, diningTableGroups))
    setTableSelectorOpen(false)
    if (appConfiguration.showServiceStaffSelector) {
      openStaffCodePrompt()
    } else {
      clearSelectedServiceStaff()
    }
    setPrinterStatus(`${tableNo} selected`)
  }

  function toggleGroupTable(tableNo: string) {
    const tableOrder = tableStatus.get(tableNo)
    if (tableOrder && tableOrder.id !== activeOrderId) {
      setPrinterStatus(`${tableNo} already has bill ${tableOrder.billNo}`)
      return
    }

    setSelectedTables((tables) =>
      tables.includes(tableNo) ? tables.filter((savedTable) => savedTable !== tableNo) : [...tables, tableNo],
    )
  }

  function saveGroupedTables() {
    if (selectedTables.length < 2) {
      setPrinterStatus('Select two or more tables for group dining')
      return
    }

    const sortedTables = sortTablesByLayout(selectedTables, tableList)
    const label = getSeatingDisplayLabel('group', table, sortedTables, diningGroupName)
    setOrderType('Dining')
    setSeatingMode('group')
    setSelectedTables(sortedTables)
    setTable(label)
    setTableSelectorOpen(false)
    if (appConfiguration.showServiceStaffSelector) {
      openStaffCodePrompt()
    } else {
      clearSelectedServiceStaff()
    }
    setPrinterStatus(`${label} selected`)
  }

  function openStaffCodePrompt() {
    setStaffCodeInput('')
    setStaffCodeStatus(activeServiceStaff.length ? 'Enter staff code for this table' : 'Add service staff before billing')
    setStaffCodePromptOpen(true)
  }

  function selectServiceStaffForBill(staffMember: ServiceStaff) {
    setSelectedServiceStaffId(staffMember.id)
    setSelectedServiceStaffName(staffMember.name)
    setSelectedServiceStaffCode(staffMember.code)
    setStaffCodeInput(staffMember.code)
    setStaffCodePromptOpen(false)
    setStaffCodeStatus('')
    setPrinterStatus(`${staffMember.name} selected`)
  }

  function applyStaffCode() {
    const code = normalizeStaffCode(staffCodeInput)
    if (!code) {
      setStaffCodeStatus('Enter staff code')
      return
    }

    const matchedStaff = activeServiceStaff.find((staffMember) => normalizeStaffCode(staffMember.code) === code)
    if (!matchedStaff) {
      setStaffCodeStatus('Staff code not found')
      return
    }

    selectServiceStaffForBill(matchedStaff)
  }

  function ensureTableSelected() {
    if (orderType === 'Dining' && seatingMode === 'group' && selectedTables.length < 2) {
      setTableSelectorOpen(true)
      setPrinterStatus('Select two or more tables for group dining')
      return false
    }

    if (orderType === 'Dining' && !getSeatingDisplayLabel(seatingMode, table, selectedTables, diningGroupName)) {
      setTableSelectorOpen(true)
      setPrinterStatus('Select table before continuing')
      return false
    }

    return true
  }

  function ensureServiceStaffSelected() {
    if (!appConfiguration.showServiceStaffSelector) {
      return true
    }

    if (orderType !== 'Dining') {
      return true
    }

    if (selectedServiceStaffName.trim()) {
      return true
    }

    openStaffCodePrompt()
    setPrinterStatus('Enter service staff code before continuing')
    return false
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
    setStaffCodePromptOpen(false)
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
      ? customersRef.current.find((profile) => profile.id === selectedCustomerId)
      : customersRef.current.find(
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

    const nextCustomers = existing
      ? customersRef.current.map((customerProfile) => (customerProfile.id === existing.id ? profile : customerProfile))
      : [profile, ...customersRef.current]

    customersRef.current = nextCustomers
    setCustomers(nextCustomers)
    void persistLocalValueNow('pos-customers', nextCustomers).catch((error) => {
      setPrinterStatus(`Customer save failed: ${getErrorMessage(error)}`)
    })
    setSelectedCustomerId(profile.id)
    setCustomer(profile.name)
    setCustomerPhone(profile.phone)
    setCustomerAddress(profile.address)
    setCustomerDetailEditing(false)
    setPrinterStatus(`${profile.name} customer profile saved`)

    return profile
  }

  function selectCustomerProfile(profile: CustomerProfile) {
    setSelectedCustomerId(profile.id)
    setCustomer(profile.name)
    setCustomerPhone(profile.phone)
    setCustomerAddress(profile.address)
    setCustomerDetailEditing(false)
  }

  function editCustomerProfile(profile: CustomerProfile) {
    setSelectedCustomerId(profile.id)
    setCustomer(profile.name)
    setCustomerPhone(profile.phone)
    setCustomerAddress(profile.address)
    setCustomerDetailEditing(true)
  }

  function clearCustomerProfile() {
    setSelectedCustomerId('')
    setCustomer('')
    setCustomerPhone('')
    setCustomerAddress('')
    setCustomerDetailEditing(true)
  }

  function markSelectedCustomerDuePaid() {
    if (!requirePermission('due_manage', 'Due management permission required')) {
      return
    }

    if (!selectedCustomerProfile || selectedCustomerProfile.creditBalance <= 0) {
      return
    }

    const nextCustomers = customersRef.current.map((profile) =>
      profile.id === selectedCustomerProfile.id
        ? { ...profile, creditBalance: 0, updatedAt: new Date().toISOString() }
        : profile,
    )
    customersRef.current = nextCustomers
    setCustomers(nextCustomers)
    void persistLocalValueNow('pos-customers', nextCustomers).catch((error) => {
      setPrinterStatus(`Customer due save failed: ${getErrorMessage(error)}`)
    })
    setPrinterStatus(`${selectedCustomerProfile.name} due marked as paid`)
    recordAudit('due_marked_paid', `${selectedCustomerProfile.name} due marked as paid`)
  }

  function applyCustomerCredit(order: SavedOrder) {
    if (order.creditApplied || order.status !== 'paid' || order.totals.balance <= 0 || !order.customerId) {
      return
    }

    const nextCustomers = customersRef.current.map((profile) =>
      profile.id === order.customerId
        ? {
            ...profile,
            creditBalance: roundMoney(profile.creditBalance + order.totals.balance),
            totalCredit: roundMoney(profile.totalCredit + order.totals.balance),
            updatedAt: new Date().toISOString(),
          }
        : profile,
    )
    const nextOrders = savedOrdersRef.current.map((savedOrder) =>
      savedOrder.id === order.id ? { ...savedOrder, creditApplied: true } : savedOrder,
    )

    customersRef.current = nextCustomers
    savedOrdersRef.current = nextOrders
    setCustomers(nextCustomers)
    setSavedOrders(nextOrders)
    void Promise.all([persistLocalValueNow('pos-customers', nextCustomers), persistSavedOrdersNow(nextOrders)]).catch((error) => {
      setPrinterStatus(`Customer credit save failed: ${getErrorMessage(error)}`)
    })
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
    const priceInput = itemDraft.price.trim()
    const price = Number(priceInput)
    const category = itemDraft.category || editableCategories[0]?.id || 'all'
    const tags = normalizeTags(itemDraft.tags)
    const imageDataUrl = itemDraft.imageDataUrl || undefined
    const available = itemDraft.available
    const unavailableReason = itemDraft.available ? undefined : itemDraft.unavailableReason.trim() || undefined

    if (!name) {
      setPrinterStatus('Enter item name')
      return
    }

    if (!priceInput || !Number.isFinite(price) || price < 0) {
      setPrinterStatus('Enter item price, or 0 for open price')
      return
    }

    const itemPrice = roundMoney(price)
    const taxRate = itemDraft.taxRate.trim() === '' ? businessProfile.defaultGstRate : (Number(itemDraft.taxRate) || 0)

    if (editingItemId) {
      setMenuList((list) =>
        list.map((item) =>
          item.id === editingItemId
            ? { ...item, name, price: itemPrice, category, tags, imageDataUrl, available, unavailableReason, taxRate }
            : item,
        ),
      )
    } else {
      const id = makeUniqueId(name, menuList.map((item) => item.id))
      setMenuList((list) => [...list, { id, name, category, price: itemPrice, tags, imageDataUrl, available, unavailableReason, taxRate }])
      setActiveCategory(category)
    }

    resetItemDraft(category)
  }

  function editMenuItem(item: MenuItem) {
    setEditingItemId(item.id)
    setGeneratedImageVariant(0)
    setItemImageStatus(item.imageDataUrl ? 'Current item image loaded' : '')
    setItemDraft({
      name: item.name,
      category: item.category,
      price: String(item.price),
      tags: item.tags?.join(', ') ?? '',
      imageDataUrl: item.imageDataUrl ?? '',
      available: item.available !== false,
      unavailableReason: item.unavailableReason ?? '',
      taxRate: String(item.taxRate ?? 0),
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
    setGeneratedImageVariant(0)
    setItemImageStatus('')
    setItemImagePreviewOpen(false)
    setItemDraft({
      name: '',
      category,
      price: '',
      tags: '',
      imageDataUrl: '',
      available: true,
      unavailableReason: '',
      taxRate: '',
    })
  }

  function saveExpense() {
    if (!requirePermission('expense_manage', 'Expense permission required')) {
      return
    }

    const amount = roundMoney(numberFromInput(expenseDraft.amount))
    const category = expenseDraft.category.trim() || 'Other'
    const expenseDate = parseDateInputValue(expenseDraft.date, new Date())

    if (amount <= 0) {
      setExpenseStatus('Enter expense amount')
      return
    }

    const now = new Date().toISOString()
    const nextExpense: ExpenseEntry = {
      id: editingExpenseId ?? createExpenseId(),
      date: formatDateInputValue(expenseDate),
      category,
      amount,
      paymentMethod: expenseDraft.paymentMethod,
      vendor: expenseDraft.vendor.trim(),
      note: expenseDraft.note.trim(),
      createdBy: currentUser?.name ?? 'Owner',
      createdAt: editingExpenseId ? (expenses.find((expense) => expense.id === editingExpenseId)?.createdAt ?? now) : now,
      updatedAt: now,
    }

    setExpenses((list) => {
      if (editingExpenseId) {
        return list.map((expense) => (expense.id === editingExpenseId ? nextExpense : expense))
      }

      return [nextExpense, ...list]
    })
    setExpenseStatus(`${category} expense saved`)
    recordAudit(editingExpenseId ? 'expense_updated' : 'expense_created', `${category} ${money(amount)}`)
    resetExpenseDraft()
  }

  function editExpense(expense: ExpenseEntry) {
    if (!requirePermission('expense_manage', 'Expense permission required')) {
      return
    }

    setEditingExpenseId(expense.id)
    setExpenseDraft({
      date: expense.date,
      category: expense.category,
      amount: String(expense.amount),
      paymentMethod: expense.paymentMethod,
      vendor: expense.vendor,
      note: expense.note,
    })
    setExpenseStatus(`Editing ${expense.category}`)
  }

  function deleteExpense(expenseId: string) {
    if (!requirePermission('expense_manage', 'Expense permission required')) {
      return
    }

    const expense = expenses.find((entry) => entry.id === expenseId)
    if (!expense || !window.confirm(`Delete expense ${expense.category} ${money(expense.amount)}?`)) {
      return
    }

    setExpenses((list) => list.filter((entry) => entry.id !== expenseId))
    setExpenseStatus('Expense deleted')
    recordAudit('expense_deleted', `${expense.category} ${money(expense.amount)}`)
    if (editingExpenseId === expenseId) {
      resetExpenseDraft()
    }
  }

  function resetExpenseDraft() {
    setEditingExpenseId(null)
    setExpenseDraft({
      date: formatDateInputValue(new Date()),
      category: expenseCategories[0],
      amount: '',
      paymentMethod: 'Cash',
      vendor: '',
      note: '',
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
    const baseProfile = activePrinterDraft ?? activePrinterProfile
    if (!baseProfile) {
      return
    }

    setPrinterDraftProfile((draft) => {
      const baseDraft = draft ?? createPrinterEditDraft(baseProfile)
      return {
        ...baseDraft,
        settings: normalizePrinterSettings({ ...baseDraft.settings, ...next }),
        updatedAt: new Date().toISOString(),
      }
    })
  }

  function updateActivePrinterProfileName(name: string) {
    const baseProfile = activePrinterDraft ?? activePrinterProfile
    if (!baseProfile) {
      return
    }

    setPrinterDraftProfile((draft) => {
      const baseDraft = draft ?? createPrinterEditDraft(baseProfile)
      return { ...baseDraft, name, updatedAt: new Date().toISOString() }
    })
  }

  function toggleActivePrinterCategory(categoryId: string) {
    const baseProfile = activePrinterDraft ?? activePrinterProfile
    if (!baseProfile) {
      return
    }

    const nextCategoryIds = baseProfile.categoryIds.includes(categoryId)
      ? baseProfile.categoryIds.filter((id) => id !== categoryId)
      : [...baseProfile.categoryIds, categoryId]

    setPrinterDraftProfile((draft) => {
      const baseDraft = draft ?? createPrinterEditDraft(baseProfile)
      return { ...baseDraft, categoryIds: uniqueStrings(nextCategoryIds), updatedAt: new Date().toISOString() }
    })
  }

  function addActivePrinterCategoryRoute() {
    const baseProfile = activePrinterDraft ?? activePrinterProfile
    if (!baseProfile) {
      return
    }

    const categoryId =
      printerRouteCategoryId ||
      editableCategories.find((category) => !baseProfile.categoryIds.includes(category.id))?.id ||
      ''

    if (!categoryId) {
      setPrinterStatus('No category available to add')
      return
    }

    if (baseProfile.categoryIds.includes(categoryId)) {
      setPrinterStatus(`${getCategoryDisplayLabel(categoryId, categoryList)} already added`)
      return
    }

    setPrinterDraftProfile((draft) => {
      const baseDraft = draft ?? createPrinterEditDraft(baseProfile)
      return {
        ...baseDraft,
        categoryIds: uniqueStrings([...baseDraft.categoryIds, categoryId]),
        updatedAt: new Date().toISOString(),
      }
    })
    setPrinterRouteCategoryId('')
    setPrinterStatus(`${getCategoryDisplayLabel(categoryId, categoryList)} added. Press Save to apply.`)
  }

  function toggleActivePrinterTableGroup(groupId: string) {
    const baseProfile = activePrinterDraft ?? activePrinterProfile
    if (!baseProfile) {
      return
    }

    const nextTableGroupIds = baseProfile.tableGroupIds.includes(groupId)
      ? baseProfile.tableGroupIds.filter((id) => id !== groupId)
      : [...baseProfile.tableGroupIds, groupId]

    setPrinterDraftProfile((draft) => {
      const baseDraft = draft ?? createPrinterEditDraft(baseProfile)
      return { ...baseDraft, tableGroupIds: uniqueStrings(nextTableGroupIds), updatedAt: new Date().toISOString() }
    })
  }

  function addActivePrinterTableGroupRoute() {
    const baseProfile = activePrinterDraft ?? activePrinterProfile
    if (!baseProfile) {
      return
    }

    const groupId =
      printerRouteTableGroupId ||
      diningTableGroups.find((group) => !baseProfile.tableGroupIds.includes(group.id))?.id ||
      ''

    if (!groupId) {
      setPrinterStatus('No table group available to add')
      return
    }

    if (baseProfile.tableGroupIds.includes(groupId)) {
      setPrinterStatus(`${diningTableGroups.find((group) => group.id === groupId)?.label || 'Table group'} already added`)
      return
    }

    setPrinterDraftProfile((draft) => {
      const baseDraft = draft ?? createPrinterEditDraft(baseProfile)
      return {
        ...baseDraft,
        tableGroupIds: uniqueStrings([...baseDraft.tableGroupIds, groupId]),
        updatedAt: new Date().toISOString(),
      }
    })
    setPrinterRouteTableGroupId('')
    setPrinterStatus(`${diningTableGroups.find((group) => group.id === groupId)?.label || 'Table group'} added. Press Save to apply.`)
  }

  function openNewPrinterConfiguration() {
    const defaultPrinter = printers.find((printer) => printer.isDefault) ?? printers[0]
    const profileName = `Printer ${printerProfiles.length + 1}`
    const profile: PrinterProfile = {
      id: createPrinterProfileId(),
      name: profileName,
      settings: normalizePrinterSettings({
        ...defaultPrinterSettings,
        deviceName: defaultPrinter?.name ?? '',
      }),
      categoryIds: [],
      tableGroupIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setActivePrinterProfileId(profile.id)
    setPrinterDraftProfile(createPrinterEditDraft(profile))
    setPendingNewPrinterId(profile.id)
    setPrinterRouteCategoryId('')
    setPrinterRouteTableGroupId('')
    setPrinterStatus('Configure printer details and press Save')
    setActiveView('printer_config')
  }

  function closePrinterConfiguration() {
    if (pendingNewPrinterId || printerDraftProfile) {
      setActivePrinterProfileId(billPrinterProfile?.id ?? defaultBillPrinterProfileId)
      setPendingNewPrinterId('')
      setPrinterDraftProfile(null)
      setPrinterRouteCategoryId('')
      setPrinterRouteTableGroupId('')
      setPrinterStatus(pendingNewPrinterId ? 'New printer setup cancelled' : 'Printer changes discarded')
    }

    setActiveView('printers')
  }

  function saveActivePrinterProfile() {
    const profileToSave = printerDraftProfile ?? activePrinterProfile
    if (!profileToSave) {
      setPrinterStatus('Select printer profile')
      return
    }

    const name = profileToSave.name.trim()
    if (!name) {
      setPrinterStatus('Enter printer name')
      return
    }

    if (!activePrinterSettings.deviceName) {
      setPrinterStatus('Select installed printer')
      return
    }

    setPrinterProfiles((profiles) =>
      profiles.some((profile) => profile.id === profileToSave.id)
        ? profiles.map((profile) =>
            profile.id === profileToSave.id
              ? {
                  ...profileToSave,
                  name,
                  settings: normalizePrinterSettings({
                    ...profileToSave.settings,
                    mode: 'system',
                    printMethod: 'driver',
                  }),
                  categoryIds: uniqueStrings(profileToSave.categoryIds),
                  tableGroupIds: uniqueStrings(profileToSave.tableGroupIds),
                  updatedAt: new Date().toISOString(),
                }
              : profile,
          )
        : [
            ...profiles,
            {
              ...profileToSave,
              name,
              settings: normalizePrinterSettings({
                ...profileToSave.settings,
                mode: 'system',
                printMethod: 'driver',
              }),
              categoryIds: uniqueStrings(profileToSave.categoryIds),
              tableGroupIds: uniqueStrings(profileToSave.tableGroupIds),
              updatedAt: new Date().toISOString(),
            },
          ],
    )
    setActivePrinterProfileId(profileToSave.id)
    setPrinterDraftProfile(null)
    setPendingNewPrinterId('')
    setPrinterStatus(`${name} printer saved`)
    setActiveView('printers')
  }

  function deleteActivePrinterProfile() {
    const profileToDelete = activePrinterDraft ?? activePrinterProfile
    if (!profileToDelete) {
      setPrinterStatus('Select printer profile')
      return
    }

    if (pendingNewPrinterId === profileToDelete.id) {
      setPrinterDraftProfile(null)
      setPendingNewPrinterId('')
      setActivePrinterProfileId(billPrinterProfile?.id ?? defaultBillPrinterProfileId)
      setPrinterStatus('New printer setup cancelled')
      setActiveView('printers')
      return
    }

    deletePrinterProfile(profileToDelete.id)
  }

  function deletePrinterProfile(profileId: string) {
    const profileToDelete = printerProfiles.find((profile) => profile.id === profileId)
    if (!profileToDelete || profileToDelete.id === billPrinterProfile?.id) {
      setPrinterStatus('Bill printer profile cannot be deleted')
      return
    }

    if (!window.confirm(`Remove printer "${profileToDelete.name}"?`)) {
      return
    }

    setPrinterProfiles((profiles) => profiles.filter((profile) => profile.id !== profileToDelete.id))
    setActivePrinterProfileId(billPrinterProfile?.id ?? defaultBillPrinterProfileId)
    if (pendingNewPrinterId === profileToDelete.id) {
      setPendingNewPrinterId('')
    }
    if (printerDraftProfile?.id === profileToDelete.id) {
      setPrinterDraftProfile(null)
      setActiveView('printers')
    }
    setPrinterStatus(`${profileToDelete.name} printer profile removed`)
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

        if (!ensureServiceStaffSelected()) {
          return
        }

        const creditCustomer = ensureCreditCustomer()
        if (!creditCustomer) {
          return
        }

        try {
          const order = await saveCurrentOrderDurable('paid', creditCustomer === true ? undefined : creditCustomer)
          completeBill(order, 'printed')
        } catch (error) {
          setPrinterStatus(`Bill not saved. Print stopped: ${getErrorMessage(error)}`)
          return
        }
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

    if (!ensureServiceStaffSelected()) {
      return
    }

    const creditCustomer = saveBeforePrint ? ensureCreditCustomer() : true
    if (!creditCustomer) {
      return
    }

    if (saveBeforePrint) {
      setPrinterStatus('Saving and printing receipt...')
    } else {
      setPrinterStatus('Printing receipt...')
    }

    let order: SavedOrder | null = null
    if (saveBeforePrint) {
      try {
        order =
          creditCustomer !== true
            ? await saveCurrentOrderDurable('paid', creditCustomer)
            : await saveCurrentOrderDurable('paid')
      } catch (error) {
        setPrinterStatus(`Bill not saved. Print stopped: ${getErrorMessage(error)}`)
        return
      }
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

  async function printKot(profileId: string, kotItems = cart) {
    const profile = profileId === activePrinterDraft?.id ? activePrinterDraft : printerProfiles.find((savedProfile) => savedProfile.id === profileId)
    if (!profile) {
      setPrinterStatus('Select printer profile')
      return
    }

    if (!window.posPrinter) {
      setPrinterStatus('Run inside desktop app for KOT printer')
      return
    }

    if (!kotItems.length) {
      setPrinterStatus('Add items before printing KOT')
      return
    }

    if (!ensureTableSelected()) {
      return
    }

    if (!ensureServiceStaffSelected()) {
      return
    }

    if (activeSavedOrder?.status !== 'paid') {
      saveCurrentOrder('unclosed')
    }

    setPrinterStatus(`Printing ${profile.name} KOT...`)
    try {
      await window.posPrinter.printKot({
        settings: profile.settings,
        kot: buildKotOrder(profile.name, kotItems),
      })
      setKotPrintOpen(false)
      setPrinterStatus(`${profile.name} KOT sent`)
    } catch (error) {
      setPrinterStatus(getErrorMessage(error))
    }
  }

  async function printKotByRouting() {
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

    if (!ensureServiceStaffSelected()) {
      return
    }

    if (activeSavedOrder?.status !== 'paid') {
      saveCurrentOrder('unclosed')
    }

    const routeGroups = buildKotRouteGroups(cart)
    if (!routeGroups.length) {
      setPrinterStatus('No KOT printer route found')
      return
    }

    setPrinterStatus(`Printing KOT to ${routeGroups.length} printer(s)...`)
    try {
      for (const routeGroup of routeGroups) {
        await window.posPrinter.printKot({
          settings: routeGroup.profile.settings,
          kot: buildKotOrder(routeGroup.profile.name, routeGroup.lines),
        })
      }
      setKotPrintOpen(false)
      const itemCount = routeGroups.reduce((total, routeGroup) => total + routeGroup.lines.length, 0)
      setPrinterStatus(`KOT sent: ${itemCount} item(s) routed to ${routeGroups.length} printer(s)`)
    } catch (error) {
      setPrinterStatus(getErrorMessage(error))
    }
  }

  async function testPrinter(profileId = activePrinterDraft?.id) {
    if (!window.posPrinter) {
      setPrinterStatus('Run inside desktop app for printers')
      return
    }

    const profile = profileId === activePrinterDraft?.id ? activePrinterDraft : printerProfiles.find((savedProfile) => savedProfile.id === profileId)
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

  async function testKotPrinter(profileId = activePrinterDraft?.id) {
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

  function buildKotRouteGroups(kotItems: CartLine[]) {
    const routeMap = new Map<string, { profile: PrinterProfile; lines: CartLine[] }>()
    const currentTables = getCurrentDiningTables(seatingMode, table, selectedTables)
    const currentTableGroupIds = diningTableGroups
      .filter((group) => group.tables.some((tableName) => currentTables.includes(tableName)))
      .map((group) => group.id)
    const fallbackProfile = billPrinterProfile ?? printerProfiles[0]

    function findBestRouteProfile(categoryId: string) {
      let bestProfile: PrinterProfile | undefined
      let bestScore = 0

      printerProfiles.forEach((profile) => {
        if (!profile.categoryIds.includes(categoryId)) {
          return
        }

        const hasTableGroupRule = profile.tableGroupIds.length > 0
        const tableGroupMatches =
          !hasTableGroupRule || profile.tableGroupIds.some((groupId) => currentTableGroupIds.includes(groupId))

        if (!tableGroupMatches) {
          return
        }

        const score = hasTableGroupRule ? 2 : 1
        if (score > bestScore) {
          bestProfile = profile
          bestScore = score
        }
      })

      return bestProfile
    }

    kotItems.forEach((line) => {
      const categoryId = getCartLineCategoryId(line, menuList)
      const matchingProfile = findBestRouteProfile(categoryId) ?? fallbackProfile

      if (!matchingProfile) {
        return
      }

      const existing = routeMap.get(matchingProfile.id)
      if (existing) {
        existing.lines.push(line)
      } else {
        routeMap.set(matchingProfile.id, { profile: matchingProfile, lines: [line] })
      }
    })

    return printerProfiles
      .map((profile) => routeMap.get(profile.id))
      .filter((routeGroup): routeGroup is { profile: PrinterProfile; lines: CartLine[] } => Boolean(routeGroup))
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
      table: getSeatingDisplayLabel(seatingMode, table, selectedTables, diningGroupName),
      customer,
      cashier: receiptCashierName,
      serviceStaffName: appConfiguration.showServiceStaffSelector ? selectedServiceStaffName : '',
      serviceStaffCode: appConfiguration.showServiceStaffSelector ? selectedServiceStaffCode : '',
      paymentMethod,
      paymentBreakdown,
      items: cart.map((line) => ({
        name: line.name,
        qty: line.qty,
        price: line.price,
        total: lineTotal(line),
        description: line.description ?? '',
        discountMode: line.discountMode ?? 'percent',
        discountPercent: line.discountPercent ?? 0,
        discountAmount: line.discountAmount ?? 0,
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      discountMode,
      discountPercent,
      discountAmount,
      tax: totals.tax,
      taxExempt,
      serviceCharge: totals.serviceCharge,
      total: totals.total,
      paid: totals.paid,
      balance: totals.balance,
      change: totals.change,
      createdAt: new Date().toISOString(),
    }
  }

  function buildKotOrder(station: string, kotItems = cart) {
    return {
      billNo: String(billNumber),
      station,
      orderType,
      table: getSeatingDisplayLabel(seatingMode, table, selectedTables, diningGroupName),
      customer,
      cashier: receiptCashierName,
      serviceStaffName: appConfiguration.showServiceStaffSelector ? selectedServiceStaffName : '',
      serviceStaffCode: appConfiguration.showServiceStaffSelector ? selectedServiceStaffCode : '',
      items: kotItems.map((line) => ({
        name: line.name,
        qty: line.qty,
        description: line.description ?? '',
      })),
      createdAt: new Date().toISOString(),
    }
  }

  function buildReportPrintPayload(
    reportData: ReturnType<typeof buildReport>,
    period: ReportPeriod,
    title: string,
    openingCash = 0,
  ): ReportPrintPayload {
    return {
      settings: billPrinterSettings,
      report: {
        title,
        periodLabel: period.label,
        generatedAt: new Date().toISOString(),
        business: {
          name: receiptBusinessName,
          branch: businessProfile.branch.trim(),
          phone: businessProfile.phone.trim(),
        },
        salesTotal: reportData.salesTotal,
        receivedTotal: reportData.receivedTotal,
        paidCount: reportData.paidCount,
        openingCash,
        cashReceivedTotal: reportData.cashReceivedTotal,
        cashInHand: roundMoney(openingCash + reportData.cashInHand),
        upiTotal: reportData.upiTotal,
        cardTotal: reportData.cardTotal,
        bankReceivedTotal: reportData.bankReceivedTotal,
        bankTotal: reportData.bankTotal,
        balanceTotal: reportData.balanceTotal,
        discountTotal: reportData.discountTotal,
        expenseTotal: reportData.expenseTotal,
        cashExpenseTotal: reportData.cashExpenseTotal,
        bankExpenseTotal: reportData.bankExpenseTotal,
        netTotal: reportData.netTotal,
        openTotal: reportData.openTotal,
        openCount: reportData.openCount,
        orderTypeRows: orderTypes.map((type) => ({
          label: type,
          count: reportData.orderTypeTotals[type].count,
          total: reportData.orderTypeTotals[type].total,
        })),
      },
    }
  }

  async function printSelectedDateReport() {
    if (!requirePermission('reports', 'Report permission required')) {
      return
    }

    const printDate = parseDateInputValue(reportPrintDate, new Date())
    const dailyPeriod = getDailyReportPeriod(printDate)
    const dailyReport = buildReport(savedOrders, dailyPeriod, expenses)
    const isToday = formatDateInputValue(printDate) === formatDateInputValue(new Date())
    const title = isToday ? 'Today Sales Report' : `Daily Sales Report - ${formatDate(printDate)}`
    const payload = buildReportPrintPayload(
      dailyReport,
      dailyPeriod,
      title,
      openingCashBalances[formatDateInputValue(printDate)] ?? 0,
    )

    try {
      setPrinterStatus('Printing report...')
      if (window.posPrinter?.printReport) {
        await window.posPrinter.printReport(payload)
        setPrinterStatus('Report sent to bill printer')
        return
      }

      printReportInBrowser(payload)
      setPrinterStatus('Report opened for printing')
    } catch (error) {
      setPrinterStatus(getErrorMessage(error))
    }
  }

  async function printPreviousDayReport() {
    if (!requirePermission('reports', 'Report permission required')) {
      return
    }

    const yesterday = addDays(new Date(), -1)
    const yesterdayDateValue = formatDateInputValue(yesterday)
    setReportPrintDate(yesterdayDateValue)
    const yesterdayPeriod = getDailyReportPeriod(yesterday)
    const yesterdayReport = buildReport(savedOrders, yesterdayPeriod, expenses)
    const title = `Previous Day Report - ${formatDate(yesterday)}`
    const payload = buildReportPrintPayload(
      yesterdayReport,
      yesterdayPeriod,
      title,
      openingCashBalances[yesterdayDateValue] ?? 0,
    )

    try {
      setPrinterStatus('Printing previous day report...')
      if (window.posPrinter?.printReport) {
        await window.posPrinter.printReport(payload)
        setPrinterStatus('Previous day report sent to bill printer')
        return
      }

      printReportInBrowser(payload)
      setPrinterStatus('Previous day report opened for printing')
    } catch (error) {
      setPrinterStatus(getErrorMessage(error))
    }
  }

  async function printCurrentPeriodReport() {
    if (!requirePermission('reports', 'Report permission required')) {
      return
    }

    const payload = buildReportPrintPayload(periodReport, reportPeriod, `Sales Report - ${periodReport.periodLabel}`, periodOpeningCash)

    try {
      setPrinterStatus('Printing period report...')
      if (window.posPrinter?.printReport) {
        await window.posPrinter.printReport(payload)
        setPrinterStatus('Period report sent to bill printer')
        return
      }

      printReportInBrowser(payload)
      setPrinterStatus('Period report opened for printing')
    } catch (error) {
      setPrinterStatus(getErrorMessage(error))
    }
  }

  async function exportCurrentPeriodReport(format: 'csv' | 'excel' | 'pdf') {
    if (!requirePermission('reports', 'Report permission required')) {
      return
    }

    const exportData: ReportExportData = {
      reportData: periodReport,
      period: reportPeriod,
      orders: periodReportOrders,
      expenses: periodReportExpenses,
      businessProfile,
      businessName: receiptBusinessName,
      generatedAt: new Date().toISOString(),
      openingCash: periodOpeningCash,
    }
    const baseFileName = buildReportExportFileName(exportData)

    try {
      if (format === 'csv') {
        downloadTextFile(`${baseFileName}.csv`, buildReportCsv(exportData), 'text/csv;charset=utf-8')
        setPrinterStatus('CSV report exported')
        return
      }

      if (format === 'excel') {
        downloadTextFile(
          `${baseFileName}.xls`,
          buildReportExportHtml(exportData, 'excel'),
          'application/vnd.ms-excel;charset=utf-8',
        )
        setPrinterStatus('Excel report exported')
        return
      }

      const html = buildReportExportHtml(exportData, 'pdf')
      if (window.posPrinter?.exportReportPdf) {
        const result = await window.posPrinter.exportReportPdf({ html, defaultFileName: `${baseFileName}.pdf` })
        setPrinterStatus(result.canceled ? 'PDF export cancelled' : `PDF report exported${result.path ? `: ${result.path}` : ''}`)
        return
      }

      openReportExportPrintWindow(html)
      setPrinterStatus('PDF layout opened. Use Print or Save as PDF.')
    } catch (error) {
      setPrinterStatus(getErrorMessage(error))
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
                    ref={setupCloudLoginInputRef}
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
                  <div className="setup-owner-pin">
                    <strong>Activation Plan</strong>
                    <span>
                      {selectedSetupIsOfflinePlan
                        ? 'Offline plan restores once and then uses local SQLite only.'
                        : `${selectedSetupPlanDetails.name} plan keeps cloud backup/sync active.`}
                    </span>
                    <div className="app-plan-badges">
                      <span>{selectedSetupPlanDetails.name}</span>
                      <span className={selectedSetupIsOfflinePlan ? 'limited' : 'included'}>
                        {selectedSetupIsOfflinePlan ? 'Offline This PC' : 'Cloud Backup'}
                      </span>
                    </div>
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
                    {selectedSetupIsOfflinePlan ? <Save size={16} /> : <RefreshCw size={16} />}
                    {selectedSetupIsOfflinePlan
                      ? selectedSetupStaffUsers.length
                        ? 'Activate Offline'
                        : 'Activate Offline & Create Owner'
                      : selectedSetupStaffUsers.length
                        ? 'Restore Server Data'
                        : 'Restore & Create Owner'}
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
                ref={loginPinInputRef}
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
              {renderShortcutKey('pos-orders')}
            </button>
            {hasCloudFeatureAccess && hasGoldLocalPlan && (
              <button
                className={pendingQrOrders.length ? 'tool-button qr-alert' : 'tool-button'}
                type="button"
                title="Table QR orders"
                onClick={() => setQrOrdersOpen(true)}
              >
                <QrCode size={16} />
                QR
                {pendingQrOrders.length > 0 && <span className="nav-badge">{pendingQrOrders.length}</span>}
              </button>
            )}
            <button className="tool-button" type="button" title="Hold orders" onClick={() => openOrderList('hold')}>
              <Clock3 size={16} />
              Hold
            </button>
            <button className="new-order" type="button" onClick={newOrder}>
              <Plus size={17} />
              New Order
              {renderShortcutKey('pos-new-order')}
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
                  {renderShortcutKey('home-pos')}
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
                  {renderShortcutKey('home-report')}
                </button>
              )}
              {hasSubscriptionAccess && hasPermission('expense_manage') && (
                <button
                  className={activeView === 'expenses' ? 'view-tab active' : 'view-tab'}
                  type="button"
                  onClick={() => goToView('expenses')}
                >
                  <Banknote size={17} />
                  Expense
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
              className="theme-toggle"
              type="button"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme((mode) => (mode === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              {theme === 'dark' ? 'Light' : 'Dark'}
              {renderShortcutKey('global-theme')}
            </button>
            <button className="theme-toggle user-lock-button" type="button" title="Lock app" onClick={lockApp}>
              <span className="user-name">{currentUser?.name || 'User'}</span>
              <LogOut size={17} />
              {renderShortcutKey('global-lock')}
            </button>
          </div>
        )}
      </header>

      {activeView === 'home' && (
        <section className="home-view page-view">
            {subscriptionLock && !hasOfflineAccess && (
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
                {hasCloudFeatureAccess && hasPermission('cloud_sync') && (
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
              {renderShortcutKey('home-pos')}
            </button>
            )}
            {hasSubscriptionAccess && hasPermission('reports') && (
            <button className="home-launch-tile" type="button" onClick={() => goToView('reports')}>
              <BarChart3 size={34} />
              <strong>Report</strong>
              <span>Sales graph and bills</span>
              {renderShortcutKey('home-report')}
            </button>
            )}
            {hasSubscriptionAccess && hasPermission('expense_manage') && (
            <button className="home-launch-tile" type="button" onClick={() => goToView('expenses')}>
              <Banknote size={34} />
              <strong>Expense</strong>
              <span>Cash and bank outflow</span>
            </button>
            )}
            {hasSubscriptionAccess &&
              (hasPermission('user_manage') ||
                hasPermission('business_profile') ||
                hasPermission('menu_manage') ||
                hasPermission('printer_manage') ||
                (hasCloudFeatureAccess && hasPermission('cloud_sync'))) && (
            <button className="home-launch-tile" type="button" onClick={() => goToView('settings')}>
              <Settings size={34} />
              <strong>Settings</strong>
              <span>App configuration</span>
              {renderShortcutKey('home-settings')}
            </button>
            )}
            {hasSubscriptionAccess && hasCloudFeatureAccess && hasPermission('cloud_sync') && hasGoldLocalPlan && (
            <button className="home-launch-tile" type="button" onClick={() => goToView('network')}>
              <Monitor size={34} />
              <strong>Local Server</strong>
              <span>Main PC LAN access</span>
            </button>
            )}
          </div>
        </section>
      )}

      {activeView === 'settings' && (
        <section className="settings-view page-view">
          <div className="page-head">
            <div>
              <span>Settings</span>
              <h1>Settings</h1>
              <p>Control app behavior and operational preferences</p>
            </div>
            <button className="home-action" type="button" onClick={() => goToView('home')}>
              <Home size={18} />
              Home
            </button>
          </div>

          <div className="settings-card-grid">
            <button className="home-launch-tile settings-launch-tile" type="button" onClick={() => goToView('configuration')}>
              <Settings size={34} />
              <strong>Configuration</strong>
              <span>Sale flow and app behavior</span>
            </button>
            {hasSubscriptionAccess && hasPermission('user_manage') && (
              <button className="home-launch-tile settings-launch-tile" type="button" onClick={() => goToView('keyboard_shortcuts')}>
                <Keyboard size={34} />
                <strong>Keyboard Shortcuts</strong>
                <span>View and manage shortcut keys</span>
              </button>
            )}
            {hasSubscriptionAccess && hasPermission('menu_manage') && (
              <button className="home-launch-tile settings-launch-tile" type="button" onClick={openMenuSetup}>
                <Pencil size={34} />
                <strong>Menu Setup</strong>
                <span>Categories and items</span>
              </button>
            )}
            {hasSubscriptionAccess && hasPermission('menu_manage') && (
              <button className="home-launch-tile settings-launch-tile" type="button" onClick={openTableSetup}>
                <UtensilsCrossed size={34} />
                <strong>Table Setup</strong>
                <span>Dining tables</span>
              </button>
            )}
            {hasSubscriptionAccess && hasPermission('printer_manage') && (
              <button className="home-launch-tile settings-launch-tile" type="button" onClick={openPrinterManager}>
                <Printer size={34} />
                <strong>Printer Manage</strong>
                <span>Bill and KOT printers</span>
              </button>
            )}
            {(hasPermission('business_profile') || (hasCloudFeatureAccess && hasPermission('cloud_sync')) || hasPermission('user_manage')) && (
              <button className="home-launch-tile settings-launch-tile" type="button" onClick={openAccountPanel}>
                <User size={34} />
                <strong>Account</strong>
                <span>{hasOfflineAccess ? 'Profile and users' : 'Profile, sync, and users'}</span>
              </button>
            )}
            {hasSubscriptionAccess && hasPermission('user_manage') && (
              <button className="home-launch-tile settings-launch-tile" type="button" onClick={() => goToView('service_staff')}>
                <User size={34} />
                <strong>Staff</strong>
                <span>Service staff codes</span>
              </button>
            )}
          </div>
        </section>
      )}

      {activeView === 'configuration' && (
        <section className="configuration-view page-view">
          <div className="page-head">
            <div>
              <span>Settings</span>
              <h1>Configuration</h1>
              <p>Enable or disable optional steps in daily billing</p>
            </div>
            <button className="home-action" type="button" onClick={() => goToView('settings')}>
              <Settings size={18} />
              Settings
            </button>
          </div>

          <div className="configuration-layout">
            <section className="home-card configuration-card">
              <div className="section-title">
                <strong>Sales Flow</strong>
                <span>Dining order behavior</span>
              </div>
              <label className="configuration-option">
                <input
                  type="checkbox"
                  checked={appConfiguration.showServiceStaffSelector}
                  onChange={(event) => {
                    const enabled = event.currentTarget.checked
                    setAppConfiguration((settings) => ({ ...settings, showServiceStaffSelector: enabled }))
                    if (!enabled) {
                      setStaffCodePromptOpen(false)
                      clearSelectedServiceStaff()
                    }
                    setPrinterStatus(enabled ? 'Staff selector enabled for dining sales' : 'Staff selector disabled for dining sales')
                  }}
                />
                <div>
                  <strong>Show staff selector during sale</strong>
                  <span>
                    When enabled, selecting a dining table asks for staff code or staff name. When disabled, billing continues after table selection without staff prompt.
                  </span>
                </div>
              </label>
            </section>

            <section className="home-card configuration-card">
              <div className="section-title">
                <strong>Current Flow</strong>
                <span>{appConfiguration.showServiceStaffSelector ? 'Staff required' : 'Staff hidden'}</span>
              </div>
              <div className="configuration-summary">
                <div>
                  <span>Dining Table</span>
                  <strong>Required</strong>
                </div>
                <div>
                  <span>Staff Selection</span>
                  <strong>{appConfiguration.showServiceStaffSelector ? 'Enabled' : 'Disabled'}</strong>
                </div>
                <div>
                  <span>Save / Print</span>
                  <strong>{appConfiguration.showServiceStaffSelector ? 'Requires staff' : 'No staff check'}</strong>
                </div>
              </div>
            </section>
          </div>
        </section>
      )}

      {activeView === 'keyboard_shortcuts' && (
        <section className="keyboard-shortcuts-view page-view">
          <div className="page-head">
            <div>
              <span>Settings</span>
              <h1>Keyboard Shortcuts</h1>
              <p>Enable shortcuts and manage the assigned keys for daily POS actions</p>
            </div>
            <div className="page-head-actions">
              <button
                className="home-action"
                type="button"
                onClick={() => {
                  setKeyboardShortcutOverrides({})
                  setPrinterStatus('Keyboard shortcuts reset to default')
                }}
              >
                <RefreshCw size={18} />
                Reset
              </button>
              <button className="home-action" type="button" onClick={() => goToView('settings')}>
                <Settings size={18} />
                Settings
              </button>
            </div>
          </div>

          <section className="home-card shortcut-manager-card">
            <label className="configuration-option shortcut-master-option">
              <input
                type="checkbox"
                checked={keyboardShortcutsEnabled}
                onChange={(event) => setKeyboardShortcutsEnabled(event.currentTarget.checked)}
              />
              <div>
                <strong>Enable Keyboard Shortcuts</strong>
                <span>
                  {keyboardShortcutsEnabled
                    ? 'Shortcut keys are active. Hold Alt on other screens to reveal the assigned keys.'
                    : 'Shortcut execution and Alt key hints are disabled.'}
                </span>
              </div>
            </label>
            <div className="section-title">
              <div>
                <strong>Assigned Shortcuts</strong>
                <span>Click a key field, then press the replacement key</span>
              </div>
            </div>

            <div className="shortcut-manager-list">
              {keyboardShortcuts.map((shortcut) => (
                <div className="shortcut-manager-row" key={shortcut.id}>
                  <div>
                    <span>{getShortcutScopeLabel(shortcut.scope)}</span>
                    <strong>{shortcut.action}</strong>
                    <small>{shortcut.description}</small>
                  </div>
                  <input
                    aria-label={`${shortcut.action} shortcut key`}
                    value={shortcut.key}
                    onChange={() => undefined}
                    onKeyDown={(event) => {
                      event.preventDefault()
                      const nextKey = normalizeShortcutKey(event.key)
                      if (!nextKey) {
                        return
                      }
                      const shortcutConflict = keyboardShortcuts.find(
                        (entry) =>
                          entry.id !== shortcut.id &&
                          doShortcutScopesOverlap(entry.scope, shortcut.scope) &&
                          isShortcutKeyMatch(entry.key, nextKey),
                      )
                      if (shortcutConflict) {
                        setPrinterStatus(`${nextKey} is already used for ${shortcutConflict.action}`)
                        return
                      }
                      setKeyboardShortcutOverrides((overrides) =>
                        normalizeKeyboardShortcutOverrides({
                          ...overrides,
                          [shortcut.id]: nextKey,
                        }),
                      )
                      setPrinterStatus(`${shortcut.action} shortcut set to ${nextKey}`)
                    }}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </div>
              ))}
            </div>
          </section>
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
            <div className="page-head-actions">
              <div className="report-print-date-row">
                <input
                  type="date"
                  value={reportPrintDate}
                  onChange={(event) => setReportPrintDate(event.currentTarget.value)}
                  title="Select date for report print"
                />
                <button className="home-action" type="button" onClick={printSelectedDateReport}>
                  <Printer size={18} />
                  Print Selected Date
                </button>
                <button className="home-action" type="button" onClick={printCurrentPeriodReport}>
                  <Printer size={18} />
                  Print Period
                </button>
                <button className="home-action" type="button" onClick={printPreviousDayReport} title="Print yesterday's sales report">
                  <Printer size={18} />
                  Yesterday
                </button>
              </div>
              <button className="home-action primary" type="button" onClick={() => goToView('pos')}>
                <ShoppingCart size={18} />
                POS Sale
              </button>
            </div>
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

          <section className="home-card report-export-panel">
            <div>
              <strong>Export Report</strong>
              <span>Use for custom period, monthly, yearly, accountant sharing, or A4 printing.</span>
            </div>
            <div className="report-export-actions">
              <button className="small-button" type="button" onClick={() => void exportCurrentPeriodReport('csv')}>
                <Save size={15} />
                CSV
              </button>
              <button className="small-button" type="button" onClick={() => void exportCurrentPeriodReport('excel')}>
                <Save size={15} />
                Excel
              </button>
              <button className="small-button primary" type="button" onClick={() => void exportCurrentPeriodReport('pdf')}>
                <ReceiptText size={15} />
                PDF
              </button>
            </div>
          </section>

          <section className="home-card daily-cash-desk">
            <div className="section-title">
              <div>
                <strong>Opening Cash</strong>
                <span>{formatDate(dailyReportDate)} daily cash start</span>
              </div>
              <Banknote size={22} />
            </div>

            <div className="daily-opening-row">
              <label>
                Opening Cash
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dailyOpeningCash || ''}
                  onChange={(event) => updateOpeningCashBalance(dailyReportDate, event.currentTarget.value)}
                />
              </label>
              <div className="opening-cash-preview">
                <span>Cash In Hand With Opening</span>
                <strong>{money(roundMoney(dailyOpeningCash + dailyReport.cashInHand))}</strong>
              </div>
              <button className="small-button" type="button" onClick={() => updateOpeningCashBalance(dailyReportDate, '0')}>
                Reset Opening
              </button>
            </div>
          </section>

          <div className="report-grid detailed report-kpi-grid">
            <div className="report-card featured">
              <span>Period Sales</span>
              <strong>{money(periodReport.salesTotal)}</strong>
              <small>Previous: {money(periodReport.previousSalesTotal)}</small>
            </div>
            <div className="report-card">
              <span>Expense</span>
              <strong>{money(periodReport.expenseTotal)}</strong>
              <small>Cash {money(periodReport.cashExpenseTotal)} / Bank {money(periodReport.bankExpenseTotal)}</small>
            </div>
            <div className="report-card featured alt">
              <span>Net Amount</span>
              <strong>{money(periodReport.netTotal)}</strong>
              <small>Sales minus expenses</small>
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
              <small>After cash expenses</small>
            </div>
            <div className="report-card">
              <span>Bank</span>
              <strong>{money(periodReport.bankTotal)}</strong>
              <small>UPI + Card - bank expenses</small>
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
                <span>Total expense</span>
                <strong>{money(periodReport.expenseTotal)}</strong>
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
              <h3>Expense Summary</h3>
              <div className="report-line">
                <span>Total Expense</span>
                <strong>{money(periodReport.expenseTotal)}</strong>
              </div>
              <div className="report-line">
                <span>Cash Expense</span>
                <strong>{money(periodReport.cashExpenseTotal)}</strong>
              </div>
              <div className="report-line">
                <span>Bank Expense</span>
                <strong>{money(periodReport.bankExpenseTotal)}</strong>
              </div>
              <div className="report-line highlight">
                <span>Net Amount</span>
                <strong>{money(periodReport.netTotal)}</strong>
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

      {activeView === 'expenses' && (
        <section className="expenses-view page-view">
          <div className="page-head">
            <div>
              <span>Expenses</span>
              <h1>Expense Entry</h1>
              <p>Cash and bank expenses reduce cash in hand and bank report totals.</p>
            </div>
            <div className="page-head-actions">
              <button className="home-action" type="button" onClick={() => goToView('reports')}>
                <BarChart3 size={18} />
                Report
              </button>
              <button className="home-action primary" type="button" onClick={() => goToView('pos')}>
                <ShoppingCart size={18} />
                POS Sale
              </button>
            </div>
          </div>

          <div className="expense-layout">
            <section className="home-card profile-form-card expense-entry-card">
              <div className="section-title">
                <div>
                  <strong>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</strong>
                  <span>{expenseStatus}</span>
                </div>
                <Banknote size={20} />
              </div>
              <div className="profile-form expense-form">
                <label>
                  Date
                  <input
                    type="date"
                    value={expenseDraft.date}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setExpenseDraft((draft) => ({ ...draft, date: value }))
                    }}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={expenseDraft.category}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setExpenseDraft((draft) => ({ ...draft, category: value }))
                    }}
                  >
                    {expenseCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseDraft.amount}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setExpenseDraft((draft) => ({ ...draft, amount: value }))
                    }}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  Payment
                  <select
                    value={expenseDraft.paymentMethod}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setExpenseDraft((draft) => ({
                        ...draft,
                        paymentMethod: value === 'Bank' ? 'Bank' : 'Cash',
                      }))
                    }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                  </select>
                </label>
                <label>
                  Vendor
                  <input
                    value={expenseDraft.vendor}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setExpenseDraft((draft) => ({ ...draft, vendor: value }))
                    }}
                    placeholder="Supplier / staff / shop"
                  />
                </label>
                <label>
                  Note
                  <input
                    value={expenseDraft.note}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setExpenseDraft((draft) => ({ ...draft, note: value }))
                    }}
                    placeholder="Short note"
                  />
                </label>
              </div>
              <div className="editor-actions">
                <button type="button" className="small-button primary" onClick={saveExpense}>
                  <Save size={16} />
                  {editingExpenseId ? 'Update Expense' : 'Save Expense'}
                </button>
                <button type="button" className="small-button" onClick={resetExpenseDraft}>
                  <X size={16} />
                  Clear
                </button>
              </div>
            </section>

            <section className="home-card expense-summary-card">
              <div className="report-grid detailed">
                <div className="report-card featured">
                  <span>Today Expense</span>
                  <strong>{money(report.todayExpenseTotal)}</strong>
                  <small>{formatDate(new Date())}</small>
                </div>
                <div className="report-card">
                  <span>Today Cash Expense</span>
                  <strong>{money(report.todayCashExpenseTotal)}</strong>
                  <small>Reduces cash in hand</small>
                </div>
                <div className="report-card">
                  <span>Today Bank Expense</span>
                  <strong>{money(report.todayBankExpenseTotal)}</strong>
                  <small>Reduces bank amount</small>
                </div>
                <div className="report-card">
                  <span>Total Expense</span>
                  <strong>{money(report.expenseTotal)}</strong>
                  <small>All saved expenses</small>
                </div>
              </div>
            </section>
          </div>

          <section className="home-card report-table-card expense-table-card">
            <h3>Recent Expenses</h3>
            <div className="detail-table">
              <div className="detail-row head expense-row">
                <span>Date</span>
                <span>Category</span>
                <span>Vendor</span>
                <span>Payment</span>
                <span>Amount</span>
                <span>Action</span>
              </div>
              {recentExpenses.map((expense) => (
                <div className="detail-row expense-row" key={expense.id}>
                  <span>{formatDate(parseDateInputValue(expense.date, new Date(expense.createdAt)))}</span>
                  <span>{expense.category}</span>
                  <span>{expense.vendor || expense.note || '-'}</span>
                  <span>{expense.paymentMethod}</span>
                  <strong>{money(expense.amount)}</strong>
                  <span className="expense-row-actions">
                    <button type="button" onClick={() => editExpense(expense)} title="Edit expense">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => deleteExpense(expense.id)} title="Delete expense">
                      <Trash2 size={15} />
                    </button>
                  </span>
                </div>
              ))}
              {!recentExpenses.length && <div className="empty-list">No expenses saved yet</div>}
            </div>
          </section>
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
                  Default GST Rate (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={businessProfile.defaultGstRate}
                    onChange={(event) => updateBusinessProfile('defaultGstRate', Number(event.target.value) || 0)}
                  />
                </label>
                <label>
                  GST Treatment
                  <select
                    value={businessProfile.gstType}
                    onChange={(event) => updateBusinessProfile('gstType', event.target.value as 'exclusive' | 'inclusive')}
                  >
                    <option value="exclusive">Exclusive (Tax added on top)</option>
                    <option value="inclusive">Inclusive (Tax included in price)</option>
                  </select>
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

      {activeView === 'service_staff' && (
        <section className="service-staff-view page-view">
          <div className="page-head">
            <div>
              <span>Staff</span>
              <h1>Service Staff</h1>
              <p>Add the staff code used after table selection. The matched staff name prints on the bill.</p>
            </div>
            <button className="home-action primary" type="button" onClick={startNewServiceStaff}>
              <Plus size={18} />
              New Staff
            </button>
          </div>

          <div className="service-staff-page-layout">
            <section className="home-card service-staff-editor-card">
              <div className="section-title">
                <strong>{serviceStaffEditorId ? 'Edit Staff' : 'Add Staff'}</strong>
                <span>Name and code only</span>
              </div>
              <div className="profile-form service-staff-form">
                <label>
                  Staff Name
                  <input
                    value={serviceStaffNameDraft}
                    onChange={(event) => setServiceStaffNameDraft(event.currentTarget.value)}
                    placeholder="Waiter / pilot name"
                  />
                </label>
                <label>
                  Staff Code
                  <input
                    value={serviceStaffCodeDraft}
                    onChange={(event) => setServiceStaffCodeDraft(normalizeStaffCode(event.currentTarget.value))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        saveServiceStaff()
                      }
                    }}
                    placeholder="101"
                  />
                </label>
              </div>
              {serviceStaffStatus && <div className="sync-message">{serviceStaffStatus}</div>}
              <div className="user-editor-actions">
                <button className="small-button" type="button" onClick={startNewServiceStaff}>
                  <RefreshCw size={16} />
                  Clear
                </button>
                <button className="small-button primary" type="button" onClick={saveServiceStaff}>
                  <Save size={16} />
                  Save Staff
                </button>
              </div>
            </section>

            <section className="home-card service-staff-list-card">
              <div className="section-title">
                <strong>Saved Staff</strong>
                <span>{serviceStaff.length} staff member(s)</span>
              </div>
              <div className="service-staff-grid">
                {serviceStaff.map((staffMember) => (
                  <article className="service-staff-card" key={staffMember.id}>
                    <button type="button" className="service-staff-main" onClick={() => editServiceStaff(staffMember)}>
                      <span>{staffMember.code}</span>
                      <strong>{staffMember.name}</strong>
                    </button>
                    <button type="button" className="small-button icon-only" onClick={() => editServiceStaff(staffMember)} title="Edit staff">
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="small-button danger icon-only"
                      onClick={() => deleteServiceStaff(staffMember)}
                      title="Delete staff"
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
                {!serviceStaff.length && (
                  <div className="empty-list">
                    Add staff names and codes here before live dining billing.
                  </div>
                )}
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
              <div className="app-plan-card">
                <div>
                  <span>Current Plan</span>
                  <strong>
                    {hasOfflineAccess
                      ? `${currentPlanDetails?.name || offlineLicense.subscriptionPlan || 'Offline'} / Offline`
                      : currentPlanDetails?.name || cloudSyncSettings.subscriptionPlan || 'Not paired'}
                  </strong>
                  <small>
                    {hasOfflineAccess
                      ? 'Local SQLite only. Cloud backup and local POS server are disabled.'
                      : currentPlanDetails?.subtitle || 'Connect cloud account to load plan details'}
                  </small>
                </div>
                <div className="app-plan-badges">
                  <span>
                    {hasOfflineAccess
                      ? formatDeviceLimit(offlineLicense.subscriptionMaxDevices)
                      : formatDeviceLimit(cloudSyncSettings.subscriptionMaxDevices)}
                  </span>
                  <span className={hasGoldLocalPlan ? 'included' : 'limited'}>
                    {hasOfflineAccess ? 'Offline mode' : hasGoldLocalPlan ? 'Local POS included' : 'Local POS not included'}
                  </span>
                </div>
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
                      ? `${currentPlanDetails?.name || cloudSyncSettings.subscriptionPlan || titleCase(cloudSyncSettings.subscriptionStatus)} / ${titleCase(cloudSyncSettings.subscriptionStatus)}${cloudSyncSettings.subscriptionExpiresAt ? ` till ${formatDate(new Date(cloudSyncSettings.subscriptionExpiresAt))}` : ''}`
                      : 'Not paired'}
                  </strong>
                </div>
                <div>
                  <span>Counter Limit</span>
                  <strong>{formatDeviceLimit(cloudSyncSettings.subscriptionMaxDevices)}</strong>
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

      {activeView === 'network' && (
        <section className="network-view page-view">
          <div className="page-head">
            <div>
              <span>Main PC</span>
              <h1>Local POS Server</h1>
              <p>{localServerPrimaryUrl || 'Local server status not loaded'}</p>
            </div>
            <button className="home-action primary" type="button" onClick={() => void refreshLocalServerStatus()}>
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>

          <div className="network-layout">
            <section className="home-card network-card">
              <div className="section-title">
                <strong>Server Status</strong>
                <span>{localServerStatus?.enabled ? 'Running' : 'Stopped'}</span>
              </div>
              <div className="sync-status-grid network-status-grid">
                <div>
                  <span>Mode</span>
                  <strong>Main PC Server</strong>
                </div>
                <div>
                  <span>Computer</span>
                  <strong>{localServerStatus?.computerName || 'This PC'}</strong>
                </div>
                <div>
                  <span>Port</span>
                  <strong>{localServerStatus?.port ?? 8080}</strong>
                </div>
                <div>
                  <span>Database</span>
                  <strong>{localServerStatus?.dbPath || localDatabasePath ? 'SQLite Ready' : 'Not ready'}</strong>
                </div>
                <div>
                  <span>Local DNS</span>
                  <strong>{localDnsStatus?.enabled ? 'Running' : 'Not running'}</strong>
                </div>
                <div>
                  <span>DNS IP</span>
                  <strong>{localDnsStatus?.primaryIp || 'Not ready'}</strong>
                </div>
              </div>
              {localServerStatus?.error && <div className="sync-message">{localServerStatus.error}</div>}
              {localDnsStatus?.error && <div className="sync-message">{localDnsStatus.error}</div>}
            </section>

            <section className="home-card network-card">
              <div className="section-title">
                <strong>Client URLs</strong>
                <span>Same Wi-Fi / LAN</span>
              </div>
              <div className="server-url-list">
                {(localServerUrls.length ? localServerUrls : [localServerPrimaryUrl]).filter(Boolean).map((url) => (
                  <div className="server-url-row" key={url}>
                    <Monitor size={17} />
                    <span>{url}</span>
                    <button className="small-button" type="button" onClick={() => void copyLocalServerText(url)}>
                      Copy
                    </button>
                  </div>
                ))}
                {localDnsUrls.map((url) => (
                  <div className="server-url-row dns-url-row" key={url}>
                    <Globe2 size={17} />
                    <span>{url}</span>
                    <button className="small-button" type="button" onClick={() => void copyLocalServerText(url)}>
                      Copy
                    </button>
                  </div>
                ))}
                {!localServerUrls.length && !localServerPrimaryUrl && (
                  <div className="empty-list">Open this page inside the desktop app to see LAN address.</div>
                )}
              </div>
              <div className="network-note">
                Other computers or mobile devices can test the connection by opening the URL above. If it does not load,
                allow this app in Windows Firewall and make sure all devices are on the same network.
              </div>
            </section>

            <section className="home-card network-card network-wide-card">
              <div className="section-title">
                <strong>Local DNS Setup</strong>
                <span>{localDnsStatus?.enabled ? 'Ready' : 'Needs setup'}</span>
              </div>
              <div className="server-url-list">
                <div className="server-url-row">
                  <Wifi size={17} />
                  <span>
                    Set phone/other PC DNS server to {localDnsStatus?.primaryIp || 'this Main PC IP'}
                  </span>
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => void copyLocalServerText(localDnsStatus?.primaryIp || '')}
                    disabled={!localDnsStatus?.primaryIp}
                  >
                    Copy IP
                  </button>
                </div>
                <div className="server-url-row">
                  <Globe2 size={17} />
                  <span>
                    Use domain {localDnsStatus?.domains?.[0] || 'pos.local'} with port {localServerStatus?.port ?? 8080}
                  </span>
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => void copyLocalServerText(localDnsStatus?.domains?.[0] || 'pos.local')}
                  >
                    Copy Name
                  </button>
                </div>
              </div>
              <div className="network-note">
                For easy address, set router DHCP DNS to the Main PC IP. If router access is not available, set DNS manually
                on each client device. Unknown domains are forwarded to {localDnsStatus?.upstream || 'upstream DNS'} so internet browsing can continue.
              </div>
            </section>

            <section className="home-card network-card network-wide-card">
              <div className="section-title">
                <strong>API Endpoints</strong>
                <span>For client POS build</span>
              </div>
              <div className="server-url-list">
                <div className="server-url-row">
                  <Globe2 size={17} />
                  <span>{localServerPrimaryUrl ? `${localServerPrimaryUrl}/api/server/status` : '/api/server/status'}</span>
                  <button
                    className="small-button"
                    type="button"
                    onClick={() =>
                      void copyLocalServerText(
                        localServerPrimaryUrl ? `${localServerPrimaryUrl}/api/server/status` : '/api/server/status',
                      )
                    }
                  >
                    Copy
                  </button>
                </div>
                <div className="server-url-row">
                  <Globe2 size={17} />
                  <span>{localServerPrimaryUrl ? `${localServerPrimaryUrl}/api/pos/snapshot` : '/api/pos/snapshot'}</span>
                  <button
                    className="small-button"
                    type="button"
                    onClick={() =>
                      void copyLocalServerText(
                        localServerPrimaryUrl ? `${localServerPrimaryUrl}/api/pos/snapshot` : '/api/pos/snapshot',
                      )
                    }
                  >
                    Copy
                  </button>
                </div>
              </div>
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

          <div className="about-layout refined-about-layout">
            <section className="home-card about-hero-card">
              <div className="about-hero-brand">
                <div className="brand-mark about-brand-mark">
                  <img src={appIconUrl} alt="" />
                </div>
                <div>
                  <span>{hasOfflineAccess ? 'Offline POS' : 'Cloud POS'}</span>
                  <h2>{appName}</h2>
                  <p>
                    Restaurant billing, reporting, customer credit, and printer workflow by {companyName}.
                  </p>
                </div>
              </div>
              <div className="about-hero-badges">
                <span>{licensePlanLabel}</span>
                <span>Valid till {licenseExpiryLabel}</span>
                <span>v{appVersion}</span>
              </div>
            </section>

            <section className="about-summary-grid" aria-label="App and license summary">
              <article>
                <span>Plan</span>
                <strong>{licensePlanLabel}</strong>
                <small>{licenseModeLabel}</small>
              </article>
              <article>
                <span>Valid Till</span>
                <strong>{licenseExpiryLabel}</strong>
                <small>License period</small>
              </article>
              <article>
                <span>Business</span>
                <strong>{licenseValueByLabel.get('Business') || billingDisplayName}</strong>
                <small>{licenseValueByLabel.get('Phone') || businessProfile.phone || 'Phone not set'}</small>
              </article>
              <article>
                <span>Version</span>
                <strong>v{appVersion}</strong>
                <small>{companyWebsiteDisplay}</small>
              </article>
            </section>

            <section className="home-card license-details-panel refined-license-panel">
              <div>
                <strong>Account Details</strong>
                <span>Clean business and license summary</span>
              </div>
              <div className="license-group-grid">
                {licenseGroups.map((group) => (
                  <div className="license-group" key={group.title}>
                    <h4>{group.title}</h4>
                    {group.rows.map((row) => (
                      <div className="license-detail-row" key={`${group.title}-${row.label}`}>
                        <span>{row.label}</span>
                        <strong title={row.value}>{row.value}</strong>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="home-card about-service-card">
              <div className="section-title">
                <div>
                  <strong>Support & Data</strong>
                  <span>Update, backup, and restore</span>
                </div>
                <Save size={20} />
              </div>

              <div className="about-service-grid">
                <div>
                  <span>Data Folder</span>
                  <strong title={localDatabaseDataDir || 'C:\\GIPOS Restaurant'}>
                    {localDatabaseDataDir || 'C:\\GIPOS Restaurant'}
                  </strong>
                </div>
                <div>
                  <span>Database</span>
                  <strong title={localDatabasePath || 'Local storage'}>{localDatabasePath ? 'SQLite protected' : 'Local storage'}</strong>
                </div>
                <div>
                  <span>Backup</span>
                  <strong title={localDatabaseBackupDir || 'Backup folder'}>
                    {localDatabaseBackupDir ? 'Backup ready' : 'Manual backup'}
                  </strong>
                </div>
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
                      Install & Reopen
                    </button>
                  )}
                </div>
                <div className="database-backup-row">
                  <select
                    value={selectedDatabaseBackup}
                    onChange={(event) => setSelectedDatabaseBackup(event.target.value)}
                    disabled={!databaseBackups.length}
                  >
                    {databaseBackups.length ? (
                      databaseBackups.map((backup) => (
                        <option key={backup.fileName} value={backup.fileName}>
                          {formatDatabaseBackupLabel(backup)}
                        </option>
                      ))
                    ) : (
                      <option value="">No backups found</option>
                    )}
                  </select>
                  <button className="small-button" type="button" onClick={() => void refreshDatabaseBackups()}>
                    <RefreshCw size={15} />
                    Refresh
                  </button>
                </div>
                <div className="update-actions">
                  <button className="small-button" type="button" onClick={() => void createDatabaseBackupNow()}>
                    <Save size={15} />
                    Create Backup
                  </button>
                  <button
                    className="small-button danger"
                    type="button"
                    onClick={() => void restoreSelectedDatabaseBackup()}
                    disabled={!selectedDatabaseBackup}
                  >
                    <RefreshCw size={15} />
                    Restore Selected
                  </button>
                </div>
                <small>{databaseBackupStatus}. Automatic safety backups are limited; manual backups are kept separately.</small>
            </section>

            <section className="home-card company-info-card about-company-card">
              <div className="section-title">
                <strong>About Us</strong>
                <a href={companyWebsite} target="_blank" rel="noreferrer">
                  {companyWebsiteDisplay}
                </a>
              </div>
              <p>
                {companyName} provides business hosting, domains, websites, and practical software tools for local
                companies that need dependable daily operations.
              </p>
              <p>
                {appName} is built for fast restaurant counters: billing, table orders, customer credit, reports,
                expenses, and thermal printing in one focused desktop system.
              </p>
            </section>

            <section className="home-card company-info-card terms-card">
              <div className="section-title">
                <strong>Terms & Conditions</strong>
                <span>Business use policy</span>
              </div>
              <ul>
                <li>Use this software only for restaurant billing, reports, customer credit, expenses, and POS operations.</li>
                <li>Verify business details, tax settings, printer setup, menu prices, and bill format before live billing.</li>
                <li>Keep regular backups of bills, customers, menu, expenses, and business settings.</li>
                <li>Business decisions, tax filing, and statutory compliance remain the responsibility of the business owner.</li>
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
            {filteredItems.map((item) => {
              const unavailable = !isMenuItemAvailable(item)

              return (
                <button
                  className={unavailable ? 'menu-item unavailable' : 'menu-item'}
                  type="button"
                  key={item.id}
                  disabled={unavailable}
                  title={unavailable ? item.unavailableReason || 'Unavailable' : item.name}
                  onClick={() => addItem(item)}
                >
                  {item.imageDataUrl ? (
                    <img className="menu-item-photo" src={item.imageDataUrl} alt="" />
                  ) : (
                    <span className="menu-item-photo empty-photo">
                      <ImagePlus size={19} />
                    </span>
                  )}
                  {unavailable && <span className="availability-badge">Sold Out</span>}
                  <span className={item.price <= 0 ? 'price open-price-label' : 'price'}>
                    {item.price <= 0 ? 'Open Price' : `Rs. ${item.price.toFixed(2)}`}
                  </span>
                  <span className="item-name">{item.name}</span>
                </button>
              )
            })}
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
            <button
              type="button"
              className="icon-action"
              title="Seating"
              onClick={() => {
                if (table) {
                  setActiveTableGroupId(getTableGroupId(selectedTables[0] ?? getDiningTablesFromLabel(table)[0] ?? table, diningTableGroups))
                }
                setTableSelectorOpen(true)
              }}
            >
              <UtensilsCrossed size={19} />
              <span>
                {getSeatingDisplayLabel(seatingMode, table, selectedTables, diningGroupName) || 'Seating'}
                {appConfiguration.showServiceStaffSelector && selectedServiceStaffName ? ` / ${selectedServiceStaffName}` : ''}
              </span>
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
              <span>{getDiscountLabel(baseTotals.subtotal, discountMode, discountPercent, discountAmount)}</span>
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

              {cart.length > 0 &&
                (totals.discount > 0 || taxExempt || totals.tax > 0 || totals.serviceCharge > 0 || businessProfile.defaultGstRate > 0) && (
                <div className="bill-adjustment-summary">
                  {totals.discount > 0 && (
                    <div className="bill-adjustment-row discount">
                      <span>Discount</span>
                      <strong>-{money(totals.discount)}</strong>
                    </div>
                  )}
                  {taxExempt ? (
                    <div className="bill-adjustment-row success">
                      <span>Tax</span>
                      <strong>Exempt</strong>
                    </div>
                  ) : totals.tax > 0 && (
                    <>
                      <div className="bill-adjustment-row">
                        <span>CGST</span>
                        <strong>{money(totals.tax / 2)}</strong>
                      </div>
                      <div className="bill-adjustment-row">
                        <span>SGST</span>
                        <strong>{money(totals.tax / 2)}</strong>
                      </div>
                    </>
                  )}
                  {totals.serviceCharge > 0 && (
                    <div className="bill-adjustment-row">
                      <span>Service Charge</span>
                      <strong>{money(totals.serviceCharge)}</strong>
                    </div>
                  )}
                  {businessProfile.defaultGstRate > 0 && (
                    <div className="bill-tax-toggle-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={taxExempt}
                          onChange={(e) => setTaxExempt(e.currentTarget.checked)}
                        />
                        Tax Exempt
                      </label>
                    </div>
                  )}
                </div>
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
                  <span>Hold</span>
                  {renderShortcutKey('pos-hold')}
                </button>
                <button className="action primary print-primary-action" type="button" onClick={() => printReceipt(true)}>
                  <ReceiptText size={18} />
                  <span>Print Bill</span>
                  {renderShortcutKey('pos-print-bill')}
                </button>
                <button className="action success" type="button" onClick={savePaidOrder}>
                  <Save size={18} />
                  <span>Save Bill</span>
                  {renderShortcutKey('pos-save-bill')}
                </button>
                <button className="action kot" type="button" onClick={printKotByRouting}>
                  <Printer size={18} />
                  <span>Print KOT</span>
                  {renderShortcutKey('pos-kot')}
                </button>
                <button className="action primary" type="button" onClick={() => printReceipt(true)}>
                  <Printer size={18} />
                  <span>Save & Print</span>
                  {renderShortcutKey('pos-save-print')}
                </button>
              </div>
            </div>
          </footer>
        </section>
          </section>
        </section>
      )}

      {pendingPriceItem && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Item amount required">
          <div className="quick-panel open-price-panel">
            <div className="panel-head">
              <div>
                <strong>Item Amount Required</strong>
                <span>{pendingPriceItem.name}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingPriceItem(null)
                  setPendingPriceValue('')
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="open-price-card">
              <Banknote size={26} />
              <div>
                <span>Menu price is zero</span>
                <strong>Enter amount before adding to cart</strong>
              </div>
            </div>

            <label className="dialog-field open-price-field">
              Item Amount
              <input
                autoFocus
                min="0.01"
                step="0.01"
                type="number"
                placeholder="0.00"
                value={pendingPriceValue}
                onChange={(event) => setPendingPriceValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    savePendingPriceItem()
                  }
                }}
              />
            </label>

            <div className="panel-actions">
              <button
                className="small-button"
                type="button"
                onClick={() => {
                  setPendingPriceItem(null)
                  setPendingPriceValue('')
                }}
              >
                Cancel
              </button>
              <button className="small-button primary" type="button" onClick={savePendingPriceItem}>
                <Plus size={16} />
                Add Item
              </button>
            </div>
          </div>
        </div>
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

      {tableSetupOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Table setup">
          <div className="table-setup-panel">
            <div className="panel-head">
              <div>
                <strong>Table Setup</strong>
                <span>{diningTableGroups.length} area(s) / {tableList.length} table(s)</span>
              </div>
              <button type="button" onClick={() => setTableSetupOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="table-setup-layout">
              <section className="table-area-list">
                <div className="printer-section-title">
                  <strong>Dining Areas</strong>
                  <span>{tableStatus.size} occupied</span>
                </div>
                <div className="table-area-buttons">
                  {diningTableGroups.map((group) => (
                    <button
                      className={editingTableGroupId === group.id ? 'active' : ''}
                      key={group.id}
                      type="button"
                      onClick={() => editTableGroup(group)}
                    >
                      <strong>{group.label}</strong>
                      <span>{group.tables.length} table(s)</span>
                    </button>
                  ))}
                </div>
                <div className="table-setup-actions">
                  <button className="small-button" type="button" onClick={newTableGroupDraft}>
                    <Plus size={16} />
                    New Area
                  </button>
                </div>
              </section>

              <section className="table-area-editor">
                <div className="printer-section-title">
                  <strong>{editingTableGroupId ? 'Edit Area' : 'Add Area'}</strong>
                  <span>{selectedTableSetupGroup?.label || 'New dining area'}</span>
                </div>

                <div className="dialog-grid single">
                  <label className="dialog-field">
                    Area Name
                    <input
                      placeholder="Main Hall"
                      value={tableGroupName}
                      onChange={(event) => setTableGroupName(event.target.value)}
                    />
                  </label>
                  <label className="dialog-field">
                    Tables
                    <textarea
                      placeholder="T1, T2, T3"
                      value={tableGroupTables}
                      onChange={(event) => setTableGroupTables(event.target.value)}
                    />
                  </label>
                </div>

                <div className="table-preview-grid">
                  {parseDiningTableNames(tableGroupTables).map((tableName) => (
                    <button
                      className="table-preview-chip"
                      key={tableName}
                      type="button"
                      title={hasCloudFeatureAccess && hasGoldLocalPlan ? `Show QR for ${tableName}` : 'QR requires Gold local POS server'}
                      onClick={() => {
                        if (hasCloudFeatureAccess && hasGoldLocalPlan) {
                          void openTableQrPreview(tableName)
                        }
                      }}
                    >
                      <span>{tableName}</span>
                      {hasCloudFeatureAccess && hasGoldLocalPlan && <QrCode size={15} />}
                    </button>
                  ))}
                </div>

                <div className="panel-actions">
                  {editingTableGroupId && (
                    <button className="small-button danger" type="button" onClick={() => deleteTableGroup(editingTableGroupId)}>
                      <Trash2 size={16} />
                      Delete
                    </button>
                  )}
                  <button className="small-button primary" type="button" onClick={saveTableGroup}>
                    <Save size={16} />
                    Save Area
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {tableQrPreview && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Table QR code">
          <div className="quick-panel table-qr-panel">
            <div className="panel-head">
              <div>
                <strong>{tableQrPreview.tableName} QR</strong>
                <span>Customer scan menu</span>
              </div>
              <button type="button" onClick={() => setTableQrPreview(null)} title="Close">
                <X size={18} />
              </button>
            </div>
            <div className="table-qr-card">
              <img src={tableQrPreview.dataUrl} alt={`${tableQrPreview.tableName} QR code`} />
              <strong>{receiptBusinessName}</strong>
              <span>{tableQrPreview.url}</span>
            </div>
            <div className="panel-actions">
              <button className="small-button" type="button" onClick={() => void navigator.clipboard?.writeText(tableQrPreview.url)}>
                <Save size={16} />
                Copy URL
              </button>
              <button className="small-button primary" type="button" onClick={printTableQrPreview}>
                <Printer size={16} />
                Print QR
              </button>
            </div>
          </div>
        </div>
      )}

      {qrOrdersOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Table QR orders">
          <div className="orders-panel qr-orders-panel">
            <div className="panel-head">
              <div>
                <strong>Table QR Orders</strong>
                <span>{pendingQrOrders.length} pending order(s)</span>
              </div>
              <button type="button" onClick={() => setQrOrdersOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="qr-order-list">
              {pendingQrOrders.length ? (
                pendingQrOrders.map((qrOrder) => {
                  const existingTableOrder = openOrders.find(
                    (order) =>
                      order.orderType === 'Dining' &&
                      getSavedOrderTables(order).some(
                        (tableName) => tableName.toLowerCase() === qrOrder.table.toLowerCase(),
                      ),
                  )

                  return (
                    <article className="qr-order-card" key={qrOrder.id}>
                      <div className="qr-order-head">
                        <div>
                          <strong>{qrOrder.table}</strong>
                          <span>
                            {qrOrder.customerName || 'Guest'}
                            {qrOrder.customerPhone ? ` / ${qrOrder.customerPhone}` : ''}
                          </span>
                        </div>
                        <div>
                          <strong>{money(qrOrder.totals.total)}</strong>
                          <span>{formatDateTime(new Date(qrOrder.createdAt))}</span>
                        </div>
                      </div>
                      <div className="qr-order-meta">
                        <span>Ref {qrOrder.shortId || qrOrder.id.slice(-6).toUpperCase()}</span>
                        <span>
                          {qrOrder.cart.reduce((sum, line) => sum + Number(line.qty || 0), 0)} item(s)
                        </span>
                        <span>Updated {formatDateTime(new Date(qrOrder.updatedAt))}</span>
                        <strong className={existingTableOrder ? 'merge' : 'new'}>
                          {existingTableOrder
                            ? `Merges with Bill #${existingTableOrder.billNo}`
                            : 'Creates new dining bill'}
                        </strong>
                      </div>
                      <div className="qr-order-lines">
                        {qrOrder.cart.map((line) => (
                          <div key={line.id}>
                            <span>{line.qty} x {line.name}</span>
                            <strong>{money(lineTotal(line))}</strong>
                          </div>
                        ))}
                      </div>
                      {qrOrder.note && <p className="qr-order-note">{qrOrder.note}</p>}
                      <div className="qr-order-actions">
                        <button className="small-button danger" type="button" onClick={() => rejectQrOrder(qrOrder)}>
                          <X size={16} />
                          Reject
                        </button>
                        <button className="small-button" type="button" onClick={() => acceptQrOrder(qrOrder)}>
                          <Save size={16} />
                          Add to Bill
                        </button>
                        <button className="small-button primary" type="button" onClick={() => acceptQrOrder(qrOrder, true)}>
                          <Printer size={16} />
                          Add + KOT
                        </button>
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="empty-state">
                  <QrCode size={34} />
                  <strong>No pending QR orders</strong>
                  <span>Customer table QR orders will appear here.</span>
                </div>
              )}
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
                <span>{seatingMode === 'group' ? 'Select two or more free tables for one group bill' : 'Occupied tables open saved unclosed or hold orders'}</span>
              </div>
              <button type="button" onClick={() => setTableSelectorOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="seating-mode-tabs" aria-label="Seating mode">
              <button
                className={seatingMode === 'individual' ? 'active' : ''}
                type="button"
                onClick={() => {
                  setSeatingMode('individual')
                  setDiningGroupName('')
                }}
              >
                <User size={16} />
                Individual
              </button>
              <button
                className={seatingMode === 'group' ? 'active' : ''}
                type="button"
                onClick={() => {
                  setSeatingMode('group')
                  if (!selectedTables.length && table) {
                    setSelectedTables(getDiningTablesFromLabel(table))
                  }
                }}
              >
                <UtensilsCrossed size={16} />
                Group
              </button>
            </div>

            {seatingMode === 'group' && (
              <div className="group-seat-bar">
                <label className="group-seat-name-field">
                  <span>Group Name</span>
                  <div className="group-seat-input">
                    <UtensilsCrossed size={16} />
                    <input
                      placeholder="Family 1"
                      value={diningGroupName}
                      onChange={(event) => setDiningGroupName(event.target.value)}
                    />
                  </div>
                </label>
                <div className="group-seat-summary">
                  <span>{selectedTables.length} selected</span>
                  <strong>{selectedTables.length ? sortTablesByLayout(selectedTables, tableList).join(', ') : 'No tables'}</strong>
                </div>
                <button className="small-button primary" type="button" onClick={saveGroupedTables}>
                  <Save size={16} />
                  Apply Group
                </button>
              </div>
            )}

            <div className="table-group-tabs" aria-label="Table groups">
              {diningTableGroups.map((group) => {
                const occupiedCount = group.tables.filter((tableNo) => tableStatus.has(tableNo)).length
                return (
                  <button
                    className={activeTableGroupId === group.id ? 'active' : ''}
                    key={group.id}
                    type="button"
                    onClick={() => setActiveTableGroupId(group.id)}
                  >
                    <strong>{group.label}</strong>
                    <span>
                      {occupiedCount}/{group.tables.length} busy
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="table-grid">
              {visibleTableList.map((tableNo) => {
                const savedOrder = tableStatus.get(tableNo)
                const isSelected = table === tableNo
                const isGroupSelected = seatingMode === 'group' && selectedTables.includes(tableNo)
                const className = [
                  'table-tile',
                  isSelected || isGroupSelected ? 'active' : '',
                  savedOrder ? savedOrder.status : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button
                    className={className}
                    key={tableNo}
                    type="button"
                    onClick={() => (seatingMode === 'group' ? toggleGroupTable(tableNo) : selectTable(tableNo))}
                  >
                    <strong>{tableNo}</strong>
                    <span>{savedOrder ? `${savedOrder.status} - ${money(savedOrder.totals.total)}` : 'Free'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {staffCodePromptOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Staff code">
          <div className="quick-panel staff-code-panel">
            <div className="panel-head">
              <div>
                <strong>Staff Code</strong>
                <span>{getSeatingDisplayLabel(seatingMode, table, selectedTables, diningGroupName) || 'Selected table'}</span>
              </div>
              <button type="button" onClick={() => setStaffCodePromptOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <label className="dialog-field">
              Enter Staff Code
              <input
                autoFocus
                value={staffCodeInput}
                onChange={(event) => {
                  const code = normalizeStaffCode(event.currentTarget.value)
                  const matchedStaff = activeServiceStaff.find((staffMember) => normalizeStaffCode(staffMember.code) === code)
                  setStaffCodeInput(code)
                  setStaffCodeStatus(matchedStaff ? `${matchedStaff.name} found` : code ? 'Enter a valid saved staff code' : 'Enter staff code')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    applyStaffCode()
                  }
                }}
                placeholder="Staff code"
              />
            </label>

            {staffCodeStatus && <div className="sync-message">{staffCodeStatus}</div>}

            <div className="staff-code-preview">
              <span>Selected Staff</span>
              <strong>{staffCodePreviewStaff?.name || selectedServiceStaffName || 'Not selected'}</strong>
            </div>

            <div className="staff-picker">
              <div className="staff-picker-title">
                <strong>Select Staff</strong>
                <span>{activeServiceStaff.length} available</span>
              </div>
              <div className="staff-picker-list">
                {activeServiceStaff.map((staffMember) => (
                  <button
                    className={staffMember.id === selectedServiceStaffId ? 'staff-picker-row active' : 'staff-picker-row'}
                    key={staffMember.id}
                    type="button"
                    onClick={() => selectServiceStaffForBill(staffMember)}
                  >
                    <span>{staffMember.code}</span>
                    <strong>{staffMember.name}</strong>
                  </button>
                ))}
                {!activeServiceStaff.length && (
                  <div className="empty-note">No active staff saved. Add staff from Staff Page.</div>
                )}
              </div>
            </div>

            <div className="panel-actions">
              <button
                className="small-button"
                type="button"
                onClick={() => {
                  setStaffCodePromptOpen(false)
                  goToView('service_staff')
                }}
              >
                <User size={16} />
                Staff Page
              </button>
              <button className="small-button primary" type="button" onClick={applyStaffCode}>
                <Save size={16} />
                Apply Staff
              </button>
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
                      <div
                        className={[
                          'customer-picker-row',
                          selectedCustomerId === profile.id ? 'active' : '',
                          profile.creditBalance > 0 ? 'has-due' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        key={profile.id}
                      >
                        <button className="customer-select-button" type="button" onClick={() => selectCustomerProfile(profile)}>
                          <div className="customer-row-head">
                            <strong className="customer-name-with-badge">
                              {profile.name}
                              {profile.creditBalance > 0 && <small className="due-badge">DUE</small>}
                            </strong>
                            <span>{profile.creditBalance > 0 ? money(profile.creditBalance) : 'No Due'}</span>
                          </div>
                          <span>{profile.phone || 'No phone'}</span>
                        </button>
                        <button
                          className="customer-edit-button"
                          type="button"
                          onClick={() => editCustomerProfile(profile)}
                          aria-label={`Edit ${profile.name}`}
                          title={`Edit ${profile.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="empty-customer-list">
                      {customers.length ? 'No matching customer' : 'No saved customers yet'}
                    </div>
                  )}
                </div>
              </section>

              <section className="customer-detail-panel">
                {selectedCustomerProfile && !customerDetailEditing ? (
                  <>
                    <div className="customer-readonly-head">
                      <div>
                        <span>Selected Customer</span>
                        <strong>{selectedCustomerProfile.name}</strong>
                      </div>
                      <button
                        className="small-button icon-only"
                        type="button"
                        onClick={() => editCustomerProfile(selectedCustomerProfile)}
                        aria-label={`Edit ${selectedCustomerProfile.name}`}
                        title={`Edit ${selectedCustomerProfile.name}`}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>

                    <div className="customer-summary-card">
                      <div>
                        <span>Mobile Number</span>
                        <strong>{selectedCustomerProfile.phone || 'Not set'}</strong>
                      </div>
                      <div>
                        <span>Balance Due</span>
                        <strong className="customer-name-with-badge">
                          {money(selectedCustomerProfile.creditBalance)}
                          {selectedCustomerProfile.creditBalance > 0 && <small className="due-badge">DUE</small>}
                        </strong>
                      </div>
                    </div>

                    <div className="customer-due-section">
                      <div className="customer-list-head">
                        <strong>Unpaid Bills</strong>
                        <span>{selectedCustomerUnpaidOrders.length} bill(s)</span>
                      </div>
                      <div className="customer-due-list">
                        {selectedCustomerUnpaidOrders.length ? (
                          selectedCustomerUnpaidOrders.map((order) => (
                            <div className="customer-due-row" key={order.id}>
                              <div>
                                <span>Bill #{order.billNo}</span>
                                <strong>{order.orderType} {order.table ? `/ ${order.table}` : ''}</strong>
                              </div>
                              <span>{formatDate(new Date(order.createdAt))}</span>
                              <strong>{money(order.totals.balance)}</strong>
                            </div>
                          ))
                        ) : (
                          <div className="empty-customer-list">No unpaid bills for this customer</div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="customer-readonly-head">
                      <div>
                        <span>{selectedCustomerProfile ? 'Edit Customer' : 'New Customer'}</span>
                        <strong>{selectedCustomerProfile?.name || 'Enter customer details'}</strong>
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
                              setCustomerDetailEditing(false)
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
                  </>
                )}

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
                    disabled={Boolean(selectedCustomerProfile && !customerDetailEditing)}
                    type="button"
                    onClick={() => {
                      if (saveCustomerProfile()) {
                        setCustomerDetailEditing(false)
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

            <div className="discount-mode-tabs" aria-label="Discount type">
              <button
                className={discountMode === 'percent' ? 'active' : ''}
                type="button"
                onClick={() => setDiscountMode('percent')}
              >
                <BadgePercent size={16} />
                Percent
              </button>
              <button
                className={discountMode === 'amount' ? 'active' : ''}
                type="button"
                onClick={() => setDiscountMode('amount')}
              >
                <Banknote size={16} />
                Amount
              </button>
            </div>

            <div className="dialog-grid single">
              <label className="dialog-field">
                {discountMode === 'percent' ? 'Discount %' : 'Discount Amount'}
                <input
                  autoFocus
                  type="number"
                  min="0"
                  max={discountMode === 'percent' ? '100' : undefined}
                  value={discountMode === 'percent' ? discountPercent : discountAmount}
                  onChange={(event) => {
                    const value = numberFromInput(event.target.value)
                    if (discountMode === 'percent') {
                      setDiscountPercent(clamp(value, 0, 100))
                      return
                    }

                    setDiscountAmount(clamp(value, 0, baseTotals.subtotal))
                  }}
                />
              </label>
            </div>

            <div className="discount-preview">
              <span>Subtotal</span>
              <strong>{money(baseTotals.subtotal)}</strong>
              <span>Discount</span>
              <strong>{money(baseTotals.discount)}</strong>
            </div>

            <div className="panel-actions">
              <button
                className="small-button"
                type="button"
                onClick={() => {
                  setDiscountMode('percent')
                  setDiscountPercent(0)
                  setDiscountAmount(0)
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
                <span>{activeLineEditorLine?.name}</span>
              </div>
              <button type="button" onClick={() => setLineEditor(null)} title="Close">
                <X size={18} />
              </button>
            </div>

            {lineEditor.mode === 'discount' && (
              <div className="discount-mode-tabs" aria-label="Item discount type">
                <button
                  className={(lineEditor.discountMode ?? 'percent') === 'percent' ? 'active' : ''}
                  type="button"
                  onClick={() =>
                    setLineEditor({
                      ...lineEditor,
                      discountMode: 'percent',
                      value: String(activeLineEditorLine?.discountPercent ?? 0),
                    })
                  }
                >
                  <BadgePercent size={16} />
                  Percent
                </button>
                <button
                  className={lineEditor.discountMode === 'amount' ? 'active' : ''}
                  type="button"
                  onClick={() =>
                    setLineEditor({
                      ...lineEditor,
                      discountMode: 'amount',
                      value: String(activeLineEditorLine?.discountAmount ?? 0),
                    })
                  }
                >
                  <Banknote size={16} />
                  Amount
                </button>
              </div>
            )}

            <label className="dialog-field">
              {lineEditor.mode === 'discount' && lineEditor.discountMode === 'amount'
                ? 'Discount Amount'
                : getLineEditorLabel(lineEditor.mode)}
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
                  max={
                    lineEditor.mode === 'discount' && (lineEditor.discountMode ?? 'percent') === 'percent'
                      ? '100'
                      : undefined
                  }
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
                <div className="orders-total-summary">
                  <span>{formatDate(selectedOrderListDay)}</span>
                  <strong>Total {money(visibleOrdersTotal)}</strong>
                  <small>Selected {selectedVisibleOrders.length} / {money(selectedOrdersTotal)}</small>
                </div>
              </div>
            )}

            <div className="orders-select-toolbar">
              <label>
                <input
                  type="checkbox"
                  checked={allVisibleOrdersSelected}
                  disabled={!visibleOrders.length}
                  onChange={toggleAllVisibleOrders}
                />
                Select
              </label>
              <div>
                <span>{selectedVisibleOrders.length} selected</span>
                <strong>{money(selectedOrdersTotal)}</strong>
              </div>
              {selectedVisibleOrders.length > 0 && (
                <button
                  className="small-button danger icon-only"
                  type="button"
                  onClick={deleteSelectedOrders}
                  aria-label={`Delete ${selectedVisibleOrders.length} selected order${selectedVisibleOrders.length === 1 ? '' : 's'}`}
                  title={`Delete ${selectedVisibleOrders.length} selected order${selectedVisibleOrders.length === 1 ? '' : 's'}`}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>

            <div className="orders-list">
              {visibleOrders.map((order) => (
                <article className={`saved-order ${order.status}`} key={order.id}>
                  <label className="order-select-cell" title={`Select bill ${order.billNo}`}>
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                    />
                  </label>
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
                <span>Amount Received</span>
                <strong>{money(report.receivedTotal)}</strong>
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
                <div className="report-line">
                  <span>Cash</span>
                  <strong>{money(report.cashReceivedTotal)}</strong>
                </div>
                <div className="report-line">
                  <span>UPI</span>
                  <strong>{money(report.upiTotal)}</strong>
                </div>
                <div className="report-line">
                  <span>Card</span>
                  <strong>{money(report.cardTotal)}</strong>
                </div>
                <div className="report-line">
                  <span>Due / Credit</span>
                  <strong>{money(report.balanceTotal)}</strong>
                </div>
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
              {hasCloudFeatureAccess && hasPermission('cloud_sync') && (
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
              {hasPermission('user_manage') && (
                <button className="small-button danger" type="button" onClick={() => void completeActivationLogout()}>
                  <LogOut size={16} />
                  Complete Logout
                </button>
              )}
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

      {activeView === 'menu' && (
        <section className="menu-setup-view page-view">
          <div className="page-head">
            <div>
              <span>Menu</span>
              <h1>Menu Setup</h1>
              <p>Manage categories, item photos, prices, tax, availability, and priority order</p>
            </div>
            <button className="home-action" type="button" onClick={() => goToView('home')}>
              <Home size={18} />
              Home
            </button>
          </div>

          <div className="menu-editor-panel full-page-panel">
            <div className="panel-head">
              <div>
                <strong>Menu Editor</strong>
                <span>Add or edit categories and items</span>
              </div>
            </div>

            <div className="editor-layout">
              <section className="editor-section">
                <div className="editor-title">
                  <strong>Categories</strong>
                  <span>{editableCategories.length} active</span>
                </div>

                <div className="inline-form">
                  <input
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
                  <button
                    className={itemDraft.imageDataUrl ? 'item-photo-preview clickable' : 'item-photo-preview'}
                    type="button"
                    disabled={!itemDraft.imageDataUrl}
                    onClick={() => itemDraft.imageDataUrl && setItemImagePreviewOpen(true)}
                    title={itemDraft.imageDataUrl ? 'Open image preview' : 'No image selected'}
                  >
                    {itemDraft.imageDataUrl ? (
                      <img src={itemDraft.imageDataUrl} alt="" />
                    ) : (
                      <ImagePlus size={24} />
                    )}
                  </button>
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
                      disabled={itemImageSearching}
                      onClick={generateItemImage}
                    >
                      <RefreshCw size={16} />
                      {itemImageSearching ? 'Searching...' : itemDraft.imageDataUrl ? 'Regenerate' : 'Generate Image'}
                    </button>
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => {
                        setItemDraft((draft) => ({ ...draft, imageDataUrl: '' }))
                        setItemImagePreviewOpen(false)
                        setItemImageStatus('Image removed')
                      }}
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </div>
                </div>
                {itemImageStatus && <div className="image-generate-status">{itemImageStatus}</div>}

                <div className="item-form">
                  <label>
                    Item Name
                    <input
                      value={itemDraft.name}
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setItemDraft((draft) => ({ ...draft, name: value }))
                      }}
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={itemDraft.category}
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setItemDraft((draft) => ({ ...draft, category: value }))
                      }}
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
                      value={itemDraft.price}
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setItemDraft((draft) => ({ ...draft, price: value }))
                      }}
                    />
                    {itemDraft.price.trim() !== '' && Number(itemDraft.price) === 0 && (
                      <span className="item-price-help">
                        Zero price item will ask amount before adding to cart.
                      </span>
                    )}
                  </label>
                  <label>
                    GST Rate (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={itemDraft.taxRate}
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setItemDraft((draft) => ({ ...draft, taxRate: value }))
                      }}
                    />
                  </label>
                  <label>
                    Tags
                    <input
                      value={itemDraft.tags}
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setItemDraft((draft) => ({ ...draft, tags: value }))
                      }}
                    />
                  </label>
                  <label className="toggle-field">
                    Availability
                    <button
                      type="button"
                      className={itemDraft.available ? 'availability-toggle available' : 'availability-toggle unavailable'}
                      onClick={() =>
                        setItemDraft((draft) => ({
                          ...draft,
                          available: !draft.available,
                        }))
                      }
                    >
                      {itemDraft.available ? 'Available' : 'Unavailable'}
                    </button>
                  </label>
                  {!itemDraft.available && (
                    <label className="wide-field">
                      Unavailable Reason
                      <input
                        value={itemDraft.unavailableReason}
                        onChange={(event) => {
                          const value = event.currentTarget.value
                          setItemDraft((draft) => ({ ...draft, unavailableReason: value }))
                        }}
                      />
                    </label>
                  )}
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
                    <div
                      className={isMenuItemAvailable(item) ? 'editor-row item-editor-row' : 'editor-row item-editor-row unavailable'}
                      key={item.id}
                    >
                      <button className="row-main" type="button" onClick={() => editMenuItem(item)}>
                        <span className="item-row-thumb">
                          {item.imageDataUrl ? <img src={item.imageDataUrl} alt="" /> : <ImagePlus size={14} />}
                        </span>
                        <span>{item.name}</span>
                        <strong>{item.price <= 0 ? 'Open Price' : `Rs. ${item.price.toFixed(2)}`}</strong>
                      </button>
                      <button
                        type="button"
                        title={isMenuItemAvailable(item) ? 'Mark unavailable' : 'Mark available'}
                        onClick={() => toggleMenuItemAvailability(item.id)}
                      >
                        {isMenuItemAvailable(item) ? 'On' : 'Off'}
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
        </section>
      )}

      {itemImagePreviewOpen && itemDraft.imageDataUrl && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Item image preview">
          <div className="quick-panel item-image-preview-panel">
            <div className="panel-head">
              <div>
                <strong>{itemDraft.name.trim() || 'Generated Image'}</strong>
                <span>Preview selected product image</span>
              </div>
              <button type="button" onClick={() => setItemImagePreviewOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>
            <div className="item-image-preview-large">
              <img src={itemDraft.imageDataUrl} alt="" />
            </div>
            <div className="panel-actions">
              <button className="small-button" type="button" disabled={itemImageSearching} onClick={generateItemImage}>
                <RefreshCw size={16} />
                {itemImageSearching ? 'Searching...' : 'Regenerate'}
              </button>
              <button className="small-button primary" type="button" onClick={() => setItemImagePreviewOpen(false)}>
                <Save size={16} />
                Use This Image
              </button>
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
                  setPrinterOpen(false)
                  setActiveView('printers')
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

      {activeView === 'printers' && (
        <section className="printer-manage-view page-view">
          <div className="page-head">
            <div>
              <span>Printer</span>
              <h1>Printer Manage</h1>
              <p>Add printers, choose installed devices, and manage group-wise KOT routing</p>
            </div>
            <button className="home-action primary" type="button" onClick={refreshPrinters}>
              <RefreshCw size={18} />
              Refresh Printers
            </button>
          </div>

          <div className="printer-dashboard-layout">
            <section className="printer-add-card home-card">
              <div className="section-title">
                <div>
                  <strong>Add New Printer</strong>
                  <span>Create a printer profile, then configure device, KOT categories, and table groups</span>
                </div>
              </div>

              <div className="printer-add-hero">
                <div className="printer-summary-icon">
                  <Printer size={24} />
                </div>
                <strong>Start printer setup</strong>
                <span>Use this for bill, kitchen, juice, tea, floor-wise KOT, or any custom station.</span>
                <button className="small-button primary" type="button" onClick={openNewPrinterConfiguration}>
                  <Plus size={16} />
                  Add New Printer
                </button>
              </div>

              <div className="printer-status-line">{printerStatus}</div>
            </section>

            <section className="printer-list-card home-card">
              <div className="section-title">
                <div>
                  <strong>Saved Printers</strong>
                  <span>{printerProfiles.length} profile(s)</span>
                </div>
              </div>

              <div className="printer-review-list">
                {printerProfiles.map((profile) => {
                  const categoryLabels = getPrinterCategoryLabels(profile, categoryList)
                  const tableGroupLabels = getPrinterTableGroupLabels(profile, diningTableGroups)
                  const isBillDefault = profile.id === billPrinterProfile?.id

                  return (
                    <article className="printer-review-row" key={profile.id}>
                      <div className="printer-review-main">
                        <div className="printer-summary-icon">
                          <Printer size={20} />
                        </div>
                        <div>
                          <div className="printer-review-title">
                            <strong>{profile.name || 'Printer Profile'}</strong>
                            {isBillDefault && <span>Bill default</span>}
                          </div>
                          <p>{describePrinterSettings(profile.settings)}</p>
                        </div>
                      </div>

                      <div className="printer-review-tags">
                        <span>{profile.settings.deviceName || 'Select printer'}</span>
                        <span>POS {profile.settings.paperWidth || '80'}mm</span>
                        <span>{categoryLabels.length ? `${categoryLabels.length} KOT group(s)` : 'No KOT route'}</span>
                        <span>{tableGroupLabels.length ? tableGroupLabels.join(', ') : 'All tables'}</span>
                      </div>

                      <div className="printer-review-actions">
                        <button
                          className="small-button icon-only"
                          type="button"
                          title="Edit printer"
                          aria-label={`Edit ${profile.name || 'printer'}`}
                          onClick={() => {
                            setActivePrinterProfileId(profile.id)
                            setPrinterDraftProfile(createPrinterEditDraft(profile))
                            setPendingNewPrinterId('')
                            setPrinterRouteCategoryId('')
                            setPrinterRouteTableGroupId('')
                            setActiveView('printer_config')
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="small-button icon-only"
                          type="button"
                          title="Test print"
                          aria-label={`Test ${profile.name || 'printer'}`}
                          onClick={() => testPrinter(profile.id)}
                        >
                          <Printer size={16} />
                        </button>
                        {profile.id !== billPrinterProfile?.id && (
                          <button
                            className="small-button danger icon-only"
                            type="button"
                            title="Remove printer"
                            aria-label={`Remove ${profile.name || 'printer'}`}
                            onClick={() => deletePrinterProfile(profile.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          </div>
        </section>
      )}

      {activeView === 'printer_config' && (
        <section className="printer-config-view page-view">
          <div className="page-head">
            <div>
              <span>Printer</span>
              <h1>{activePrinterDraft?.name || 'Printer Configuration'}</h1>
              <p>Configure printer device, receipt size, KOT categories, and table groups</p>
            </div>
            <div className="page-head-actions">
              <button className="home-action primary" type="button" onClick={saveActivePrinterProfile}>
                <Save size={18} />
                Save
              </button>
              <button className="home-action" type="button" onClick={closePrinterConfiguration}>
                <X size={18} />
                Close
              </button>
            </div>
          </div>

          <div className="printer-config-layout">
            <section className="printer-setup-card home-card">
              <div className="section-title">
                <div>
                  <strong>1. Printer Details</strong>
                  <span>Name the profile, choose the Windows printer, and set paper width</span>
                </div>
              </div>

              <div className="printer-details-grid">
                <label className="dialog-field">
                  Printer Name
                  <input
                    value={activePrinterDraft?.name ?? ''}
                    onChange={(event) => updateActivePrinterProfileName(event.target.value)}
                  />
                </label>

                <div className="printer-install-panel compact">
                  <div className="method-panel-head">
                    <strong>Installed Windows Printer</strong>
                    <span>Select the exact printer queue from Windows. Press Refresh after adding or renaming a printer.</span>
                  </div>
                  <div className="panel-grid compact">
                  <label>
                    <select
                      value={activePrinterSettings.deviceName}
                      onChange={(event) =>
                        updateActivePrinterProfileSettings({
                          deviceName: event.target.value,
                          mode: 'system',
                          printMethod: 'driver',
                        })
                      }
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
                </div>

                <div className="paper-row compact">
                  <span>Paper Width</span>
                  <button
                    className={activePrinterSettings.paperWidth === '80' ? 'active' : ''}
                    type="button"
                    onClick={() => updateActivePrinterProfileSettings({ paperWidth: '80' })}
                  >
                    POS 80mm
                  </button>
                  <button
                    className={activePrinterSettings.paperWidth === '58' ? 'active' : ''}
                    type="button"
                    onClick={() => updateActivePrinterProfileSettings({ paperWidth: '58' })}
                  >
                    POS 58mm
                  </button>
                </div>
              </div>

              <div className="panel-actions">
                <button className="small-button" type="button" onClick={() => testPrinter()}>
                  <Printer size={16} />
                  Test Print
                </button>
                <button className="small-button" type="button" onClick={() => testKotPrinter()}>
                  <Printer size={16} />
                  Test KOT
                </button>
                {!pendingNewPrinterId && activePrinterDraft?.id !== billPrinterProfile?.id && (
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => {
                      if (activePrinterDraft) {
                        setBillPrinterProfileId(activePrinterDraft.id)
                        setPrinterStatus(`${activePrinterDraft.name} set as bill printer`)
                      }
                    }}
                  >
                    <ReceiptText size={16} />
                    Use for Bill
                  </button>
                )}
                {activePrinterDraft?.id !== billPrinterProfile?.id && (
                  <button className="small-button danger" type="button" onClick={deleteActivePrinterProfile}>
                    <Trash2 size={16} />
                    Remove
                  </button>
                )}
              </div>
            </section>

            <section className="printer-routing-card printer-setup-card home-card">
              <div className="section-title">
                <div>
                  <strong>2. KOT Routing Automation</strong>
                  <span>Route item groups to the correct printer automatically during Print KOT</span>
                </div>
              </div>

              <div className="routing-help-box">
                <strong>How routing works</strong>
                <span>
                  Priority is category plus table/floor group first, then category-only routes. Items without a matching route print on the bill/default printer.
                </span>
              </div>

              <div className="routing-priority-grid">
                <div>
                  <span>1</span>
                  <strong>Category + table/floor</strong>
                </div>
                <div>
                  <span>2</span>
                  <strong>Category only</strong>
                </div>
                <div>
                  <span>3</span>
                  <strong>Bill/default printer</strong>
                </div>
              </div>

              <div className="routing-section-head">
                <div>
                  <strong>Add Category</strong>
                  <span>Choose food sections handled by this printer</span>
                </div>
              </div>

              <div className="route-add-row">
                <select
                  value={printerRouteCategoryId}
                  onChange={(event) => setPrinterRouteCategoryId(event.target.value)}
                >
                  <option value="">Select category</option>
                  {editableCategories
                    .filter((category) => !activePrinterDraft?.categoryIds.includes(category.id))
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                </select>
                <button className="small-button primary" type="button" onClick={addActivePrinterCategoryRoute}>
                  <Plus size={16} />
                  Add Category
                </button>
              </div>

              <div className="route-ticket-list">
                {activePrinterDraft?.categoryIds.length ? (
                  activePrinterDraft.categoryIds.map((categoryId) => (
                    <button className="route-ticket" key={categoryId} type="button" onClick={() => toggleActivePrinterCategory(categoryId)}>
                      <span>{getCategoryDisplayLabel(categoryId, categoryList)}</span>
                      <X size={14} />
                    </button>
                  ))
                ) : (
                  <div className="route-empty-state">No KOT category selected.</div>
                )}
              </div>

              <div className="routing-section-head">
                <div>
                  <strong>Table / Floor Group</strong>
                  <span>Optional. Leave blank to print for all tables.</span>
                </div>
              </div>

              <div className="route-add-row">
                <select
                  value={printerRouteTableGroupId}
                  onChange={(event) => setPrinterRouteTableGroupId(event.target.value)}
                  disabled={!diningTableGroups.length}
                >
                  <option value="">Select table / floor group</option>
                  {diningTableGroups
                    .filter((group) => !activePrinterDraft?.tableGroupIds.includes(group.id))
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.label}
                      </option>
                    ))}
                </select>
                <button className="small-button primary" type="button" onClick={addActivePrinterTableGroupRoute}>
                  <Plus size={16} />
                  Add Group
                </button>
              </div>

              <div className="route-ticket-list">
                {activePrinterDraft?.tableGroupIds.length ? (
                  activePrinterDraft.tableGroupIds.map((groupId) => {
                    const groupLabel = diningTableGroups.find((group) => group.id === groupId)?.label || 'Table group'
                    return (
                      <button className="route-ticket" key={groupId} type="button" onClick={() => toggleActivePrinterTableGroup(groupId)}>
                        <span>{groupLabel}</span>
                        <X size={14} />
                      </button>
                    )
                  })
                ) : (
                  <div className="route-empty-state">All tables will use this route.</div>
                )}
              </div>
            </section>

          </div>
        </section>
      )}

      {accessPrompt && (
        <div className="modal-layer access-prompt-layer" role="alertdialog" aria-modal="true" aria-label={accessPrompt.title}>
          <div className="quick-panel access-prompt-panel">
            <div className="panel-head">
              <div>
                <strong>{accessPrompt.title}</strong>
                <span>Admin permission required</span>
              </div>
              <button type="button" onClick={() => setAccessPrompt(null)} title="Close">
                <X size={18} />
              </button>
            </div>
            <div className="access-prompt-body">
              <div className="access-prompt-icon">
                <User size={22} />
              </div>
              <div>
                <strong>No access for this user</strong>
                <p>{accessPrompt.message}</p>
              </div>
            </div>
            <div className="panel-actions">
              <button className="small-button primary" type="button" onClick={() => setAccessPrompt(null)}>
                OK
              </button>
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

function getDiscountValue(baseAmount: number, mode: DiscountMode, percent = 0, amount = 0) {
  const safeBaseAmount = Math.max(Number(baseAmount || 0), 0)
  const rawDiscount =
    mode === 'amount' ? Number(amount || 0) : (safeBaseAmount * clamp(Number(percent || 0), 0, 100)) / 100

  return roundMoney(clamp(rawDiscount, 0, safeBaseAmount))
}

function getDiscountLabel(baseAmount: number, mode: DiscountMode, percent = 0, amount = 0) {
  const discount = getDiscountValue(baseAmount, mode, percent, amount)

  if (discount <= 0) {
    return 'Discount'
  }

  return mode === 'amount' ? `Rs. ${money(discount)}` : `${clamp(Number(percent || 0), 0, 100)}%`
}

function lineTotal(line: CartLine) {
  const gross = Number(line.qty || 0) * Number(line.price || 0)
  const discount = getDiscountValue(
    gross,
    line.discountMode ?? 'percent',
    line.discountPercent ?? 0,
    line.discountAmount ?? 0,
  )
  return roundMoney(Math.max(0, gross - discount))
}

function buildCartOnlyTotals(cart: CartLine[]): OrderTotals {
  const profile = loadStoredObject('pos-business-profile', defaultBusinessProfile)
  const isInclusive = profile?.gstType === 'inclusive'

  const subtotal = roundMoney(cart.reduce((sum, line) => sum + lineTotal(line), 0))
  const tax = isInclusive
    ? roundMoney(cart.reduce((sum, line) => sum + (lineTotal(line) * Number(line.taxRate || 0)) / (100 + Number(line.taxRate || 0)), 0))
    : roundMoney(cart.reduce((sum, line) => sum + (lineTotal(line) * Number(line.taxRate || 0)) / 100, 0))
  const total = isInclusive ? subtotal : roundMoney(subtotal + tax)

  return {
    subtotal,
    discount: 0,
    tax,
    serviceCharge: 0,
    total,
    paid: 0,
    balance: total,
    change: 0,
  }
}

function normalizeOrderTotals(totals: Partial<OrderTotals> | undefined, fallback: OrderTotals): OrderTotals {
  return {
    subtotal: roundMoney(Number(totals?.subtotal ?? fallback.subtotal)),
    discount: roundMoney(Number(totals?.discount ?? fallback.discount)),
    tax: roundMoney(Number(totals?.tax ?? fallback.tax)),
    serviceCharge: roundMoney(Number(totals?.serviceCharge ?? fallback.serviceCharge)),
    total: roundMoney(Number(totals?.total ?? fallback.total)),
    paid: roundMoney(Number(totals?.paid ?? fallback.paid)),
    balance: roundMoney(Number(totals?.balance ?? fallback.balance)),
    change: roundMoney(Number(totals?.change ?? fallback.change)),
  }
}

function mergeCartLines(baseCart: CartLine[], incomingCart: CartLine[]) {
  const merged = baseCart.map((line) => ({ ...line }))

  incomingCart.forEach((incomingLine) => {
    const existingLine = merged.find(
      (line) =>
        line.itemId === incomingLine.itemId &&
        line.price === incomingLine.price &&
        line.taxRate === incomingLine.taxRate &&
        normalizeLineDescription(line.description) === normalizeLineDescription(incomingLine.description) &&
        (line.discountMode ?? 'percent') === (incomingLine.discountMode ?? 'percent') &&
        Number(line.discountPercent ?? 0) === Number(incomingLine.discountPercent ?? 0) &&
        Number(line.discountAmount ?? 0) === Number(incomingLine.discountAmount ?? 0),
    )

    if (existingLine) {
      existingLine.qty = roundMoney(existingLine.qty + incomingLine.qty)
      return
    }

    merged.push({ ...incomingLine })
  })

  return merged
}

function normalizeLineDescription(value: unknown) {
  const description = String(value ?? '').trim()
  return description && description !== '0' ? description : ''
}

function getCartLineNote(line: CartLine) {
  const description = normalizeLineDescription(line.description)
  const gross = Number(line.qty || 0) * Number(line.price || 0)
  const itemDiscount = getDiscountValue(gross, line.discountMode ?? 'percent', line.discountPercent ?? 0, line.discountAmount ?? 0)
  const discountText =
    itemDiscount > 0
      ? line.discountMode === 'amount'
        ? `Rs. ${money(itemDiscount)} item discount`
        : `${clamp(Number(line.discountPercent ?? 0), 0, 100)}% item discount`
      : ''

  return [description, discountText].filter(Boolean).join(' / ')
}

function money(value: number) {
  return value.toFixed(2)
}

function getTableGroupId(tableNo: string, tableGroups: DiningTableGroup[]) {
  return tableGroups.find((group) => group.tables.includes(tableNo))?.id ?? tableGroups[0]?.id ?? ''
}

function getCurrentDiningTables(seatingMode: SeatingMode, tableLabel: string, selectedTables: string[]) {
  if (seatingMode === 'group') {
    return parseDiningTableNames(selectedTables)
  }

  return parseDiningTableNames(tableLabel)
}

function getSavedOrderTables(order: SavedOrder) {
  const savedTables = parseDiningTableNames(order.tables ?? [])
  if (savedTables.length) {
    return savedTables
  }

  return getDiningTablesFromLabel(order.table)
}

function getDiningTablesFromLabel(value: string) {
  const label = String(value ?? '')
  const labelParts = label.split('/')
  const tablePart = label.includes('/') ? labelParts[labelParts.length - 1] || '' : label
  return parseDiningTableNames(tablePart.replace(/\+/g, ','))
}

function getSeatingDisplayLabel(
  seatingMode: SeatingMode,
  tableLabel: string,
  selectedTables: string[],
  diningGroupName: string,
) {
  const tables = parseDiningTableNames(seatingMode === 'group' ? selectedTables : tableLabel)

  if (seatingMode === 'group') {
    if (tables.length < 2) {
      return ''
    }

    const groupName = diningGroupName.trim() || 'Group'
    return `${groupName} / ${tables.join(', ')}`
  }

  return tables[0] || ''
}

function sortTablesByLayout(tables: string[], tableList: string[]) {
  const layoutIndex = new Map(tableList.map((tableName, index) => [tableName.toLowerCase(), index]))

  return [...parseDiningTableNames(tables)].sort((first, second) => {
    const firstIndex = layoutIndex.get(first.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
    const secondIndex = layoutIndex.get(second.toLowerCase()) ?? Number.MAX_SAFE_INTEGER

    return firstIndex - secondIndex || first.localeCompare(second, undefined, { numeric: true })
  })
}

function printReportInBrowser(payload: ReportPrintPayload) {
  const printWindow = window.open('', '_blank', 'width=420,height=700')

  if (!printWindow) {
    throw new Error('Print window blocked')
  }

  printWindow.document.open()
  printWindow.document.write(buildReportPrintHtml(payload))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function openReportExportPrintWindow(html: string) {
  const printWindow = window.open('', '_blank', 'width=900,height=1200')

  if (!printWindow) {
    throw new Error('Export window blocked')
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildReportExportFileName(data: ReportExportData) {
  return safeReportFileName(`${data.businessName}-${data.period.label}-report`)
}

function safeReportFileName(value: string) {
  const cleaned = Array.from(value)
    .map((char) => (char.charCodeAt(0) < 32 ? '-' : char))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)

  return cleaned || 'GI-POS-Report'
}

function getReportSummaryRows(report: ReturnType<typeof buildReport>, openingCash: number) {
  const cashInHandWithOpening = roundMoney(openingCash + report.cashInHand)
  const rows: Array<{ label: string; value: number; always?: boolean; count?: boolean }> = [
    { label: 'Total Sales', value: report.salesTotal, always: true },
    { label: 'Amount Received', value: report.receivedTotal, always: true },
    { label: 'Paid Bills', value: report.paidCount, always: true, count: true },
    { label: 'Opening Cash', value: openingCash },
    { label: 'Cash Received', value: report.cashReceivedTotal },
    { label: 'Cash In Hand', value: cashInHandWithOpening, always: true },
    { label: 'UPI', value: report.upiTotal },
    { label: 'Card', value: report.cardTotal },
    { label: 'Bank', value: report.bankTotal, always: true },
    { label: 'Due / Credit', value: report.balanceTotal },
    { label: 'Discount', value: report.discountTotal },
    { label: 'Expense', value: report.expenseTotal },
    { label: 'Net Amount', value: report.netTotal, always: true },
    { label: 'Open Amount', value: report.openTotal },
    { label: 'Open Bills', value: report.openCount, count: true },
  ]

  return rows
    .filter((row) => row.always || reportNumberHasValue(row.value))
    .map((row) => [row.label, row.count ? String(row.value) : money(row.value)])
}

function appendCsvSection(rows: string[][], title: string, headers: string[], dataRows: string[][]) {
  if (!dataRows.length) {
    return
  }

  rows.push([], [title], headers, ...dataRows)
}

function reportNumberHasValue(value: number) {
  return Math.abs(Number(value) || 0) >= 0.005
}

function buildReportCsv(data: ReportExportData) {
  const report = data.reportData
  const paymentRows = paymentMethods
    .map((method) => [method, money(report.paymentTotals[method] ?? 0), report.paymentTotals[method] ?? 0] as const)
    .filter((row) => reportNumberHasValue(row[2]))
    .map(([method, amount]) => [method, amount])
  const orderTypeRows = orderTypes
    .map(
      (type) =>
        [
          type,
          String(report.orderTypeTotals[type].count),
          money(report.orderTypeTotals[type].total),
          report.orderTypeTotals[type].count,
          report.orderTypeTotals[type].total,
        ] as const,
    )
    .filter((row) => row[3] > 0 || reportNumberHasValue(row[4]))
    .map(([type, count, total]) => [type, count, total])
  const rows: string[][] = [
    ['GI POS Restaurant Report'],
    ['Business', data.businessName],
    ['Branch', data.businessProfile.branch],
    ['Phone', data.businessProfile.phone],
    ['Period', data.period.label],
    ['Generated At', formatDateTime(new Date(data.generatedAt))],
    [],
    ['Summary', 'Value'],
    ...getReportSummaryRows(report, data.openingCash),
  ]

  appendCsvSection(rows, 'Payment Summary', ['Method', 'Amount'], paymentRows)
  appendCsvSection(rows, 'Order Type', ['Type', 'Count', 'Total'], orderTypeRows)
  appendCsvSection(
    rows,
    'Top Items',
    ['Item', 'Qty', 'Total'],
    report.topItems.map((item) => [item.name, String(item.qty), money(item.total)]),
  )
  appendCsvSection(
    rows,
    'Bill Details',
    ['Bill No', 'Date', 'Type', 'Table', 'Customer', 'Payment', 'Status', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Due', 'Cash', 'UPI', 'Card'],
    data.orders.map((order) => [
      order.billNo,
      formatDateTime(new Date(order.createdAt)),
      order.orderType,
      order.table,
      order.customer,
      order.paymentMethod,
      order.status,
      String(order.cart.reduce((sum, line) => sum + line.qty, 0)),
      money(order.totals.subtotal),
      money(order.totals.discount),
      money(order.totals.tax),
      money(order.totals.total),
      money(order.totals.paid),
      money(order.totals.balance),
      money(order.paymentBreakdown?.cash ?? getOrderCashInHand(order)),
      money(order.paymentBreakdown?.upi ?? getOrderUpiReceived(order)),
      money(order.paymentBreakdown?.card ?? getOrderCardReceived(order)),
    ]),
  )
  appendCsvSection(
    rows,
    'Expense Details',
    ['Date', 'Category', 'Payment', 'Amount', 'Vendor', 'Note'],
    data.expenses.map((expense) => [
      expense.date,
      expense.category,
      expense.paymentMethod,
      money(expense.amount),
      expense.vendor,
      expense.note,
    ]),
  )

  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n')
}

function buildReportExportHtml(data: ReportExportData, format: 'excel' | 'pdf') {
  const report = data.reportData
  const cashInHandWithOpening = roundMoney(data.openingCash + report.cashInHand)
  const title = `${data.businessName} - ${data.period.label} Report`
  const summaryRows = getReportSummaryRows(report, data.openingCash)
  const paymentRows = paymentMethods
    .map((method) => [method, money(report.paymentTotals[method] ?? 0), report.paymentTotals[method] ?? 0] as const)
    .filter((row) => reportNumberHasValue(row[2]))
    .map(([method, amount]) => [method, amount])
  const orderTypeRows = orderTypes
    .map(
      (type) =>
        [
          `${type} x ${report.orderTypeTotals[type].count}`,
          money(report.orderTypeTotals[type].total),
          report.orderTypeTotals[type].count,
          report.orderTypeTotals[type].total,
        ] as const,
    )
    .filter((row) => row[2] > 0 || reportNumberHasValue(row[3]))
    .map(([label, total]) => [label, total])
  const topItemRows = report.topItems.map((item) => [item.name, String(item.qty), money(item.total)])
  const extensionMeta =
    format === 'excel'
      ? '<meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=utf-8" />'
      : ''

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    ${extensionMeta}
    <title>${escapePrintHtml(title)}</title>
    <style>
      @page { size: A4; margin: 7mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #111827; font-family: Arial, sans-serif; font-size: 11px; background: #fff; }
      .report-page { width: 100%; }
      .header { display: flex; justify-content: space-between; gap: 14px; padding: 12px 14px; color: #fff; background: linear-gradient(135deg, #cc0d2d, #07848e); border-radius: 8px; }
      .brand h1 { margin: 0; color: #fff; font-size: 22px; letter-spacing: 0; }
      .brand p, .meta p { margin: 3px 0 0; color: rgba(255,255,255,.84); font-weight: 700; }
      .meta { text-align: right; }
      .meta strong { display: block; color: #fff; font-size: 15px; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin: 10px 0; }
      .kpi { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; }
      .kpi span { display: block; color: #64748b; font-size: 9px; font-weight: 800; text-transform: uppercase; }
      .kpi strong { display: block; margin-top: 4px; font-size: 16px; }
      .section { margin-top: 9px; page-break-inside: avoid; }
      h2 { margin: 0 0 5px; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; }
      th { color: #0f172a; background: #e2e8f0; font-size: 10px; text-transform: uppercase; }
      th, td { padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; vertical-align: top; }
      td.number, th.number { text-align: right; white-space: nowrap; }
      .split { display: grid; grid-template-columns: 1.1fr .9fr; gap: 8px; align-items: start; }
      .empty { padding: 10px; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; }
      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .section { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <main class="report-page">
      <header class="header">
        <div class="brand">
          <h1>${escapePrintHtml(data.businessName)}</h1>
          ${data.businessProfile.branch ? `<p>${escapePrintHtml(data.businessProfile.branch)}</p>` : ''}
          ${data.businessProfile.phone ? `<p>Phone: ${escapePrintHtml(data.businessProfile.phone)}</p>` : ''}
        </div>
        <div class="meta">
          <strong>Sales Report</strong>
          <p>${escapePrintHtml(data.period.label)}</p>
          <p>Generated: ${escapePrintHtml(formatDateTime(new Date(data.generatedAt)))}</p>
        </div>
      </header>

      <section class="summary">
        <div class="kpi"><span>Total Sales</span><strong>Rs. ${money(report.salesTotal)}</strong></div>
        <div class="kpi"><span>Received</span><strong>Rs. ${money(report.receivedTotal)}</strong></div>
        <div class="kpi"><span>Cash In Hand</span><strong>Rs. ${money(cashInHandWithOpening)}</strong></div>
        <div class="kpi"><span>Bank</span><strong>Rs. ${money(report.bankTotal)}</strong></div>
      </section>

      <section class="split">
        ${renderExportTable('Summary', ['Metric', 'Value'], summaryRows)}
        ${renderExportTable('Payment Summary', ['Method', 'Amount'], paymentRows)}
      </section>

      ${
        orderTypeRows.length || topItemRows.length
          ? `<section class="split">
              ${renderExportTable('Order Type', ['Type', 'Total'], orderTypeRows, [1], { hideWhenEmpty: true })}
              ${renderExportTable('Top Items', ['Item', 'Qty', 'Total'], topItemRows, [1, 2], { hideWhenEmpty: true })}
            </section>`
          : ''
      }

      ${renderExportTable(
        'Bill Details',
        ['Bill', 'Date', 'Type', 'Table', 'Customer', 'Payment', 'Status', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Due'],
        data.orders.map((order) => [
          `#${order.billNo}`,
          formatDateTime(new Date(order.createdAt)),
          order.orderType,
          order.table,
          order.customer,
          order.paymentMethod,
          order.status,
          String(order.cart.reduce((sum, line) => sum + line.qty, 0)),
          money(order.totals.subtotal),
          money(order.totals.discount),
          money(order.totals.tax),
          money(order.totals.total),
          money(order.totals.paid),
          money(order.totals.balance),
        ]),
        [8, 9, 10, 11, 12, 13],
        { hideWhenEmpty: true },
      )}

      ${renderExportTable(
        'Expense Details',
        ['Date', 'Category', 'Payment', 'Amount', 'Vendor', 'Note'],
        data.expenses.map((expense) => [
          expense.date,
          expense.category,
          expense.paymentMethod,
          money(expense.amount),
          expense.vendor,
          expense.note,
        ]),
        [3],
        { hideWhenEmpty: true },
      )}
    </main>
  </body>
</html>`
}

function renderExportTable(
  title: string,
  headers: string[],
  rows: string[][],
  numberColumns: number[] = [1],
  options: { hideWhenEmpty?: boolean } = {},
) {
  if (!rows.length && options.hideWhenEmpty) {
    return ''
  }

  const headerHtml = headers
    .map((header, index) => `<th class="${numberColumns.includes(index) ? 'number' : ''}">${escapePrintHtml(header)}</th>`)
    .join('')
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) => `<td class="${numberColumns.includes(index) ? 'number' : ''}">${escapePrintHtml(cell)}</td>`)
          .join('')}</tr>`,
    )
    .join('')

  return `<section class="section">
    <h2>${escapePrintHtml(title)}</h2>
    ${
      rows.length
        ? `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
        : `<div class="empty">No data found</div>`
    }
  </section>`
}

function escapeCsvValue(value: string) {
  const normalized = String(value ?? '')
  return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized
}

function buildReportPrintHtml(payload: ReportPrintPayload) {
  const report = payload.report
  const orderTypeRows = report.orderTypeRows
    .filter((row) => Number(row.count ?? 0) > 0 || reportNumberHasValue(row.total ?? 0))
    .map((row) => `<tr><td>${escapePrintHtml(row.label)} x ${row.count ?? 0}</td><td>${money(row.total ?? 0)}</td></tr>`)
    .join('')
  const reportRows = getThermalReportRows(report)
    .map((row) => `<tr class="${row.strong ? 'grand' : ''}"><td>${escapePrintHtml(row.label)}</td><td>${escapePrintHtml(row.value)}</td></tr>`)
    .join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapePrintHtml(report.title)}</title>
    <style>
      @page { margin: 0; size: ${payload.settings.paperWidth === '58' ? 58 : 80}mm auto; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 8px; color: #111; font-family: Arial, sans-serif; font-size: 11px; }
      .center { text-align: center; }
      .shop { font-size: 16px; font-weight: 800; }
      .title { margin-top: 4px; font-size: 13px; font-weight: 800; }
      .muted { color: #333; }
      .rule { border-top: 1px dashed #111; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 2px 0; vertical-align: top; }
      td:last-child { text-align: right; white-space: nowrap; padding-left: 8px; }
      .grand td { font-size: 15px; font-weight: 800; border-top: 1px solid #111; padding-top: 5px; }
      .section { margin-top: 6px; font-weight: 800; }
    </style>
  </head>
  <body>
    <div class="center">
      <div class="shop">${escapePrintHtml(report.business.name)}</div>
      ${report.business.branch ? `<div class="muted">${escapePrintHtml(report.business.branch)}</div>` : ''}
      ${report.business.phone ? `<div class="muted">Phone: ${escapePrintHtml(report.business.phone)}</div>` : ''}
      <div class="title">${escapePrintHtml(report.title)}</div>
      <div class="muted">${escapePrintHtml(report.periodLabel)}</div>
      <div class="muted">${escapePrintHtml(formatDateTime(new Date(report.generatedAt)))}</div>
    </div>
    <div class="rule"></div>
    <table>${reportRows}</table>
    ${
      orderTypeRows
        ? `<div class="rule"></div><div class="section">Order Type</div><table>${orderTypeRows}</table>`
        : ''
    }
    <div class="rule"></div>
    <div class="center"><strong>End of report</strong></div>
  </body>
</html>`
}

function getThermalReportRows(report: ReportPrintPayload['report']) {
  const candidates = [
    { label: 'Total Sales', value: money(report.salesTotal), numericValue: report.salesTotal, strong: true, always: true },
    { label: 'Paid Bills', value: String(report.paidCount), numericValue: report.paidCount, always: true },
    { label: 'Opening Cash', value: money(report.openingCash), numericValue: report.openingCash },
    { label: 'Amount Received', value: money(report.receivedTotal), numericValue: report.receivedTotal, always: true },
    { label: 'Cash In Hand', value: money(report.cashInHand), numericValue: report.cashInHand, always: true },
    { label: 'UPI', value: money(report.upiTotal), numericValue: report.upiTotal },
    { label: 'Card', value: money(report.cardTotal), numericValue: report.cardTotal },
    { label: 'Bank', value: money(report.bankTotal), numericValue: report.bankTotal },
    { label: 'Due / Credit', value: money(report.balanceTotal), numericValue: report.balanceTotal },
    { label: 'Discount', value: money(report.discountTotal), numericValue: report.discountTotal },
    { label: 'Expense', value: money(report.expenseTotal), numericValue: report.expenseTotal },
    { label: 'Net Amount', value: money(report.netTotal), numericValue: report.netTotal, strong: true, always: true },
    { label: 'Open Amount', value: money(report.openTotal), numericValue: report.openTotal },
    { label: 'Open Bills', value: String(report.openCount), numericValue: report.openCount },
  ]

  return candidates.filter((row) => row.always || reportNumberHasValue(row.numericValue))
}

function escapePrintHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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

function formatLicenseDate(value: string) {
  if (!value) {
    return 'Not set'
  }

  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? formatDateTime(date) : value
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDatabaseBackupLabel(backup: LocalDbBackup) {
  const lowerName = backup.fileName.toLowerCase()
  const type = lowerName.includes('-manual-')
    ? 'Manual backup'
    : lowerName.includes('-before-restore-')
      ? 'Before restore'
      : lowerName.includes('-before-reset-')
        ? 'Before reset'
        : 'Auto safety backup'
  const date = backup.updatedAt ? formatDateTime(new Date(backup.updatedAt)) : backup.fileName

  return `${type} - ${date} - ${formatFileSize(backup.size)}`
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

function getDailyReportPeriod(value: Date): ReportPeriod {
  return {
    mode: 'custom',
    from: startOfDay(value),
    to: endOfDay(value),
    label: `Date - ${formatDate(value)}`,
  }
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

function isSingleDayReportPeriod(period: ReportPeriod) {
  return (
    period.from.getFullYear() === period.to.getFullYear() &&
    period.from.getMonth() === period.to.getMonth() &&
    period.from.getDate() === period.to.getDate()
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

function normalizeMenuItems(items: MenuItem[]) {
  return items.map((item, index) => {
    const name = String(item.name ?? '').trim() || `Item ${index + 1}`
    const id = String(item.id ?? '').trim() || `${slugify(name)}-${index + 1}`
    const tags = Array.isArray(item.tags) ? normalizeTags(item.tags.join(', ')) : normalizeTags(String(item.tags ?? ''))
    const unavailableReason = String(item.unavailableReason ?? '').trim()

    return {
      id,
      name,
      category: String(item.category ?? 'all').trim() || 'all',
      price: roundMoney(Math.max(0, Number(item.price) || 0)),
      tags,
      imageDataUrl: typeof item.imageDataUrl === 'string' && item.imageDataUrl ? item.imageDataUrl : undefined,
      available: item.available === false ? false : true,
      unavailableReason: item.available === false && unavailableReason ? unavailableReason : undefined,
      taxRate: Number(item.taxRate ?? 0) || 0,
    }
  })
}

function isMenuItemAvailable(item: MenuItem) {
  return item.available !== false
}

function createOrderId() {
  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createCustomerId() {
  return `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createExpenseId() {
  return `expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeExpenses(entries: ExpenseEntry[]) {
  return entries
    .map((entry, index) => {
      const createdAt = String(entry.createdAt || new Date().toISOString())
      const date = formatDateInputValue(parseDateInputValue(String(entry.date || ''), new Date(createdAt)))
      const amount = roundMoney(Math.max(0, Number(entry.amount) || 0))

      if (amount <= 0) {
        return null
      }

      return {
        id: String(entry.id || `expense-restored-${index + 1}`),
        date,
        category: String(entry.category || 'Other').trim() || 'Other',
        amount,
        paymentMethod: entry.paymentMethod === 'Bank' ? 'Bank' : 'Cash',
        vendor: String(entry.vendor || ''),
        note: String(entry.note || ''),
        createdBy: String(entry.createdBy || 'Owner'),
        createdAt,
        updatedAt: String(entry.updatedAt || createdAt),
      }
    })
    .filter((entry): entry is ExpenseEntry => Boolean(entry))
}

function normalizeOpeningCashBalances(value: Record<string, number> | unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.entries(value).reduce<Record<string, number>>((balances, [dateKey, amount]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      balances[dateKey] = roundMoney(Math.max(0, Number(amount) || 0))
    }

    return balances
  }, {})
}

function createStaffUserId() {
  return `staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createServiceStaffId() {
  return `service-staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createPrinterProfileId() {
  return `printer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getInitialBillNumber(orders: SavedOrder[], referenceDate = new Date()) {
  const highestSavedBill = getHighestBillNumber(orders, referenceDate)

  if (highestSavedBill > 0) {
    return highestSavedBill + 1
  }

  return firstBillNumber
}

function getNextBillNumber(orders: SavedOrder[], currentBillNumber: number, referenceDate = new Date()) {
  const highestSavedBill = getHighestBillNumber(orders, referenceDate)
  return Math.max(currentBillNumber, highestSavedBill, firstBillNumber - 1) + 1
}

function getHighestBillNumber(orders: SavedOrder[], referenceDate = new Date()) {
  return orders
    .filter((order) => isOrderInsideFinancialYear(order, referenceDate))
    .reduce((highest, order) => Math.max(highest, Number(order.billNo) || 0), 0)
}

function isOrderInsideFinancialYear(order: SavedOrder, referenceDate = new Date()) {
  const orderDate = new Date(order.createdAt || order.updatedAt)
  if (!Number.isFinite(orderDate.getTime())) {
    return false
  }

  const start = getFinancialYearStart(referenceDate)
  const end = getFinancialYearEnd(referenceDate)
  return orderDate >= start && orderDate <= end
}

function getFinancialYearStart(value: Date) {
  const year = value.getMonth() >= 3 ? value.getFullYear() : value.getFullYear() - 1
  return new Date(year, 3, 1, 0, 0, 0, 0)
}

function getFinancialYearEnd(value: Date) {
  const start = getFinancialYearStart(value)
  return new Date(start.getFullYear() + 1, 2, 31, 23, 59, 59, 999)
}

function getFinancialYearKey(value: Date) {
  const start = getFinancialYearStart(value)
  return `${start.getFullYear()}-${start.getFullYear() + 1}`
}

function buildReport(orders: SavedOrder[], period?: ReportPeriod, expenses: ExpenseEntry[] = []) {
  const scopedOrders = period ? orders.filter((order) => isOrderInsidePeriod(order, period)) : orders
  const scopedExpenses = period ? expenses.filter((expense) => isExpenseInsidePeriod(expense, period)) : expenses
  const paidOrders = scopedOrders.filter((order) => order.status === 'paid')
  const openOrders = scopedOrders.filter((order) => order.status !== 'paid')
  const previousPeriod = period ? getPreviousReportPeriod(period) : null
  const previousPaidOrders = previousPeriod
    ? orders.filter((order) => order.status === 'paid' && isOrderInsidePeriod(order, previousPeriod))
    : []
  const today = new Date()
  const todayPaidOrders = paidOrders.filter((order) => isSameBusinessDay(order.createdAt, today))
  const todayExpenses = expenses.filter((expense) => isSameBusinessDay(expense.date, today))
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
  const expenseTotal = roundMoney(scopedExpenses.reduce((sum, expense) => sum + expense.amount, 0))
  const cashExpenseTotal = roundMoney(
    scopedExpenses
      .filter((expense) => expense.paymentMethod === 'Cash')
      .reduce((sum, expense) => sum + expense.amount, 0),
  )
  const bankExpenseTotal = roundMoney(
    scopedExpenses
      .filter((expense) => expense.paymentMethod === 'Bank')
      .reduce((sum, expense) => sum + expense.amount, 0),
  )
  const todayExpenseTotal = roundMoney(todayExpenses.reduce((sum, expense) => sum + expense.amount, 0))
  const todayCashExpenseTotal = roundMoney(
    todayExpenses
      .filter((expense) => expense.paymentMethod === 'Cash')
      .reduce((sum, expense) => sum + expense.amount, 0),
  )
  const todayBankExpenseTotal = roundMoney(
    todayExpenses
      .filter((expense) => expense.paymentMethod === 'Bank')
      .reduce((sum, expense) => sum + expense.amount, 0),
  )
  const cashSalesTotal = roundMoney(paidOrders.reduce((sum, order) => sum + getOrderCashInHand(order), 0))
  const bankSalesTotal = roundMoney(paidOrders.reduce((sum, order) => sum + getOrderBankReceived(order), 0))
  const todayCashSalesTotal = roundMoney(todayPaidOrders.reduce((sum, order) => sum + getOrderCashInHand(order), 0))
  const todayBankSalesTotal = roundMoney(todayPaidOrders.reduce((sum, order) => sum + getOrderBankReceived(order), 0))
  const receivedTotal = roundMoney(cashSalesTotal + bankSalesTotal)
  const todayReceivedTotal = roundMoney(todayCashSalesTotal + todayBankSalesTotal)
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
    todayReceivedTotal,
    todayExpenseTotal,
    todayCashExpenseTotal,
    todayBankExpenseTotal,
    todayCashInHand: roundMoney(todayCashSalesTotal - todayCashExpenseTotal),
    todayBank: roundMoney(todayBankSalesTotal - todayBankExpenseTotal),
    receivedTotal,
    cashReceivedTotal: cashSalesTotal,
    bankReceivedTotal: bankSalesTotal,
    cashInHand: roundMoney(cashSalesTotal - cashExpenseTotal),
    upiTotal: roundMoney(paidOrders.reduce((sum, order) => sum + getOrderUpiReceived(order), 0)),
    cardTotal: roundMoney(paidOrders.reduce((sum, order) => sum + getOrderCardReceived(order), 0)),
    bankTotal: roundMoney(bankSalesTotal - bankExpenseTotal),
    expenseTotal,
    cashExpenseTotal,
    bankExpenseTotal,
    netTotal: roundMoney(salesTotal - expenseTotal),
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

function isExpenseInsidePeriod(expense: ExpenseEntry, period: ReportPeriod) {
  const expenseDate = parseDateInputValue(expense.date, new Date(expense.createdAt))
  return Number.isFinite(expenseDate.getTime()) && expenseDate >= period.from && expenseDate <= period.to
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
  const fallbackCash = !hasSavedPaymentBreakdown(order) && order.paymentMethod === 'Cash' ? order.totals.total : cash
  return roundMoney(Math.max(0, fallbackCash - returnAmount))
}

function getOrderUpiReceived(order: SavedOrder) {
  const upi = Math.max(0, Number(order.paymentBreakdown?.upi ?? 0))
  return roundMoney(!hasSavedPaymentBreakdown(order) && order.paymentMethod === 'UPI' ? order.totals.total : upi)
}

function getOrderCardReceived(order: SavedOrder) {
  const card = Math.max(0, Number(order.paymentBreakdown?.card ?? 0))
  return roundMoney(!hasSavedPaymentBreakdown(order) && order.paymentMethod === 'Card' ? order.totals.total : card)
}

function getOrderBankReceived(order: SavedOrder) {
  return roundMoney(getOrderUpiReceived(order) + getOrderCardReceived(order))
}

function hasSavedPaymentBreakdown(order: SavedOrder) {
  const breakdown = order.paymentBreakdown

  if (!breakdown) {
    return false
  }

  return Number(breakdown.cash || 0) > 0 || Number(breakdown.upi || 0) > 0 || Number(breakdown.card || 0) > 0
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

function normalizeAppMode(value: unknown): AppMode {
  return String(value || '').trim().toLowerCase() === 'offline' ? 'offline' : 'cloud'
}

function normalizeOfflineLicense(value: Partial<OfflineLicense> | null | undefined): OfflineLicense | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const license: OfflineLicense = {
    plan: 'offline',
    licenseId: String(value.licenseId || ''),
    licenseKey: String(value.licenseKey || ''),
    businessName: String(value.businessName || ''),
    phone: String(value.phone || ''),
    deviceFingerprint: String(value.deviceFingerprint || ''),
    deviceName: String(value.deviceName || ''),
    activatedAt: String(value.activatedAt || ''),
    expiresAt: String(value.expiresAt || ''),
    issuedAt: String(value.issuedAt || ''),
    signature: String(value.signature || ''),
    subscriptionPlan: String(value.subscriptionPlan || ''),
    subscriptionStatus: String(value.subscriptionStatus || ''),
    subscriptionExpiresAt: String(value.subscriptionExpiresAt || value.expiresAt || ''),
    subscriptionMaxDevices: Number(value.subscriptionMaxDevices || 0),
  }

  return license.licenseKey && license.businessName && license.phone && license.deviceFingerprint && license.signature
    ? license
    : null
}

function isOfflineLicenseValid(license: OfflineLicense | null): license is OfflineLicense {
  if (!license) {
    return false
  }

  if (license.plan !== 'offline' || !license.licenseKey || !license.signature) {
    return false
  }

  if (license.expiresAt) {
    const expiresAt = new Date(license.expiresAt).getTime()
    if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) {
      return false
    }
  }

  const deviceFingerprint = localStorage.getItem(deviceFingerprintStorageKey) || ''
  return !deviceFingerprint || !license.deviceFingerprint || license.deviceFingerprint === deviceFingerprint
}

function getOrCreateDeviceFingerprint() {
  const existing = localStorage.getItem(deviceFingerprintStorageKey)
  if (existing) {
    return existing
  }

  const next =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`
  localStorage.setItem(deviceFingerprintStorageKey, next)
  return next
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

function normalizeKeyboardShortcutsEnabled(value: unknown) {
  return value !== false && value !== 'false'
}

function normalizeShortcutKey(value: unknown) {
  const rawKey = String(value ?? '').trim()
  if (!rawKey || rawKey === 'Alt' || rawKey === 'Control' || rawKey === 'Shift' || rawKey === 'Meta') {
    return ''
  }

  if (rawKey === ' ') {
    return 'Space'
  }

  if (rawKey === 'Escape') {
    return 'Esc'
  }

  if (rawKey === 'Enter' || rawKey === 'Tab' || rawKey === 'Backspace' || rawKey === 'Delete') {
    return rawKey
  }

  const functionKey = rawKey.match(/^F([1-9]|1[0-2])$/i)
  if (functionKey) {
    return `F${functionKey[1]}`
  }

  if (/^[a-z0-9]$/i.test(rawKey)) {
    return rawKey.toUpperCase()
  }

  return ''
}

function normalizeKeyboardShortcutOverrides(value: Record<string, string>) {
  const overrides: Record<string, string> = {}
  if (!value || typeof value !== 'object') {
    return overrides
  }

  defaultKeyboardShortcuts.forEach((shortcut) => {
    const normalizedKey = normalizeShortcutKey(value[shortcut.id])
    if (normalizedKey) {
      overrides[shortcut.id] = normalizedKey
    }
  })

  return overrides
}

function isShortcutKeyMatch(shortcutKey: string, eventKey: string) {
  return normalizeShortcutKey(eventKey) === normalizeShortcutKey(shortcutKey)
}

function doShortcutScopesOverlap(firstScope: ShortcutScope, secondScope: ShortcutScope) {
  return firstScope === 'global' || secondScope === 'global' || firstScope === secondScope
}

function getShortcutScopeLabel(scope: ShortcutScope) {
  if (scope === 'pos') return 'POS Sale'
  if (scope === 'home') return 'Home'
  return 'Global'
}

function normalizeDiscountMode(value: unknown): DiscountMode {
  return value === 'amount' ? 'amount' : 'percent'
}

function normalizeSeatingMode(value: unknown): SeatingMode {
  return value === 'group' ? 'group' : 'individual'
}

function normalizeCartLine(line: CartLine): CartLine {
  const legacyLine = line as CartLine & {
    discountMode?: unknown
    discountPercent?: number
    discountAmount?: number
  }
  const discountMode = normalizeDiscountMode(legacyLine.discountMode)
  const qty = Math.max(Number(legacyLine.qty ?? 0), 0)
  const price = Math.max(Number(legacyLine.price ?? 0), 0)
  const gross = qty * price

  return {
    ...line,
    category: String((legacyLine as CartLine).category ?? '').trim() || undefined,
    qty,
    price,
    taxRate: Math.max(Number(legacyLine.taxRate ?? 0), 0),
    discountMode,
    discountPercent: discountMode === 'percent' ? clamp(Number(legacyLine.discountPercent ?? 0), 0, 100) : 0,
    discountAmount: discountMode === 'amount' ? clamp(Number(legacyLine.discountAmount ?? 0), 0, gross) : 0,
    description: normalizeLineDescription(legacyLine.description),
  }
}

function normalizeQrOrders(orders: QrPendingOrder[]) {
  if (!Array.isArray(orders)) {
    return []
  }

  return orders
    .map((order) => {
      const status: QrOrderStatus =
        order.status === 'accepted' || order.status === 'rejected' || order.status === 'pending' ? order.status : 'pending'
      const table = parseDiningTableNames(order.table || order.tables)[0] || ''
      const cart = Array.isArray(order.cart) ? order.cart.map(normalizeCartLine).filter((line) => line.qty > 0) : []
      const createdAt = String(order.createdAt || new Date().toISOString())

      return {
        id: String(order.id || createOrderId()).trim(),
        shortId: String(order.shortId || '').trim(),
        status,
        source: 'table-qr' as const,
        table,
        tables: table ? [table] : parseDiningTableNames(order.tables),
        customerName: String(order.customerName || '').trim(),
        customerPhone: String(order.customerPhone || '').trim(),
        note: normalizeLineDescription(order.note),
        cart,
        totals: normalizeOrderTotals(order.totals, buildCartOnlyTotals(cart)),
        createdAt,
        updatedAt: String(order.updatedAt || createdAt),
      }
    })
    .filter((order) => order.id && order.table && order.cart.length)
}

function normalizeSavedOrderPayment(order: SavedOrder): SavedOrder {
  const legacyOrder = order as SavedOrder & {
    paymentBreakdown?: Partial<PaymentBreakdown>
    paymentMethod?: unknown
    totals?: Partial<OrderTotals>
    amountReceived?: number
    discountMode?: unknown
    discountPercent?: number
    discountAmount?: number
    seatingMode?: unknown
    tables?: unknown
    diningGroupName?: unknown
    serviceStaffId?: unknown
    serviceStaffName?: unknown
    serviceStaffCode?: unknown
  }
  const savedTables = parseDiningTableNames(legacyOrder.tables ?? getDiningTablesFromLabel(order.table))
  const discountMode = normalizeDiscountMode(legacyOrder.discountMode)
  const seatingMode = legacyOrder.seatingMode ? normalizeSeatingMode(legacyOrder.seatingMode) : savedTables.length > 1 ? 'group' : 'individual'
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
    serviceStaffId: String(legacyOrder.serviceStaffId ?? '').trim() || undefined,
    serviceStaffName: String(legacyOrder.serviceStaffName ?? '').trim(),
    serviceStaffCode: String(legacyOrder.serviceStaffCode ?? '').trim(),
    seatingMode,
    tables: savedTables,
    diningGroupName: seatingMode === 'group' ? String(legacyOrder.diningGroupName ?? '').trim() : '',
    cart: Array.isArray(order.cart) ? order.cart.map(normalizeCartLine) : [],
    discountMode,
    discountPercent: clamp(Number(legacyOrder.discountPercent ?? 0), 0, 100),
    discountAmount: roundMoney(Math.max(Number(legacyOrder.discountAmount ?? 0), 0)),
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

function normalizeDiningTableGroups(groups: DiningTableGroup[]) {
  const sourceGroups = Array.isArray(groups) && groups.length ? groups : defaultDiningTableGroups
  const usedIds = new Set<string>()
  const normalizedGroups = sourceGroups
    .map((group, index) => {
      const label = String(group?.label ?? `Area ${index + 1}`).trim()
      const tables = parseDiningTableNames(group?.tables ?? [])
      const baseId = String(group?.id || createDiningTableGroupId(label)).trim() || createDiningTableGroupId(label)
      let id = baseId
      let suffix = 2
      while (usedIds.has(id)) {
        id = `${baseId}-${suffix}`
        suffix += 1
      }
      usedIds.add(id)

      return label && tables.length ? { id, label, tables } : null
    })
    .filter((group): group is DiningTableGroup => Boolean(group))

  if (normalizedGroups.length) {
    return normalizedGroups
  }

  return defaultDiningTableGroups.map((group) => ({ ...group, tables: [...group.tables] }))
}

function parseDiningTableNames(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : String(value ?? '')
        .split(/[\n,;]+/)
        .map((item) => item.trim())
  const seen = new Set<string>()
  const tables: string[] = []

  rawValues.forEach((rawValue) => {
    const tableName = String(rawValue ?? '').trim().replace(/\s+/g, ' ')
    const key = tableName.toLowerCase()
    if (tableName && !seen.has(key)) {
      seen.add(key)
      tables.push(tableName)
    }
  })

  return tables
}

function createDiningTableGroupId(label: string) {
  const slug =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'table-area'

  return `${slug}-${Date.now().toString(36)}`
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
    mode: 'system',
    printMethod: 'driver',
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
      categoryIds: uniqueStrings(profile.categoryIds),
      tableGroupIds: uniqueStrings(profile.tableGroupIds),
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

function createPrinterEditDraft(profile: PrinterProfile): PrinterProfile {
  return {
    ...profile,
    settings: normalizePrinterSettings(profile.settings),
    categoryIds: uniqueStrings(profile.categoryIds),
    tableGroupIds: uniqueStrings(profile.tableGroupIds),
  }
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
    categoryIds: [],
    tableGroupIds: [],
    createdAt: now,
    updatedAt: now,
  }
}

function uniqueStrings(values?: unknown) {
  if (!Array.isArray(values)) {
    return []
  }

  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  )
}

function getPrinterCategoryLabels(profile: PrinterProfile | null | undefined, categories: Category[]) {
  if (!profile) {
    return []
  }

  return profile.categoryIds.map((categoryId) => getCategoryDisplayLabel(categoryId, categories)).filter(Boolean)
}

function getPrinterTableGroupLabels(profile: PrinterProfile | null | undefined, groups: DiningTableGroup[]) {
  if (!profile) {
    return []
  }

  return profile.tableGroupIds
    .map((groupId) => groups.find((group) => group.id === groupId)?.label ?? '')
    .filter(Boolean)
}

function getCartLineCategoryId(line: CartLine, menuList: MenuItem[]) {
  return line.category || menuList.find((item) => item.id === line.itemId)?.category || 'all'
}

function getCategoryDisplayLabel(categoryId: string, categories: Category[]) {
  return categories.find((category) => category.id === categoryId)?.label || titleCase(categoryId)
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
  return settings.deviceName || 'Select installed printer'
}

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ')
}

function getAppPlanId(planName = ''): keyof typeof appPlanCatalog | '' {
  const normalized = planName.trim().toLowerCase()
  if (normalized.includes('gold')) return 'gold'
  if (normalized.includes('offline')) return 'offline'
  if (normalized.includes('premium')) return 'premium'
  return ''
}

function getAppPlanDetails(planName = '', maxDevices = 0) {
  const planId = getAppPlanId(planName)

  if (planId) {
    return appPlanCatalog[planId]
  }

  if (maxDevices === 1) {
    return appPlanCatalog.premium
  }

  if (maxDevices >= unlimitedDeviceLimit) {
    return appPlanCatalog.gold
  }

  return null
}

function formatDeviceLimit(maxDevices = 0) {
  if (!maxDevices) return 'Not set'
  if (maxDevices >= unlimitedDeviceLimit) return 'Main PC plus local counters'
  return `${maxDevices} counter${maxDevices === 1 ? '' : 's'}`
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
    defaultGstRate: Number(profile.defaultGstRate ?? defaultBusinessProfile.defaultGstRate) || 0,
    gstType: (profile.gstType === 'inclusive' || profile.gstType === 'exclusive') ? profile.gstType : defaultBusinessProfile.gstType,
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

function normalizeStaffCode(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
}

function normalizeServiceStaff(staffList: ServiceStaff[] = []) {
  if (!Array.isArray(staffList)) {
    return []
  }

  const usedCodes = new Set<string>()
  return staffList
    .map((staffMember) => {
      const name = String(staffMember?.name ?? '').trim()
      const code = normalizeStaffCode(staffMember?.code)
      if (!name || !code || usedCodes.has(code)) {
        return null
      }

      usedCodes.add(code)
      const now = new Date().toISOString()
      return {
        id: String(staffMember?.id || createServiceStaffId()).trim(),
        name,
        code,
        active: staffMember?.active !== false,
        createdAt: String(staffMember?.createdAt || now),
        updatedAt: String(staffMember?.updatedAt || staffMember?.createdAt || now),
      }
    })
    .filter((staffMember): staffMember is ServiceStaff => Boolean(staffMember))
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
    subscriptionMaxDevices: Number(settings.subscriptionMaxDevices ?? defaultCloudSyncSettings.subscriptionMaxDevices),
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

function normalizeAppConfiguration(settings: Partial<AppConfiguration> = {}) {
  return {
    ...defaultAppConfiguration,
    showServiceStaffSelector:
      typeof settings.showServiceStaffSelector === 'boolean'
        ? settings.showServiceStaffSelector
        : defaultAppConfiguration.showServiceStaffSelector,
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
