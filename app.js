/* =========================================
   MO SaaS - Modern Business Management System
   Complete Application Logic
   ========================================= */

// ==========================================
// GLOBAL STATE & CONSTANTS
// ==========================================

const STORAGE_KEY = 'mfumo_pos_v1';
const SIGNUP_DRAFT_KEY = 'mfumo_pos_signup_draft_v1';
const SIGNUP_DRAFTS_KEY = 'mfumo_pos_signup_drafts_v2';
const TODAY = new Date().toISOString().slice(0, 10);
const BACKUP_DB_NAME = 'mfumo_pos_backup_db';
const BACKUP_STORE_NAME = 'settings';
const BACKUP_FOLDER_KEY = 'backupFolderHandle';
const OFFLINE_DB_NAME = 'mfumo_pos_offline_db';
const OFFLINE_DB_VERSION = 3;
const OFFLINE_LICENSE_GRACE_DAYS = 7;
const OFFLINE_CLIENT_ID_KEY = 'mfumo_pos_offline_client_id';
const OFFLINE_SYNC_META_KEY = 'mfumo_pos_last_sync_at';
const AUTH_TOKEN_KEY = 'mfumo_pos_auth_token';
const AUTH_TOKEN_ENCRYPTED_KEY = 'mfumo_pos_auth_token_secure_v1';
const AUTH_USER_KEY = 'mfumo_pos_auth_user';
const SESSION_AUTOSAVE_KEY = `${STORAGE_KEY}:session_autosave`;
const SESSION_WARNING_SECONDS = 30;
const SESSION_TIMEOUT_RULES_MS = {
  super_admin: 7 * 60 * 1000,
  admin: 9 * 60 * 1000,
  user: 11 * 60 * 1000,
  staff: 11 * 60 * 1000
};
const SPA_VIEW_STATE_KEY = `${STORAGE_KEY}:spa_view_state`;

let appState = {
  products: [],
  sales: [],
  orders: [],
  employees: {},
  settings: {
    businessName: 'MO SaaS',
    bossPhone: '+255692854445',
    closingTime: '22:00',
    backupTime: '00:00',
    lastBackupDate: null,
    lowStockThreshold: 10,
    dashboardProductName: '',
    language: 'sw',
    theme: 'dark'
  },
  currentEmployee: null,
  currentRole: 'guest',
  clockInTime: null,
  comments: [],
  dailyReports: [],
  expenses: [],
  customers: [],
  customerDebts: [],
  customerPayments: [],
  receipts: [],
  lastReceiptId: null,
  reminders: {
    weekly: {},
    monthly: {}
  },
  developer: {
    users: [],
    payments: [],
    auditLogs: [],
    notifications: []
  }
};

let cart = [];
let charts = {};
let closingTimerInterval = null;
let editingProductId = null;
let sessionInactivityTimer = null;
let sessionCountdownTimer = null;
let sessionCountdownRemaining = SESSION_WARNING_SECONDS;
let sessionWarningVisible = false;
let lastSessionActivityAt = 0;
let spaNavigationReady = false;
let activeViewName = 'dashboard';
let viewStateCache = {};
let sessionCryptoKey = null;
let deferredPwaInstallPrompt = null;
let pwaInstallDismissed = false;
let adminEmployeeTimelineState = {
  employeeName: null,
  period: 'all',
  from: '',
  to: ''
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

const $ = (id) => document.getElementById(id);
const formatCurrency = (value) => new Intl.NumberFormat('sw-TZ', {
  style: 'currency',
  currency: 'TZS',
  minimumFractionDigits: 0,
}).format(value);

const formatDate = (date) => new Date(date).toLocaleDateString();
const formatTime = (date) => new Date(date).toLocaleTimeString();
const formatDateTime = (date) => new Date(date).toLocaleString();
const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
const escapeJsString = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/"/g, '\\"')
  .replace(/\r/g, '\\r')
  .replace(/\n/g, '\\n')
  .replace(/</g, '\\x3C')
  .replace(/>/g, '\\x3E');
const escapeCsv = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
const DEFAULT_STAFF_PASSWORD = 'Digital11@';
const DEFAULT_ADMIN_PASSWORD = 'Digital11#';
const LEGACY_ADMIN_PASSWORD = 'Boss2026!';
const ADMIN_ACCOUNT = 'Boss Admin';
const ADMIN_EMPLOYEES = ['Admin 1', 'Admin 2', 'Admin 3', 'Admin 4'];
const USER_EMPLOYEES = ['Mfanisi Chugastan', 'Mo Tec'];
const ADMIN_USER_ASSIGNMENTS = {
  'Admin 1': ['Mfanisi Chugastan'],
  'Admin 2': ['Mo Tec'],
  'Admin 3': [],
  'Admin 4': []
};
const STAFF_EMPLOYEES = [...ADMIN_EMPLOYEES, ...USER_EMPLOYEES];
const ALLOWED_EMPLOYEES = [ADMIN_ACCOUNT, ...STAFF_EMPLOYEES];
const ROLE_LABELS = {
  super_admin: 'Developer',
  admin: 'Admin',
  user: 'User',
  staff: 'User',
  guest: 'Guest'
};
const PASSWORD_MAX_AGE_DAYS = 111;
const PASSWORD_HASH_ALGORITHM = 'PBKDF2-SHA256';
const PASSWORD_HASH_ITERATIONS = 210000;
const DEFAULT_PASSWORD_ISSUED_AT = '1970-01-01T00:00:00.000Z';
const STAFF_LOCK_START_HOUR = 22;
const STAFF_LOCK_END_HOUR = 8;
const ADMIN_BUSINESS_NAMES = {
  'Admin 1': 'CAANAN PRINTING',
  'Admin 2': 'MO TEC DIGITAL PRINTING'
};
const LEGACY_ADMIN_BUSINESS_NAMES = {
  'Admin 1': 'Amani Retail',
  'Admin 2': 'Kilimani Shop'
};
const DEFAULT_ADMIN_BUSINESSES = [
  { id: 'u_001', adminName: 'Admin 1', businessName: ADMIN_BUSINESS_NAMES['Admin 1'], email: 'admin1@caanan-printing.co.tz', status: 'active', plan: 'basic', monthlyFee: 30000, revenue: 1450000, transactions: 236, customers: 89, stockValue: 780000, growth: 12 },
  { id: 'u_002', adminName: 'Admin 2', businessName: ADMIN_BUSINESS_NAMES['Admin 2'], email: 'admin2@motec-digital.co.tz', status: 'active', plan: 'pro', monthlyFee: 60000, revenue: 2380000, transactions: 381, customers: 142, stockValue: 1260000, growth: 18 },
  { id: 'u_003', adminName: 'Admin 3', businessName: 'Mlimani Mini Mart', email: 'admin3@mlimani-mart.co.tz', status: 'expired', plan: 'basic', monthlyFee: 30000, revenue: 820000, transactions: 124, customers: 51, stockValue: 430000, growth: -4 },
  { id: 'u_004', adminName: 'Admin 4', businessName: 'Zanzibar Traders', email: 'admin4@zanzibar-traders.co.tz', status: 'suspended', plan: 'enterprise', monthlyFee: 120000, revenue: 4120000, transactions: 604, customers: 233, stockValue: 2190000, growth: 25 }
];
const TRIAL_SUBSCRIPTION_DAYS = 14;
const REGISTRY_VERSION = 1;
const SUBSCRIPTION_STATUSES = ['trial', 'active', 'pending_payment', 'inactive', 'suspended', 'expired'];
const BACKEND_API_OVERRIDE = localStorage.getItem('mfumo_payment_api_base');
const PAYMENT_API_BASE_URL = BACKEND_API_OVERRIDE
  || ((location.protocol.startsWith('http') && !isStaticPagesHost()) ? `${location.origin}/api` : '');

function hasExplicitBackendApiBase() {
  return Boolean(BACKEND_API_OVERRIDE);
}

function isStaticPagesHost() {
  return location.hostname.endsWith('.github.io') || location.protocol === 'file:';
}

function isBackendConfigured() {
  return hasExplicitBackendApiBase();
}

function shouldRequireBackendAuth() {
  return hasExplicitBackendApiBase() || !isStaticPagesHost();
}

const SUPABASE_ENTITY_TABLES = {
  product: 'products',
  sale: 'sales',
  order: 'orders',
  receipt: 'receipts',
  dailyReport: 'daily_reports',
  customer: 'customers',
  customerDebt: 'customer_debts',
  customerPayment: 'customer_payments',
  expense: 'expenses'
};
// =========================================
// LICENSE SYSTEM CONSTANTS
// =========================================
const LICENSE_STORAGE_KEY = 'mfumo_pos_license_v1';
const LICENSE_PLANS = {
  FREE: 'free',
  BASIC: 'free',
  PRO: 'pro',
  PRO_PLUS: 'pro_plus',
  ENTERPRISE: 'pro_plus'
};
const LICENSE_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPEND: 'SUSPEND',
  EXPIRE: 'EXPIRE'
};
const SMS_OTP_TTL_MS = 5 * 60 * 1000;
const SMS_OTP_RESEND_MS = 60 * 1000;
const DESIGN_ADDON_PRICE = 10000;

function getSubscriptionPlanCatalog() {
  const lang = appState.settings?.language || 'sw';
  const isSw = lang === 'sw';
  return {
    free: {
      key: 'free',
      displayName: 'FREE',
      monthlyPrice: 0,
      priceLabel: isSw ? 'Bure' : 'Free',
      periodLabel: isSw ? '/ mwezi' : '/ month',
      trialDays: 14,
      badge: isSw ? 'Anza hapa' : 'Start here',
      featured: false,
      features: isSw
        ? ['POS ya msingi', 'Hifadhi data ndani ya kivinjari', 'Ripoti za kila siku', 'Wafanyakazi 2', 'Trial siku 14']
        : ['Core POS', 'Browser local storage', 'Daily reports', '2 staff users', '14-day trial']
    },
    pro: {
      key: 'pro',
      displayName: 'PRO',
      monthlyPrice: 20000,
      priceLabel: formatCurrency(20000),
      periodLabel: isSw ? '/ mwezi' : '/ month',
      trialDays: 0,
      badge: isSw ? 'Maarufu' : 'Popular',
      featured: true,
      features: isSw
        ? ['POS + Inventory kamili', 'Analytics & chati', 'Wafanyakazi 10', 'Ripoti WhatsApp', 'Backup ya kila siku', 'Inasubiri malipo kabla ya activation']
        : ['Full POS + Inventory', 'Analytics & charts', '10 staff users', 'WhatsApp reports', 'Daily backup', 'Pending payment before activation']
    },
    pro_plus: {
      key: 'pro_plus',
      displayName: 'Pro+',
      monthlyPrice: 30000,
      priceLabel: formatCurrency(30000),
      periodLabel: isSw ? '/ mwezi' : '/ month',
      trialDays: 0,
      badge: isSw ? 'Biashara kubwa' : 'Enterprise',
      featured: false,
      features: isSw
        ? ['Kila kitu cha PRO', 'Wafanyakazi wasio na kikomo', 'Developer support', 'Multi-branch (tayari)', 'API & integrations', 'Inasubiri malipo kabla ya activation']
        : ['Everything in PRO', 'Unlimited staff', 'Priority support', 'Multi-branch ready', 'API & integrations', 'Pending payment before activation']
    }
  };
}

function normalizePlanKey(plan) {
  const value = String(plan || LICENSE_PLANS.FREE).toLowerCase();
  if (value === 'basic') return LICENSE_PLANS.FREE;
  if (value === 'enterprise') return LICENSE_PLANS.PRO_PLUS;
  if (['free', 'pro', 'pro_plus'].includes(value)) return value;
  return LICENSE_PLANS.FREE;
}

function getPlanDetails(plan) {
  const catalog = getSubscriptionPlanCatalog();
  return catalog[normalizePlanKey(plan)] || catalog.free;
}

let licenseData = {
  company_id: 'COMP-' + Date.now(),
  plan: LICENSE_PLANS.FREE,
  status: LICENSE_STATUS.ACTIVE,
  expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  created_date: new Date().toISOString().split('T')[0],
  last_renewal: new Date().toISOString().split('T')[0],
  creator_id: null
};

let signupHumanCaptcha = null;
let signupSmsSession = null;
let signupOtpCountdownTimer = null;
let signupOtpVerified = false;
const TRANSLATIONS = {
  sw: {
    login: 'Ingia',
    logout: 'Toka',
    savedSales: 'Mauzo Yaliyohifadhiwa',
    exportCsv: 'Pakua CSV',
    employeeSummary: 'Muhtasari wa Wafanyakazi',
    businessSettings: 'Mipangilio ya Biashara',
    adminStaffManagement: 'Wafanyakazi Wangu',
    language: 'Lugha',
    theme: 'Muonekano',
    employeePlaceholder: 'Chagua mfanyakazi',
    passwordPlaceholder: 'Nywila',
    settingsSaved: 'Mipangilio imehifadhiwa!',
    invalidEmployee: 'Chagua mfanyakazi aliyesajiliwa',
    invalidPassword: 'Nywila si sahihi',
    noSavedSales: 'Hakuna mauzo yaliyohifadhiwa kwa tarehe hii',
    items: 'bidhaa'
  },
  en: {
    login: 'Login',
    logout: 'Logout',
    savedSales: 'Saved Sales',
    exportCsv: 'Export CSV',
    employeeSummary: 'Employee Summary',
    businessSettings: 'Business Settings',
    adminStaffManagement: 'My Staff',
    language: 'Language',
    theme: 'Mode',
    employeePlaceholder: 'Choose employee',
    passwordPlaceholder: 'Password',
    settingsSaved: 'Settings saved!',
    invalidEmployee: 'Choose a registered employee',
    invalidPassword: 'Incorrect password',
    noSavedSales: 'No saved sales for this date',
    items: 'items'
  },
  zh: {
    login: '登录',
    logout: '退出',
    savedSales: '已保存销售',
    exportCsv: '导出 CSV',
    employeeSummary: '员工汇总',
    businessSettings: '业务设置',
    language: '语言',
    theme: '模式',
    employeePlaceholder: '选择员工',
    passwordPlaceholder: '密码',
    settingsSaved: '设置已保存！',
    invalidEmployee: '请选择已注册员工',
    invalidPassword: '密码错误',
    noSavedSales: '此日期没有已保存销售',
    items: '件'
  }
};

const UI_TRANSLATIONS = {
  sw: {
    dashboard: 'Dashibodi', pointOfSale: 'Sehemu ya Mauzo', orders: 'Orders', password: 'Badilisha Password', inventory: 'Bidhaa', analytics: 'Uchambuzi', reports: 'Ripoti', history: 'Historia', settings: 'Mipangilio',
    businessManagement: 'Usimamizi wa Biashara', adminStaffManagement: 'Wafanyakazi Wangu', date: 'Tarehe:', employee: 'Mfanyakazi:', status: 'Hali:', active: 'Inafanya kazi', notSet: 'Haijawekwa',
    todaysSummary: 'Muhtasari wa Leo', totalRevenue: 'Jumla ya Mapato', itemsSold: 'Bidhaa Zilizouzwa', transactions: 'Miamala', lowStockItems: 'Bidhaa Zilizo Chini',
    dailyExpenses: 'Matumizi ya Siku', netProfit: 'Kilichobaki',
    salesOverview: 'Muhtasari wa Mauzo', daily: 'Siku', weekly: 'Wiki', monthly: 'Mwezi', bestSellingProducts: 'Bidhaa Zinazouzwa Sana', availableProducts: 'Bidhaa Zilizopo',
    viewAll: 'Tazama Zote →', lowStockAlert: 'Tahadhari ya Stock Ndogo', recentTransactions: 'Miamala ya Karibuni', quickActions: 'Vitendo vya Haraka',
    newSale: 'Sale Mpya', checkStock: 'Angalia Stock', generateReport: 'Tengeneza Ripoti', exportData: 'Pakua Data', workStatus: 'Hali ya Kazi',
    currentEmployee: 'Mfanyakazi wa Sasa:', clockInTime: 'Muda wa Kuingia:', salesToday: 'Mauzo ya Leo:', clockOut: 'Toka Kazini',
    products: 'Bidhaa', shoppingCart: 'Kikapu cha Mauzo', subtotal: 'Jumla Ndogo:', total: 'Jumla:', notesOptional: 'Maelezo (Si lazima)',
    clearCart: 'Futa Kikapu', saveSale: 'Hifadhi Mauzo', productInventory: 'Stock ya Bidhaa', addProduct: '+ Ongeza Bidhaa',
    totalProducts: 'Jumla ya Bidhaa', totalStockValue: 'Thamani ya Stock', outOfStock: 'Zimeisha', productName: 'Jina la Bidhaa',
    sku: 'SKU', price: 'Bei', stock: 'Stock', actions: 'Vitendo', analyticsInsights: 'Uchambuzi na Maarifa', salesTrend: 'Mwenendo wa Mauzo (Siku 7)',
    productPerformance: 'Utendaji wa Bidhaa', revenueAnalytics: 'Uchambuzi wa Mapato', categoryDistribution: 'Mgawanyo wa Makundi',
    dailyBossReports: 'Ripoti za Boss', dailySalesReport: 'Ripoti ya Mauzo ya Siku', weeklySalesReport: 'Ripoti ya Mauzo ya Wiki', monthlySalesReport: 'Ripoti ya Mauzo ya Mwezi',
    employeeComments: 'Maoni ya Wafanyakazi', sendWhatsApp: 'Tuma WhatsApp', exportPdf: 'Pakua PDF', addComment: 'Ongeza Maoni',
    salesHistory: 'Historia ya Mauzo', reset: 'Rudisha', sales: 'Mauzo', lastSale: 'Sale ya Mwisho', businessName: 'Jina la Biashara',
    bossPhone: 'Simu ya Boss (WhatsApp)', closingTime: 'Muda wa Kufunga', saveSettings: 'Hifadhi Mipangilio', dataManagement: 'Usimamizi wa Data',
    exportAllData: 'Pakua Data Zote', exportSalesReport: 'Pakua Ripoti ya Mauzo', resetSystem: 'Futa Mfumo', clearAllData: 'Futa Data Zote',
    aboutSystem: 'Kuhusu Mfumo', aboutText: 'Mfumo wa kisasa wa POS kwa biashara, wenye usimamizi wa stock, uchambuzi na ripoti.',
    addNewProduct: 'Ongeza Bidhaa Mpya', category: 'Kundi', stockType: 'Aina ya Stock', cancel: 'Ghairi', exportJson: 'Pakua JSON', printReport: 'Chapisha Ripoti',
    closingReminder: 'Kumbusho la Kufunga', closingTimeLabel: 'Muda wa kufunga:', timeRemaining: 'Muda uliobaki:', dark: 'Giza', light: 'Mwanga',
    searchProductsPlaceholder: '🔍 Tafuta bidhaa...', addNotesPlaceholder: 'Ongeza maelezo...', bossCommentPlaceholder: 'Ongeza maoni kwa boss...',
    enterBusinessName: 'Weka jina la biashara', enterPhoneNumber: 'Weka namba ya simu', enterProductName: 'Weka jina la bidhaa',
    enterSku: 'Weka SKU', enterPrice: 'Weka bei', enterQuantity: 'Weka idadi', enterCategory: 'Weka kundi',
    noSalesToday: 'Hakuna mauzo leo', noTransactions: 'Hakuna miamala bado', noComments: 'Hakuna maoni bado', cartEmpty: 'Kikapu kiko wazi',
    allProductsStocked: 'Bidhaa zote zina stock ya kutosha', addToCart: 'Ongeza', inStock: 'Ipo', lowStock: 'Stock Ndogo', addStock: 'Ongeza Stock', edit: 'Hariri'
  },
  en: {
    dashboard: 'Dashboard', pointOfSale: 'Point of Sale', orders: 'Orders', password: 'Change Password', inventory: 'Inventory', analytics: 'Analytics', reports: 'Reports', history: 'History', settings: 'Settings',
    businessManagement: 'Business Management', adminStaffManagement: 'My Staff', date: 'Date:', employee: 'Employee:', status: 'Status:', active: 'Active', notSet: 'Not Set',
    todaysSummary: "Today's Summary", totalRevenue: 'Total Revenue', itemsSold: 'Items Sold', transactions: 'Transactions', lowStockItems: 'Low Stock Items',
    dailyExpenses: 'Daily Expenses', netProfit: 'Net Profit',
    salesOverview: 'Sales Overview', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', bestSellingProducts: 'Best Selling Products', availableProducts: 'Available Products',
    viewAll: 'View All →', lowStockAlert: 'Low Stock Alert', recentTransactions: 'Recent Transactions', quickActions: 'Quick Actions',
    newSale: 'New Sale', checkStock: 'Check Stock', generateReport: 'Generate Report', exportData: 'Export Data', workStatus: 'Work Status',
    currentEmployee: 'Current Employee:', clockInTime: 'Clock In Time:', salesToday: 'Sales Today:', clockOut: 'Clock Out',
    products: 'Products', shoppingCart: 'Shopping Cart', subtotal: 'Subtotal:', total: 'Total:', notesOptional: 'Notes (Optional)',
    clearCart: 'Clear Cart', saveSale: 'Save Sale', productInventory: 'Product Inventory', addProduct: '+ Add Product',
    totalProducts: 'Total Products', totalStockValue: 'Total Stock Value', outOfStock: 'Out of Stock', productName: 'Product Name',
    sku: 'SKU', price: 'Price', stock: 'Stock', actions: 'Actions', analyticsInsights: 'Analytics & Insights', salesTrend: 'Sales Trend (7 Days)',
    productPerformance: 'Product Performance', revenueAnalytics: 'Revenue Analytics', categoryDistribution: 'Category Distribution',
    dailyBossReports: 'Daily Boss Reports', dailySalesReport: 'Daily Sales Report', weeklySalesReport: 'Weekly Sales Report', monthlySalesReport: 'Monthly Sales Report',
    employeeComments: 'Employee Comments', sendWhatsApp: 'Send via WhatsApp', exportPdf: 'Export as PDF', addComment: 'Add Comment',
    salesHistory: 'Sales History', reset: 'Reset', sales: 'Sales', lastSale: 'Last Sale', businessName: 'Business Name',
    bossPhone: 'Boss Phone (WhatsApp)', closingTime: 'Closing Time', saveSettings: 'Save Settings', dataManagement: 'Data Management',
    exportAllData: 'Export All Data', exportSalesReport: 'Export Sales Report', resetSystem: 'Reset System', clearAllData: 'Clear All Data',
    aboutSystem: 'About System', aboutText: 'A modern POS system for retail businesses with stock management, analytics and reporting.',
    addNewProduct: 'Add New Product', category: 'Category', stockType: 'Stock Type', cancel: 'Cancel', exportJson: 'Export as JSON', printReport: 'Print Report',
    closingReminder: 'Store Closing Reminder', closingTimeLabel: 'Closing time:', timeRemaining: 'Time remaining:', dark: 'Dark', light: 'Light',
    searchProductsPlaceholder: '🔍 Search products...', addNotesPlaceholder: 'Add notes...', bossCommentPlaceholder: 'Add comment for boss...',
    enterBusinessName: 'Enter business name', enterPhoneNumber: 'Enter phone number', enterProductName: 'Enter product name',
    enterSku: 'Enter SKU', enterPrice: 'Enter price', enterQuantity: 'Enter quantity', enterCategory: 'Enter category',
    noSalesToday: 'No sales today', noTransactions: 'No transactions yet', noComments: 'No comments yet', cartEmpty: 'Cart is empty',
    allProductsStocked: 'All products well stocked', addToCart: 'Add to Cart', inStock: 'In Stock', lowStock: 'Low Stock', addStock: 'Add Stock', edit: 'Edit'
  },
  zh: {
    dashboard: '仪表板', pointOfSale: '销售点', orders: 'Orders', inventory: '库存', analytics: '分析', reports: '报告', history: '历史', settings: '设置',
    businessManagement: '业务管理', adminStaffManagement: '我的员工', date: '日期：', employee: '员工：', status: '状态：', active: '运行中', notSet: '未设置',
    todaysSummary: '今日汇总', totalRevenue: '总收入', itemsSold: '已售商品', transactions: '交易', lowStockItems: '低库存商品',
    salesOverview: '销售概览', daily: '日', weekly: '周', monthly: '月', bestSellingProducts: '畅销商品', availableProducts: '现有商品',
    viewAll: '查看全部 →', lowStockAlert: '低库存提醒', recentTransactions: '最近交易', quickActions: '快捷操作',
    newSale: '新销售', checkStock: '查看库存', generateReport: '生成报告', exportData: '导出数据', workStatus: '工作状态',
    currentEmployee: '当前员工：', clockInTime: '登录时间：', salesToday: '今日销售：', clockOut: '退出工作',
    products: '商品', shoppingCart: '购物车', subtotal: '小计：', total: '总计：', notesOptional: '备注（可选）',
    clearCart: '清空购物车', saveSale: '保存销售', productInventory: '商品库存', addProduct: '+ 添加商品',
    totalProducts: '商品总数', totalStockValue: '库存总值', outOfStock: '缺货', productName: '商品名称',
    sku: 'SKU', price: '价格', stock: '库存', actions: '操作', analyticsInsights: '分析与洞察', salesTrend: '销售趋势（7天）',
    productPerformance: '商品表现', revenueAnalytics: '收入分析', categoryDistribution: '分类分布',
    dailyBossReports: '老板日报', dailySalesReport: '日销售报告', weeklySalesReport: '周销售报告', monthlySalesReport: '月销售报告',
    employeeComments: '员工备注', sendWhatsApp: '通过 WhatsApp 发送', exportPdf: '导出 PDF', addComment: '添加备注',
    salesHistory: '销售历史', reset: '重置', sales: '销售', lastSale: '最后销售', businessName: '业务名称',
    bossPhone: '老板电话 (WhatsApp)', closingTime: '关店时间', saveSettings: '保存设置', dataManagement: '数据管理',
    exportAllData: '导出全部数据', exportSalesReport: '导出销售报告', resetSystem: '重置系统', clearAllData: '清除全部数据',
    aboutSystem: '关于系统', aboutText: '适合零售业务的现代 POS 系统，包含库存管理、分析和报告。',
    addNewProduct: '添加新商品', category: '分类', stockType: 'Stock Type', cancel: '取消', exportJson: '导出 JSON', printReport: '打印报告',
    closingReminder: '关店提醒', closingTimeLabel: '关店时间：', timeRemaining: '剩余时间：', dark: '深色', light: '浅色',
    searchProductsPlaceholder: '🔍 搜索商品...', addNotesPlaceholder: '添加备注...', bossCommentPlaceholder: '给老板添加备注...',
    enterBusinessName: '输入业务名称', enterPhoneNumber: '输入电话号码', enterProductName: '输入商品名称',
    enterSku: '输入 SKU', enterPrice: '输入价格', enterQuantity: '输入数量', enterCategory: '输入分类',
    noSalesToday: '今天没有销售', noTransactions: '暂无交易', noComments: '暂无备注', cartEmpty: '购物车为空',
    allProductsStocked: '所有商品库存充足', addToCart: '加入购物车', inStock: '有货', lowStock: '低库存', addStock: '添加库存', edit: '编辑'
  }
};

Object.keys(UI_TRANSLATIONS).forEach(language => {
  TRANSLATIONS[language] = {
    ...(TRANSLATIONS[language] || {}),
    ...UI_TRANSLATIONS[language],
    password: language === 'sw' ? 'Badilisha Password' : (language === 'zh' ? '修改密码' : 'Change Password'),
    costPrice: language === 'sw' ? 'Bei ya Kununua' : 'Cost Price',
    profitPerItem: language === 'sw' ? 'Faida/Kipande' : 'Profit/Item',
    dailyBackupTime: language === 'sw' ? 'Muda wa Backup ya Kila Siku' : 'Daily Backup Time',
    backupRestore: language === 'sw' ? 'Backup / Restore' : 'Backup / Restore',
    backupTimeHint: language === 'sw' ? 'Saa sita usiku ni 00:00. App ikiwa wazi muda huo itahifadhi backup ya siku.' : 'Midnight is 00:00. If the app is open then, it saves the daily backup.',
    chooseBackupFolder: language === 'sw' ? 'Chagua Folder ya Backup' : 'Choose Backup Folder',
    backupNow: language === 'sw' ? 'Backup Sasa' : 'Backup Now',
    restoreBackup: language === 'sw' ? 'Restore Backup' : 'Restore Backup',
    syncCloudNow: language === 'sw' ? 'Sync Cloud Sasa' : 'Sync Cloud Now',
    customers: language === 'sw' ? 'Madeni' : 'Debts',
    customerManagement: language === 'sw' ? 'Madeni ya Wateja' : 'Customer Debts',
    customerName: language === 'sw' ? 'Jina la Mteja' : 'Customer Name',
    customerPhone: language === 'sw' ? 'Simu ya Mteja' : 'Customer Phone',
    payment: language === 'sw' ? 'Malipo' : (language === 'zh' ? '付款' : 'Payment'),
    paymentStatusLabel: language === 'sw' ? 'Hali ya Malipo' : (language === 'zh' ? '付款状态' : 'Payment Status'),
    paid: language === 'sw' ? 'Amelipa yote' : (language === 'zh' ? '已付清' : 'Paid'),
    partial: language === 'sw' ? 'Amelipa kiasi' : (language === 'zh' ? '部分付款' : 'Partial'),
    credit: language === 'sw' ? 'Deni' : (language === 'zh' ? '赊账' : 'Credit'),
    allPayments: language === 'sw' ? 'Malipo Yote' : (language === 'zh' ? '所有付款' : 'All Payments'),
    allStatuses: language === 'sw' ? 'Status Zote' : (language === 'zh' ? '所有状态' : 'All Status'),
    unpaid: language === 'sw' ? 'Hajalipa' : (language === 'zh' ? '未付款' : 'Unpaid'),
    markPaid: language === 'sw' ? 'Weka Amelipa' : (language === 'zh' ? '标记已付' : 'Mark Paid'),
    markUnpaid: language === 'sw' ? 'Weka Hajalipa' : (language === 'zh' ? '标记未付' : 'Mark Unpaid'),
    saveOrder: language === 'sw' ? 'Hifadhi Order' : (language === 'zh' ? '保存订单' : 'Save Order'),
    receiptWhatsApp: language === 'sw' ? 'Risiti / WhatsApp' : (language === 'zh' ? '收据 / WhatsApp' : 'Receipt / WhatsApp'),
    smartPriceCalculator: language === 'sw' ? 'Kikokotoo cha Bei' : (language === 'zh' ? '智能价格计算器' : 'Smart Price Calculator'),
    smartPriceHint: language === 'sw' ? 'Inahesabu cm, m, kg, l, inch na vipimo mchanganyiko kama 1m 20cm.' : (language === 'zh' ? '支持 cm、m、kg、l、inch 以及 1m 20cm 等混合单位。' : 'Supports cm, m, kg, l, inch and mixed units like 1m 20cm.'),
    productService: language === 'sw' ? 'Bidhaa / Huduma' : (language === 'zh' ? '商品 / 服务' : 'Product / Service'),
    calculationType: language === 'sw' ? 'Aina ya Hesabu' : (language === 'zh' ? '计算类型' : 'Calculation Type'),
    width: language === 'sw' ? 'Upana' : (language === 'zh' ? '宽度' : 'Width'),
    height: language === 'sw' ? 'Urefu' : (language === 'zh' ? '高度' : 'Height'),
    quantity: language === 'sw' ? 'Idadi' : (language === 'zh' ? '数量' : 'Quantity'),
    customPrice: language === 'sw' ? 'Bei Maalum' : (language === 'zh' ? '自定义价格' : 'Custom Price'),
    addCalculatedItem: language === 'sw' ? 'Ongeza Bidhaa Iliyohesabiwa' : (language === 'zh' ? '添加计算项目' : 'Add Calculated Item'),
    mySalesToday: language === 'sw' ? 'Mauzo Yangu Leo' : (language === 'zh' ? '我今天的销售' : 'My Sales Today'),
    pending: language === 'sw' ? 'Inasubiri' : (language === 'zh' ? '待处理' : 'Pending'),
    inProgress: language === 'sw' ? 'Inaendelea' : (language === 'zh' ? '进行中' : 'In progress'),
    ready: language === 'sw' ? 'Tayari' : (language === 'zh' ? '已完成' : 'Ready'),
    delivered: language === 'sw' ? 'Imekabidhiwa' : (language === 'zh' ? '已交付' : 'Delivered'),
    noOrdersForFilter: language === 'sw' ? 'Hakuna orders kwa filter hii.' : (language === 'zh' ? '此筛选没有订单。' : 'No orders for this filter.'),
    none: language === 'sw' ? 'Hakuna' : (language === 'zh' ? '无' : 'None'),
    customerNamePlaceholder: language === 'sw' ? 'Jina la mteja' : (language === 'zh' ? '客户姓名' : 'Customer name'),
    customerPhonePlaceholder: language === 'sw' ? '+2557XXXXXXXX' : '+2557XXXXXXXX',
    debtAmount: language === 'sw' ? 'Deni' : (language === 'zh' ? '欠款' : 'Debt'),
    paidAmount: language === 'sw' ? 'Kilicholipwa' : (language === 'zh' ? '已付金额' : 'Paid Amount'),
    outstandingDebt: language === 'sw' ? 'Deni Lililobaki' : (language === 'zh' ? '剩余欠款' : 'Outstanding Debt'),
    recordPayment: language === 'sw' ? 'Pokea Malipo' : (language === 'zh' ? '收款' : 'Receive Payment'),
    noCustomers: language === 'sw' ? 'Bado hakuna deni la mteja.' : (language === 'zh' ? '暂无客户欠款。' : 'No customer debt yet.'),
    backupFolderHint: language === 'sw' ? 'Folder inaweza kuwa Google Drive au flash drive.' : 'The folder can be Google Drive or a flash drive.',
    lastBackupLabel: language === 'sw' ? 'Backup ya mwisho:' : 'Last backup:',
    staffNamePlaceholder: language === 'sw' ? 'Jina la mfanyakazi' : 'Staff name',
    temporaryPasswordPlaceholder: language === 'sw' ? 'Password ya muda' : 'Temporary password',
    addStaff: language === 'sw' ? 'Ongeza' : 'Add',
    adminStaffHint: language === 'sw'
      ? 'Admin anaweza kuongeza au kuondoa wafanyakazi wake. Ukiondoa, mfanyakazi hataweza kuingia tena.'
      : 'An admin can add or remove their staff. Removed staff cannot log in again.',
    expenseTitle: language === 'sw' ? 'Matumizi ya Leo' : 'Today Expenses',
    expenseNamePlaceholder: language === 'sw' ? 'Mfano: Nauli, chakula, delivery' : 'Example: transport, food, delivery',
    expenseAmountPlaceholder: language === 'sw' ? 'Kiasi' : 'Amount',
    addExpense: language === 'sw' ? 'Ongeza Matumizi' : 'Add Expense',
    noExpensesToday: language === 'sw' ? 'Bado hakuna matumizi ya leo.' : 'No expenses recorded today.',
    dailyExpenses: language === 'sw' ? 'Matumizi ya Siku' : 'Daily Expenses',
    netProfit: language === 'sw' ? 'Kilichobaki' : 'Net Profit',
    grossProfit: language === 'sw' ? 'Faida Kabla ya Matumizi' : 'Gross Profit',
    expenseSaved: language === 'sw' ? 'Matumizi yamehifadhiwa' : 'Expense saved',
    expenseInvalid: language === 'sw' ? 'Weka jina na kiasi sahihi cha matumizi.' : 'Enter a valid expense name and amount.',
    expenseUpdated: language === 'sw' ? 'Matumizi yamesasishwa' : 'Expense updated',
    expenseDeleted: language === 'sw' ? 'Matumizi yamefutwa' : 'Expense deleted',
    editExpense: language === 'sw' ? 'Hariri matumizi' : 'Edit expense',
    deleteExpense: language === 'sw' ? 'Futa matumizi' : 'Delete expense',
    // License System Translations
    subscriptionLicense: language === 'sw' ? 'Leseni ya Usambazaji' : 'Subscription License',
    licenseStatus: language === 'sw' ? 'Hali ya Leseni' : 'License Status',
    licenseActive: language === 'sw' ? 'Leseni Inafanya' : 'License Active',
    licenseExpired: language === 'sw' ? 'Leseni Imefika Muda' : 'License Expired',
    expiryDate: language === 'sw' ? 'Tarehe ya Kumalizia' : 'Expiry Date',
    subscriptionPlan: language === 'sw' ? 'Mpango wa Usambazaji' : 'Subscription Plan',
    planBasic: language === 'sw' ? 'Msingi' : 'Basic',
    planPro: language === 'sw' ? 'Pro' : 'Pro',
    planEnterprise: language === 'sw' ? 'Biashara Kubwa' : 'Enterprise',
    renewLicense: language === 'sw' ? 'Panua Leseni' : 'Renew License',
    renewFor1Month: language === 'sw' ? 'Panua kwa Mwezi 1' : 'Renew for 1 Month',
    systemLocked: language === 'sw' ? 'Mfumo umefungwa kwa sababu ya leseni iliyofika muda. Wasiliana na mtoa huduma.' : 'Your system has been locked due to expired subscription. Contact provider.',
    subscriptionExpired: language === 'sw' ? 'Leseni yako imefika muda. Tafadhali panua leseni yako.' : 'Subscription expired. Please renew your license.',
    licenseRenewalSuccess: language === 'sw' ? 'Leseni imepanuliwa kwa mwezi mmoja!' : 'License renewed for one month!',
    licenseRenewalError: language === 'sw' ? 'Kosa katika panua leseni. Jaribu tena.' : 'Error renewing license. Try again.',
    licenseRenewalNotCreator: language === 'sw' ? 'Kosa: Tu mtu aliyeunda leseni anaweza kuipanua.' : 'Error: Only the creator can renew the license.',
    planFree: language === 'sw' ? 'FREE' : 'FREE',
    planProPlus: language === 'sw' ? 'Pro+' : 'Pro+',
    daysRemaining: language === 'sw' ? 'Siku zilizobaki' : 'Days remaining',
    manageLicense: language === 'sw' ? 'Simamia Leseni' : 'Manage License',
    companyId: language === 'sw' ? 'Kitambulisho cha Kampuni' : 'Company ID',
    licenseSettings: language === 'sw' ? 'Mipangilio ya Leseni' : 'License Settings',
    loginGateSubtitle: language === 'sw' ? 'Andika jina lako na nywila ili kuendelea.' : 'Enter your username and password to continue.',
    loginNameLabel: language === 'sw' ? 'Jina la mtumiaji' : 'Username',
    loginGateHint: language === 'sw' ? 'Andika jina lako kama ulivyosajiliwa, kisha weka nywila yako.' : 'Type your registered name, then enter your password.',
    loginNamePlaceholder: language === 'sw' ? 'Mfano: Admin 1' : 'e.g. Admin 1',
    licenseExpiredBadge: language === 'sw' ? 'LESENI IMEISHA' : 'LICENSE EXPIRED',
    licenseExpiredTitle: language === 'sw' ? 'Mfumo Umefungwa' : 'System Locked',
    licenseExpiredFooter: language === 'sw'
      ? 'Wasiliana na mtoa huduma wa MO SaaS kupata leseni mpya.'
      : 'Contact your MO SaaS provider for a new license.',
    backToLogin: language === 'sw' ? 'Rudi kwenye Login' : 'Back to Login',
    loginLicenseBannerTitle: language === 'sw' ? 'Leseni imefika muda' : 'License has expired',
    loginLicenseBannerDesc: language === 'sw'
      ? 'Wasiliana na mtoa huduma kupata leseni mpya.'
      : 'Contact your provider to renew your license.',
    signupTitle: language === 'sw' ? 'Unda akaunti ya Admin' : 'Create Admin Account',
    signupSubtitle: language === 'sw' ? 'Jaza taarifa za biashara yako kuanza trial.' : 'Fill in your business details to start your trial.',
    signupSubmit: language === 'sw' ? 'Jisajili sasa' : 'Sign up now',
    signupProcessing: language === 'sw' ? 'Inasajili...' : 'Registering...',
    signupSuccess: language === 'sw' ? 'Usajili umefanikiwa!' : 'Registration successful!',
    signupSuccessShort: language === 'sw' ? 'Akaunti imeundwa. Ingia sasa.' : 'Account created. Please log in.',
    signupFailed: language === 'sw' ? 'Usajili umeshindikana. Jaribu tena.' : 'Registration failed. Try again.',
    signupEmailLabel: language === 'sw' ? 'Barua pepe' : 'Email',
    signupPhoneLabel: language === 'sw' ? 'Simu' : 'Phone',
    signupConfirmPasswordLabel: language === 'sw' ? 'Thibitisha nywila' : 'Confirm password',
    aboutTagline: language === 'sw' ? 'Mfumo wa Mauzo na Usimamizi wa Biashara' : 'Modern Employee Sales & Business Management System',
    versionLabel: language === 'sw' ? 'Toleo 1.0' : 'Version 1.0',
    offlineReadyLabel: language === 'sw' ? 'Tayari kwa offline' : 'Offline ready',
    secureAccessLabel: language === 'sw' ? 'Ulinzi wa access' : 'Secure access',
    sessionSecurity: language === 'sw' ? 'Usalama wa Session' : 'Session Security',
    sessionTimeoutHint: language === 'sw' ? 'Kikapu kisichohifadhiwa huhifadhiwa kiotomatiki kabla ya logout.' : 'Unsaved cart work is saved automatically before logout.',
    sessionExpireMessage: language === 'sw' ? 'Session yako itaisha ndani ya sekunde' : 'Your session will expire in',
    secondsLabel: language === 'sw' ? 'sekunde' : 'seconds',
    logoutNow: language === 'sw' ? 'Toka Sasa' : 'Logout Now',
    stayLoggedIn: language === 'sw' ? 'Endelea Kuingia' : 'Stay Logged In',
    installApp: language === 'sw' ? 'Sakinisha hii APP' : 'Install this App',
    installUnavailable: language === 'sw'
      ? 'Kwenye simu, fungua menu ya browser kisha chagua Add to Home Screen.'
      : 'On mobile, open the browser menu and choose Add to Home Screen.',
    appInstalled: language === 'sw' ? 'App imesakinishwa.' : 'App installed.',
    signupNameRequired: language === 'sw' ? 'Jina na biashara vinahitajika.' : 'Full name and business name are required.',
    signupContactRequired: language === 'sw' ? 'Weka barua pepe AU namba ya simu.' : 'Enter an email OR phone number.',
    signupContactExists: language === 'sw' ? 'Email au simu tayari imesajiliwa.' : 'Email or phone is already registered.',
    signupEmailInvalid: language === 'sw' ? 'Barua pepe si sahihi.' : 'Invalid email address.',
    signupPhoneInvalid: language === 'sw' ? 'Namba ya simu si sahihi.' : 'Invalid phone number.',
    signupPasswordMismatch: language === 'sw' ? 'Nywila hazifanani.' : 'Passwords do not match.',
    signupPasswordWeak: language === 'sw' ? 'Nywila inahitaji' : 'Password must include',
    showSignupLink: language === 'sw' ? 'Jisajili hapa' : 'Sign up here',
    noAdminAccount: language === 'sw' ? 'Huna akaunti ya Admin?' : "Don't have an Admin account?",
    haveAccount: language === 'sw' ? 'Tayari una akaunti?' : 'Already have an account?',
    backToLoginLink: language === 'sw' ? 'Rudi kwenye Login' : 'Back to Login',
    bossAdminAdded: language === 'sw' ? 'Admin ameongezwa' : 'Admin added',
    bossAdminRemoved: language === 'sw' ? 'Admin ameondolewa' : 'Admin removed',
    bossAdminRemoveConfirm: language === 'sw' ? 'Ondoa Admin' : 'Remove Admin',
    bossRemoveAdmin: language === 'sw' ? 'Ondoa' : 'Remove',
    signupPlansHeading: language === 'sw' ? 'Chagua mpango wako' : 'Choose your plan',
    signupVerifyHeading: language === 'sw' ? 'Thibitisha kuwa wewe ni mtu' : 'Verify you are human',
    signupCaptchaLabel: language === 'sw' ? 'Swali la usalama' : 'Security question',
    signupCaptchaRequired: language === 'sw' ? 'Jibu swali la usalama.' : 'Answer the security question.',
    signupCaptchaInvalid: language === 'sw' ? 'Jibu la swali si sahihi.' : 'Incorrect security answer.',
    signupSmsLabel: language === 'sw' ? 'Thibitisho la SMS' : 'SMS verification',
    signupSmsHint: language === 'sw' ? 'Tutatuma namba ya uthibitisho kwenye simu yako.' : 'We will send a verification code to your phone.',
    signupSendOtp: language === 'sw' ? 'Tuma SMS OTP' : 'Send SMS OTP',
    signupSendingOtp: language === 'sw' ? 'Inatuma...' : 'Sending...',
    signupOtpSent: language === 'sw' ? 'OTP imetumwa kwenye simu yako.' : 'OTP sent to your phone.',
    signupOtpRequired: language === 'sw' ? 'Weka OTP iliyotumwa kwa SMS.' : 'Enter the SMS OTP code.',
    signupOtpInvalid: language === 'sw' ? 'OTP si sahihi.' : 'Invalid OTP code.',
    signupOtpExpired: language === 'sw' ? 'OTP imeisha muda. Tuma tena.' : 'OTP expired. Send again.',
    signupOtpPhoneMismatch: language === 'sw' ? 'OTP hailingani na namba ya simu.' : 'OTP does not match this phone number.',
    signupOtpResendIn: language === 'sw' ? 'Tuma tena baada ya' : 'Resend in',
    signupOtpDemo: language === 'sw' ? 'Demo OTP (bila SMS halisi)' : 'Demo OTP (no real SMS yet)',
    signupPaymentHeading: language === 'sw' ? 'Malipo ya Kifurushi' : 'Plan Payment',
    signupPaymentHint: language === 'sw' ? 'Chagua njia ya malipo: BANK au MITANDAO.' : 'Choose payment method: BANK or MOBILE NETWORKS.',
    signupPaymentMethodRequired: language === 'sw' ? 'Chagua njia ya malipo (BANK au MITANDAO).' : 'Select payment method (BANK or MOBILE NETWORKS).',
    signupPaymentRefRequired: language === 'sw' ? 'Weka namba ya kumbukumbu ya malipo.' : 'Enter payment reference number.',
    signupPendingPayment: language === 'sw' ? 'Usajili umepokelewa. Akaunti inasubiri activation ya malipo.' : 'Signup received. Account is waiting for payment activation.',
    signupAutoActivated: language === 'sw' ? 'Malipo yamepokelewa. Akaunti ime-activate moja kwa moja.' : 'Payment received. Account auto-activated.',
    paymentMethodBank: language === 'sw' ? 'BANK' : 'BANK',
    paymentMethodNetworks: language === 'sw' ? 'MITANDAO' : 'MOBILE NETWORKS'
  };
});

Object.assign(TRANSLATIONS.zh, {
  login: '登录',
  logout: '退出',
  dashboard: '仪表盘',
  pointOfSale: '销售点',
  orders: '订单',
  inventory: '库存',
  analytics: '分析',
  reports: '报表',
  history: '历史',
  settings: '设置',
  businessManagement: '业务管理',
  adminStaffManagement: '我的员工',
  date: '日期:',
  employee: '员工:',
  status: '状态:',
  active: '运行中',
  notSet: '未设置',
  savedSales: '已保存销售',
  exportCsv: '导出 CSV',
  employeeSummary: '员工汇总',
  businessSettings: '业务设置',
  language: '语言',
  theme: '模式',
  employeePlaceholder: '选择员工',
  passwordPlaceholder: '密码',
  settingsSaved: '设置已保存!',
  invalidEmployee: '请选择已注册员工',
  invalidPassword: '密码错误',
  noSavedSales: '该日期没有已保存销售',
  items: '件',
  todaysSummary: '今日汇总',
  totalRevenue: '总收入',
  itemsSold: '已售商品',
  transactions: '交易',
  lowStockItems: '低库存商品',
  salesOverview: '销售概览',
  daily: '日',
  weekly: '周',
  monthly: '月',
  bestSellingProducts: '畅销商品',
  availableProducts: '可售商品',
  viewAll: '查看全部',
  lowStockAlert: '低库存提醒',
  recentTransactions: '最近交易',
  quickActions: '快捷操作',
  newSale: '新销售',
  checkStock: '查看库存',
  generateReport: '生成报表',
  exportData: '导出数据',
  workStatus: '工作状态',
  currentEmployee: '当前员工:',
  clockInTime: '登录时间:',
  salesToday: '今日销售:',
  clockOut: '下班',
  products: '商品',
  shoppingCart: '购物车',
  subtotal: '小计:',
  total: '总计:',
  notesOptional: '备注(可选)',
  clearCart: '清空购物车',
  saveSale: '保存销售',
  productInventory: '商品库存',
  addProduct: '添加商品',
  totalProducts: '商品总数',
  totalStockValue: '库存总值',
  outOfStock: '缺货',
  productName: '商品名称',
  sku: 'SKU',
  price: '价格',
  costPrice: '成本价',
  profitPerItem: '单件利润',
  stock: '库存',
  actions: '操作',
  analyticsInsights: '分析与洞察',
  salesTrend: '销售趋势(7天)',
  productPerformance: '商品表现',
  revenueAnalytics: '收入分析',
  categoryDistribution: '分类分布',
  dailyBossReports: '老板日报',
  dailySalesReport: '每日销售报表',
  weeklySalesReport: '每周销售报表',
  monthlySalesReport: '每月销售报表',
  employeeComments: '员工备注',
  sendWhatsApp: '发送 WhatsApp',
  exportPdf: '导出 PDF',
  addComment: '添加备注',
  salesHistory: '销售历史',
  reset: '重置',
  sales: '销售',
  lastSale: '最后销售',
  businessName: '业务名称',
  bossPhone: '老板电话(WhatsApp)',
  closingTime: '关店时间',
  dailyBackupTime: '每日备份时间',
  saveSettings: '保存设置',
  dataManagement: '数据管理',
  exportAllData: '导出全部数据',
  exportSalesReport: '导出销售报表',
  backupRestore: '备份 / 恢复',
  backupTimeHint: '午夜是 00:00。如果应用打开，将自动保存每日备份。',
  chooseBackupFolder: '选择备份文件夹',
  backupNow: '立即备份',
  restoreBackup: '恢复备份',
  syncCloudNow: '立即同步云端',
  backupFolderHint: '文件夹可以是 Google Drive 或闪存盘。',
  lastBackupLabel: '最后备份:',
  resetSystem: '重置系统',
  clearAllData: '清除全部数据',
  staffNamePlaceholder: '员工姓名',
  temporaryPasswordPlaceholder: '临时密码',
  addStaff: '添加',
  adminStaffHint: '管理员可以添加或移除自己的员工。移除后员工不能再次登录。',
  subscriptionLicense: '订阅许可',
  licenseStatus: '许可状态',
  licenseActive: '许可有效',
  licenseExpired: '许可已过期',
  expiryDate: '到期日期',
  subscriptionPlan: '订阅方案',
  manageLicense: '管理许可',
  daysRemaining: '剩余天数',
  companyId: '公司 ID',
  aboutSystem: '关于系统',
  aboutText: '面向现代零售业务的专业 POS 系统，包含库存管理、分析和报表功能。',
  aboutTagline: '现代员工销售与业务管理系统',
  versionLabel: '版本 1.0',
  offlineReadyLabel: '支持离线',
  secureAccessLabel: '安全访问',
  sessionSecurity: '会话安全',
  sessionTimeoutHint: '未保存的购物车内容会在退出前自动保存。',
  sessionExpireMessage: '你的会话将在以下秒数后过期',
  secondsLabel: '秒',
  logoutNow: '立即退出',
  stayLoggedIn: '保持登录',
  installApp: '安装此应用',
  installUnavailable: '在手机浏览器菜单中选择“添加到主屏幕”。',
  appInstalled: '应用已安装。',
  expenseTitle: '今日支出',
  expenseNamePlaceholder: '例如: 交通、餐食、配送',
  expenseAmountPlaceholder: '金额',
  addExpense: '添加支出',
  noExpensesToday: '今天暂无支出记录。',
  dailyExpenses: '每日支出',
  netProfit: '净收入',
  grossProfit: '扣除支出前利润',
  expenseSaved: '支出已保存',
  expenseInvalid: '请输入有效的支出名称和金额。',
  expenseUpdated: '支出已更新',
  expenseDeleted: '支出已删除',
  editExpense: '编辑支出',
  deleteExpense: '删除支出',
  addNewProduct: '添加新商品',
  category: '分类',
  stockType: '库存类型',
  cancel: '取消',
  exportJson: '导出 JSON',
  printReport: '打印报表',
  closingReminder: '关店提醒',
  closingTimeLabel: '关店时间:',
  timeRemaining: '剩余时间:',
  dark: '深色',
  light: '浅色',
  searchProductsPlaceholder: '搜索商品...',
  addNotesPlaceholder: '添加备注...',
  bossCommentPlaceholder: '给老板添加备注...',
  enterBusinessName: '输入业务名称',
  enterPhoneNumber: '输入电话号码',
  enterProductName: '输入商品名称',
  enterSku: '输入 SKU',
  enterPrice: '输入价格',
  enterQuantity: '输入数量',
  enterCategory: '输入分类',
  noSalesToday: '今天没有销售',
  noTransactions: '暂无交易',
  noComments: '暂无备注',
  cartEmpty: '购物车为空',
  allProductsStocked: '所有商品库存充足',
  addToCart: '加入购物车',
  inStock: '有货',
  lowStock: '低库存',
  addStock: '添加库存',
  edit: '编辑'
});

const DEFAULT_PRODUCTS = [
  {
    id: 'prod_pungua_na_aggy',
    name: 'Pungua na Aggy',
    sku: 'PROD-PUNGUA-AGGY',
    price: 25000,
    stock: 50,
    category: 'product',
    itemType: 'product',
    stockType: 'product',
    unitType: 'piece',
    priceMode: 'quantity'
  },
  {
    id: 'prod_sublimation_paper',
    name: 'Sublimation Paper',
    sku: 'PROD-SUBLIMATION-PAPER',
    price: 0,
    stock: 100,
    category: 'product',
    itemType: 'product',
    stockType: 'product',
    unitType: 'sheet',
    priceMode: 'quantity'
  }
];

const BUSINESS_CATALOG_ITEMS = [
  { id: 'biz_business_card', name: 'Business Card - Pic 100', sku: 'PRINT-BIZCARD-100', price: 35000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'set', priceMode: 'quantity' },
  { id: 'biz_bango_nje', name: 'Bango la Nje', sku: 'PRINT-BANGO-NJE', price: 49999, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'piece', priceMode: 'quantity' },
  { id: 'biz_bango_nje_pande_mbili', name: 'Bango la Nje - Pande Mbili', sku: 'PRINT-BANGO-NJE-2SIDE', price: 65000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'piece', priceMode: 'quantity' },
  { id: 'biz_flyers_100', name: 'Flyers Design and Printing - Pic 100', sku: 'PRINT-FLYERS-100', price: 49999, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'set', priceMode: 'quantity' },
  { id: 'biz_jezi_print', name: 'Kuprint Jezi', sku: 'PRINT-JEZI', price: 5000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'piece', priceMode: 'quantity' },
  { id: 'biz_sign_logo_2x2', name: 'Sign logo futi 2 kwa 2', sku: 'PRINT-SIGN-LOGO-2X2', price: 165000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'piece', priceMode: 'quantity' },
  { id: 'biz_bango_nje_kubwa_2m', name: 'Bango la Nje Kubwa - Mita Mbili', sku: 'PRINT-BANGO-KUBWA-2M', price: 95000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'piece', priceMode: 'quantity' },
  { id: 'biz_frame_picha', name: 'Frame za picha', sku: 'FRAME-PICHA', price: 0, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'piece', priceMode: 'custom' },
  { id: 'biz_picha_mbao_a3', name: 'Picha mbao A3', sku: 'PICHA-MBAO-A3', price: 25000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'piece', priceMode: 'quantity' },
  { id: 'biz_picha_mbao_a4', name: 'Picha mbao A4', sku: 'PICHA-MBAO-A4', price: 15000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'piece', priceMode: 'quantity' },
  { id: 'biz_rgb_sticker', name: 'RGB Sticker', sku: 'RGB-STICKER', price: 1000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'picture', priceMode: 'quantity' },
  { id: 'svc_banner', name: 'Banner', sku: 'SVC-BANNER', price: 16000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'meter', priceMode: 'area' },
  { id: 'svc_sticker_printing', name: 'Sticker printing', sku: 'SVC-STICKER', price: 15000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'meter', priceMode: 'area' },
  { id: 'svc_contra', name: 'Contra', sku: 'SVC-CONTRA', price: 25000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'meter', priceMode: 'area' },
  { id: 'svc_backlight', name: 'Backlight', sku: 'SVC-BACKLIGHT', price: 25000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'meter', priceMode: 'area' },
  { id: 'svc_rollup_banner', name: 'Rollup Banner', sku: 'SVC-ROLLUP', price: 65000, stock: null, category: 'service', itemType: 'service', stockType: 'service', unitType: 'meter', priceMode: 'area' }
];

const PRINTING_CATALOG_SKUS = new Set(BUSINESS_CATALOG_ITEMS.map(item => item.sku));

// ==========================================
// LOCAL STORAGE MANAGEMENT
// ==========================================

function loadAppState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      appState = JSON.parse(saved);
      if (!appState.employees) appState.employees = {};
      if (!appState.settings) appState.settings = {};
      if (!appState.currentRole) {
        appState.currentRole = getDefaultRoleForEmployee(appState.currentEmployee);
      }
      appState.settings = {
        businessName: 'MO SaaS',
        bossPhone: '+255692854445',
        closingTime: '22:00',
        backupTime: '00:00',
        lastBackupDate: null,
        lowStockThreshold: 10,
        language: 'sw',
        theme: 'dark',
        ...appState.settings
      };
      if (!Array.isArray(appState.comments)) appState.comments = [];
      if (!Array.isArray(appState.dailyReports)) appState.dailyReports = [];
      if (!Array.isArray(appState.expenses)) appState.expenses = [];
      if (!Array.isArray(appState.customers)) appState.customers = [];
      if (!Array.isArray(appState.customerDebts)) appState.customerDebts = [];
      if (!Array.isArray(appState.customerPayments)) appState.customerPayments = [];
      if (!Array.isArray(appState.receipts)) appState.receipts = [];
      if (!Array.isArray(appState.orders)) appState.orders = [];
      if (!appState.reminders || typeof appState.reminders !== 'object') appState.reminders = { weekly: {}, monthly: {} };
      if (!appState.reminders.weekly) appState.reminders.weekly = {};
      if (!appState.reminders.monthly) appState.reminders.monthly = {};
      if (!('lastReceiptId' in appState)) appState.lastReceiptId = null;
      ensureRegistry();
      ensureDeveloperData();
      ensureDefaultProducts();
      ensureEmployeeAccounts();
    } else {
      initializeSampleData();
    }
    // Keep all saved sales, then merge in today's legacy daily cache if it exists.
    const savedSales = Array.isArray(appState.sales) ? appState.sales : [];
    const todaySalesKey = `${STORAGE_KEY}:sales:${TODAY}`;
    const salesData = localStorage.getItem(todaySalesKey);
    const todaysCachedSales = salesData ? JSON.parse(salesData) : [];
    const salesById = new Map();
    [...savedSales, ...todaysCachedSales].forEach(sale => {
      salesById.set(sale.id, sale);
    });
    appState.sales = [...salesById.values()];
    if (!Array.isArray(appState.orders)) appState.orders = [];
    if (!Array.isArray(appState.expenses)) appState.expenses = [];
    if (!Array.isArray(appState.customers)) appState.customers = [];
    if (!Array.isArray(appState.customerDebts)) appState.customerDebts = [];
    if (!Array.isArray(appState.customerPayments)) appState.customerPayments = [];
    appState.currentEmployee = null;
    appState.currentRole = 'guest';
    appState.clockInTime = null;
    if (!appState.reminders || typeof appState.reminders !== 'object') appState.reminders = { weekly: {}, monthly: {} };
    if (!appState.reminders.weekly) appState.reminders.weekly = {};
    if (!appState.reminders.monthly) appState.reminders.monthly = {};
    ensureRegistry();
    ensureDeveloperData();
    // Load license data
    loadLicenseData();
  } catch (error) {
    console.error('Failed to load state:', error);
    initializeSampleData();
  }
}

function saveAppState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    const todaySalesKey = `${STORAGE_KEY}:sales:${TODAY}`;
    localStorage.setItem(todaySalesKey, JSON.stringify(appState.sales.filter(sale => sale.date === TODAY)));
    cacheCurrentStateOffline();
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

// =========================================
// OFFLINE STORAGE & SYNC
// =========================================

let offlineDbPromise = null;
let offlineSyncInProgress = false;
let offlineConflictCount = 0;
let dashboardChartPeriod = 'daily';
let buttonReliabilityReady = false;

function getOfflineClientId() {
  let clientId = localStorage.getItem(OFFLINE_CLIENT_ID_KEY);
  if (!clientId) {
    clientId = `client_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(OFFLINE_CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

function openOfflineDb() {
  if (offlineDbPromise) return offlineDbPromise;
  offlineDbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sales')) db.createObjectStore('sales', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('orders')) db.createObjectStore('orders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('receipts')) db.createObjectStore('receipts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('dailyReports')) db.createObjectStore('dailyReports', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('customers')) db.createObjectStore('customers', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('customerDebts')) db.createObjectStore('customerDebts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('customerPayments')) db.createObjectStore('customerPayments', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('license')) db.createObjectStore('license', { keyPath: 'company_id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return offlineDbPromise;
}

async function idbPut(storeName, value) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(storeName, key) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function idbClear(storeName) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve();
      return;
    }
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll(storeName) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(storeName, key) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function getSyncCompanyId() {
  return licenseData.company_id || getCurrentAdminBusiness()?.id || 'local-company';
}

function getSupabaseClient() {
  return window.moSupabase || null;
}

function isSupabaseCloudSyncEnabled() {
  return Boolean(getSupabaseClient());
}

function buildSupabaseRecord(entity, payload = {}) {
  const companyId = getSyncCompanyId();
  const base = {
    id: payload.id,
    company_id: companyId,
    data: payload,
    updated_at: payload.updatedAt || payload.serverUpdatedAt || new Date().toISOString()
  };

  if (entity === 'product') {
    return {
      ...base,
      owner_admin: payload.ownerAdmin || null,
      name: payload.name || 'Untitled',
      sku: payload.sku || null,
      category: payload.category || 'General',
      price: Number(payload.price || 0),
      cost_price: Number(payload.costPrice || 0),
      stock: payload.stock === null || payload.stock === undefined ? null : Number(payload.stock || 0),
      item_type: payload.itemType || 'product',
      stock_type: payload.stockType || payload.itemType || 'product',
      unit_type: payload.unitType || 'piece',
      price_mode: payload.priceMode || 'quantity'
    };
  }

  if (entity === 'sale') {
    return {
      ...base,
      transaction_id: payload.transactionId || null,
      order_id: payload.orderId || null,
      product_id: payload.productId || null,
      product_name: payload.productName || 'Sale item',
      quantity: Number(payload.quantity || 1),
      price: Number(payload.price || 0),
      cost_price: Number(payload.costPrice || 0),
      cost_total: Number(payload.costTotal || 0),
      total: Number(payload.total || 0),
      profit: Number(payload.profit || 0),
      employee: payload.employee || null,
      customer_id: payload.customerId || null,
      customer_name: payload.customerName || null,
      customer_phone: payload.customerPhone || null,
      payment_status: payload.paymentStatus || 'paid',
      item_type: payload.itemType || 'product',
      unit_type: payload.unitType || 'piece',
      measurement: payload.measurement || null,
      comment: payload.comment || null,
      sale_date: payload.date || String(payload.timestamp || '').slice(0, 10) || TODAY,
      timestamp: payload.timestamp || new Date().toISOString()
    };
  }

  if (entity === 'order') {
    return {
      ...base,
      customer_id: payload.customerId || null,
      customer_name: payload.customerName || null,
      customer_phone: payload.customerPhone || null,
      employee: payload.employee || null,
      owner_admin: payload.ownerAdmin || null,
      status: payload.status || 'pending',
      payment_status: payload.paymentStatus || 'unpaid',
      total: Number(payload.total || 0),
      comment: payload.comment || null,
      items: payload.items || [],
      order_date: payload.date || String(payload.timestamp || '').slice(0, 10) || TODAY,
      timestamp: payload.timestamp || new Date().toISOString()
    };
  }

  if (entity === 'customer') {
    return {
      ...base,
      owner_admin: payload.ownerAdmin || null,
      created_by: payload.createdBy || null,
      name: payload.name || 'Walk-in Customer',
      phone: payload.phone || null,
      email: payload.email || null,
      notes: payload.notes || null
    };
  }

  if (entity === 'customerDebt') {
    return {
      ...base,
      customer_id: payload.customerId || null,
      customer_name: payload.customerName || null,
      customer_phone: payload.customerPhone || null,
      transaction_id: payload.transactionId || null,
      sale_ids: payload.saleIds || [],
      amount: Number(payload.amount || 0),
      original_amount: Number(payload.originalAmount || payload.amount || 0),
      paid_at_sale: Number(payload.paidAtSale || 0),
      total: Number(payload.total || 0),
      status: payload.status || 'credit',
      employee: payload.employee || null,
      owner_admin: payload.ownerAdmin || null,
      debt_date: payload.date || TODAY,
      timestamp: payload.timestamp || new Date().toISOString(),
      cleared_at: payload.clearedAt || null
    };
  }

  if (entity === 'customerPayment') {
    return {
      ...base,
      customer_id: payload.customerId || null,
      customer_name: payload.customerName || null,
      amount: Number(payload.amount || 0),
      employee: payload.employee || null,
      owner_admin: payload.ownerAdmin || null,
      payment_date: payload.date || TODAY,
      timestamp: payload.timestamp || new Date().toISOString(),
      cleared_at: payload.clearedAt || null
    };
  }

  if (entity === 'expense') {
    return {
      ...base,
      employee: payload.employee || null,
      owner_admin: payload.ownerAdmin || null,
      name: payload.name || 'Expense',
      amount: Number(payload.amount || 0),
      expense_date: payload.date || TODAY,
      timestamp: payload.timestamp || new Date().toISOString()
    };
  }

  if (entity === 'receipt') {
    return {
      ...base,
      transaction_id: payload.transactionId || null,
      customer_id: payload.customerId || null,
      customer_name: payload.customerName || null,
      customer_phone: payload.customerPhone || null,
      employee: payload.employee || null,
      payment_status: payload.paymentStatus || 'paid',
      paid_amount: Number(payload.paidAmount || 0),
      debt_amount: Number(payload.debtAmount || 0),
      total: Number(payload.total || 0),
      items: payload.items || [],
      receipt_date: payload.date || String(payload.timestamp || '').slice(0, 10) || TODAY,
      timestamp: payload.timestamp || new Date().toISOString()
    };
  }

  if (entity === 'dailyReport') {
    return {
      ...base,
      employee: payload.employee || null,
      report_date: payload.date || TODAY,
      source: payload.source || 'manual',
      label: payload.label || null,
      auto_generated: Boolean(payload.autoGenerated),
      submitted_at: payload.submittedAt || null,
      summary: payload.summary || {},
      sales: payload.sales || [],
      expenses: payload.expenses || []
    };
  }

  return base;
}

async function ensureSupabaseCompany() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const business = getCurrentAdminBusiness?.() || {};
  const company = {
    id: getSyncCompanyId(),
    business_name: appState.settings?.businessName || business.businessName || 'MO SaaS',
    admin_name: business.adminName || appState.currentEmployee || null,
    email: business.email || null,
    plan: licenseData?.plan || business.plan || 'starter',
    status: licenseData?.status || business.status || 'active',
    settings: appState.settings || {},
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('companies').upsert(company, { onConflict: 'id' });
  if (error) throw error;
}

async function syncSupabaseOutbox(changes = []) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    updateSyncStatusDisplay('Supabase login needed');
    return true;
  }

  await ensureSupabaseCompany();

  for (const change of changes) {
    const table = SUPABASE_ENTITY_TABLES[change.entity];
    if (!table || !change.payload?.id) continue;
    const record = buildSupabaseRecord(change.entity, change.payload);
    if (change.operation === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', change.payload.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).upsert(record, { onConflict: 'id' });
      if (error) throw error;
    }
    await idbDelete('outbox', change.id);
  }

  localStorage.setItem(OFFLINE_SYNC_META_KEY, new Date().toISOString());
  await pullSupabaseChanges();
  updateSyncStatusDisplay('Supabase synced');
  return true;
}

async function pullSupabaseChanges() {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return true;

  const since = localStorage.getItem(OFFLINE_SYNC_META_KEY) || '1970-01-01T00:00:00.000Z';
  const companyId = getSyncCompanyId();
  const pulls = await Promise.all([
    supabase.from('products').select('*').eq('company_id', companyId).gte('updated_at', since),
    supabase.from('sales').select('*').eq('company_id', companyId).gte('created_at', since),
    supabase.from('orders').select('*').eq('company_id', companyId).gte('updated_at', since),
    supabase.from('receipts').select('*').eq('company_id', companyId),
    supabase.from('daily_reports').select('*').eq('company_id', companyId).gte('created_at', since),
    supabase.from('customers').select('*').eq('company_id', companyId).gte('updated_at', since),
    supabase.from('customer_debts').select('*').eq('company_id', companyId),
    supabase.from('customer_payments').select('*').eq('company_id', companyId),
    supabase.from('expenses').select('*').eq('company_id', companyId)
  ]);

  const firstError = pulls.find(result => result.error)?.error;
  if (firstError) throw firstError;

  mergeServerProducts((pulls[0].data || []).map(row => row.data || row));
  mergeServerSales((pulls[1].data || []).map(row => row.data || row));
  mergeServerCollection('orders', (pulls[2].data || []).map(row => row.data || row), renderOrdersBoard);
  mergeServerCollection('receipts', (pulls[3].data || []).map(row => row.data || row), () => {});
  mergeServerCollection('dailyReports', (pulls[4].data || []).map(row => row.data || row), renderDailyReportStatus);
  mergeServerCollection('customers', (pulls[5].data || []).map(row => row.data || row), renderCustomersView);
  mergeServerCollection('customerDebts', (pulls[6].data || []).map(row => row.data || row), renderCustomersView);
  mergeServerCollection('customerPayments', (pulls[7].data || []).map(row => row.data || row), renderCustomersView);
  mergeServerCollection('expenses', (pulls[8].data || []).map(row => row.data || row), renderDailyReport);
  localStorage.setItem(OFFLINE_SYNC_META_KEY, new Date().toISOString());
  saveAppState();
  return true;
}

async function cacheCurrentStateOffline() {
  try {
    await Promise.all([
      ...appState.products.map(product => idbPut('products', product)),
      ...appState.sales.map(sale => idbPut('sales', sale)),
      ...(appState.orders || []).map(order => idbPut('orders', order)),
      ...(appState.receipts || []).map(receipt => idbPut('receipts', receipt)),
      ...(appState.dailyReports || []).map(report => idbPut('dailyReports', report)),
      cacheLicenseOffline()
    ]);
  } catch (error) {
    console.warn('Offline cache skipped:', error.message);
  }
}

async function cacheLicenseOffline() {
  try {
    const graceUntil = new Date(Date.now() + OFFLINE_LICENSE_GRACE_DAYS * 86400000).toISOString();
    const cachedLicense = {
      ...licenseData,
      company_id: licenseData.company_id || getSyncCompanyId(),
      cached_at: new Date().toISOString(),
      offline_grace_until: graceUntil
    };
    localStorage.setItem(`${LICENSE_STORAGE_KEY}:offline_grace`, JSON.stringify(cachedLicense));
    await idbPut('license', cachedLicense);
  } catch (error) {
    console.warn('License cache skipped:', error.message);
  }
}

function getCachedLicenseGrace() {
  try {
    const cached = JSON.parse(localStorage.getItem(`${LICENSE_STORAGE_KEY}:offline_grace`) || 'null');
    if (!cached) return null;
    if (new Date(cached.offline_grace_until) < new Date()) return null;
    return cached;
  } catch (error) {
    return null;
  }
}

async function syncLicenseCacheToLocalStorage() {
  try {
    const cached = await idbGet('license', licenseData.company_id || getSyncCompanyId());
    if (cached) localStorage.setItem(`${LICENSE_STORAGE_KEY}:offline_grace`, JSON.stringify(cached));
  } catch (error) {
    // Non-blocking.
  }
}

async function hydrateOfflineCache() {
  try {
    const [cachedProducts, cachedSales, cachedOrders, cachedReceipts, cachedDailyReports] = await Promise.all([
      idbGetAll('products'),
      idbGetAll('sales'),
      idbGetAll('orders'),
      idbGetAll('receipts'),
      idbGetAll('dailyReports')
    ]);
    let changed = false;
    if (cachedProducts.length > appState.products.length) {
      const productsById = new Map(appState.products.map(product => [product.id, product]));
      cachedProducts.forEach(product => productsById.set(product.id, { ...productsById.get(product.id), ...product }));
      appState.products = [...productsById.values()];
      ensureDefaultProducts();
      changed = true;
    }
    if (cachedSales.length > appState.sales.length) {
      const salesById = new Map(appState.sales.map(sale => [sale.id, sale]));
      cachedSales.forEach(sale => salesById.set(sale.id, { ...salesById.get(sale.id), ...sale }));
      appState.sales = [...salesById.values()];
      changed = true;
    }
    if (cachedOrders.length > (appState.orders || []).length) {
      const ordersById = new Map((appState.orders || []).map(order => [order.id, order]));
      cachedOrders.forEach(order => ordersById.set(order.id, { ...ordersById.get(order.id), ...order }));
      appState.orders = [...ordersById.values()];
      changed = true;
    }
    if (cachedReceipts.length > (appState.receipts || []).length) {
      const receiptsById = new Map((appState.receipts || []).map(receipt => [receipt.id, receipt]));
      cachedReceipts.forEach(receipt => receiptsById.set(receipt.id, { ...receiptsById.get(receipt.id), ...receipt }));
      appState.receipts = [...receiptsById.values()];
      changed = true;
    }
    if (cachedDailyReports.length > (appState.dailyReports || []).length) {
      const reportsById = new Map((appState.dailyReports || []).map(report => [report.id, report]));
      cachedDailyReports.forEach(report => reportsById.set(report.id, { ...reportsById.get(report.id), ...report }));
      appState.dailyReports = [...reportsById.values()];
      changed = true;
    }
    await syncLicenseCacheToLocalStorage();
    if (changed) {
      saveAppState();
      renderProductsGrid();
      renderInventoryTable();
      updateDashboard();
      renderHistoryTable();
    }
  } catch (error) {
    console.warn('Offline hydrate skipped:', error.message);
  }
}

async function getOfflinePendingCount() {
  try {
    return (await idbGetAll('outbox')).length;
  } catch (error) {
    return 0;
  }
}

async function updateSyncStatusDisplay(status = '') {
  const pending = await getOfflinePendingCount();
  const online = navigator.onLine;
  const lastSync = localStorage.getItem(OFFLINE_SYNC_META_KEY) || '-';
  const label = status || (offlineSyncInProgress ? 'Syncing...' : (online ? 'Online' : 'Offline'));
  const text = `${label} | Pending: ${pending}${offlineConflictCount ? ` | Conflicts: ${offlineConflictCount}` : ''}`;

  const syncEl = $('syncStatusDisplay');
  const syncText = $('syncStatusText');
  if (syncEl) {
    syncEl.classList.toggle('sync-offline', !online);
    syncEl.classList.toggle('sync-pending', pending > 0);
  }
  if (syncText) syncText.textContent = text;
  if ($('devSyncConnection')) $('devSyncConnection').textContent = online ? 'Online' : 'Offline';
  if ($('devSyncPending')) $('devSyncPending').textContent = pending;
  if ($('devSyncLast')) $('devSyncLast').textContent = lastSync === '-' ? '-' : formatDateTime(lastSync);
}

async function queueOfflineChange(entity, operation, payload, baseUpdatedAt = null) {
  const change = {
    id: `chg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    entity,
    operation,
    payload,
    base_updated_at: baseUpdatedAt,
    client_updated_at: new Date().toISOString()
  };
  await idbPut('outbox', change);
  if (entity === 'product') await idbPut('products', payload);
  if (entity === 'sale') await idbPut('sales', payload);
  if (entity === 'order') await idbPut('orders', payload);
  if (entity === 'receipt') await idbPut('receipts', payload);
  if (entity === 'dailyReport') await idbPut('dailyReports', payload);
  if (entity === 'customer') await idbPut('customers', payload);
  if (entity === 'customerDebt') await idbPut('customerDebts', payload);
  if (entity === 'customerPayment') await idbPut('customerPayments', payload);
  scheduleOfflineSync();
  updateSyncStatusDisplay('Queued');
}

function queueOfflineChangeSafe(entity, operation, payload, baseUpdatedAt = null) {
  queueOfflineChange(entity, operation, payload, baseUpdatedAt)
    .catch(error => console.warn('Failed to queue offline change:', error.message));
}

async function queueFullCloudSync() {
  const batches = [
    ...(appState.products || []).map(product => ['product', product]),
    ...(appState.sales || []).map(sale => ['sale', sale]),
    ...(appState.orders || []).map(order => ['order', order]),
    ...(appState.receipts || []).map(receipt => ['receipt', receipt]),
    ...(appState.dailyReports || []).map(report => ['dailyReport', report]),
    ...(appState.customers || []).map(customer => ['customer', customer]),
    ...(appState.customerDebts || []).map(debt => ['customerDebt', debt]),
    ...(appState.customerPayments || []).map(payment => ['customerPayment', payment])
  ];

  for (const [entity, payload] of batches) {
    await queueOfflineChange(entity, entity === 'sale' ? 'insert' : 'upsert', payload, payload.serverUpdatedAt || payload.updatedAt || null);
  }
  showNotification(`Cloud sync imeandaliwa: ${batches.length} records`);
  await syncOfflineOutbox();
}

function scheduleOfflineSync() {
  if (!navigator.onLine) return;
  window.setTimeout(() => syncOfflineOutbox(), 250);
}

async function syncOfflineOutbox() {
  if (offlineSyncInProgress || !navigator.onLine) return;
  offlineSyncInProgress = true;
  updateSyncStatusDisplay('Syncing...');
  try {
    const changes = await idbGetAll('outbox');
    if (isSupabaseCloudSyncEnabled()) {
      const handledBySupabase = await syncSupabaseOutbox(changes);
      if (handledBySupabase) return;
    }
    if (changes.length === 0) {
      await pullServerChanges();
      updateSyncStatusDisplay('Synced');
      return;
    }
    const authToken = await getBackendAuthToken();
    if (!authToken) {
      updateSyncStatusDisplay('Login needed for sync');
      return;
    }

    const response = await fetch(`${PAYMENT_API_BASE_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        company_id: getSyncCompanyId(),
        client_id: getOfflineClientId(),
        changes
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || 'Sync failed');

    const appliedIds = new Set((result.data?.applied || []).map(item => item.id));
    await Promise.all(changes.filter(change => appliedIds.has(change.id)).map(change => idbDelete('outbox', change.id)));
    await handleSyncConflicts(result.data?.conflicts || []);
    localStorage.setItem(OFFLINE_SYNC_META_KEY, result.data?.server_time || new Date().toISOString());
    await pullServerChanges();
    if (appliedIds.size > 0) showNotification('Offline data synced');
    updateSyncStatusDisplay('Synced');
  } catch (error) {
    console.warn('Offline sync pending:', error.message);
    updateSyncStatusDisplay('Sync pending');
  } finally {
    offlineSyncInProgress = false;
    updateSyncStatusDisplay();
  }
}

async function pullServerChanges() {
  try {
    if (isSupabaseCloudSyncEnabled()) {
      const handledBySupabase = await pullSupabaseChanges();
      if (handledBySupabase) return;
    }
    const since = localStorage.getItem(OFFLINE_SYNC_META_KEY) || '1970-01-01T00:00:00.000Z';
    const url = `${PAYMENT_API_BASE_URL}/sync/bootstrap?company_id=${encodeURIComponent(getSyncCompanyId())}&since=${encodeURIComponent(since)}`;
    const authToken = await getBackendAuthToken();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) return;

    mergeServerProducts(result.data?.products || []);
    mergeServerSales(result.data?.sales || []);
    mergeServerCollection('orders', result.data?.orders || [], renderOrdersBoard);
    mergeServerCollection('receipts', result.data?.receipts || [], () => {});
    mergeServerCollection('dailyReports', result.data?.dailyReports || [], renderDailyReportStatus);
    mergeServerCollection('customers', result.data?.customers || [], renderCustomersView);
    mergeServerCollection('customerDebts', result.data?.customerDebts || [], renderCustomersView);
    mergeServerCollection('customerPayments', result.data?.customerPayments || [], renderCustomersView);
    if (result.data?.license) {
      licenseData = { ...licenseData, ...result.data.license };
      saveLicenseData();
      await cacheLicenseOffline();
    }
    localStorage.setItem(OFFLINE_SYNC_META_KEY, result.data?.server_time || new Date().toISOString());
    saveAppState();
  } catch (error) {
    console.warn('Pull sync skipped:', error.message);
  }
}

function mergeServerProducts(products) {
  if (!Array.isArray(products) || products.length === 0) return;
  const byId = new Map(appState.products.map(product => [product.id, product]));
  products.forEach(product => {
    const local = byId.get(product.id);
    if (!local || new Date(product.serverUpdatedAt || 0) >= new Date(local.serverUpdatedAt || local.updatedAt || 0)) {
      byId.set(product.id, product);
      idbPut('products', product);
    }
  });
  appState.products = [...byId.values()];
  renderProductsGrid();
  renderCalculatorOptions();
  updateCalculatorPreview();
  renderInventoryTable();
}

function mergeServerSales(sales) {
  if (!Array.isArray(sales) || sales.length === 0) return;
  const byId = new Map(appState.sales.map(sale => [sale.id, sale]));
  sales.forEach(sale => {
    if (!byId.has(sale.id)) {
      byId.set(sale.id, sale);
      idbPut('sales', sale);
    }
  });
  appState.sales = [...byId.values()];
  updateDashboard();
  renderHistoryTable();
}

function mergeServerCollection(stateKey, records, afterMerge = null) {
  if (!Array.isArray(records) || records.length === 0) return;
  if (!Array.isArray(appState[stateKey])) appState[stateKey] = [];
  const byId = new Map(appState[stateKey].map(record => [record.id, record]));
  records.forEach(record => {
    const local = byId.get(record.id);
    if (!local || new Date(record.serverUpdatedAt || 0) >= new Date(local.serverUpdatedAt || local.updatedAt || local.timestamp || 0)) {
      byId.set(record.id, record);
      idbPut(stateKey, record);
    }
  });
  appState[stateKey] = [...byId.values()];
  if (typeof afterMerge === 'function') afterMerge();
}

async function handleSyncConflicts(conflicts) {
  if (!Array.isArray(conflicts) || conflicts.length === 0) return;
  offlineConflictCount += conflicts.length;
  conflicts.forEach(conflict => {
    if (conflict.entity === 'product' && conflict.server_record) {
      const index = appState.products.findIndex(product => product.id === conflict.entity_id);
      if (index >= 0) appState.products[index] = conflict.server_record;
      else appState.products.push(conflict.server_record);
      idbPut('products', conflict.server_record);
    } else if (['order', 'receipt', 'dailyReport'].includes(conflict.entity) && conflict.server_record) {
      const stateKey = conflict.entity === 'order'
        ? 'orders'
        : conflict.entity === 'receipt'
          ? 'receipts'
          : 'dailyReports';
      if (!Array.isArray(appState[stateKey])) appState[stateKey] = [];
      const index = appState[stateKey].findIndex(record => record.id === conflict.entity_id);
      if (index >= 0) appState[stateKey][index] = conflict.server_record;
      else appState[stateKey].push(conflict.server_record);
      idbPut(stateKey, conflict.server_record);
    }
  });
  saveAppState();
  showNotification(`${conflicts.length} sync conflict(s) resolved with server data`);
  updateSyncStatusDisplay('Conflict resolved');
}

function initOfflineSync() {
  hydrateOfflineCache();
  cacheCurrentStateOffline();
  window.addEventListener('online', () => {
    showNotification('Internet imerudi. Sync inaanza...');
    syncOfflineOutbox();
  });
  window.addEventListener('offline', () => {
    updateSyncStatusDisplay('Offline');
    showNotification('Uko offline. Mauzo yatahifadhiwa na kusync baadaye.');
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  scheduleOfflineSync();
  updateSyncStatusDisplay();
  setInterval(syncOfflineOutbox, 60000);
}

function isRunningAsInstalledApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function updateInstallAppButton() {
  const button = $('installAppBtn');
  if (!button) return;
  const canShowInstallHelp = /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const shouldShow = !isRunningAsInstalledApp()
    && !pwaInstallDismissed
    && (Boolean(deferredPwaInstallPrompt) || canShowInstallHelp);
  button.classList.toggle('hidden', !shouldShow);
  button.textContent = t('installApp');
}

async function installAppToDevice() {
  if (isRunningAsInstalledApp()) {
    showNotification(t('appInstalled'));
    updateInstallAppButton();
    return;
  }

  if (!deferredPwaInstallPrompt) {
    alert(t('installUnavailable'));
    return;
  }

  deferredPwaInstallPrompt.prompt();
  const choice = await deferredPwaInstallPrompt.userChoice.catch(() => null);
  pwaInstallDismissed = choice?.outcome === 'dismissed';
  deferredPwaInstallPrompt = null;
  updateInstallAppButton();
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPwaInstallPrompt = event;
  pwaInstallDismissed = false;
  updateInstallAppButton();
});

window.addEventListener('appinstalled', () => {
  deferredPwaInstallPrompt = null;
  pwaInstallDismissed = true;
  showNotification(t('appInstalled'));
  updateInstallAppButton();
});

// =========================================
// LICENSE MANAGEMENT FUNCTIONS
// =========================================

function loadLicenseData() {
  try {
    const saved = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (saved) {
      licenseData = JSON.parse(saved);
      licenseData.creator_id = licenseData.creator_id || null;
      licenseData.plan = normalizePlanKey(licenseData.plan);
      updateLicenseStatus();
    } else {
      saveLicenseData();
    }
  } catch (error) {
    console.error('Failed to load license data:', error);
    saveLicenseData();
  }
}

function saveLicenseData() {
  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(licenseData));
  } catch (error) {
    console.error('Failed to save license data:', error);
  }
}

function normalizeLicenseStatus(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'SUSPEND' || value === 'SUSPENDED') return LICENSE_STATUS.SUSPEND;
  if (value === 'EXPIRE' || value === 'EXPIRED') return LICENSE_STATUS.EXPIRE;
  return LICENSE_STATUS.ACTIVE;
}

function updateLicenseStatus() {
  const today = new Date().toISOString().split('T')[0];
  licenseData.status = normalizeLicenseStatus(licenseData.status);
  if (licenseData.status === LICENSE_STATUS.SUSPEND) {
    saveLicenseData();
    return;
  }
  if (today > licenseData.expiry_date || licenseData.status === LICENSE_STATUS.EXPIRE) {
    licenseData.status = LICENSE_STATUS.EXPIRE;
  } else {
    licenseData.status = LICENSE_STATUS.ACTIVE;
  }
  saveLicenseData();
}

function isLicenseActive() {
  updateLicenseStatus();
  return licenseData.status === LICENSE_STATUS.ACTIVE;
}

function isLicenseExpired() {
  updateLicenseStatus();
  return licenseData.status === LICENSE_STATUS.EXPIRE;
}

function getLicenseExpiryDate() {
  return new Date(licenseData.expiry_date);
}

function getDaysRemaining() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(licenseData.expiry_date);
  expiry.setHours(0, 0, 0, 0);
  const diff = expiry.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function renewLicense(months = 1) {
  try {
    // Check if user is the creator (only creator can renew license)
    if (!appState.currentEmployee || appState.currentEmployee !== licenseData.creator_id) {
      console.warn('License renewal denied: Only the creator can renew the license');
      return false;
    }
    
    const expiry = new Date(licenseData.expiry_date);
    expiry.setMonth(expiry.getMonth() + months);
    licenseData.expiry_date = expiry.toISOString().split('T')[0];
    licenseData.last_renewal = new Date().toISOString().split('T')[0];
    licenseData.status = LICENSE_STATUS.ACTIVE;
    saveLicenseData();
    updateLicenseStatus();
    return true;
  } catch (error) {
    console.error('Failed to renew license:', error);
    return false;
  }
}

function upgradePlan(newPlan) {
  const normalized = normalizePlanKey(newPlan);
  if ([LICENSE_PLANS.FREE, LICENSE_PLANS.PRO, LICENSE_PLANS.PRO_PLUS].includes(normalized)) {
    licenseData.plan = normalized;
    saveLicenseData();
    return true;
  }
  return false;
}

function validateLicenseForLogin(employeeName = '') {
  updateLicenseStatus();
  if (getDefaultRoleForEmployee(employeeName) === 'super_admin') {
    return { valid: true };
  }
  if (licenseData.status === LICENSE_STATUS.SUSPEND) {
    return {
      valid: false,
      message: 'Leseni imesitishwa na Boss Admin.'
    };
  }
  if (isLicenseExpired()) {
    const grace = !navigator.onLine ? getCachedLicenseGrace() : null;
    if (grace && normalizeLicenseStatus(grace.status) === LICENSE_STATUS.ACTIVE) {
      return { valid: true, offlineGrace: true };
    }
    return {
      valid: false,
      message: t('systemLocked')
    };
  }
  return { valid: true };
}

function displayLicenseStatus() {
  const statusEl = $('licenseStatusDisplay');
  if (!statusEl) return;

  updateLicenseStatus();
  const daysLeft = getDaysRemaining();
  const status = normalizeLicenseStatus(licenseData.status);
  const statusText = status;
  const statusClass = status === LICENSE_STATUS.ACTIVE
    ? 'license-active'
    : (status === LICENSE_STATUS.SUSPEND ? 'license-suspend' : 'license-expired');
  const statusValue = status === LICENSE_STATUS.ACTIVE
    ? `${daysLeft} ${t('daysRemaining')}`
    : (status === LICENSE_STATUS.SUSPEND ? 'Boss Admin' : `${Math.max(0, daysLeft)} ${t('daysRemaining')}`);
  
  statusEl.className = `license-status-badge ${statusClass}`;
  statusEl.innerHTML = `
    <span class="status-label">${statusText}</span>
    <span class="status-value">${statusValue}</span>
  `;
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function getBackupFilename(date = getTodayString()) {
  const safeBusinessName = (appState.settings.businessName || 'mfumo_pos')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'mfumo_pos';
  return `${safeBusinessName}_backup_${date}.json`;
}

function createBackupPayload() {
  return {
    app: 'MO SaaS',
    version: 2,
    exportDate: new Date().toISOString(),
    appState
  };
}

function normalizeRestoredState(data) {
  const restoredState = data?.appState || data;
  if (!restoredState || typeof restoredState !== 'object') {
    throw new Error('Invalid backup file');
  }

  appState = {
    products: Array.isArray(restoredState.products) ? restoredState.products : [],
    sales: Array.isArray(restoredState.sales) ? restoredState.sales : [],
    employees: restoredState.employees || {},
    settings: {
      businessName: 'MO SaaS',
      bossPhone: '+255692854445',
      closingTime: '22:00',
      backupTime: '00:00',
      lastBackupDate: null,
      lowStockThreshold: 10,
      language: 'sw',
      theme: 'dark',
      ...(restoredState.settings || {})
    },
    currentEmployee: null,
    currentRole: 'guest',
    clockInTime: null,
    comments: Array.isArray(restoredState.comments) ? restoredState.comments : [],
    dailyReports: Array.isArray(restoredState.dailyReports) ? restoredState.dailyReports : [],
    expenses: Array.isArray(restoredState.expenses) ? restoredState.expenses : [],
    customers: Array.isArray(restoredState.customers) ? restoredState.customers : [],
    customerDebts: Array.isArray(restoredState.customerDebts) ? restoredState.customerDebts : [],
    customerPayments: Array.isArray(restoredState.customerPayments) ? restoredState.customerPayments : [],
    receipts: Array.isArray(restoredState.receipts) ? restoredState.receipts : [],
    orders: Array.isArray(restoredState.orders) ? restoredState.orders : [],
    reminders: restoredState.reminders || { weekly: {}, monthly: {} },
    lastReceiptId: restoredState.lastReceiptId || null
  };

  ensureDefaultProducts();
  ensureEmployeeAccounts();
}

function refreshAllViews() {
  updateSettingsControls();
  applyLanguage();
  applyTheme();
  renderProductsGrid();
  renderCalculatorOptions();
  updateCalculatorPreview();
  renderInventoryTable();
  renderOrdersBoard();
  renderCart();
  updateDashboard();
  renderDailyReport();
  renderWeeklyReport();
  renderMonthlyReport();
  renderDailySummary();
  renderEmployeePerformanceReport();
  renderHistoryTable();
  renderStaffSalesPanel();
  renderCustomersView();
  renderAdminStaffPanel();
  renderEmployeeComments();
  renderDailyReportStatus();
  applyRoleAccess();
}

function ensureDefaultProducts() {
  if (!Array.isArray(appState.products)) {
    appState.products = [];
  }
  const beforeCount = appState.products.length;
  appState.products.forEach(product => {
    product.itemType = product.itemType || (product.category === 'service' ? 'service' : 'product');
    product.stockType = product.stockType || (product.itemType === 'service' ? 'service' : 'product');
    product.unitType = product.unitType || 'piece';
    product.priceMode = product.priceMode || 'quantity';
    if (product.itemType === 'service' || product.category === 'service') {
      product.stock = null;
      product.category = 'service';
    }
    if (typeof product.costPrice !== 'number') {
      product.costPrice = Number((product.price * 0.7).toFixed(2));
    }
  });

  const existingSkus = new Set(appState.products.map(product => product.sku));
  const missingProducts = DEFAULT_PRODUCTS
    .filter(product => !existingSkus.has(product.sku))
    .map(product => ({
      ...product,
      costPrice: typeof product.costPrice === 'number' ? product.costPrice : Number((product.price * 0.7).toFixed(2)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

  if (missingProducts.length > 0) {
    appState.products = [...appState.products, ...missingProducts];
    saveAppState();
  }
  if (beforeCount !== appState.products.length) saveAppState();
  ensureBusinessCatalogItems();
}

function getDashboardProductName() {
  return $('dashboardProductName')?.value?.trim() || '';
}

function updateDashboardProductNameUsage() {
  const productName = getDashboardProductName();
  const statusSales = $('statusSales');
  if (statusSales) {
    statusSales.textContent = productName ? `${productName} sales summary` : `${getTodaySalesCount()} items`;
  }
}

function ensureBusinessCatalogItems() {
  if (!Array.isArray(appState.products)) appState.products = [];
  const bySku = new Map(appState.products.map(product => [product.sku, product]));
  let changed = false;

  BUSINESS_CATALOG_ITEMS.forEach(item => {
    const existing = bySku.get(item.sku);
    if (existing) {
      ['name', 'price', 'category', 'itemType', 'stockType', 'unitType', 'priceMode'].forEach(key => {
        if (existing[key] !== item[key]) {
          existing[key] = item[key];
          changed = true;
        }
      });
      if (item.stock === null && existing.stock !== null) {
        existing.stock = null;
        changed = true;
      }
      if (typeof existing.costPrice !== 'number' || item.itemType === 'service') {
        existing.costPrice = item.itemType === 'service' ? 0 : Number((item.price * 0.7).toFixed(2));
        changed = true;
      }
      return;
    }

    appState.products.push({
      ...item,
      costPrice: item.itemType === 'service' ? 0 : Number((item.price * 0.7).toFixed(2)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    changed = true;
  });

  if (changed) saveAppState();
}

function ensureEmployeeAccounts() {
  if (!appState.employees || typeof appState.employees !== 'object') {
    appState.employees = {};
  }

  const existingAdmin = appState.employees[ADMIN_ACCOUNT] || {};
  const adminUsingDefaultPassword = !existingAdmin.passwordHash
    && (!existingAdmin.password || existingAdmin.password === LEGACY_ADMIN_PASSWORD || existingAdmin.password === DEFAULT_ADMIN_PASSWORD);
  appState.employees[ADMIN_ACCOUNT] = {
    role: 'super_admin',
    ...(existingAdmin.passwordHash ? {} : {
      password: existingAdmin.password && existingAdmin.password !== LEGACY_ADMIN_PASSWORD
        ? existingAdmin.password
        : DEFAULT_ADMIN_PASSWORD
    }),
    passwordSalt: existingAdmin.passwordSalt || null,
    passwordHash: existingAdmin.passwordHash || null,
    passwordAlgorithm: existingAdmin.passwordAlgorithm || null,
    passwordIterations: existingAdmin.passwordIterations || null,
    passwordChangedAt: existingAdmin.passwordChangedAt || (adminUsingDefaultPassword ? DEFAULT_PASSWORD_ISSUED_AT : new Date().toISOString()),
    mustChangePassword: Boolean(existingAdmin.mustChangePassword || adminUsingDefaultPassword),
    lastLogin: existingAdmin.lastLogin || null,
    email: existingAdmin.email || '',
    phone: existingAdmin.phone || '',
    fullName: existingAdmin.fullName || ADMIN_ACCOUNT
  };

  syncRegistryToEmployees();

  USER_EMPLOYEES.forEach(employee => {
    const existing = appState.employees[employee] || {};
    const staffUsingDefaultPassword = !existing.passwordHash
      && (!existing.password || existing.password === DEFAULT_STAFF_PASSWORD);
    appState.employees[employee] = {
      role: existing.role === 'staff' ? 'user' : (existing.role || 'user'),
      ownerAdmin: getOwnerAdminForUser(employee),
      ...(existing.passwordHash ? {} : { password: existing.password || DEFAULT_STAFF_PASSWORD }),
      passwordSalt: existing.passwordSalt || null,
      passwordHash: existing.passwordHash || null,
      passwordAlgorithm: existing.passwordAlgorithm || null,
      passwordIterations: existing.passwordIterations || null,
      passwordChangedAt: existing.passwordChangedAt || (staffUsingDefaultPassword ? DEFAULT_PASSWORD_ISSUED_AT : new Date().toISOString()),
      mustChangePassword: Boolean(existing.mustChangePassword || staffUsingDefaultPassword),
      lastLogin: existing.lastLogin || null,
      locked: Boolean(existing.locked),
      lockedReason: existing.lockedReason || null
    };
  });
}

function initializeSampleData() {
  appState.products = DEFAULT_PRODUCTS.map(product => ({
    ...product,
    costPrice: Number((product.price * 0.7).toFixed(2))
  }));
  ensureRegistry();
  ensureEmployeeAccounts();
  ensureDeveloperData();
  ensureBusinessCatalogItems();
  appState.currentRole = 'guest';
  saveAppState();
}

function getAdminEmployees() {
  return getRegistryAdmins().map(admin => admin.loginName);
}

function getAllowedEmployees() {
  const dynamicUsers = Object.entries(appState.employees || {})
    .filter(([, account]) => account?.role === 'user')
    .map(([employeeName]) => employeeName);
  return [...new Set([ADMIN_ACCOUNT, ...getAdminEmployees(), ...USER_EMPLOYEES, ...dynamicUsers])];
}

function getDefaultRoleForEmployee(employeeName) {
  if (!employeeName) return 'guest';
  if (employeeName === ADMIN_ACCOUNT) return 'super_admin';
  const registryAdmin = findRegistryAdminByLogin(employeeName);
  if (registryAdmin) return registryAdmin.role === 'admin' ? 'admin' : 'user';
  if (getAdminEmployees().includes(employeeName)) return 'admin';
  if (USER_EMPLOYEES.includes(employeeName) || STAFF_EMPLOYEES.includes(employeeName)) return 'user';
  if (appState.employees?.[employeeName]?.role === 'user') return 'user';
  return 'guest';
}

function getOwnerAdminForUser(employeeName) {
  const dynamicOwner = appState.employees?.[employeeName]?.ownerAdmin;
  if (dynamicOwner) return dynamicOwner;
  return Object.entries(ADMIN_USER_ASSIGNMENTS)
    .find(([, users]) => users.includes(employeeName))?.[0] || null;
}

function getBusinessForEmployee(employeeName) {
  ensureDeveloperData();
  const role = getDefaultRoleForEmployee(employeeName);
  if (role === 'admin') {
    return appState.developer.users.find(user => user.adminName === employeeName) || null;
  }
  if (role === 'user') {
    const ownerAdmin = getOwnerAdminForUser(employeeName) || appState.employees?.[employeeName]?.ownerAdmin;
    return ownerAdmin ? appState.developer.users.find(user => user.adminName === ownerAdmin) || null : null;
  }
  return null;
}

function getBusinessDisplayNameForEmployee(employeeName = appState.currentEmployee) {
  if (!employeeName) return appState.settings?.businessName || 'MO SaaS';
  if (getDefaultRoleForEmployee(employeeName) === 'super_admin') {
    return appState.settings?.businessName || 'MO SaaS';
  }
  const business = getBusinessForEmployee(employeeName);
  return business?.businessName || business?.name || appState.settings?.businessName || 'MO SaaS';
}

function updateBusinessHeaderName() {
  const target = $('headerBusinessName');
  if (!target) return;
  target.textContent = getBusinessDisplayNameForEmployee();
}

function getAccountsForBusiness(business) {
  if (!business?.adminName) return [];
  return [business.adminName, ...(getAdminUserAssignments(business.adminName))];
}

function getAdminUserAssignments(adminName) {
  const staticUsers = ADMIN_USER_ASSIGNMENTS[adminName] || [];
  const registryUsers = appState.registry?.userAssignments?.[adminName] || [];
  const dynamicUsers = Object.entries(appState.employees || {})
    .filter(([, account]) => account?.role === 'user' && account?.ownerAdmin === adminName && !account.removed)
    .map(([employeeName]) => employeeName);
  return [...new Set([...staticUsers, ...registryUsers, ...dynamicUsers])];
}

function setBusinessAccountsLocked(business, locked, reason = '') {
  ensureEmployeeAccounts();
  getAccountsForBusiness(business).forEach(employeeName => {
    if (!appState.employees[employeeName]) return;
    appState.employees[employeeName].locked = locked;
    appState.employees[employeeName].lockedReason = locked ? reason : null;
  });
}

function buildAccountBlockMessage({ businessName = 'Account', ownerText = '', status = 'expired', actor = 'Boss Admin' } = {}) {
  const normalizedStatus = String(status || 'expired').toLowerCase();
  const statusText = normalizedStatus === 'expired' ? 'ime-expire' : `iko ${normalizedStatus}`;
  return `Account imefungwa: ${businessName}${ownerText} ${statusText}. Wasiliana na ${actor}.`;
}

function getAccountAccessBlock(employeeName) {
  const role = getDefaultRoleForEmployee(employeeName);
  if (role === 'super_admin') return { blocked: false };

  const account = appState.employees?.[employeeName] || null;
  const ownerAdminName = role === 'admin'
    ? employeeName
    : getOwnerAdminForUser(employeeName) || account?.ownerAdmin;
  const ownerText = role === 'user' && ownerAdminName ? ` chini ya ${ownerAdminName}` : '';
  const registryAdmin = ownerAdminName ? findRegistryAdminByLogin(ownerAdminName) : null;
  if (registryAdmin) {
    const registryBlock = getRegistryAdminBlockStatus(registryAdmin);
    if (registryBlock.blocked) {
      const message = buildAccountBlockMessage({
        businessName: registryAdmin.businessName || registryAdmin.loginName,
        ownerText,
        status: registryBlock.status,
        actor: 'Boss Admin'
      });
      return { blocked: true, status: registryBlock.status, message, registryAdmin };
    }
  }

  const business = getBusinessForEmployee(employeeName);
  if (business) {
    const status = getDeveloperUserStatus(business);
    if (status === 'active') return { blocked: false };
    const message = buildAccountBlockMessage({
      businessName: business.businessName || business.name || 'biashara',
      ownerText: role === 'user' ? ` chini ya ${business.adminName}` : '',
      status,
      actor: 'Boss Admin'
    });
    return { blocked: true, status, message, business };
  }

  if (account?.locked) {
    return {
      blocked: true,
      status: 'locked',
      message: account.lockedReason || buildAccountBlockMessage({ businessName: employeeName, status: 'locked', actor: 'Boss Admin' })
    };
  }

  return { blocked: false };
}

function validateAccountSubscriptionForLogin(employeeName) {
  const role = getDefaultRoleForEmployee(employeeName);
  if (role === 'super_admin') return { valid: true };

  const account = getEmployeeAccount(employeeName);
  const accessBlock = getAccountAccessBlock(employeeName);
  if (!accessBlock.blocked) return { valid: true };

  if (account) {
    account.locked = true;
    account.lockedReason = accessBlock.message;
    appState.employees[employeeName] = account;
    saveAppState();
  }

  return {
    valid: false,
    message: accessBlock.message
  };
}

function getRegistryAdminBlockStatus(registryAdmin, dateString = getTodayString()) {
  if (!registryAdmin) return { blocked: false, status: 'active' };
  const status = String(registryAdmin.status || 'active').toLowerCase();
  if (['pending_payment', 'inactive', 'suspended', 'expired'].includes(status)) {
    return { blocked: true, status };
  }
  if (registryAdmin.expiryDate && registryAdmin.expiryDate < dateString) {
    return { blocked: true, status: 'expired' };
  }
  return { blocked: false, status: 'active' };
}

function isEmployeeBlockedInStoredState(employeeName) {
  if (!employeeName || getDefaultRoleForEmployee(employeeName) === 'super_admin') return false;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const savedAccount = saved.employees?.[employeeName];
    if (savedAccount?.locked) return true;

    const role = getDefaultRoleForEmployee(employeeName);
    const ownerAdmin = role === 'admin'
      ? employeeName
      : getOwnerAdminForUser(employeeName) || savedAccount?.ownerAdmin;
    const savedRegistryAdmin = (saved.registry?.admins || [])
      .filter(admin => !admin.removed)
      .find(admin => String(admin.loginName || '').toLowerCase() === String(ownerAdmin || '').toLowerCase());
    if (getRegistryAdminBlockStatus(savedRegistryAdmin).blocked) return true;

    const business = saved.developer?.users?.find(user => user.adminName === ownerAdmin);
    if (!business) return false;

    const today = getTodayString();
    if (business.status === 'suspended' || business.status === 'expired') return true;
    return business.expiryDate < today;
  } catch (error) {
    return false;
  }
}

function enforceCurrentAccountAccess() {
  if (!appState.currentEmployee || appState.currentRole === 'super_admin') return;
  const accessBlock = getAccountAccessBlock(appState.currentEmployee);
  if (!accessBlock.blocked && !isEmployeeBlockedInStoredState(appState.currentEmployee)) return;

  alert(accessBlock.message || 'Account yako imefungwa na Boss Admin. Tafadhali wasiliana na Boss Admin.');
  logoutEmployee();
}

// ==========================================
// ADMIN REGISTRY & SAAS SIGNUP
// ==========================================

function addRegistryDays(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().split('T')[0];
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\s+/g, '').replace(/[^\d+]/g, '');
}

function isPaidPlan(plan) {
  const key = normalizePlanKey(plan);
  return key === LICENSE_PLANS.PRO || key === LICENSE_PLANS.PRO_PLUS;
}

function ensureRegistry() {
  if (!appState.registry || typeof appState.registry !== 'object') {
    appState.registry = { version: REGISTRY_VERSION, admins: [], userAssignments: { ...ADMIN_USER_ASSIGNMENTS } };
  }
  if (!Array.isArray(appState.registry.admins)) appState.registry.admins = [];
  if (!appState.registry.userAssignments) {
    appState.registry.userAssignments = { ...ADMIN_USER_ASSIGNMENTS };
  }
  if (appState.registry.admins.length === 0) {
    migrateLegacyAdminsToRegistry();
  }
  migrateDefaultAdminBusinessNames();
}

function migrateDefaultAdminBusinessNames() {
  if (!Array.isArray(appState.registry?.admins)) return;
  appState.registry.admins.forEach(admin => {
    const configuredName = ADMIN_BUSINESS_NAMES[admin.loginName];
    if (!configuredName) return;
    const legacyName = LEGACY_ADMIN_BUSINESS_NAMES[admin.loginName];
    if (!admin.businessName || admin.businessName === legacyName) {
      admin.businessName = configuredName;
    }
  });
}

function migrateLegacyAdminsToRegistry() {
  const expiryById = { u_001: 22, u_002: 5, u_003: -3, u_004: 40 };
  const signupById = { u_001: -18, u_002: -6, u_003: -44, u_004: -75 };
  DEFAULT_ADMIN_BUSINESSES.forEach((business) => {
    const existing = appState.employees?.[business.adminName] || {};
    const adminUsingDefaultPassword = !existing.passwordHash
      && (!existing.password || existing.password === DEFAULT_ADMIN_PASSWORD);
    appState.registry.admins.push({
      id: business.id,
      loginName: business.adminName,
      fullName: business.adminName,
      businessName: business.businessName,
      email: business.email,
      phone: existing.phone || '',
      role: 'admin',
      status: business.status === 'active' ? 'active' : business.status,
      plan: normalizePlanKey(business.plan || LICENSE_PLANS.FREE),
      expiryDate: addRegistryDays(expiryById[business.id] ?? TRIAL_SUBSCRIPTION_DAYS),
      signupDate: addRegistryDays(signupById[business.id] ?? -7),
      lastLogin: existing.lastLogin || null,
      monthlyFee: Number(business.monthlyFee || 30000),
      source: 'legacy',
      ...(existing.passwordHash ? {} : { password: existing.password || DEFAULT_ADMIN_PASSWORD }),
      passwordSalt: existing.passwordSalt || null,
      passwordHash: existing.passwordHash || null,
      passwordAlgorithm: existing.passwordAlgorithm || null,
      passwordIterations: existing.passwordIterations || null,
      passwordChangedAt: existing.passwordChangedAt || (adminUsingDefaultPassword ? DEFAULT_PASSWORD_ISSUED_AT : new Date().toISOString()),
      mustChangePassword: Boolean(existing.mustChangePassword || adminUsingDefaultPassword),
      revenue: Number(business.revenue || 0),
      transactions: Number(business.transactions || 0),
      customers: Number(business.customers || 0),
      stockValue: Number(business.stockValue || 0),
      growth: Number(business.growth || 0)
    });
  });
  saveAppState();
}

function getRegistryAdmins() {
  ensureRegistry();
  return appState.registry.admins.filter(admin => !admin.removed);
}

function findRegistryAdminById(adminId) {
  return getRegistryAdmins().find(admin => admin.id === adminId) || null;
}

function findRegistryAdminByLogin(loginName) {
  const lower = String(loginName || '').trim().toLowerCase();
  if (!lower) return null;
  return getRegistryAdmins().find(admin => admin.loginName.toLowerCase() === lower) || null;
}

function findRegistryAdminByContact(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const email = normalizeEmail(raw);
  const phone = normalizePhone(raw);
  return getRegistryAdmins().find(admin => {
    if (email && normalizeEmail(admin.email) === email) return true;
    if (phone && normalizePhone(admin.phone) === phone) return true;
    return false;
  }) || null;
}

function isRegistryContactTaken(email, phone, excludeId = null) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  return getRegistryAdmins().some(admin => {
    if (excludeId && admin.id === excludeId) return false;
    if (normalizedEmail && normalizeEmail(admin.email) === normalizedEmail) return true;
    if (normalizedPhone && normalizePhone(admin.phone) === normalizedPhone) return true;
    return false;
  });
}

function adminMatchesContact(admin, email, phone) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  if (normalizedEmail && normalizeEmail(admin.email) === normalizedEmail) return true;
  if (normalizedPhone && normalizePhone(admin.phone) === normalizedPhone) return true;
  return false;
}

function hasPaymentRecordForAdmin(adminId) {
  return Array.isArray(appState.developer?.payments)
    && appState.developer.payments.some(payment => payment.userId === adminId);
}

function cleanupAbandonedPendingSignup(email, phone) {
  ensureRegistry();
  const beforeCount = appState.registry.admins.length;
  const abandonedIds = new Set(
    getRegistryAdmins()
      .filter(admin => (
        admin.status === 'pending_payment'
        && admin.source === 'registration'
        && adminMatchesContact(admin, email, phone)
        && !hasPaymentRecordForAdmin(admin.id)
      ))
      .map(admin => admin.id)
  );

  if (abandonedIds.size === 0) return false;

  appState.registry.admins = appState.registry.admins.filter(admin => !abandonedIds.has(admin.id));
  Object.keys(appState.employees || {}).forEach(employeeName => {
    const account = appState.employees[employeeName];
    if (account?.registryId && abandonedIds.has(account.registryId)) {
      delete appState.employees[employeeName];
    }
  });
  appState.developer.users = (appState.developer?.users || []).filter(user => !abandonedIds.has(user.id));
  saveAppState();
  return appState.registry.admins.length !== beforeCount;
}

function generateUniqueAdminLoginName(fullName, businessName) {
  const seed = String(businessName || fullName || 'Admin')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const baseRaw = seed[0] || 'Admin';
  const base = baseRaw.charAt(0).toUpperCase() + baseRaw.slice(1, 12).toLowerCase();
  const taken = new Set(getAllowedEmployees().map(name => name.toLowerCase()));
  let candidate = base;
  let counter = 1;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}${counter}`;
    counter += 1;
  }
  return candidate;
}

async function hashPasswordSecure(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = Array.from(saltBytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: PASSWORD_HASH_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const digest = derivedBits;
  const hash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  return {
    salt,
    hash,
    passwordAlgorithm: PASSWORD_HASH_ALGORITHM,
    passwordIterations: PASSWORD_HASH_ITERATIONS
  };
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

async function deriveSessionCryptoKey(employeeName, password) {
  if (!crypto?.subtle || !password) return null;
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(`MO-SaaS:${employeeName}`),
      iterations: 120000,
      hash: 'SHA-256'
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptForSession(value) {
  if (!sessionCryptoKey || !value) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sessionCryptoKey,
    new TextEncoder().encode(value)
  );
  return JSON.stringify({
    v: 1,
    alg: 'AES-GCM',
    iv: bytesToBase64(iv),
    data: bytesToBase64(encrypted)
  });
}

async function decryptForSession(payload) {
  if (!sessionCryptoKey || !payload) return '';
  try {
    const parsed = JSON.parse(payload);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(parsed.iv) },
      sessionCryptoKey,
      base64ToBytes(parsed.data)
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    return '';
  }
}

async function verifyAccountPassword(account, password) {
  if (!account || !password) return false;
  if (account.passwordHash && account.passwordSalt) {
    if (account.passwordAlgorithm === PASSWORD_HASH_ALGORITHM) {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: new TextEncoder().encode(account.passwordSalt),
          iterations: Number(account.passwordIterations || PASSWORD_HASH_ITERATIONS),
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );
      const hash = Array.from(new Uint8Array(derivedBits)).map(byte => byte.toString(16).padStart(2, '0')).join('');
      return hash === account.passwordHash;
    }

    const encoded = new TextEncoder().encode(`${account.passwordSalt}:${password}`);
    const legacyDigest = await crypto.subtle.digest('SHA-256', encoded);
    const legacyHash = Array.from(new Uint8Array(legacyDigest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    return legacyHash === account.passwordHash;
  }
  if (account.password) return account.password === password;
  return false;
}

async function applySecurePasswordToAccount(account, password) {
  const secure = await hashPasswordSecure(password);
  account.passwordSalt = secure.salt;
  account.passwordHash = secure.hash;
  account.passwordAlgorithm = secure.passwordAlgorithm;
  account.passwordIterations = secure.passwordIterations;
  delete account.password;
  return account;
}

function getMonthlyFeeForPlan(plan) {
  return getPlanDetails(plan).monthlyPrice;
}

function mapRegistryStatusToDeveloperStatus(status) {
  if (status === 'trial' || status === 'active') return 'active';
  if (status === 'inactive') return 'suspended';
  return status;
}

function mapDeveloperStatusToLicenseStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'suspended' || value === 'inactive') return LICENSE_STATUS.SUSPEND;
  if (value === 'expired') return LICENSE_STATUS.EXPIRE;
  return LICENSE_STATUS.ACTIVE;
}

function syncCurrentLicenseFromAdminControl(employeeName = appState.currentEmployee) {
  const directAdmin = findRegistryAdminByLogin(employeeName);
  const business = directAdmin ? null : getBusinessForEmployee(employeeName);
  const admin = directAdmin || findRegistryAdminByLogin(business?.adminName);
  if (!admin) return;
  licenseData.company_id = admin.id;
  licenseData.plan = normalizePlanKey(admin.plan);
  licenseData.expiry_date = admin.expiryDate || licenseData.expiry_date;
  licenseData.status = mapDeveloperStatusToLicenseStatus(admin.status);
  licenseData.creator_id = admin.loginName;
  saveLicenseData();
}

function syncRegistryToEmployees() {
  ensureRegistry();
  getRegistryAdmins().forEach(admin => {
    admin.plan = normalizePlanKey(admin.plan);
    const existing = appState.employees[admin.loginName] || {};
    const block = getRegistryAdminBlockStatus(admin);
    appState.employees[admin.loginName] = {
      ...existing,
      role: 'admin',
      fullName: admin.fullName,
      email: admin.email,
      phone: admin.phone,
      registryId: admin.id,
      ...(admin.passwordHash || existing.passwordHash ? {} : { password: admin.password || existing.password || DEFAULT_ADMIN_PASSWORD }),
      passwordSalt: admin.passwordSalt || existing.passwordSalt || null,
      passwordHash: admin.passwordHash || existing.passwordHash || null,
      passwordAlgorithm: admin.passwordAlgorithm || existing.passwordAlgorithm || null,
      passwordIterations: admin.passwordIterations || existing.passwordIterations || null,
      passwordChangedAt: existing.passwordChangedAt || admin.signupDate || new Date().toISOString(),
      mustChangePassword: Boolean(existing.mustChangePassword || admin.mustChangePassword),
      lastLogin: admin.lastLogin || existing.lastLogin || null,
      locked: block.blocked,
      lockedReason: block.blocked
        ? buildAccountBlockMessage({ businessName: admin.businessName, status: block.status, actor: 'Boss Admin' })
        : null
    };
  });
}

function syncRegistryToDeveloperUsers() {
  ensureRegistry();
  const existingUsers = Array.isArray(appState.developer?.users) ? appState.developer.users : [];
  const existingById = new Map(existingUsers.map(user => [user.id, user]));

  const registryUsers = getRegistryAdmins().map(admin => {
    const existing = existingById.get(admin.id) || {};
    const status = mapRegistryStatusToDeveloperStatus(admin.status);
    return {
      ...existing,
      id: admin.id,
      adminName: admin.loginName,
      fullName: admin.fullName,
      name: admin.businessName,
      businessName: admin.businessName,
      email: admin.email || existing.email || '',
      phone: admin.phone || existing.phone || '',
      status,
      registryStatus: admin.status,
      plan: normalizePlanKey(admin.plan || LICENSE_PLANS.FREE),
      expiryDate: admin.expiryDate,
      monthlyFee: Number(admin.monthlyFee || getMonthlyFeeForPlan(admin.plan)),
      signupDate: admin.signupDate || existing.signupDate || getTodayString(),
      lastLogin: admin.lastLogin || existing.lastLogin || null,
      revenue: Number(existing.revenue ?? admin.revenue ?? 0),
      transactions: Number(existing.transactions ?? admin.transactions ?? 0),
      customers: Number(existing.customers ?? admin.customers ?? 0),
      stockValue: Number(existing.stockValue ?? admin.stockValue ?? 0),
      growth: Number(existing.growth ?? admin.growth ?? 0),
      source: admin.source || existing.source || 'registry'
    };
  });

  const registryIds = new Set(registryUsers.map(user => user.id));
  const otherUsers = existingUsers.filter(user => !registryIds.has(user.id));
  appState.developer.users = [...registryUsers, ...otherUsers];
}

async function createAdminRegistryRecord({
  fullName,
  businessName,
  email = '',
  phone = '',
  password,
  plan = LICENSE_PLANS.FREE,
  status = 'trial',
  source = 'registration',
  loginName = '',
  trialDays = null
}) {
  ensureRegistry();
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedEmail && !normalizedPhone) {
    throw new Error(t('signupContactRequired'));
  }
  cleanupAbandonedPendingSignup(normalizedEmail, normalizedPhone);
  if (isRegistryContactTaken(normalizedEmail, normalizedPhone)) {
    throw new Error(t('signupContactExists'));
  }

  const planDetails = getPlanDetails(plan);
  const trialLength = Number(trialDays || planDetails.trialDays || TRIAL_SUBSCRIPTION_DAYS);

  const adminRecord = {
    id: `adm_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    loginName: loginName || generateUniqueAdminLoginName(fullName, businessName),
    fullName: fullName.trim(),
    businessName: businessName.trim(),
    email: normalizedEmail,
    phone: normalizedPhone,
    role: 'admin',
    status,
    plan,
    expiryDate: addRegistryDays(status === 'trial' ? trialLength : 30),
    signupDate: getTodayString(),
    lastLogin: null,
    monthlyFee: getMonthlyFeeForPlan(plan),
    source,
    revenue: 0,
    transactions: 0,
    customers: 0,
    stockValue: 0,
    growth: 0
  };

  await applySecurePasswordToAccount(adminRecord, password);
  appState.registry.admins.push(adminRecord);
  syncRegistryToEmployees();
  syncRegistryToDeveloperUsers();
  saveAppState();
  return adminRecord;
}

async function registerAdminFromSignup(formData) {
  const plan = normalizePlanKey(formData.plan || LICENSE_PLANS.FREE);
  const planDetails = getPlanDetails(plan);
  const requiresPayment = isPaidPlan(plan);
  return createAdminRegistryRecord({
    ...formData,
    status: requiresPayment ? 'pending_payment' : 'trial',
    plan,
    trialDays: planDetails.trialDays,
    source: 'registration'
  });
}

async function bossAddAdminFromPanel() {
  if (!assertSuperAdminAction()) return null;

  const fullName = $('bossAddFullName')?.value.trim() || '';
  const businessName = $('bossAddBusinessName')?.value.trim() || '';
  const email = $('bossAddEmail')?.value.trim() || '';
  const phone = $('bossAddPhone')?.value.trim() || '';
  const plan = normalizePlanKey($('bossAddPlan')?.value || LICENSE_PLANS.FREE);
  let password = $('bossAddPassword')?.value.trim() || '';

  if (!fullName || !businessName) {
    setBossRegistryStatus(t('signupNameRequired'), 'error');
    return null;
  }
  if (!email && !phone) {
    setBossRegistryStatus(t('signupContactRequired'), 'error');
    return null;
  }
  if (!password) {
    password = `Admin${Math.random().toString(36).slice(2, 8)}!`;
  }
  const passwordErrors = validatePasswordStrength(password);
  if (passwordErrors.length > 0) {
    setBossRegistryStatus(`${t('signupPasswordWeak')}: ${passwordErrors.join(', ')}`, 'error');
    return null;
  }

  try {
    const adminRecord = await createAdminRegistryRecord({
      fullName,
      businessName,
      email,
      phone,
      password,
      plan,
      status: plan === LICENSE_PLANS.FREE ? 'trial' : 'active',
      source: 'manual'
    });
    addDeveloperAuditLog('add_admin', adminRecord.loginName, appState.currentEmployee, `Boss added admin ${adminRecord.loginName}`, 'success');
    addDeveloperNotification('signup', `Admin added: ${adminRecord.businessName}`);
    ['bossAddFullName', 'bossAddBusinessName', 'bossAddEmail', 'bossAddPhone', 'bossAddPassword'].forEach(id => {
      const input = $(id);
      if (input) input.value = '';
    });
    setBossRegistryStatus(`${t('bossAdminAdded')}: ${adminRecord.loginName}`, 'success');
    renderDeveloperDashboard();
    return adminRecord;
  } catch (error) {
    setBossRegistryStatus(error.message, 'error');
    return null;
  }
}

function bossRemoveAdmin(adminId) {
  if (!assertSuperAdminAction()) return false;
  const admin = findRegistryAdminById(adminId);
  if (!admin) return false;
  if (!confirm(`${t('bossAdminRemoveConfirm')} ${admin.loginName}?`)) return false;

  admin.removed = true;
  admin.removedAt = new Date().toISOString();
  admin.status = 'inactive';

  delete appState.employees[admin.loginName];
  appState.developer.users = (appState.developer.users || []).filter(user => user.id !== admin.id);
  appState.registry.admins = appState.registry.admins.filter(item => item.id !== admin.id);

  const assignments = appState.registry.userAssignments || {};
  Object.keys(assignments).forEach(key => {
    if (key === admin.loginName) delete assignments[key];
  });

  addDeveloperAuditLog('remove_admin', admin.loginName, appState.currentEmployee, `Boss removed admin ${admin.loginName}`, 'warning');
  addDeveloperNotification('admin_action', `Admin removed: ${admin.businessName}`);
  saveAppState();
  renderDeveloperDashboard();
  showNotification(t('bossAdminRemoved'));
  return true;
}

function setBossRegistryStatus(message, type = '') {
  const statusEl = $('bossRegistryStatus');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove('success', 'error');
  if (type) statusEl.classList.add(type);
}

function renderBossAdminRegistry() {
  const tbody = $('bossAdminRegistryBody');
  if (!tbody) return;
  const admins = getRegistryAdmins();
  if (admins.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">No registered admins</td></tr>';
    return;
  }

  tbody.innerHTML = admins.map(admin => {
    const status = getDeveloperUserStatus({ status: mapRegistryStatusToDeveloperStatus(admin.status), expiryDate: admin.expiryDate });
    const lastChange = admin.lastBossTimeChange
      ? `<br><small class="boss-time-note">${escapeHtml(admin.lastBossTimeChange)}</small>`
      : '';
    return `
      <tr>
        <td><strong>${admin.loginName}</strong><br><small>${admin.fullName}</small></td>
        <td>${admin.businessName}</td>
        <td>${admin.email || '-'}<br><small>${admin.phone || '-'}</small></td>
        <td><span class="dev-status-badge ${status}">${mapDeveloperStatusToLicenseStatus(admin.status)}</span></td>
        <td>${admin.expiryDate}<br><small>${formatCountdown(admin.expiryDate)}</small>${lastChange}</td>
        <td>
          <div class="boss-time-control">
            <input id="bossDays_${admin.id}" class="form-input boss-days-input" type="number" min="1" value="30" aria-label="Siku za ${escapeHtml(admin.loginName)}">
            <button class="btn btn-small btn-success" type="button" onclick="bossAdjustAdminDays('${admin.id}', 1)">+</button>
            <button class="btn btn-small btn-secondary" type="button" onclick="bossAdjustAdminDays('${admin.id}', -1)">-</button>
          </div>
        </td>
        <td>${admin.source || 'registry'}</td>
        <td>
          <div class="dev-table-actions">
            <button class="btn btn-small btn-success" type="button" onclick="bossSetAdminLicenseStatus('${admin.id}', 'ACTIVE')">ACTIVE</button>
            <button class="btn btn-small btn-secondary" type="button" onclick="bossSetAdminLicenseStatus('${admin.id}', 'SUSPEND')">SUSPEND</button>
            <button class="btn btn-small btn-danger" type="button" onclick="bossSetAdminLicenseStatus('${admin.id}', 'EXPIRE')">EXPIRE</button>
            <button class="btn btn-small btn-danger" type="button" onclick="bossRemoveAdmin('${admin.id}')">${t('bossRemoveAdmin')}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function generateSignupMathCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
}

function refreshSignupCaptcha() {
  signupHumanCaptcha = generateSignupMathCaptcha();
  const questionEl = $('signupCaptchaQuestion');
  if (questionEl) {
    questionEl.textContent = `${signupHumanCaptcha.a} + ${signupHumanCaptcha.b} = ?`;
  }
  const answerEl = $('signupCaptchaAnswer');
  if (answerEl) answerEl.value = '';
}

function clearSignupSmsSession() {
  signupSmsSession = null;
  signupOtpVerified = false;
  if (signupOtpCountdownTimer) {
    clearInterval(signupOtpCountdownTimer);
    signupOtpCountdownTimer = null;
  }
  const timerEl = $('signupOtpTimer');
  if (timerEl) timerEl.textContent = '';
  const demoEl = $('signupOtpDemo');
  if (demoEl) {
    demoEl.textContent = '';
    demoEl.classList.add('hidden');
  }
}

function updateSignupSmsBlockVisibility() {
  const phone = normalizePhone($('signupPhone')?.value || '');
  const block = $('signupSmsBlock');
  if (!block) return;
  const show = phone.length >= 9;
  block.classList.toggle('hidden', !show);
  if (show && signupSmsSession && normalizePhone(signupSmsSession.phone) !== phone) {
    clearSignupSmsSession();
    if ($('signupOtpCode')) $('signupOtpCode').value = '';
    if ($('signupOtpStatus')) $('signupOtpStatus').textContent = '';
  }
  if (!show) {
    clearSignupSmsSession();
    if ($('signupOtpCode')) $('signupOtpCode').value = '';
    if ($('signupOtpDemo')) $('signupOtpDemo').classList.add('hidden');
    if ($('signupOtpStatus')) $('signupOtpStatus').textContent = '';
  }
}

function getSelectedSignupPlan() {
  return normalizePlanKey($('signupSelectedPlan')?.value || LICENSE_PLANS.FREE);
}

function getSelectedSignupPaymentMethod() {
  const checked = document.querySelector('input[name="signupPaymentMethod"]:checked');
  return checked ? checked.value : '';
}

function getSignupDraftPayload() {
  return {
    fullName: $('signupFullName')?.value || '',
    businessName: $('signupBusinessName')?.value || '',
    email: $('signupEmail')?.value || '',
    phone: $('signupPhone')?.value || '',
    plan: getSelectedSignupPlan(),
    paymentMethod: getSelectedSignupPaymentMethod(),
    paymentReference: $('signupPaymentReference')?.value || '',
    savedAt: new Date().toISOString()
  };
}

function getSignupDrafts() {
  try {
    const drafts = JSON.parse(localStorage.getItem(SIGNUP_DRAFTS_KEY) || '[]');
    return Array.isArray(drafts) ? drafts : [];
  } catch (error) {
    localStorage.removeItem(SIGNUP_DRAFTS_KEY);
    return [];
  }
}

function saveSignupDrafts(drafts) {
  localStorage.setItem(SIGNUP_DRAFTS_KEY, JSON.stringify(drafts.slice(0, 20)));
}

function getSignupDraftKey(draft) {
  return normalizeEmail(draft.email) || normalizePhone(draft.phone) || String(draft.fullName || '').trim().toLowerCase();
}

function migrateSingleSignupDraft() {
  try {
    const raw = localStorage.getItem(SIGNUP_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft?.fullName || draft?.email || draft?.phone) {
      const drafts = getSignupDrafts();
      const key = getSignupDraftKey(draft);
      const filtered = drafts.filter(item => getSignupDraftKey(item) !== key);
      saveSignupDrafts([draft, ...filtered]);
    }
    localStorage.removeItem(SIGNUP_DRAFT_KEY);
  } catch (error) {
    localStorage.removeItem(SIGNUP_DRAFT_KEY);
  }
}

function renderSignupNameSuggestions() {
  migrateSingleSignupDraft();
  const list = $('signupNameSuggestions');
  if (!list) return;
  list.innerHTML = getSignupDrafts()
    .filter(draft => String(draft.fullName || '').trim())
    .map(draft => `<option value="${escapeHtml(draft.fullName)}">${escapeHtml(draft.businessName || draft.email || draft.phone || '')}</option>`)
    .join('');
}

function saveSignupDraft() {
  try {
    const draft = getSignupDraftPayload();
    if (!draft.fullName && !draft.businessName && !draft.email && !draft.phone) return;
    const key = getSignupDraftKey(draft);
    const drafts = getSignupDrafts().filter(item => getSignupDraftKey(item) !== key);
    saveSignupDrafts([draft, ...drafts]);
    renderSignupNameSuggestions();
  } catch (error) {
    console.warn('Failed to save signup draft:', error);
  }
}

function applySignupDraft(draft) {
  if (!draft) return false;
  if ($('signupFullName')) $('signupFullName').value = draft.fullName || '';
  if ($('signupBusinessName')) $('signupBusinessName').value = draft.businessName || '';
  if ($('signupEmail')) $('signupEmail').value = draft.email || '';
  if ($('signupPhone')) $('signupPhone').value = draft.phone || '';
  if ($('signupSelectedPlan')) $('signupSelectedPlan').value = normalizePlanKey(draft.plan || LICENSE_PLANS.FREE);
  if ($('signupPaymentReference')) $('signupPaymentReference').value = draft.paymentReference || '';
  document.querySelectorAll('input[name="signupPaymentMethod"]').forEach(input => {
    input.checked = input.value === draft.paymentMethod;
  });
  renderSignupPlanCards();
  updateSignupPaymentSection();
  updateSignupSmsBlockVisibility();
  return true;
}

function applySignupDraftSuggestion() {
  const name = String($('signupFullName')?.value || '').trim().toLowerCase();
  if (!name) return false;
  const draft = getSignupDrafts().find(item => String(item.fullName || '').trim().toLowerCase() === name);
  return applySignupDraft(draft);
}

function restoreSignupDraft() {
  try {
    renderSignupNameSuggestions();
    return false;
  } catch (error) {
    console.warn('Failed to restore signup draft:', error);
    localStorage.removeItem(SIGNUP_DRAFT_KEY);
    return false;
  }
}

function clearSignupDraft() {
  try {
    localStorage.removeItem(SIGNUP_DRAFT_KEY);
    const submitted = getSignupDraftPayload();
    const submittedKey = getSignupDraftKey(submitted);
    const drafts = getSignupDrafts().filter(draft => getSignupDraftKey(draft) !== submittedKey);
    saveSignupDrafts(drafts);
    renderSignupNameSuggestions();
  } catch (error) {
    console.warn('Failed to clear signup draft:', error);
  }
}

function getApiConnectionErrorMessage(error) {
  if (error instanceof TypeError || String(error?.message || '').includes('Failed to fetch')) {
    return 'Backend API haijawashwa au haipatikani. Washa backend kwenye http://localhost:3001 kisha jaribu tena.';
  }
  return error?.message || 'Ombi limeshindikana.';
}

function mapRoleToBackend(role) {
  if (role === 'super_admin') return 'boss_admin';
  if (role === 'admin') return 'admin';
  return 'cashier';
}

async function storeBackendAuth(data) {
  if (!data?.token) return;
  const encryptedToken = await encryptForSession(data.token);
  if (encryptedToken) {
    localStorage.setItem(AUTH_TOKEN_ENCRYPTED_KEY, encryptedToken);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } else {
    sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  if (data.user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  if (data.license) {
    licenseData = { ...licenseData, ...data.license };
    saveLicenseData();
  }
}

async function getBackendAuthToken() {
  const encrypted = localStorage.getItem(AUTH_TOKEN_ENCRYPTED_KEY);
  if (encrypted) {
    const token = await decryptForSession(encrypted);
    if (token) return token;
  }
  return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

async function backendRegisterUserFromAdmin(adminRecord, password) {
  try {
    const response = await fetch(`${PAYMENT_API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: adminRecord.id,
        username: adminRecord.loginName,
        password,
        full_name: adminRecord.fullName,
        email: adminRecord.email,
        phone: adminRecord.phone,
        role: 'admin'
      })
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 409) {
      return backendLoginUser(adminRecord.id, adminRecord.loginName, password);
    }
    if (!response.ok || !result.success) throw new Error(result.message || 'Backend register failed');
    await storeBackendAuth(result.data);
    return true;
  } catch (error) {
    console.warn('Backend registration skipped:', error.message);
    return false;
  }
}

async function backendLoginUser(companyId, login, password) {
  try {
    const response = await fetch(`${PAYMENT_API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, login, password })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      if (!shouldRequireBackendAuth()) return false;
      throw new Error(result.message || 'Backend login failed');
    }
    await storeBackendAuth(result.data);
    return true;
  } catch (error) {
    if (!(error instanceof TypeError) && !String(error?.message || '').includes('Failed to fetch')) {
      throw error;
    }
    console.warn('Backend login skipped:', error.message);
    return false;
  }
}

function updateSignupPaymentSection() {
  const section = $('signupPaymentSection');
  const status = $('signupPaymentStatus');
  const plan = getSelectedSignupPlan();
  const requiresPayment = isPaidPlan(plan);
  if (!section) return;

  section.classList.toggle('hidden', !requiresPayment);
  if (status) {
    status.textContent = '';
    status.classList.remove('success', 'error');
  }
  if (!requiresPayment) {
    document.querySelectorAll('input[name="signupPaymentMethod"]').forEach(input => { input.checked = false; });
    if ($('signupPaymentReference')) $('signupPaymentReference').value = '';
  }
}

function startSignupOtpResendCountdown(seconds = 60) {
  const timerEl = $('signupOtpTimer');
  const sendBtn = $('signupSendOtpBtn');
  if (!timerEl || !sendBtn) return;
  let remaining = seconds;
  sendBtn.disabled = true;
  timerEl.textContent = `${t('signupOtpResendIn')} ${remaining}s`;
  if (signupOtpCountdownTimer) clearInterval(signupOtpCountdownTimer);
  signupOtpCountdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(signupOtpCountdownTimer);
      signupOtpCountdownTimer = null;
      sendBtn.disabled = false;
      timerEl.textContent = '';
      return;
    }
    timerEl.textContent = `${t('signupOtpResendIn')} ${remaining}s`;
  }, 1000);
}

async function sendSignupSmsOtp() {
  const phone = normalizePhone($('signupPhone')?.value || '');
  const statusEl = $('signupOtpStatus');
  const demoEl = $('signupOtpDemo');
  if (phone.length < 9) {
    if (statusEl) {
      statusEl.textContent = t('signupPhoneInvalid');
      statusEl.classList.add('error');
    }
    return false;
  }
  if (isRegistryContactTaken('', phone)) {
    cleanupAbandonedPendingSignup('', phone);
  }
  if (isRegistryContactTaken('', phone)) {
    if (statusEl) {
      statusEl.textContent = t('signupContactExists');
      statusEl.classList.add('error');
    }
    return false;
  }

  const sendBtn = $('signupSendOtpBtn');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = t('signupSendingOtp');
  }

  try {
    const response = await fetch(`${PAYMENT_API_BASE_URL}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'OTP haikutumwa.');
    }

    signupSmsSession = {
      phone,
      otpId: result.data?.otp_id,
      verified: false,
      expiresAt: Date.now() + Number(result.data?.expires_in_seconds || 300) * 1000,
      sentAt: Date.now()
    };
    signupOtpVerified = false;

    if (statusEl) {
      statusEl.textContent = t('signupOtpSent');
      statusEl.classList.remove('error');
      statusEl.classList.add('success');
    }
    if (demoEl) {
      demoEl.textContent = '';
      demoEl.classList.add('hidden');
    }
    startSignupOtpResendCountdown(Math.floor(SMS_OTP_RESEND_MS / 1000));
    showNotification(t('signupOtpSent'));
    return true;
  } catch (error) {
    if (statusEl) {
      statusEl.textContent = getApiConnectionErrorMessage(error);
      statusEl.classList.remove('success');
      statusEl.classList.add('error');
    }
    return false;
  } finally {
    if (sendBtn) {
      sendBtn.textContent = t('signupSendOtp');
      if (!signupOtpCountdownTimer) sendBtn.disabled = false;
    }
  }
}

async function verifySignupSmsOtpCode() {
  if (!signupSmsSession) return { valid: false, message: t('signupOtpRequired') };
  if (Date.now() > signupSmsSession.expiresAt) {
    return { valid: false, message: t('signupOtpExpired') };
  }
  const entered = String($('signupOtpCode')?.value || '').trim();
  if (!entered) return { valid: false, message: t('signupOtpRequired') };

  if (signupOtpVerified && signupSmsSession.verified) {
    return { valid: true };
  }

  const response = await fetch(`${PAYMENT_API_BASE_URL}/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: signupSmsSession.phone,
      otp_id: signupSmsSession.otpId,
      code: entered
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    return { valid: false, message: result.message || t('signupOtpInvalid') };
  }

  signupSmsSession.verified = true;
  signupOtpVerified = true;
  return { valid: true };
}

function validateSignupHumanCheck() {
  const answer = Number($('signupCaptchaAnswer')?.value);
  if (!signupHumanCaptcha || Number.isNaN(answer)) {
    return t('signupCaptchaRequired');
  }
  if (answer !== signupHumanCaptcha.answer) {
    return t('signupCaptchaInvalid');
  }
  return '';
}

async function validateSignupSmsCheck(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length < 9) return '';
  const otpCheck = await verifySignupSmsOtpCode();
  if (!otpCheck.valid) return otpCheck.message;
  if (normalizePhone(signupSmsSession?.phone) !== normalizedPhone) {
    return t('signupOtpPhoneMismatch');
  }
  return '';
}

function renderSignupPlanCards() {
  const container = $('signupPlanCards');
  const hiddenInput = $('signupSelectedPlan');
  if (!container) return;

  const catalog = getSubscriptionPlanCatalog();
  const selected = normalizePlanKey(hiddenInput?.value || LICENSE_PLANS.FREE);

  container.innerHTML = Object.values(catalog).map(plan => `
    <button
      type="button"
      class="signup-plan-card ${plan.featured ? 'featured' : ''} ${plan.key === selected ? 'selected' : ''}"
      data-plan="${plan.key}"
      aria-pressed="${plan.key === selected}"
    >
      ${plan.badge ? `<span class="signup-plan-badge">${plan.badge}</span>` : ''}
      <span class="signup-plan-name">${plan.displayName}</span>
      <span class="signup-plan-price">${plan.priceLabel}<small>${plan.periodLabel}</small></span>
      <ul class="signup-plan-features">
        ${plan.features.map(feature => `<li>${feature}</li>`).join('')}
      </ul>
    </button>
  `).join('');

  container.querySelectorAll('.signup-plan-card').forEach(card => {
    card.addEventListener('click', () => {
      const planKey = card.dataset.plan;
      if (hiddenInput) hiddenInput.value = planKey;
      container.querySelectorAll('.signup-plan-card').forEach(item => {
        const isSelected = item.dataset.plan === planKey;
        item.classList.toggle('selected', isSelected);
        item.setAttribute('aria-pressed', String(isSelected));
      });
      updateSignupPaymentSection();
      saveSignupDraft();
    });
  });
}

function initSignupVerificationUi() {
  restoreSignupDraft();
  refreshSignupCaptcha();
  clearSignupSmsSession();
  updateSignupSmsBlockVisibility();
  renderSignupPlanCards();
  updateSignupPaymentSection();
}

function showSignupGate() {
  hideLicenseExpiredScreen();
  $('loginGate')?.classList.add('hidden');
  $('signupGate')?.classList.remove('hidden');
  clearSignupFormMessages();
  initSignupVerificationUi();
  $('signupFullName')?.focus();
}

function showLoginGate() {
  $('signupGate')?.classList.add('hidden');
  updateLoginGate();
  updateLoginLicenseBanner();
}

function clearSignupFormMessages() {
  const errorEl = $('signupFormError');
  const successEl = $('signupFormSuccess');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
  if (successEl) {
    successEl.textContent = '';
    successEl.classList.add('hidden');
  }
}

function setSignupLoading(isLoading) {
  const btn = $('signupSubmitBtn');
  const loader = $('signupSubmitLoader');
  const text = $('signupSubmitText');
  if (btn) btn.classList.toggle('is-loading', isLoading);
  if (loader) loader.classList.toggle('hidden', !isLoading);
  if (text) text.textContent = isLoading ? t('signupProcessing') : t('signupSubmit');
}

async function validateSignupPayload(payload) {
  if (!payload.fullName || !payload.businessName) {
    return t('signupNameRequired');
  }
  if (!payload.email && !payload.phone) {
    return t('signupContactRequired');
  }
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return t('signupEmailInvalid');
  }
  if (payload.phone && normalizePhone(payload.phone).length < 9) {
    return t('signupPhoneInvalid');
  }
  cleanupAbandonedPendingSignup(payload.email, payload.phone);
  if (isRegistryContactTaken(payload.email, payload.phone)) {
    return t('signupContactExists');
  }
  if (isPaidPlan(payload.plan)) {
    if (!payload.paymentMethod) return t('signupPaymentMethodRequired');
  }
  const captchaError = validateSignupHumanCheck();
  if (captchaError) return captchaError;
  const smsError = await validateSignupSmsCheck(payload.phone);
  if (smsError) return smsError;
  if (payload.password !== payload.passwordConfirm) {
    return t('signupPasswordMismatch');
  }
  const passwordErrors = validatePasswordStrength(payload.password);
  if (passwordErrors.length > 0) {
    return `${t('signupPasswordWeak')}: ${passwordErrors.join(', ')}`;
  }
  return '';
}

function normalizePaymentMethodForApi(method) {
  const value = String(method || '').toLowerCase();
  if (value.includes('bank')) return 'bank';
  return 'mobile_money';
}

async function initiateRealSignupPayment(adminRecord, payload) {
  const amount = getMonthlyFeeForPlan(payload.plan);
  const response = await fetch(`${PAYMENT_API_BASE_URL}/payment/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_id: adminRecord.id,
      amount,
      plan: normalizePlanKey(payload.plan),
      payment_method: normalizePaymentMethodForApi(payload.paymentMethod)
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Payment API imeshindwa kuanzisha malipo.');
  }
  return result.data;
}

async function syncPaymentActivationFromApi(adminId, transactionRef, method = 'AUTO') {
  const response = await fetch(`${PAYMENT_API_BASE_URL}/payment/${encodeURIComponent(transactionRef)}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) return false;

  const status = String(result.data?.status || '').toLowerCase();
  if (['paid', 'completed', 'success'].includes(status)) {
    autoActivateUserFromPayment(adminId, method, transactionRef);
    return true;
  }
  if (['failed', 'rejected', 'cancelled'].includes(status)) {
    syncRegistryAdminStatus(adminId, 'pending_payment');
    recordPaymentEvent(adminId, result.data?.amount || 0, 'failed', method, transactionRef);
    renderDeveloperDashboard();
    return true;
  }
  return false;
}

function watchRealPaymentActivation(adminId, transactionRef, method = 'AUTO') {
  let attempts = 0;
  const timer = setInterval(async () => {
    attempts += 1;
    try {
      const activated = await syncPaymentActivationFromApi(adminId, transactionRef, method);
      if (activated || attempts >= 40) clearInterval(timer);
    } catch (error) {
      if (attempts >= 40) clearInterval(timer);
    }
  }, 3000);
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  clearSignupFormMessages();

  const payload = {
    fullName: $('signupFullName')?.value.trim() || '',
    businessName: $('signupBusinessName')?.value.trim() || '',
    email: $('signupEmail')?.value.trim() || '',
    phone: $('signupPhone')?.value.trim() || '',
    password: $('signupPassword')?.value || '',
    passwordConfirm: $('signupPasswordConfirm')?.value || '',
    plan: getSelectedSignupPlan(),
    paymentMethod: getSelectedSignupPaymentMethod(),
    paymentReference: ($('signupPaymentReference')?.value || '').trim()
  };

  const validationError = await validateSignupPayload(payload);
  if (validationError) {
    const errorEl = $('signupFormError');
    if (errorEl) {
      errorEl.textContent = validationError;
      errorEl.classList.remove('hidden');
    }
    return;
  }

  setSignupLoading(true);
  let createdAdminRecord = null;
  try {
    const adminRecord = await registerAdminFromSignup(payload);
    createdAdminRecord = adminRecord;
    await backendRegisterUserFromAdmin(adminRecord, payload.password);
    if (isPaidPlan(payload.plan)) {
      const paymentData = await initiateRealSignupPayment(adminRecord, payload);
      const transactionRef = paymentData.transaction_ref;
      const paymentStatusEl = $('signupPaymentStatus');
      if (paymentStatusEl) {
        paymentStatusEl.textContent = `${t('signupPendingPayment')} REF: ${transactionRef}`;
        paymentStatusEl.classList.add('success');
      }
      recordPaymentEvent(
        adminRecord.id,
        getMonthlyFeeForPlan(payload.plan),
        'pending',
        payload.paymentMethod,
        transactionRef
      );
      watchRealPaymentActivation(adminRecord.id, transactionRef, payload.paymentMethod);
    }
    addDeveloperAuditLog('signup', adminRecord.loginName, 'System', `New admin registered: ${adminRecord.businessName}`, 'success');
    addDeveloperNotification('signup', `New signup: ${adminRecord.businessName}`);

    const successEl = $('signupFormSuccess');
    if (successEl) {
      successEl.textContent = isPaidPlan(payload.plan)
        ? `${t('signupPendingPayment')} Login: ${adminRecord.loginName}`
        : `${t('signupSuccess')} Login: ${adminRecord.loginName}`;
      successEl.classList.remove('hidden');
    }

    clearSignupDraft();
    $('signupForm')?.reset();
    if ($('signupSelectedPlan')) $('signupSelectedPlan').value = LICENSE_PLANS.FREE;
    document.querySelectorAll('input[name="signupPaymentMethod"]').forEach(input => { input.checked = false; });
    if ($('signupPaymentReference')) $('signupPaymentReference').value = '';
    clearSignupSmsSession();
    setTimeout(() => {
      showLoginGate();
      if ($('gateEmployeeInput')) $('gateEmployeeInput').value = adminRecord.loginName;
      $('gateEmployeePin')?.focus();
      showNotification(t('signupSuccessShort'));
    }, 1400);
  } catch (error) {
    if (createdAdminRecord && isPaidPlan(payload.plan) && !hasPaymentRecordForAdmin(createdAdminRecord.id)) {
      cleanupAbandonedPendingSignup(payload.email, payload.phone);
    }
    const errorEl = $('signupFormError');
    if (errorEl) {
      errorEl.textContent = error.message || t('signupFailed');
      errorEl.classList.remove('hidden');
    }
  } finally {
    setSignupLoading(false);
  }
}

function ensureDeveloperData() {
  if (!appState.developer || typeof appState.developer !== 'object') {
    appState.developer = {};
  }

  ensureRegistry();
  syncRegistryToDeveloperUsers();

  if (!Array.isArray(appState.developer.payments) || appState.developer.payments.length === 0) {
    const now = new Date();
    appState.developer.payments = [
      { id: 'pay_001', userId: 'u_001', amount: 30000, status: 'paid', method: 'M-Pesa', timestamp: now.toISOString() },
      { id: 'pay_002', userId: 'u_002', amount: 60000, status: 'paid', method: 'Card', timestamp: now.toISOString() },
      { id: 'pay_003', userId: 'u_003', amount: 30000, status: 'failed', method: 'M-Pesa', timestamp: now.toISOString() },
      { id: 'pay_004', userId: 'u_004', amount: 120000, status: 'unpaid', method: 'Manual', timestamp: now.toISOString() }
    ];
  }

  if (!Array.isArray(appState.developer.auditLogs)) appState.developer.auditLogs = [];
  if (!Array.isArray(appState.developer.notifications)) {
    appState.developer.notifications = [
      { id: `note_${Date.now()}_1`, type: 'signup', message: 'New user registered: Kilimani Shop', timestamp: new Date().toISOString(), read: false },
      { id: `note_${Date.now()}_2`, type: 'subscription', message: 'Mlimani Mini Mart subscription expired', timestamp: new Date().toISOString(), read: false }
    ];
  }
}

// ==========================================
// EMPLOYEE MANAGEMENT
// ==========================================

function validatePasswordStrength(password) {
  const errors = [];
  if (password.length < 8) errors.push('angalau herufi 8');
  if (!/[A-Z]/.test(password)) errors.push('herufi kubwa');
  if (!/[a-z]/.test(password)) errors.push('herufi ndogo');
  if (!/[0-9]/.test(password)) errors.push('namba');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('alama maalum');
  return errors;
}

function markAccountPasswordChangeRequired(account) {
  if (!account) return account;
  account.mustChangePassword = false;
  account.passwordChangedAt = DEFAULT_PASSWORD_ISSUED_AT;
  return account;
}

function accountRequiresPasswordChange(employeeName) {
  return false;
}

function getEmployeeAccount(employeeName) {
  ensureEmployeeAccounts();
  return appState.employees[employeeName];
}

function getPasswordAgeDays(employeeName) {
  const account = getEmployeeAccount(employeeName);
  if (!account?.passwordChangedAt) return PASSWORD_MAX_AGE_DAYS + 1;
  const changedAt = new Date(account.passwordChangedAt);
  const diff = Date.now() - changedAt.getTime();
  return Math.floor(diff / 86400000);
}

function isPasswordExpired(employeeName) {
  return getPasswordAgeDays(employeeName) >= PASSWORD_MAX_AGE_DAYS;
}

function updatePasswordStatus() {
  const target = $('passwordStatus');
  if (!target) return;

  if (!appState.currentEmployee) {
    target.textContent = 'Login kuona hali ya password.';
    return;
  }

  const age = getPasswordAgeDays(appState.currentEmployee);
  const daysLeft = Math.max(0, PASSWORD_MAX_AGE_DAYS - age);
  target.textContent = daysLeft === 0
    ? 'Unaweza kubadilisha password muda wowote kwa hiari.'
    : `Password iko sawa. Unaweza kuibadilisha kwa hiari muda wowote.`;
}

function showPasswordModal(message = '') {
  const modal = $('passwordModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  if ($('passwordModalMessage')) {
    $('passwordModalMessage').textContent = message || 'Badilisha password yako ili kuendelea.';
  }
}

function hidePasswordModal() {
  const modal = $('passwordModal');
  if (modal) modal.classList.add('hidden');
}

// =========================================
// LICENSE MODAL FUNCTIONS
// =========================================

function openLicenseModal() {
  updateLicenseModalContent();
  const modal = $('licenseRenewalModal');
  if (modal) modal.classList.remove('hidden');
}

function closeLicenseModal() {
  const modal = $('licenseRenewalModal');
  if (modal) modal.classList.add('hidden');
}

function updateLicenseModalContent() {
  updateLicenseStatus();
  const daysLeft = getDaysRemaining();
  const expiryDate = getLicenseExpiryDate().toLocaleDateString();
  const statusText = isLicenseActive() ? '[OK] ' + t('licenseActive') : '[EXPIRED] ' + t('licenseExpired');
  const planLabel = getPlanDetails(licenseData.plan).displayName;

  $('licenseCompanyId').textContent = licenseData.company_id;
  $('licensePlan').textContent = planLabel;
  $('licenseStatusText').textContent = statusText;
  $('licenseExpiryText').textContent = expiryDate;
  $('licenseDaysRemaining').textContent = Math.max(0, daysLeft);

  const renewalMsg = $('renewalMessage');
  if (renewalMsg) {
    if (isLicenseExpired()) {
      renewalMsg.innerHTML = `<strong style="color: #e74c3c;">${t('subscriptionExpired')}</strong>`;
    } else if (daysLeft <= 7) {
      renewalMsg.innerHTML = `<strong style="color: #f39c12;">${t('daysRemaining')}: ${daysLeft}</strong>`;
    } else {
      renewalMsg.innerHTML = `<strong style="color: #27ae60;">Your subscription is active and healthy.</strong>`;
    }
  }

}

function renewLicenseOneMonth() {
  // Check if current user is the creator
  if (appState.currentEmployee !== licenseData.creator_id) {
    showNotification(t('licenseRenewalNotCreator') || 'Only the creator can renew the license');
    return false;
  }
  
  if (renewLicense(1)) {
    updateLicenseModalContent();
    showNotification(t('licenseRenewalSuccess'));
  } else {
    showNotification(t('licenseRenewalError'));
  }
}

async function changeOwnPassword({ forced = false } = {}) {
  if (!appState.currentEmployee || !['super_admin', 'admin', 'user'].includes(appState.currentRole)) {
    alert('Login kwanza');
    return false;
  }

  const prefix = forced ? 'force' : 'staff';
  const currentInput = $(`${prefix}CurrentPassword`);
  const newInput = $(`${prefix}NewPassword`);
  const confirmInput = $(`${prefix}ConfirmPassword`);
  const currentPassword = currentInput?.value.trim() || '';
  const newPassword = newInput?.value.trim() || '';
  const confirmPassword = confirmInput?.value.trim() || '';
  const account = getEmployeeAccount(appState.currentEmployee);

  const currentValid = await verifyAccountPassword(account, currentPassword);
  if (!currentValid) {
    alert('Password ya sasa si sahihi');
    return false;
  }

  if (newPassword !== confirmPassword) {
    alert('Password mpya hazifanani');
    return false;
  }

  const passwordErrors = validatePasswordStrength(newPassword);
  if (passwordErrors.length > 0) {
    alert(`Password iwe na: ${passwordErrors.join(', ')}`);
    return false;
  }

  if (newPassword === currentPassword) {
    alert('Password mpya iwe tofauti na ya sasa');
    return false;
  }

  await applySecurePasswordToAccount(account, newPassword);
  account.passwordChangedAt = new Date().toISOString();
  account.mustChangePassword = false;
  appState.employees[appState.currentEmployee] = account;
  const registryAdmin = findRegistryAdminByLogin(appState.currentEmployee);
  if (registryAdmin) {
    registryAdmin.passwordSalt = account.passwordSalt;
    registryAdmin.passwordHash = account.passwordHash;
    registryAdmin.passwordAlgorithm = account.passwordAlgorithm;
    registryAdmin.passwordIterations = account.passwordIterations;
    registryAdmin.passwordChangedAt = account.passwordChangedAt;
    registryAdmin.mustChangePassword = false;
    delete registryAdmin.password;
  }
  saveAppState();

  [currentInput, newInput, confirmInput].forEach(input => {
    if (input) input.value = '';
  });
  updatePasswordStatus();
  hidePasswordModal();
  showNotification('Password imebadilishwa');
  return true;
}

function resolveEmployeeName(name) {
  const raw = (name || '').trim();
  if (!raw) return '';

  if (raw === ADMIN_ACCOUNT) return ADMIN_ACCOUNT;

  const byContact = findRegistryAdminByContact(raw);
  if (byContact) return byContact.loginName;

  const byLogin = findRegistryAdminByLogin(raw);
  if (byLogin) return byLogin.loginName;

  const allowed = getAllowedEmployees();
  if (allowed.includes(raw)) return raw;

  const lower = raw.toLowerCase();
  const allowedMatch = allowed.find(employee => employee.toLowerCase() === lower);
  if (allowedMatch) return allowedMatch;

  const storedMatch = Object.keys(appState.employees || {}).find(
    employee => employee.toLowerCase() === lower
  );
  return storedMatch || '';
}

function isLoginGateVisible() {
  const gate = $('loginGate');
  return Boolean(gate && !gate.classList.contains('hidden'));
}

function showGateLoginError(message) {
  const errorEl = $('gateLoginError');
  if (!errorEl) {
    alert(message);
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearGateLoginError() {
  const errorEl = $('gateLoginError');
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
}

function updateLoginLicenseBanner() {
  updateLicenseStatus();
  const banner = $('loginLicenseBanner');
  if (!banner) return;

  const status = normalizeLicenseStatus(licenseData.status);
  const blocked = status !== LICENSE_STATUS.ACTIVE;
  banner.classList.toggle('hidden', !blocked);
  if ($('loginLicenseBannerTitle')) {
    $('loginLicenseBannerTitle').textContent = status === LICENSE_STATUS.SUSPEND
      ? 'Leseni imesitishwa'
      : t('loginLicenseBannerTitle');
  }
  if ($('loginLicenseBannerDesc')) {
    $('loginLicenseBannerDesc').textContent = status === LICENSE_STATUS.SUSPEND
      ? 'Boss Admin ameweka leseni kuwa SUSPEND.'
      : t('loginLicenseBannerDesc');
  }
}

function updateLicenseExpiredScreenContent() {
  updateLicenseStatus();
  const status = normalizeLicenseStatus(licenseData.status);
  const planLabel = getPlanDetails(licenseData.plan).displayName;
  if ($('licenseExpiredBadge')) $('licenseExpiredBadge').textContent = status;
  if ($('licenseExpiredTitle')) {
    $('licenseExpiredTitle').textContent = status === LICENSE_STATUS.SUSPEND
      ? 'Mfumo Umesitishwa'
      : t('licenseExpiredTitle');
  }
  if ($('licenseExpiredMessage')) {
    $('licenseExpiredMessage').textContent = status === LICENSE_STATUS.SUSPEND
      ? 'Leseni yako iko SUSPEND kwa amri ya Boss Admin.'
      : t('subscriptionExpired');
  }
  if ($('licenseExpiredDate')) $('licenseExpiredDate').textContent = getLicenseExpiryDate().toLocaleDateString();
  if ($('licenseExpiredPlan')) $('licenseExpiredPlan').textContent = planLabel.toUpperCase();
  if ($('licenseExpiredCompany')) $('licenseExpiredCompany').textContent = licenseData.company_id || '-';
  if ($('licenseExpiredExpiryLabel')) $('licenseExpiredExpiryLabel').textContent = t('expiryDate');
  if ($('licenseExpiredPlanLabel')) $('licenseExpiredPlanLabel').textContent = t('subscriptionPlan');
  if ($('licenseExpiredCompanyLabel')) $('licenseExpiredCompanyLabel').textContent = t('companyId');
  if ($('licenseExpiredFooter')) $('licenseExpiredFooter').textContent = t('licenseExpiredFooter');
  if ($('licenseExpiredBackBtn')) $('licenseExpiredBackBtn').textContent = t('backToLogin');
}

function showLicenseExpiredScreen() {
  updateLicenseExpiredScreenContent();
  const expiredGate = $('licenseExpiredGate');
  const loginGate = $('loginGate');
  if (expiredGate) expiredGate.classList.remove('hidden');
  if (loginGate) loginGate.classList.add('hidden');
}

function hideLicenseExpiredScreen() {
  const expiredGate = $('licenseExpiredGate');
  if (expiredGate) expiredGate.classList.add('hidden');
  if (!appState.currentEmployee) {
    const loginGate = $('loginGate');
    if (loginGate) loginGate.classList.remove('hidden');
  }
}

async function setEmployee(name) {
  const onLoginGate = isLoginGateVisible();
  if (onLoginGate) clearGateLoginError();

  const employeeName = resolveEmployeeName(name);
  if (!employeeName) {
    if (onLoginGate) showGateLoginError(t('invalidEmployee'));
    else alert(t('invalidEmployee'));
    return;
  }

  const pinInput = $('employeePin');
  const gatePinInput = $('gateEmployeePin');
  const pin = onLoginGate
    ? (gatePinInput ? gatePinInput.value.trim() : '')
    : (pinInput ? pinInput.value.trim() : '');
  const role = getDefaultRoleForEmployee(employeeName);
  const account = getEmployeeAccount(employeeName);
  const passwordValid = await verifyAccountPassword(account, pin);
  if (!passwordValid) {
    if (onLoginGate) showGateLoginError(t('invalidPassword'));
    else alert(t('invalidPassword'));
    return;
  }

  const accountSubscription = validateAccountSubscriptionForLogin(employeeName);
  if (!accountSubscription.valid) {
    if (onLoginGate) showGateLoginError(accountSubscription.message);
    else alert(accountSubscription.message);
    return;
  }

  sessionCryptoKey = await deriveSessionCryptoKey(employeeName, pin);

  if (account.password && !account.passwordHash) {
    await applySecurePasswordToAccount(account, pin);
    appState.employees[employeeName] = account;
    const registryAdmin = findRegistryAdminByLogin(employeeName);
    if (registryAdmin) {
      registryAdmin.passwordSalt = account.passwordSalt;
      registryAdmin.passwordHash = account.passwordHash;
      registryAdmin.passwordAlgorithm = account.passwordAlgorithm;
      registryAdmin.passwordIterations = account.passwordIterations;
      delete registryAdmin.password;
    }
  } else if (account.passwordHash && account.passwordAlgorithm !== PASSWORD_HASH_ALGORITHM) {
    await applySecurePasswordToAccount(account, pin);
    appState.employees[employeeName] = account;
    const registryAdmin = findRegistryAdminByLogin(employeeName);
    if (registryAdmin) {
      registryAdmin.passwordSalt = account.passwordSalt;
      registryAdmin.passwordHash = account.passwordHash;
      registryAdmin.passwordAlgorithm = account.passwordAlgorithm;
      registryAdmin.passwordIterations = account.passwordIterations;
      delete registryAdmin.password;
    }
  }

  syncCurrentLicenseFromAdminControl(employeeName);
  const syncedAccessBlock = getAccountAccessBlock(employeeName);
  if (syncedAccessBlock.blocked) {
    if (account) {
      account.locked = true;
      account.lockedReason = syncedAccessBlock.message;
      appState.employees[employeeName] = account;
      saveAppState();
    }
    if (onLoginGate) showGateLoginError(syncedAccessBlock.message);
    else alert(syncedAccessBlock.message);
    return;
  }
  if (isBackendConfigured()) {
    try {
      const backendAuthenticated = await backendLoginUser(licenseData.company_id || getSyncCompanyId(), employeeName, pin);
      if (!backendAuthenticated) {
        const message = 'Backend auth haijathibitishwa. Login imesitishwa kwa usalama.';
        if (onLoginGate) showGateLoginError(message);
        else alert(message);
        return;
      }
    } catch (error) {
      const message = error?.message || t('invalidPassword');
      if (onLoginGate) showGateLoginError(message);
      else alert(message);
      return;
    }
  }

  // ===== LICENSE VALIDATION ON LOGIN =====
  const licenseValidation = validateLicenseForLogin(employeeName);
  if (!licenseValidation.valid) {
    showLicenseExpiredScreen();
    return;
  }
  // ========================================
  
  // Set creator_id on first login if not already set
  if (!licenseData.creator_id) {
    licenseData.creator_id = employeeName;
    saveLicenseData();
  }
  
  appState.currentEmployee = employeeName;
  appState.currentRole = role;
  appState.clockInTime = new Date().toISOString();
  appState.employees[appState.currentEmployee] = {
    ...account,
    lastLogin: appState.clockInTime,
    role,
    isOnline: true
  };

  const registryAdmin = findRegistryAdminByLogin(employeeName);
  if (registryAdmin) {
    registryAdmin.lastLogin = appState.clockInTime;
    const devUser = appState.developer?.users?.find(user => user.id === registryAdmin.id);
    if (devUser) devUser.lastLogin = appState.clockInTime;
  }

  addDeveloperAuditLog('login', appState.currentEmployee, appState.currentEmployee, 'User logged in');
  
  $('employeeInput').value = '';
  if (pinInput) pinInput.value = '';
  if ($('gateEmployeeInput')) $('gateEmployeeInput').value = '';
  if (gatePinInput) gatePinInput.value = '';
  $('statusEmployee').textContent = appState.currentEmployee;
  $('statusClockIn').textContent = formatTime(appState.clockInTime);
  $('employeeShort').textContent = appState.currentEmployee.substring(0, 2).toUpperCase();
  updateEmployeeLoginUI();
  updateBusinessHeaderName();
  applyRoleAccess();
  updateLoginGate();
  updatePasswordStatus();
  displayLicenseStatus();
  renderAdminStaffPanel();
  const autoReports = ensureMissingDailyReports();
  
  saveAppState();
  updateDashboard();
  if ((isAdmin() || isSuperAdmin()) && autoReports.length > 0) {
    showNotification(`${autoReports.length} AUTO GENERATED staff report zimepatikana.`);
    sendAutoGeneratedReportPdfs(autoReports);
  }
  resetSessionActivity();
  switchView(getInitialSpaView(canAccessAdminViews() ? 'dashboard' : 'pos'), { replaceState: true });
}

function logoutEmployee() {
  stopSessionSecurityTimers();
  sessionCryptoKey = null;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  if (appState.currentEmployee && appState.employees?.[appState.currentEmployee]) {
    appState.employees[appState.currentEmployee].isOnline = false;
    appState.employees[appState.currentEmployee].lastLogout = new Date().toISOString();
  }
  appState.currentEmployee = null;
  appState.currentRole = 'guest';
  appState.clockInTime = null;
  $('employeeShort').textContent = t('notSet');
  if ($('roleShort')) $('roleShort').textContent = ROLE_LABELS.guest;
  $('statusEmployee').textContent = t('notSet');
  $('statusClockIn').textContent = '-';
  const closedGate = $('closedGate');
  if (closedGate) closedGate.classList.add('hidden');
  updateEmployeeLoginUI();
  updateBusinessHeaderName();
  applyRoleAccess();
  updateLoginGate();
  updatePasswordStatus();
  hidePasswordModal();
  saveAppState();
  renderAdminStaffPanel();
  showNotification(t('logout'));
}

function getSessionTimeoutMs() {
  return SESSION_TIMEOUT_RULES_MS[appState.currentRole] || 0;
}

function getSessionRoleLabel() {
  return ROLE_LABELS[appState.currentRole || 'guest'] || 'User';
}

function initSessionSecurity() {
  const activityEvents = ['mousemove', 'mousedown', 'keydown', 'click', 'scroll', 'wheel', 'touchstart'];
  activityEvents.forEach(eventName => {
    window.addEventListener(eventName, handleSessionActivity, { passive: true });
  });
  if (appState.currentEmployee) resetSessionActivity();
}

function handleSessionActivity() {
  if (!appState.currentEmployee) return;
  const now = Date.now();
  if (now - lastSessionActivityAt < 1000) return;
  lastSessionActivityAt = now;
  resetSessionActivity({ fromUserEvent: true });
}

function resetSessionActivity(options = {}) {
  if (!appState.currentEmployee) {
    stopSessionSecurityTimers();
    return;
  }

  if (options.fromUserEvent && sessionWarningVisible) {
    hideSessionWarning();
  }

  clearTimeout(sessionInactivityTimer);
  const timeoutMs = getSessionTimeoutMs();
  if (!timeoutMs) return;
  sessionInactivityTimer = setTimeout(showSessionWarning, timeoutMs);
}

function stopSessionSecurityTimers() {
  clearTimeout(sessionInactivityTimer);
  clearInterval(sessionCountdownTimer);
  sessionInactivityTimer = null;
  sessionCountdownTimer = null;
  sessionWarningVisible = false;
  $('sessionTimeoutModal')?.classList.add('hidden');
}

function showSessionWarning() {
  if (!appState.currentEmployee) return;
  sessionWarningVisible = true;
  sessionCountdownRemaining = SESSION_WARNING_SECONDS;

  const roleLabel = $('sessionRoleLabel');
  const countdown = $('sessionCountdown');
  const message = $('sessionTimeoutMessage');
  if (roleLabel) roleLabel.textContent = getSessionRoleLabel();
  if (countdown) countdown.textContent = sessionCountdownRemaining;
  if (message) message.textContent = `${t('sessionExpireMessage')} ${sessionCountdownRemaining} ${t('secondsLabel')}`;

  $('sessionTimeoutModal')?.classList.remove('hidden');
  clearInterval(sessionCountdownTimer);
  sessionCountdownTimer = setInterval(() => {
    sessionCountdownRemaining -= 1;
    if (countdown) countdown.textContent = Math.max(sessionCountdownRemaining, 0);
    if (message) message.textContent = `${t('sessionExpireMessage')} ${Math.max(sessionCountdownRemaining, 0)} ${t('secondsLabel')}`;
    if (sessionCountdownRemaining <= 0) {
      sessionAutoLogout('timeout');
    }
  }, 1000);
}

function hideSessionWarning() {
  clearInterval(sessionCountdownTimer);
  sessionCountdownTimer = null;
  sessionWarningVisible = false;
  $('sessionTimeoutModal')?.classList.add('hidden');
}

function autoSaveBeforeSessionLogout() {
  try {
    const draft = {
      employee: appState.currentEmployee,
      role: appState.currentRole,
      savedAt: new Date().toISOString(),
      cart: cart.map(item => ({ ...item })),
      customerName: $('saleCustomerName')?.value || $('calculatorCustomerName')?.value || '',
      comment: $('saleComment')?.value || '',
      activeView: activeViewName
    };
    localStorage.setItem(SESSION_AUTOSAVE_KEY, JSON.stringify(draft));
    saveCurrentViewState();
    saveAppState();
    cacheCurrentStateOffline();
  } catch (error) {
    console.warn('Session autosave failed:', error);
  }
}

function sessionStayLoggedIn() {
  hideSessionWarning();
  resetSessionActivity();
  showNotification('Session imeendelea.');
}

function sessionLogoutNow() {
  sessionAutoLogout('manual');
}

function sessionAutoLogout(reason = 'timeout') {
  autoSaveBeforeSessionLogout();
  hideSessionWarning();
  logoutEmployee();
  if (reason === 'timeout') {
    showNotification('Session imeisha kwa usalama baada ya kutotumika.');
  }
}

function updateEmployeeLoginUI() {
  const isLoggedIn = Boolean(appState.currentEmployee);
  renderEmployeeSelectOptions();
  const employeeInput = $('employeeInput');
  const employeePin = $('employeePin');
  const loginBtn = $('setEmployee');
  const logoutBtn = $('logoutEmployee');

  if (employeeInput) {
    if (employeeInput.tagName === 'SELECT') {
      employeeInput.value = isLoggedIn ? appState.currentEmployee : '';
    }
    employeeInput.disabled = isLoggedIn;
  }
  if (employeePin) {
    employeePin.disabled = isLoggedIn;
    employeePin.classList.toggle('hidden', isLoggedIn);
  }
  if (loginBtn) loginBtn.classList.toggle('hidden', isLoggedIn);
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !isLoggedIn);
  if (!isLoggedIn) {
    if ($('employeeShort')) $('employeeShort').textContent = t('notSet');
    if ($('statusEmployee')) $('statusEmployee').textContent = t('notSet');
    if ($('gateEmployeeInput')) $('gateEmployeeInput').value = '';
    if ($('gateEmployeePin')) $('gateEmployeePin').value = '';
    clearGateLoginError();
    hideLicenseExpiredScreen();
    updateLoginLicenseBanner();
  }
  if ($('roleShort')) {
    $('roleShort').textContent = ROLE_LABELS[appState.currentRole || 'guest'] || ROLE_LABELS.guest;
  }
  updateBusinessHeaderName();
}

function renderEmployeeSelectOptions() {
  const select = $('employeeInput');
  if (!select || select.tagName !== 'SELECT') return;
  const currentValue = select.value;
  const admins = getAdminEmployees();
  const users = getAllowedEmployees()
    .filter(employeeName => ![ADMIN_ACCOUNT, ...admins].includes(employeeName))
    .filter(employeeName => !appState.employees?.[employeeName]?.removed);

  select.innerHTML = [
    `<option value="">${t('employeePlaceholder')}</option>`,
    `<option value="${ADMIN_ACCOUNT}">1. Developer - ${ADMIN_ACCOUNT}</option>`,
    ...admins.map((admin, index) => {
      const businessName = getBusinessDisplayNameForEmployee(admin);
      return `<option value="${escapeHtml(admin)}">${index + 2}. ${escapeHtml(admin)} - ${escapeHtml(businessName)}</option>`;
    }),
    ...users.map(user => `<option value="${escapeHtml(user)}">${escapeHtml(user)} - User</option>`)
  ].join('');
  if (currentValue && [...select.options].some(option => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function isAdmin() {
  return appState.currentRole === 'admin';
}

function isSuperAdmin() {
  return appState.currentRole === 'super_admin';
}

function canAccessAdminViews() {
  return ['super_admin', 'admin'].includes(appState.currentRole);
}

function canAccessDeveloperPanel() {
  return isSuperAdmin();
}

function canAccessView(viewName) {
  if (viewName === 'developer') return canAccessDeveloperPanel();
  if (viewName === 'customers') return ['super_admin', 'admin', 'user'].includes(appState.currentRole);
  const adminViews = ['dashboard', 'inventory', 'analytics', 'reports', 'history', 'settings'];
  if (adminViews.includes(viewName)) return canAccessAdminViews();
  return ['pos', 'orders', 'password'].includes(viewName);
}

function isStaffClosedTime(date = new Date()) {
  const hour = date.getHours();
  return hour >= STAFF_LOCK_START_HOUR || hour < STAFF_LOCK_END_HOUR;
}

function isStaffLockedNow() {
  return appState.currentRole === 'user' && isStaffClosedTime();
}

function applyRoleAccess() {
  const adminViewAllowed = canAccessAdminViews();
  const developerAllowed = canAccessDeveloperPanel();
  const userAllowed = appState.currentRole === 'user';
  document.querySelectorAll('[data-admin-only="true"], .boss-only').forEach(element => {
    element.classList.toggle('hidden', !adminViewAllowed);
  });
  document.querySelectorAll('[data-super-admin-only="true"]').forEach(element => {
    element.classList.toggle('hidden', !developerAllowed);
  });
  document.querySelectorAll('[data-user-only="true"]').forEach(element => {
    element.classList.toggle('hidden', !userAllowed);
  });

  document.querySelectorAll('.action-btn').forEach(button => {
    const target = button.getAttribute('onclick') || '';
    if (target.includes('inventory') || target.includes('reports') || target.includes('openExportMenu')) {
      button.classList.toggle('hidden', !adminViewAllowed);
    }
  });

  const activeView = document.querySelector('.view-section.active')?.id;
  if (activeView && !canAccessView(activeView)) {
    switchView('pos');
  }
}

function updateLoginGate() {
  const gate = $('loginGate');
  const signupGate = $('signupGate');
  const closedGate = $('closedGate');
  const expiredGate = $('licenseExpiredGate');
  const app = $('app');
  const loggedIn = Boolean(appState.currentEmployee);
  const staffLocked = loggedIn && isStaffLockedNow();
  const expiredVisible = expiredGate && !expiredGate.classList.contains('hidden');
  const signupVisible = signupGate && !signupGate.classList.contains('hidden');

  if (gate) gate.classList.toggle('hidden', loggedIn || expiredVisible || signupVisible);
  if (signupGate && loggedIn) signupGate.classList.add('hidden');
  if (expiredGate && loggedIn) expiredGate.classList.add('hidden');
  if (closedGate) closedGate.classList.toggle('hidden', !staffLocked);
  if (app) app.classList.toggle('hidden', !loggedIn || staffLocked);

  if (!loggedIn) updateLoginLicenseBanner();
}

function t(key) {
  const language = appState.settings?.language || 'sw';
  return TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;
}

function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    element.title = t(element.dataset.i18nTitle);
  });

  const setText = (selector, key) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = t(key);
  };
  const setAllText = (selector, keys) => {
    document.querySelectorAll(selector).forEach((element, index) => {
      if (keys[index]) element.textContent = t(keys[index]);
    });
  };
  const setPlaceholder = (selector, key) => {
    const element = document.querySelector(selector);
    if (element) element.placeholder = t(key);
  };
  const setSelectOptionText = (selector, valueMap) => {
    const select = document.querySelector(selector);
    if (!select) return;
    Object.entries(valueMap).forEach(([value, key]) => {
      const option = [...select.options].find(item => item.value === value);
      if (option) option.textContent = t(key);
    });
  };
  const setTextBeforeChild = (selector, key) => {
    const element = document.querySelector(selector);
    if (element?.firstChild) element.firstChild.textContent = `${t(key)} `;
  };

  document.title = `MO SaaS - ${t('businessManagement')}`;
  setText('.brand-sub', 'businessManagement');
  setAllText('.nav-label', ['dashboard', 'pointOfSale', 'orders', 'password', 'customers', 'inventory', 'analytics', 'reports', 'history', 'settings']);
  setAllText('.sidebar-footer .status-label', ['date', 'employee', 'status']);
  setText('#workStatus', 'active');
  setText('.dashboard-header h2', 'todaysSummary');
  setAllText('.kpi-label', ['totalRevenue', 'itemsSold', 'transactions', 'lowStockItems', 'netProfit', 'dailyExpenses', 'totalStockValue', 'itemsSold']);
  setText('#dashboard .sales-overview-card h3', 'salesOverview');
  setAllText('#dashboard .chart-controls .btn-small', ['daily', 'weekly', 'monthly']);
  setAllText('#dashboard .card-header h3', ['salesOverview', 'bestSellingProducts', 'availableProducts', 'lowStockAlert', 'recentTransactions', 'quickActions', 'workStatus']);
  setAllText('#dashboard .view-link', ['viewAll', 'viewAll']);
  setAllText('.quick-actions .action-btn span:last-child', ['newSale', 'checkStock', 'generateReport', 'exportData']);
  setAllText('.status-panel .status-row span', ['currentEmployee', 'clockInTime', 'salesToday']);
  setText('#toggleWorkStatus', 'clockOut');
  setText('#pos .section-header h2', 'products');
  setText('.business-calculator-header h3', 'smartPriceCalculator');
  setText('.business-calculator-header p', 'smartPriceHint');
  setAllText('.business-calculator .form-group label', ['productService', 'customerName', 'calculationType', 'width', 'height', 'quantity', 'customPrice']);
  setText('.business-calculator > .btn', 'addCalculatedItem');
  setText('.cart-header h3', 'shoppingCart');
  setAllText('.cart-summary .summary-row span', ['subtotal', 'total']);
  setText('label[for="saleComment"]', 'notesOptional');
  setText('label[for="saleCustomerName"]', 'customerName');
  setText('label[for="saleCustomerPhone"]', 'customerPhone');
  setText('label[for="salePaidAmount"]', 'paidAmount');
  setText('label[for="salePaymentStatus"]', 'payment');
  setText('#clearCartBtn', 'clearCart');
  setText('#saveOrderBtn', 'saveOrder');
  setText('#finalizeSaleBtn', 'saveSale');
  setText('#receiptPreviewBtn', 'receiptWhatsApp');
  setSelectOptionText('#salePaymentStatus', { paid: 'paid', partial: 'partial', credit: 'credit' });
  setSelectOptionText('#orderPaymentFilter', { '': 'allPayments', paid: 'paid', unpaid: 'unpaid' });
  setSelectOptionText('#orderStatusFilter', { '': 'allStatuses', pending: 'pending', in_progress: 'inProgress', ready: 'ready', delivered: 'delivered' });
  setText('.staff-sales-panel > .card > .card-header h3', 'mySalesToday');
  setText('#customers .section-header h2', 'customerManagement');
  setText('#inventory .section-header h2', 'productInventory');
  setText('#inventory .inventory-controls .btn', 'addProduct');
  setAllText('.inventory-stats .stat-label', ['totalProducts', 'totalStockValue', 'lowStockItems', 'outOfStock']);
  setAllText('.inventory-table th', ['productName', 'sku', 'price', 'costPrice', 'profitPerItem', 'stock', 'status', 'actions']);
  setText('#analytics .section-header h2', 'analyticsInsights');
  setAllText('#analytics .card-header h3', ['salesTrend', 'productPerformance', 'revenueAnalytics', 'categoryDistribution']);
  setText('#reports .section-header h2', 'dailyBossReports');
  setAllText('#reports .card-header h3', ['dailySalesReport', 'weeklySalesReport', 'monthlySalesReport', 'employeeComments']);
  setAllText('#reports .report-actions .btn-primary', ['sendWhatsApp', 'sendWhatsApp', 'sendWhatsApp']);
  setAllText('#reports .report-actions .btn-secondary', ['exportPdf', 'exportPdf', 'exportPdf']);
  setText('#reports .comments-section + div .btn', 'addComment');
  setText('#history .section-header h2', 'salesHistory');
  setText('#history .history-controls .btn', 'reset');
  setAllText('.history-table th', ['employee', 'sales', 'items', 'total', 'lastSale']);
  setText('#settings .section-header h2', 'settings');
  setAllText('#settings .card:first-child .form-group label', ['businessName', 'bossPhone', 'closingTime', 'dailyBackupTime', 'language', 'theme']);
  setText('#settings .card:first-child > .btn', 'saveSettings');
  setAllText('#settings .card h3', ['businessSettings', 'adminStaffManagement', 'dataManagement', 'subscriptionLicense', 'aboutSystem']);
  setAllText('#settings .card:nth-child(3) .form-group label', ['exportData', 'backupRestore', 'resetSystem']);
  setAllText('#settings .card:nth-child(3) .btn-secondary', ['exportAllData', 'exportSalesReport', 'chooseBackupFolder', 'backupNow', 'restoreBackup']);
  setText('#settings .card:nth-child(3) .btn-danger', 'clearAllData');
  setText('#settings .about-system-card p', 'aboutText');
  setText('#sessionTimeoutTitle', 'sessionSecurity');
  setText('.session-timeout-hint', 'sessionTimeoutHint');
  setText('.session-timeout-actions .btn-secondary', 'logoutNow');
  setText('.session-timeout-actions .btn-primary', 'stayLoggedIn');
  setText('#productModal .modal-header h2', 'addNewProduct');
  setAllText('#productModal .form-group label', ['productName', 'sku', 'price', 'costPrice', 'stock', 'stockType', 'category']);
  setAllText('#productModal .modal-footer .btn', ['cancel', 'addProduct']);
  setText('#exportModal .modal-header h2', 'exportData');
  setAllText('#exportModal .export-option', ['exportCsv', 'exportJson', 'printReport']);
  setText('.closing-banner strong', 'closingReminder');
  setTextBeforeChild('.closing-banner .alert-text p:nth-of-type(1)', 'closingTimeLabel');
  setTextBeforeChild('.closing-banner .alert-text p:nth-of-type(2)', 'timeRemaining');
  setPlaceholder('#searchProducts', 'searchProductsPlaceholder');
  setPlaceholder('#searchInventory', 'searchProductsPlaceholder');
  setPlaceholder('#saleComment', 'addNotesPlaceholder');
  setPlaceholder('#saleCustomerName', 'customerNamePlaceholder');
  setPlaceholder('#saleCustomerPhone', 'customerPhonePlaceholder');
  setPlaceholder('#calculatorCustomerName', 'customerNamePlaceholder');
  setPlaceholder('#bossCommentInput', 'bossCommentPlaceholder');
  setPlaceholder('#businessName', 'enterBusinessName');
  setPlaceholder('#bossPhone', 'enterPhoneNumber');
  setPlaceholder('#modalProductName', 'enterProductName');
  setPlaceholder('#modalProductSku', 'enterSku');
  setPlaceholder('#modalProductPrice', 'enterPrice');
  setPlaceholder('#modalProductCostPrice', 'enterPrice');
  setPlaceholder('#modalProductStock', 'enterQuantity');
  setPlaceholder('#modalProductCategory', 'enterCategory');

  const employeeSelect = $('employeeInput');
  if (employeeSelect?.options?.[0]) {
    employeeSelect.options[0].textContent = t('employeePlaceholder');
  }

  ['headerThemeSelect', 'themeSelect'].forEach(id => {
    const select = $(id);
    if (!select) return;
    const darkOption = select.querySelector('option[value="dark"]');
    const lightOption = select.querySelector('option[value="light"]');
    if (darkOption) darkOption.textContent = t('dark');
    if (lightOption) lightOption.textContent = t('light');
  });
  updateModernSelects();

  const pinInput = $('employeePin');
  if (pinInput) pinInput.placeholder = t('passwordPlaceholder');

  setText('#loginGateSubtitle', 'loginGateSubtitle');
  setText('#loginGateHint', 'loginGateHint');
  setText('label[for="gateEmployeeInput"]', 'loginNameLabel');
  setText('label[for="gateEmployeePin"]', 'passwordPlaceholder');
  setPlaceholder('#gateEmployeeInput', 'loginNamePlaceholder');
  setPlaceholder('#gateEmployeePin', 'passwordPlaceholder');
  setText('#signupPlansHeading', 'signupPlansHeading');
  setText('#signupVerifyHeading', 'signupVerifyHeading');
  setText('#signupCaptchaLabel', 'signupCaptchaLabel');
  setText('#signupSmsLabel', 'signupSmsLabel');
  setText('#signupSmsHint', 'signupSmsHint');
  setText('#signupSendOtpBtn', 'signupSendOtp');
  setText('#signupPaymentHeading', 'signupPaymentHeading');
  setText('#signupPaymentHint', 'signupPaymentHint');
  setPlaceholder('#signupCaptchaAnswer', 'signupCaptchaRequired');
  setPlaceholder('#signupOtpCode', 'signupOtpRequired');
  const paymentRef = $('signupPaymentReference');
  if (paymentRef) paymentRef.placeholder = t('signupPaymentRefRequired');
  const paymentOptions = document.querySelectorAll('input[name="signupPaymentMethod"]');
  if (paymentOptions[0]?.nextElementSibling) paymentOptions[0].nextElementSibling.textContent = t('paymentMethodBank');
  if (paymentOptions[1]?.nextElementSibling) paymentOptions[1].nextElementSibling.textContent = t('paymentMethodNetworks');
  updateLicenseExpiredScreenContent();
  renderSignupPlanCards();
  updateLoginLicenseBanner();
  updateLicenseSettingsDisplay();
  updateInstallAppButton();

  setText('#signupTitle', 'signupTitle');
  setText('#signupSubtitle', 'signupSubtitle');
  setText('#signupFullNameLabel', 'loginNameLabel');
  setText('#signupBusinessNameLabel', 'businessName');
  setText('#signupEmailLabel', 'signupEmailLabel');
  setText('#signupPhoneLabel', 'signupPhoneLabel');
  setText('#signupPasswordLabel', 'passwordPlaceholder');
  setText('#signupPasswordConfirmLabel', 'signupConfirmPasswordLabel');
  setText('#signupContactHint', 'signupContactRequired');
  setText('#signupSubmitText', 'signupSubmit');
  setText('#showSignupBtn', 'showSignupLink');
  setText('#showLoginFromSignupBtn', 'backToLoginLink');
  const signupSwitch = document.querySelector('#signupGate .auth-switch');
  if (signupSwitch) {
    signupSwitch.childNodes[0].textContent = `${t('haveAccount')} `;
  }
  const loginSwitch = document.querySelector('#loginGate .auth-switch');
  if (loginSwitch) {
    loginSwitch.childNodes[0].textContent = `${t('noAdminAccount')} `;
  }

  if (document.querySelector('#orders.view-section.active')) {
    renderOrdersBoard();
  }
  if (!$('receiptModal')?.classList.contains('hidden') && getLastReceipt()) {
    $('receiptContent').innerHTML = renderReceiptHtml(getLastReceipt());
  }
}

function applyTheme() {
  document.body.classList.toggle('light-mode', appState.settings?.theme === 'light');
}

// ==========================================
// PRODUCT MANAGEMENT
// ==========================================

function getProductOwnerAdminForEmployee(employeeName = appState.currentEmployee) {
  if (!employeeName) return null;
  const role = getDefaultRoleForEmployee(employeeName);
  if (role === 'admin') return employeeName;
  if (role === 'user') return getOwnerAdminForUser(employeeName) || appState.employees?.[employeeName]?.ownerAdmin || null;
  return null;
}

function isProductVisibleToCurrentAccount(product) {
  if (!product) return false;
  if (isSuperAdmin()) return true;
  const ownerAdmin = getProductOwnerAdminForEmployee();
  if (!product.ownerAdmin) return true;
  return Boolean(ownerAdmin && product.ownerAdmin === ownerAdmin);
}

function getVisibleProducts() {
  return (appState.products || []).filter(isProductVisibleToCurrentAccount);
}

function findVisibleProduct(productId) {
  return getVisibleProducts().find(product => product.id === productId) || null;
}

function renderProductsGrid() {
  const grid = $('productsGrid');
  grid.innerHTML = '';
  
  getVisibleProducts().forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
  const isService = product.itemType === 'service' || product.stockType === 'service' || product.category === 'service';
    
    if (!isService && product.stock === 0) {
      card.classList.add('out-stock');
    } else if (!isService && product.stock <= appState.settings.lowStockThreshold) {
      card.classList.add('low-stock');
    }

    const unitLabel = product.unitType || (isService ? 'meter' : 'piece');
    const stockLabel = isService ? `Service - ${unitLabel}` : `${t('stock')}: ${product.stock}`;
    const actionLabel = isService || product.priceMode === 'area' ? 'Calculate' : t('addToCart');
    const productId = escapeJsString(product.id);
    const action = isService || product.priceMode === 'area'
      ? `selectCalculatorItem('${productId}')`
      : `addToCart('${productId}')`;
    
    card.innerHTML = `
      <div class="product-card-name">${escapeHtml(product.name)}</div>
      <div class="product-card-price">${formatCurrency(product.price)}</div>
      <div class="product-card-stock">
        <span>${escapeHtml(stockLabel)}</span>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:8px;" 
              onclick="${action}"
              ${!isService && product.stock === 0 ? 'disabled' : ''}>
        ${actionLabel}
      </button>
    `;
    
    grid.appendChild(card);
  });
}

function renderInventoryTable() {
  const tbody = $('inventoryTableBody');
  tbody.innerHTML = '';
  
  getVisibleProducts().forEach(product => {
    const isService = product.itemType === 'service' || product.stockType === 'service' || product.category === 'service';
    let status = t('inStock');
    let statusClass = 'in-stock';
    
    if (isService) {
      status = 'Service';
      statusClass = 'in-stock';
    } else if (product.stock === 0) {
      status = t('outOfStock');
      statusClass = 'out-of-stock';
    } else if (product.stock <= appState.settings.lowStockThreshold) {
      status = t('lowStock');
      statusClass = 'low-stock';
    }
    
    const row = document.createElement('tr');
    const productId = escapeJsString(product.id);
    row.innerHTML = `
      <td>${escapeHtml(product.name)}</td>
      <td>${escapeHtml(product.sku)}</td>
      <td>${formatCurrency(product.price)}</td>
      <td>${formatCurrency(getProductCost(product, product.price))}</td>
      <td>${formatCurrency(product.price - getProductCost(product, product.price))}</td>
      <td>${escapeHtml(isService ? product.unitType || 'meter' : product.stock)}</td>
      <td><span class="stock-status ${statusClass}">${status}</span></td>
      <td>
        <div class="action-buttons">
          <button class="action-btn ${isService ? 'hidden' : ''}" onclick="openAddStockModal('${productId}')">${t('addStock')}</button>
          <button class="action-btn" onclick="editProduct('${productId}')">${t('edit')}</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  updateInventoryStats();
}

function updateInventoryStats() {
  const products = getVisibleProducts();
  const stats = {
    total: products.length,
    stockValue: products.reduce((sum, p) => sum + (getProductCost(p, p.price) * Number(p.stock || 0)), 0),
    lowStock: products.filter(p => p.itemType !== 'service' && p.stock > 0 && p.stock <= appState.settings.lowStockThreshold).length,
    outOfStock: products.filter(p => p.itemType !== 'service' && p.stock === 0).length
  };
  
  $('statTotalProducts').textContent = stats.total;
  $('statStockValue').textContent = formatCurrency(stats.stockValue);
  $('statLowStock').textContent = stats.lowStock;
  $('statOutOfStock').textContent = stats.outOfStock;
}

function openAddProductModal() {
  editingProductId = null;
  const title = document.querySelector('#productModal .modal-header h2');
  const saveButton = document.querySelector('#productModal .modal-footer .btn-primary');
  if (title) title.textContent = 'Add New Product';
  if (saveButton) saveButton.textContent = 'Add Product';
  $('modalProductName').value = '';
  $('modalProductSku').value = '';
  $('modalProductPrice').value = '';
  $('modalProductCostPrice').value = '';
  $('modalProductStock').value = '';
  if ($('modalProductStockType')) $('modalProductStockType').value = 'product';
  $('modalProductCategory').value = '';
  $('productModal').classList.remove('hidden');
}

function closeProductModal() {
  editingProductId = null;
  $('productModal').classList.add('hidden');
}

function saveProduct() {
  const name = $('modalProductName').value.trim();
  const sku = $('modalProductSku').value.trim();
  const price = parseFloat($('modalProductPrice').value);
  const costPrice = parseFloat($('modalProductCostPrice').value);
  const stock = parseInt($('modalProductStock').value, 10);
  const stockType = $('modalProductStockType')?.value || 'product';

  const showProductFieldError = (message, fieldId) => {
    alert(message);
    $(fieldId)?.focus();
  };

  if (!name) {
    alert(t('enterProductName'));
    $('modalProductName')?.focus();
    return;
  }
  if (!sku) {
    showProductFieldError(t('enterSku'), 'modalProductSku');
    return;
  }
  if (isNaN(price) || price <= 0) {
    showProductFieldError(t('enterPrice'), 'modalProductPrice');
    return;
  }
  if (isNaN(costPrice) || costPrice < 0) {
    showProductFieldError(
      appState.settings?.language === 'en' ? 'Enter valid cost price' : 'Weka bei halali ya kununulia/cost price',
      'modalProductCostPrice'
    );
    return;
  }
  if (stockType !== 'service' && (isNaN(stock) || stock < 0)) {
    showProductFieldError(t('enterQuantity'), 'modalProductStock');
    return;
  }

  if (costPrice > price && !confirm('Cost price ni kubwa kuliko bei ya kuuza. Endelea?')) {
    return;
  }
  
  const ownerAdmin = getProductOwnerAdminForEmployee();
  const duplicateSku = getVisibleProducts().find(product => (
    product.id !== editingProductId
    && String(product.sku || '').toLowerCase() === sku.toLowerCase()
  ));
  if (duplicateSku) {
    alert('SKU tayari ipo kwa biashara hii.');
    return;
  }

  const productData = {
    name,
    sku,
    price,
    costPrice,
    stock: stockType === 'service' ? null : stock,
    category: $('modalProductCategory').value.trim() || 'General',
    itemType: stockType === 'service' ? 'service' : 'product',
    stockType,
    unitType: 'piece',
    priceMode: 'quantity',
    ...(ownerAdmin ? { ownerAdmin } : {})
  };

  const existingProduct = appState.products.find(product => product.id === editingProductId);
  if (existingProduct) {
    productData.itemType = existingProduct.itemType || productData.itemType;
    productData.unitType = existingProduct.unitType || productData.unitType;
    productData.priceMode = existingProduct.priceMode || productData.priceMode;
    productData.ownerAdmin = existingProduct.ownerAdmin || productData.ownerAdmin;
    if (productData.itemType === 'service') productData.stock = null;
  }
  const baseUpdatedAt = existingProduct?.serverUpdatedAt || existingProduct?.updatedAt || null;
  if (existingProduct) {
    Object.assign(existingProduct, productData, { updatedAt: new Date().toISOString() });
    queueOfflineChangeSafe('product', 'upsert', existingProduct, baseUpdatedAt);
  } else {
    const newProduct = {
      id: `p${Date.now()}`,
      ...productData,
      updatedAt: new Date().toISOString()
    };
    appState.products.push(newProduct);
    queueOfflineChangeSafe('product', 'upsert', newProduct);
  }
  
  saveAppState();
  renderInventoryTable();
  renderProductsGrid();
  updateDashboard();
  closeProductModal();
  showNotification(existingProduct ? t('edit') : t('addProduct'));
}

function openAddStockModal(productId) {
  const product = findVisibleProduct(productId);
  if (!product) return;
  
  const quantity = prompt(`${t('addStock')}: ${product.name}. ${t('stock')}: ${product.stock}`, '');
  if (quantity === null) return;
  
  const addQty = parseInt(quantity);
  if (isNaN(addQty) || addQty <= 0) {
    alert(t('enterQuantity'));
    return;
  }
  
  const baseUpdatedAt = product.serverUpdatedAt || product.updatedAt || null;
  product.stock += addQty;
  product.updatedAt = new Date().toISOString();
  queueOfflineChangeSafe('product', 'upsert', product, baseUpdatedAt);
  saveAppState();
  renderInventoryTable();
  renderProductsGrid();
  updateDashboard();
  showNotification(`${t('stock')}: ${product.stock}`);
}

function editProduct(productId) {
  const product = findVisibleProduct(productId);
  if (!product) return;

  editingProductId = productId;
  const title = document.querySelector('#productModal .modal-header h2');
  const saveButton = document.querySelector('#productModal .modal-footer .btn-primary');
  if (title) title.textContent = 'Edit Product';
  if (saveButton) saveButton.textContent = 'Save Product';
  $('modalProductName').value = product.name;
  $('modalProductSku').value = product.sku;
  $('modalProductPrice').value = product.price;
  $('modalProductCostPrice').value = getProductCost(product, product.price);
  $('modalProductStock').value = product.stock;
  if ($('modalProductStockType')) $('modalProductStockType').value = product.stockType || product.itemType || 'product';
  $('modalProductCategory').value = product.category || '';
  $('productModal').classList.remove('hidden');
}

// ==========================================
// SMART UNIT CALCULATION ENGINE
// ==========================================

const UNIT_TO_BASE = {
  m: { dimension: 'length', factor: 1 },
  meter: { dimension: 'length', factor: 1 },
  meters: { dimension: 'length', factor: 1 },
  cm: { dimension: 'length', factor: 0.01 },
  inch: { dimension: 'length', factor: 0.0254 },
  in: { dimension: 'length', factor: 0.0254 },
  kg: { dimension: 'weight', factor: 1 },
  l: { dimension: 'volume', factor: 1 },
  liter: { dimension: 'volume', factor: 1 },
  litre: { dimension: 'volume', factor: 1 },
  piece: { dimension: 'quantity', factor: 1 },
  pcs: { dimension: 'quantity', factor: 1 },
  picture: { dimension: 'quantity', factor: 1 }
};

function parseUnitValue(input, fallbackUnit = 'piece') {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return 0;
  const matches = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*(cm|meter|meters|m|inch|in|kg|l|liter|litre|pcs|piece|picture)?/g)];
  if (matches.length === 0) return Number(raw) || 0;

  return matches.reduce((sum, match) => {
    const value = Number(match[1] || 0);
    const unit = match[2] || fallbackUnit;
    const meta = UNIT_TO_BASE[unit] || UNIT_TO_BASE[fallbackUnit] || UNIT_TO_BASE.piece;
    return sum + (value * meta.factor);
  }, 0);
}

function getCalculatorItem() {
  const selectedId = $('calculatorItemSelect')?.value;
  return findVisibleProduct(selectedId);
}

function calculateSmartPrice() {
  const item = getCalculatorItem();
  if (!item) return { item: null, quantity: 0, total: 0, measurementText: '' };

  const mode = $('calculatorMode')?.value || item.priceMode || 'quantity';
  const widthUnit = $('calculatorWidthUnit')?.value || 'cm';
  const heightUnit = $('calculatorHeightUnit')?.value || 'cm';
  const quantity = Math.max(1, parseUnitValue($('calculatorQuantity')?.value || '1', 'piece'));
  const widthInput = $('calculatorWidth')?.value || '';
  const heightInput = $('calculatorHeight')?.value || '';
  const widthM = parseUnitValue(widthInput, widthUnit);
  const heightM = parseUnitValue(heightInput, heightUnit);
  const areaM2 = widthM > 0 && heightM > 0 ? widthM * heightM : 0;
  const lengthM = widthM > 0 ? widthM : heightM;
  const customPrice = Number($('calculatorCustomPrice')?.value || 0);
  const hasDesignAddon = Boolean($('calculatorDesignFee')?.checked);
  const designAddonTotal = hasDesignAddon ? DESIGN_ADDON_PRICE : 0;
  const chargeUnits = mode === 'area'
    ? areaM2 * quantity
    : mode === 'length'
      ? lengthM * quantity
      : quantity;
  const basePrice = mode === 'custom' && customPrice > 0 ? customPrice : Number(item.price || 0);
  const subtotal = mode === 'custom'
    ? Math.round((basePrice * quantity) * 100) / 100
    : Math.round((chargeUnits * basePrice) * 100) / 100;
  const total = subtotal + designAddonTotal;
  const priceText = formatCurrency(basePrice || 0);
  const baseMeasurementText = mode === 'area'
    ? `${formatDimensionForFormula(widthInput, widthUnit, widthM)} x ${formatDimensionForFormula(heightInput, heightUnit, heightM)} = ${areaM2.toFixed(2)} m2 x ${priceText}${quantity > 1 ? ` x ${quantity}` : ''} = ${formatCurrency(subtotal)}`
    : mode === 'length'
      ? `${formatDimensionForFormula(widthInput || heightInput, widthInput ? widthUnit : heightUnit, lengthM)} = ${lengthM.toFixed(2)} m x ${priceText}${quantity > 1 ? ` x ${quantity}` : ''} = ${formatCurrency(subtotal)}`
      : mode === 'custom'
        ? `Bei maalum ${priceText}${quantity > 1 ? ` x ${quantity}` : ''} = ${formatCurrency(subtotal)}`
        : `${quantity} ${item.unitType || 'piece'} x ${priceText} = ${formatCurrency(subtotal)}`;
  const measurementText = hasDesignAddon
    ? `${baseMeasurementText} + Design ${formatCurrency(DESIGN_ADDON_PRICE)} = ${formatCurrency(total)}`
    : baseMeasurementText;

  return { item, mode, quantity, widthM, heightM, areaM2, lengthM, chargeUnits, subtotal, designAddonTotal, hasDesignAddon, total, measurementText, basePrice };
}

function formatMeasurement(valueM) {
  if (!valueM) return '0 m';
  if (valueM < 1) return `${Math.round(valueM * 100)} cm`;
  return `${valueM.toFixed(2).replace(/\.00$/, '')} m`;
}

function formatDimensionForFormula(rawValue, unit, valueM) {
  const raw = String(rawValue || '').trim();
  if (!raw) return formatMeasurement(valueM);
  if (/[a-z]/i.test(raw)) return raw;
  return `${raw} ${unit}`;
}

function renderCalculatorOptions() {
  const select = $('calculatorItemSelect');
  if (!select) return;
  const previous = select.value;
  const products = getVisibleProducts();
  select.innerHTML = products
    .map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} - ${formatCurrency(product.price)} / ${escapeHtml(product.unitType || 'piece')}</option>`)
    .join('');
  const menu = $('calculatorItemMenu');
  if (menu) {
    menu.innerHTML = products
      .map(product => `<button type="button" class="modern-select-option" data-value="${escapeHtml(product.id)}">${escapeHtml(product.name)} <span>${formatCurrency(product.price)}</span></button>`)
      .join('');
  }
  if (previous && products.some(product => product.id === previous)) select.value = previous;
  updateModernSelects();
}

function updateCalculatorPreview() {
  const result = calculateSmartPrice();
  if ($('calculatorLiveTotal')) $('calculatorLiveTotal').textContent = formatCurrency(result.total || 0);
  if ($('calculatorBreakdown')) {
    $('calculatorBreakdown').textContent = result.item
      ? `${result.item.name}: ${result.measurementText}`
      : 'Select an item to calculate price.';
  }
}

function selectCalculatorItem(productId) {
  const item = findVisibleProduct(productId);
  if (!item) return;
  if ($('calculatorItemSelect')) $('calculatorItemSelect').value = productId;
  if ($('calculatorMode') && item) {
    $('calculatorMode').value = item.priceMode === 'area' || item.itemType === 'service' ? 'area' : 'quantity';
  }
  updateCalculatorPreview();
  updateModernSelects();
  $('calculatorWidth')?.focus();
}

function addCalculatedItemToCart() {
  const result = calculateSmartPrice();
  if (!result.item) {
    alert('Select product or service first');
    return;
  }
  if (result.subtotal <= 0) {
    alert('Enter valid measurements or quantity');
    return;
  }

  const cartId = `${result.item.id}_${Date.now()}`;
  cart.push({
    ...result.item,
    id: cartId,
    productId: result.item.id,
    sourceProductId: result.item.id,
    qty: 1,
    quantityUnits: result.chargeUnits,
    price: result.total,
    unitPrice: result.basePrice || result.item.price,
    measurement: {
      text: result.measurementText,
      widthM: result.widthM || 0,
      heightM: result.heightM || 0,
      areaM2: result.areaM2 || 0,
      lengthM: result.lengthM || 0,
      mode: result.mode,
      quantity: result.quantity,
      designAddon: result.hasDesignAddon ? result.designAddonTotal : 0,
      unitType: result.item.unitType || 'piece'
    }
  });

  if ($('saleCustomerName') && $('calculatorCustomerName')?.value) {
    $('saleCustomerName').value = $('calculatorCustomerName').value.trim();
  }
  renderCart();
  showNotification(`${result.item.name} - calculated`);
}

// ==========================================
// CART & SALES MANAGEMENT
// ==========================================

function addToCart(productId) {
  if (isStaffLockedNow()) {
    updateLoginGate();
    return;
  }

  const product = findVisibleProduct(productId);
  const isService = product?.itemType === 'service' || product?.category === 'service';
  
  if (!product || (!isService && product.stock <= 0)) {
    alert(t('outOfStock'));
    return;
  }
  
  const existingItem = cart.find(item => item.id === productId);
  
  if (existingItem) {
    if (isService || existingItem.qty < product.stock) {
      existingItem.qty++;
    } else {
      alert(t('lowStock'));
      return;
    }
  } else {
    cart.push({
      ...product,
      productId: product.id,
      qty: 1
    });
  }
  
  renderCart();
  showNotification(`${product.name} - ${t('addToCart')}`);
}

function addCustomProductToCart() {
  if (isStaffLockedNow()) {
    updateLoginGate();
    return;
  }

  const name = $('saleProductName')?.value.trim();
  const price = Number($('saleProductPrice')?.value || 0);
  const qty = Number($('saleProductQty')?.value || 1);

  if (!name) {
    alert('Tafadhali andika jina la bidhaa');
    return;
  }
  if (!Number.isFinite(price) || price <= 0) {
    alert('Tafadhali weka bei sahihi ya bidhaa');
    return;
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    alert('Tafadhali weka kiasi cha bidhaa');
    return;
  }

  const existingItem = cart.find(item => item.isCustom && item.name === name && item.price === price);
  if (existingItem) {
    existingItem.qty += qty;
  } else {
    cart.push({
      id: `custom_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name,
      price,
      qty,
      productId: null,
      itemType: 'product',
      unitType: 'piece',
      measurement: null,
      isCustom: true
    });
  }

  if ($('saleProductName')) $('saleProductName').value = '';
  if ($('saleProductPrice')) $('saleProductPrice').value = '';
  if ($('saleProductQty')) $('saleProductQty').value = '1';
  renderCart();
  showNotification(`${name} - ${t('addToCart')}`);
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  renderCart();
}

function updateCartItemQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(productId);
  } else {
    renderCart();
  }
}

function renderCart() {
  const cartItems = $('cartItems');
  cartItems.innerHTML = '';
  
  if (cart.length === 0) {
    cartItems.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">${t('cartEmpty')}</div>`;
  } else {
    cart.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item';
      const itemId = escapeJsString(item.id);
      itemEl.innerHTML = `
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-qty">${escapeHtml(item.measurement?.text || `Qty: ${item.qty}`)}</div>
        </div>
        <div class="cart-item-price">${formatCurrency(item.price * item.qty)}</div>
        <div class="cart-item-actions">
          <button class="cart-item-btn" onclick="updateCartItemQty('${itemId}', -1)">−</button>
          <button class="cart-item-btn" onclick="removeFromCart('${itemId}')">✕</button>
          <button class="cart-item-btn" onclick="updateCartItemQty('${itemId}', 1)">+</button>
        </div>
      `;
      cartItems.appendChild(itemEl);
    });
  }
  
  updateCartSummary();
  if ($('receiptPreviewBtn')) $('receiptPreviewBtn').disabled = !getLastReceipt();
}

function updateCartSummary() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  $('cartCount').textContent = cart.reduce((sum, item) => sum + item.qty, 0);
  $('cartSubtotal').textContent = formatCurrency(subtotal);
  $('cartTotal').textContent = formatCurrency(subtotal);
  if ($('saveOrderBtn')) $('saveOrderBtn').disabled = cart.length === 0;
}

function getProductCost(product, salePrice = 0) {
  if (product && typeof product.costPrice === 'number') {
    return product.costPrice;
  }
  return Number((salePrice * 0.7).toFixed(2));
}

function getCurrentOwnerAdmin() {
  if (appState.currentRole === 'user') return getOwnerAdminForUser(appState.currentEmployee) || appState.currentEmployee;
  if (appState.currentRole === 'admin') return appState.currentEmployee;
  return null;
}

function getCustomerOwnerAdmin(customer = {}) {
  return customer.ownerAdmin || getOwnerAdminForUser(customer.createdBy) || customer.createdBy || null;
}

function getDebtOwnerAdmin(debt = {}) {
  if (debt.ownerAdmin) return debt.ownerAdmin;
  const customer = (appState.customers || []).find(item => item.id === debt.customerId);
  return getCustomerOwnerAdmin(customer) || getOwnerAdminForUser(debt.employee) || debt.employee || null;
}

function getVisibleBusinessAccounts() {
  if (isSuperAdmin()) return null;
  if (isAdmin()) {
    const business = getBusinessForEmployee(appState.currentEmployee);
    const accounts = new Set(getAccountsForBusiness(business));
    accounts.add(appState.currentEmployee);
    return accounts;
  }
  if (appState.currentRole === 'user') return new Set([appState.currentEmployee]);
  return new Set();
}

function getVisibleCustomers(customers = appState.customers || []) {
  if (isSuperAdmin()) return customers;
  const ownerAdmin = getCurrentOwnerAdmin();
  const accounts = getVisibleBusinessAccounts();
  if (appState.currentRole === 'user') {
    const ownDebtCustomerIds = new Set((appState.customerDebts || [])
      .filter(debt => debt.employee === appState.currentEmployee)
      .map(debt => debt.customerId));
    const ownPaymentCustomerIds = new Set((appState.customerPayments || [])
      .filter(payment => payment.employee === appState.currentEmployee)
      .map(payment => payment.customerId));
    return customers.filter(customer => customer.createdBy === appState.currentEmployee
      || ownDebtCustomerIds.has(customer.id)
      || ownPaymentCustomerIds.has(customer.id));
  }
  if (ownerAdmin) {
    return customers.filter(customer => {
      const customerOwner = getCustomerOwnerAdmin(customer);
      return !customerOwner
        || customerOwner === ownerAdmin
        || customer.createdBy === appState.currentEmployee
        || accounts?.has(customer.createdBy);
    });
  }
  return [];
}

function getVisibleCustomerDebts(debts = appState.customerDebts || []) {
  if (appState.currentRole === 'user') return debts.filter(debt => debt.employee === appState.currentEmployee);
  const visibleIds = new Set(getVisibleCustomers().map(customer => customer.id));
  const ownerAdmin = getCurrentOwnerAdmin();
  const accounts = getVisibleBusinessAccounts();
  return debts.filter(debt => visibleIds.has(debt.customerId)
    || (ownerAdmin && getDebtOwnerAdmin(debt) === ownerAdmin)
    || accounts?.has(debt.employee));
}

function getVisibleCustomerPayments(payments = appState.customerPayments || []) {
  if (appState.currentRole === 'user') return payments.filter(payment => payment.employee === appState.currentEmployee);
  const visibleIds = new Set(getVisibleCustomers().map(customer => customer.id));
  const ownerAdmin = getCurrentOwnerAdmin();
  const accounts = getVisibleBusinessAccounts();
  return payments.filter(payment => visibleIds.has(payment.customerId)
    || (ownerAdmin && getDebtOwnerAdmin(payment) === ownerAdmin)
    || accounts?.has(payment.employee));
}

function normalizeCustomerPhone(phone) {
  return String(phone || '').replace(/\s+/g, '').trim();
}

function findCustomerByNameOrPhone(name, phone) {
  const safeName = String(name || '').trim().toLowerCase();
  const safePhone = normalizeCustomerPhone(phone);
  const ownerAdmin = getCurrentOwnerAdmin();
  const accounts = getVisibleBusinessAccounts();
  const scopedCustomers = (appState.customers || []).filter(customer => {
    if (isSuperAdmin()) return true;
    if (appState.currentRole === 'user') {
      const ownDebt = (appState.customerDebts || []).some(debt => debt.customerId === customer.id && debt.employee === appState.currentEmployee);
      const ownPayment = (appState.customerPayments || []).some(payment => payment.customerId === customer.id && payment.employee === appState.currentEmployee);
      return customer.createdBy === appState.currentEmployee || ownDebt || ownPayment;
    }
    const customerOwner = getCustomerOwnerAdmin(customer);
    return !customerOwner
      || customerOwner === ownerAdmin
      || customer.createdBy === appState.currentEmployee
      || accounts?.has(customer.createdBy);
  });
  return scopedCustomers.find(customer => {
    const nameMatch = safeName && String(customer.name || '').trim().toLowerCase() === safeName;
    const phoneMatch = safePhone && normalizeCustomerPhone(customer.phone) === safePhone;
    return nameMatch || phoneMatch;
  }) || null;
}

function upsertCustomer({ name, phone = '', email = '', notes = '' }) {
  const safeName = String(name || '').trim() || 'Walk-in Customer';
  const safePhone = normalizeCustomerPhone(phone);
  const safeEmail = normalizeEmail(email);
  if (!Array.isArray(appState.customers)) appState.customers = [];
  let customer = findCustomerByNameOrPhone(safeName, safePhone);
  const now = new Date().toISOString();
  const ownerAdmin = getCurrentOwnerAdmin();
  if (customer) {
    customer.name = safeName;
    if (safePhone) customer.phone = safePhone;
    if (safeEmail) customer.email = safeEmail;
    if (notes) customer.notes = notes;
    if (!customer.ownerAdmin && ownerAdmin) customer.ownerAdmin = ownerAdmin;
    if (!customer.createdBy && appState.currentEmployee) customer.createdBy = appState.currentEmployee;
    customer.updatedAt = now;
  } else {
    customer = {
      id: `customer_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: safeName,
      phone: safePhone,
      email: safeEmail,
      notes,
      ownerAdmin,
      createdBy: appState.currentEmployee || 'system',
      createdAt: now,
      updatedAt: now
    };
    appState.customers.push(customer);
  }
  queueOfflineChangeSafe('customer', 'upsert', customer, customer.serverUpdatedAt || null);
  return customer;
}

function getCustomerDebtTotal(customerId) {
  return getVisibleCustomerDebts(appState.customerDebts || [])
    .filter(debt => debt.customerId === customerId && !debt.clearedAt)
    .reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
}

function getCustomerPaymentTotal(customerId) {
  return getVisibleCustomerPayments(appState.customerPayments || [])
    .filter(payment => payment.customerId === customerId && !payment.clearedAt)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function getCustomerBalance(customerId) {
  return Math.max(0, getCustomerDebtTotal(customerId) - getCustomerPaymentTotal(customerId));
}

function getCustomerGlobalBalance(customerId) {
  const totalDebt = (appState.customerDebts || [])
    .filter(debt => debt.customerId === customerId && !debt.clearedAt)
    .reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
  const totalPayments = (appState.customerPayments || [])
    .filter(payment => payment.customerId === customerId && !payment.clearedAt)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return Math.max(0, totalDebt - totalPayments);
}

function getCustomerOldestDebtDate(customerId) {
  const rows = getVisibleCustomerDebts(appState.customerDebts || [])
    .filter(debt => debt.customerId === customerId && !debt.clearedAt)
    .map(debt => debt.timestamp || debt.date)
    .filter(Boolean)
    .sort();
  return rows[0] || TODAY;
}

function buildCustomerDebtReminderMessage(customerId) {
  const customer = (appState.customers || []).find(item => item.id === customerId);
  if (!customer) return '';
  const balance = getCustomerBalance(customerId);
  const businessName = getBusinessDisplayNameForEmployee();
  return `Habari ${customer.name}, tunakukumbusha deni lako la ${businessName}: ${formatCurrency(balance)}. Tafadhali lipa au wasiliana nasi. Asante.`;
}

function getWhatsAppPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function sendCustomerDebtReminder(customerId, channel = 'whatsapp') {
  const customer = (appState.customers || []).find(item => item.id === customerId);
  if (!customer) return false;
  const balance = getCustomerBalance(customerId);
  if (balance <= 0) {
    showNotification('Mteja hana deni lililobaki');
    return false;
  }

  const message = buildCustomerDebtReminderMessage(customerId);
  const phone = getWhatsAppPhone(customer.phone);
  if (channel === 'whatsapp') {
    if (!phone) {
      alert('Mteja hana namba ya simu kwa WhatsApp');
      return false;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  } else if (channel === 'sms') {
    if (!phone) {
      alert('Mteja hana namba ya simu kwa SMS');
      return false;
    }
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
  } else if (channel === 'email') {
    if (!customer.email) {
      alert('Mteja hana email');
      return false;
    }
    window.location.href = `mailto:${encodeURIComponent(customer.email)}?subject=${encodeURIComponent('Kikumbusho cha deni')}&body=${encodeURIComponent(message)}`;
  }

  customer.lastReminderAt = new Date().toISOString();
  customer.lastReminderChannel = channel;
  saveAppState();
  renderCustomersView();
  showNotification(`Reminder imetumwa: ${channel}`);
  return true;
}

function updateCustomerSuggestions() {
  const datalist = $('customerNameSuggestions');
  if (!datalist) return;
  datalist.innerHTML = getVisibleCustomers()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(customer => `<option value="${escapeHtml(customer.name)}">${escapeHtml(customer.phone || '')}</option>`)
    .join('');
}

function clearCart() {
  if (confirm('Clear cart?')) {
    cart = [];
    renderCart();
  }
}

function completeSale() {
  if (isStaffLockedNow()) {
    updateLoginGate();
    return;
  }

  if (cart.length === 0) {
    alert(t('cartEmpty'));
    return;
  }
  
  if (!appState.currentEmployee) {
    alert(t('invalidEmployee'));
    return;
  }
  
  const comment = $('saleComment').value.trim();
  const customerName = $('saleCustomerName')?.value.trim() || $('calculatorCustomerName')?.value.trim() || 'Walk-in Customer';
  const customerPhone = $('saleCustomerPhone')?.value.trim() || '';
  const customer = upsertCustomer({ name: customerName, phone: customerPhone });
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const paymentStatusInput = $('salePaymentStatus')?.value || 'paid';
  const paidAmountInput = Number($('salePaidAmount')?.value || 0);
  const paidAmount = paymentStatusInput === 'paid'
    ? cartTotal
    : Math.max(0, Math.min(cartTotal, paidAmountInput));
  const debtAmount = Math.max(0, cartTotal - paidAmount);
  const paymentStatus = debtAmount > 0 ? (paidAmount > 0 ? 'partial' : 'credit') : 'paid';
  const transactionId = `txn_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const timestamp = new Date().toISOString();
  const newSales = [];
  const touchedProducts = new Map();
  
  cart.forEach(item => {
    const product = appState.products.find(p => p.id === (item.sourceProductId || item.productId || item.id));
    const isService = product?.itemType === 'service' || product?.category === 'service';
    const unitCost = getProductCost(product, item.price);
    const costTotal = unitCost * item.qty;
    const saleTotal = item.price * item.qty;
    if (product && !isService) {
      touchedProducts.set(product.id, {
        product,
        baseUpdatedAt: product.serverUpdatedAt || product.updatedAt || null
      });
      product.stock = Math.max(0, product.stock - item.qty);
      product.updatedAt = timestamp;
    }
    
    const saleRecord = {
      id: `sale_${Date.now()}_${Math.random()}`,
      transactionId,
      productId: product?.id || item.productId || item.id,
      productName: item.name,
      quantity: item.qty,
      price: item.price,
      costPrice: unitCost,
      costTotal,
      total: saleTotal,
      profit: saleTotal - costTotal,
      employee: appState.currentEmployee,
      customerId: customer.id,
      customerName,
      customerPhone,
      paymentStatus,
      itemType: product?.itemType || item.itemType || 'product',
      unitType: product?.unitType || item.unitType || 'piece',
      measurement: item.measurement || null,
      comment,
      timestamp,
      date: TODAY
    };
    appState.sales.push(saleRecord);
    newSales.push(saleRecord);
  });
  if (debtAmount > 0) {
    const debt = {
      id: `debt_${transactionId}`,
      customerId: customer.id,
      customerName,
      customerPhone,
      transactionId,
      saleIds: newSales.map(sale => sale.id),
      amount: debtAmount,
      originalAmount: debtAmount,
      paidAtSale: paidAmount,
      total: cartTotal,
      status: paymentStatus,
      employee: appState.currentEmployee,
      ownerAdmin: getCurrentOwnerAdmin(),
      date: TODAY,
      timestamp,
      updatedAt: timestamp
    };
    if (!Array.isArray(appState.customerDebts)) appState.customerDebts = [];
    appState.customerDebts.push(debt);
    queueOfflineChangeSafe('customerDebt', 'upsert', debt);
  }
  const receipt = createReceiptFromSales(transactionId, newSales, customerName, timestamp, {
    customerId: customer.id,
    customerPhone,
    paymentStatus,
    paidAmount,
    debtAmount
  });
  appState.receipts.push(receipt);
  appState.lastReceiptId = receipt.id;
  newSales.forEach(sale => queueOfflineChangeSafe('sale', 'insert', sale));
  queueOfflineChangeSafe('receipt', 'upsert', receipt);
  touchedProducts.forEach(({ product, baseUpdatedAt }) => {
    queueOfflineChangeSafe('product', 'upsert', product, baseUpdatedAt);
  });
  
  saveAppState();
  cart = [];
  $('saleComment').value = '';
  if ($('saleCustomerName')) $('saleCustomerName').value = '';
  if ($('saleCustomerPhone')) $('saleCustomerPhone').value = '';
  if ($('salePaidAmount')) $('salePaidAmount').value = '';
  if ($('salePaymentStatus')) $('salePaymentStatus').value = 'paid';
  renderCart();
  renderProductsGrid();
  updateDashboard();
  renderHistoryTable();
  renderStaffSalesPanel();
  renderOrdersBoard();
  renderDailyReportStatus();
  renderCustomersView();
  updateCustomerSuggestions();
  showNotification(t('saveSale'));
  openReceiptModal(receipt.id);
}

function createReceiptFromSales(transactionId, sales, customerName, timestamp, payment = {}) {
  return {
    id: `receipt_${transactionId}`,
    transactionId,
    customerId: payment.customerId || null,
    customerName,
    customerPhone: payment.customerPhone || '',
    employee: appState.currentEmployee,
    paymentStatus: payment.paymentStatus || 'paid',
    paidAmount: Number(payment.paidAmount || sales.reduce((sum, sale) => sum + sale.total, 0)),
    debtAmount: Number(payment.debtAmount || 0),
    timestamp,
    date: timestamp.slice(0, 10),
    items: sales.map(sale => ({
      name: sale.productName,
      quantity: sale.quantity,
      price: sale.price,
      total: sale.total,
      measurement: sale.measurement,
      unitType: sale.unitType,
      itemType: sale.itemType
    })),
    total: sales.reduce((sum, sale) => sum + sale.total, 0)
  };
}

function getLastReceipt() {
  if (!Array.isArray(appState.receipts)) appState.receipts = [];
  return appState.receipts.find(receipt => receipt.id === appState.lastReceiptId) || appState.receipts[appState.receipts.length - 1] || null;
}

function getReceiptPaymentSummary(receipt = {}) {
  const total = Number(receipt.total || 0);
  const paidAmount = Math.max(0, Math.min(total, Number(receipt.paidAmount ?? total)));
  const debtAmount = Math.max(0, Number(receipt.debtAmount ?? (total - paidAmount)));
  const status = debtAmount > 0 ? (paidAmount > 0 ? 'partial' : 'credit') : 'paid';
  return { total, paidAmount, debtAmount, status };
}

function getPaymentStatusLabel(status) {
  return {
    paid: t('paid'),
    partial: t('partial'),
    credit: t('credit')
  }[status] || status || t('paid');
}

function renderReceiptHtml(receipt) {
  if (!receipt) return '<p>No receipt available.</p>';
  const payment = getReceiptPaymentSummary(receipt);
  const rows = receipt.items.map(item => `
    <tr>
      <td>${escapeHtml(item.name)}<br><small>${escapeHtml(item.measurement?.text || item.unitType || 'piece')}</small></td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.price)}</td>
      <td>${formatCurrency(item.total)}</td>
    </tr>
  `).join('');

  return `
    <div class="receipt-paper">
      <h2>${escapeHtml(appState.settings.businessName)}</h2>
      <p>Receipt: ${escapeHtml(receipt.id)}</p>
      <p>Customer: <strong>${escapeHtml(receipt.customerName)}</strong></p>
      <p>Staff: ${escapeHtml(receipt.employee || 'Unknown')}</p>
      <p>Date: ${formatDateTime(receipt.timestamp)}</p>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="receipt-total">Total: ${formatCurrency(receipt.total)}</div>
      <div class="receipt-payment-summary ${payment.debtAmount > 0 ? 'has-debt' : 'paid'}">
        <div><span>${t('paymentStatusLabel')}</span><strong>${escapeHtml(getPaymentStatusLabel(payment.status))}</strong></div>
        <div><span>Amelipa</span><strong>${formatCurrency(payment.paidAmount)}</strong></div>
        <div><span>Anadaiwa</span><strong>${formatCurrency(payment.debtAmount)}</strong></div>
      </div>
      ${payment.debtAmount > 0 ? '<p class="receipt-debt-note">Kumbuka: kiasi cha Anadaiwa kimeongezwa kwenye madeni ya mteja.</p>' : ''}
    </div>
  `;
}

function buildReceiptText(receipt) {
  if (!receipt) return 'No receipt available.';
  const payment = getReceiptPaymentSummary(receipt);
  const items = receipt.items.map(item => {
    const measurement = item.measurement?.text ? ` (${item.measurement.text})` : '';
    return `- ${item.name}${measurement}: ${item.quantity} x ${formatCurrency(item.price)} = ${formatCurrency(item.total)}`;
  }).join('\n');

  return `*${appState.settings.businessName} Receipt*
Customer: ${receipt.customerName}
Staff: ${receipt.employee || 'Unknown'}
Date: ${formatDateTime(receipt.timestamp)}

${items}

Total: ${formatCurrency(receipt.total)}
${t('paymentStatusLabel')}: ${getPaymentStatusLabel(payment.status)}
Amelipa: ${formatCurrency(payment.paidAmount)}
Anadaiwa: ${formatCurrency(payment.debtAmount)}`;
}

function openReceiptModal(receiptId) {
  const receipt = appState.receipts.find(item => item.id === receiptId) || getLastReceipt();
  if (!receipt) return;
  appState.lastReceiptId = receipt.id;
  if ($('receiptContent')) $('receiptContent').innerHTML = renderReceiptHtml(receipt);
  $('receiptModal')?.classList.remove('hidden');
  if ($('receiptPreviewBtn')) $('receiptPreviewBtn').disabled = false;
  saveAppState();
}

function openLastReceipt() {
  const receipt = getLastReceipt();
  if (!receipt) {
    showNotification('No receipt yet');
    return;
  }
  openReceiptModal(receipt.id);
}

function closeReceiptModal() {
  $('receiptModal')?.classList.add('hidden');
}

function downloadLastReceiptPdf() {
  const receipt = getLastReceipt();
  if (!receipt) return;
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    showNotification('Popup imezuiwa. Ruhusu popups ili kupakua PDF.');
    return;
  }
  reportWindow.document.write(`<!doctype html><html><head><title>Receipt</title><style>
    body{font-family:Arial,sans-serif;color:#17202a;padding:28px}.receipt-paper{max-width:720px;margin:auto}
    table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border-bottom:1px solid #ddd;padding:10px;text-align:left}
    .receipt-total{text-align:right;font-size:22px;font-weight:700;margin-top:18px}
    .receipt-payment-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px;padding:12px;border:1px solid #d8e6d8;border-radius:8px;background:#f6fff6}
    .receipt-payment-summary div{display:grid;gap:4px}.receipt-payment-summary span{font-size:12px;color:#5f6b5f}.receipt-payment-summary strong{font-size:16px}
    .receipt-payment-summary.has-debt{border-color:#f3b3b3;background:#fff7f7}.receipt-debt-note{margin-top:10px;color:#8a1f1f;font-weight:700}
  </style></head><body>${renderReceiptHtml(receipt)}</body></html>`);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

function shareLastReceiptWhatsApp() {
  const receipt = getLastReceipt();
  if (!receipt) return;
  window.open(`https://wa.me/?text=${encodeURIComponent(buildReceiptText(receipt))}`, '_blank');
}

// ==========================================
// ORDER MANAGEMENT
// ==========================================

const ORDER_STATUSES = ['pending', 'in_progress', 'ready', 'delivered'];

function getOrderStatusLabel(status) {
  return {
    pending: t('pending'),
    in_progress: t('inProgress'),
    ready: t('ready'),
    delivered: t('delivered')
  }[status] || status;
}

function buildOrderFromCart({ clear = true } = {}) {
  if (cart.length === 0) {
    alert(t('cartEmpty'));
    return null;
  }
  if (!appState.currentEmployee) {
    alert(t('invalidEmployee'));
    return null;
  }

  const timestamp = new Date().toISOString();
  const customerName = $('saleCustomerName')?.value.trim() || $('calculatorCustomerName')?.value.trim() || 'Walk-in Customer';
  const customerPhone = $('saleCustomerPhone')?.value.trim() || '';
  const customer = upsertCustomer({ name: customerName, phone: customerPhone });
  const order = {
    id: `order_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    customerId: customer.id,
    customerName,
    customerPhone,
    employee: appState.currentEmployee,
    ownerAdmin: appState.currentRole === 'user' ? getOwnerAdminForUser(appState.currentEmployee) : appState.currentEmployee,
    status: 'pending',
    paymentStatus: 'unpaid',
    comment: $('saleComment')?.value.trim() || '',
    timestamp,
    updatedAt: timestamp,
    date: timestamp.slice(0, 10),
    items: cart.map(item => ({
      productId: item.sourceProductId || item.productId || item.id,
      name: item.name,
      quantity: item.qty,
      price: item.price,
      unitPrice: item.unitPrice || item.price,
      total: item.price * item.qty,
      itemType: item.itemType || 'product',
      unitType: item.unitType || 'piece',
      measurement: item.measurement || null
    })),
    total: cart.reduce((sum, item) => sum + (item.price * item.qty), 0)
  };

  if (clear) {
    cart = [];
    if ($('saleComment')) $('saleComment').value = '';
    if ($('saleCustomerName')) $('saleCustomerName').value = '';
    if ($('saleCustomerPhone')) $('saleCustomerPhone').value = '';
    renderCart();
  }

  return order;
}

function createOrderFromCart() {
  const order = buildOrderFromCart();
  if (!order) return;
  if (!Array.isArray(appState.orders)) appState.orders = [];
  appState.orders.push(order);
  queueOfflineChangeSafe('order', 'upsert', order);
  saveAppState();
  renderOrdersBoard();
  updateDashboard();
  showNotification(`Order imehifadhiwa: ${order.customerName}`);
  switchView('orders');
}

function renderOrdersBoard() {
  const board = $('ordersBoard');
  if (!board) return;
  const statusFilter = $('orderStatusFilter')?.value || '';
  const paymentFilter = $('orderPaymentFilter')?.value || '';
  let orders = getVisibleOrders(appState.orders || [])
    .filter(order => !statusFilter || order.status === statusFilter)
    .filter(order => !paymentFilter || order.paymentStatus === paymentFilter)
    .sort((a, b) => new Date(b.updatedAt || b.timestamp) - new Date(a.updatedAt || a.timestamp));

  if (orders.length === 0) {
    board.innerHTML = `<div class="order-empty">${t('noOrdersForFilter')}</div>`;
    return;
  }

  board.innerHTML = ORDER_STATUSES.map(status => {
    const rows = orders.filter(order => order.status === status);
    return `
      <div class="order-column">
        <div class="order-column-header">
          <strong>${getOrderStatusLabel(status)}</strong>
          <span>${rows.length}</span>
        </div>
        <div class="order-column-list">
          ${rows.map(renderOrderCard).join('') || `<div class="order-column-empty">${t('none')}</div>`}
        </div>
      </div>
    `;
  }).join('');
}

function renderOrderCard(order) {
  const items = order.items.map(item => `<li>${escapeHtml(item.name)} <span>${escapeHtml(item.measurement?.text || `Qty ${item.quantity}`)}</span></li>`).join('');
  const paid = order.paymentStatus === 'paid';
  return `
    <article class="order-card">
      <div class="order-card-top">
        <strong>${escapeHtml(order.customerName)}</strong>
        <span class="order-payment ${paid ? 'paid' : 'unpaid'}">${paid ? t('paid') : t('unpaid')}</span>
      </div>
      <div class="order-meta">${escapeHtml(order.employee || 'Unknown')} - ${formatDateTime(order.timestamp)}</div>
      <ul>${items}</ul>
      <div class="order-total">${formatCurrency(order.total)}</div>
      <div class="order-actions">
        <select class="form-input" onchange="updateOrderStatus('${order.id}', this.value)">
          ${ORDER_STATUSES.map(status => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${getOrderStatusLabel(status)}</option>`).join('')}
        </select>
        <button class="btn btn-small btn-secondary" onclick="toggleOrderPayment('${order.id}')">${paid ? t('markUnpaid') : t('markPaid')}</button>
        <button class="btn btn-small btn-success" onclick="completeOrderAsSale('${order.id}')" ${order.saleTransactionId ? 'disabled' : ''}>${t('saveSale')}</button>
      </div>
    </article>
  `;
}

function updateOrderStatus(orderId, status) {
  const order = (appState.orders || []).find(item => item.id === orderId);
  if (!order || !ORDER_STATUSES.includes(status)) return;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  queueOfflineChangeSafe('order', 'upsert', order, order.serverUpdatedAt || null);
  saveAppState();
  renderOrdersBoard();
  updateDashboard();
}

function toggleOrderPayment(orderId) {
  const order = (appState.orders || []).find(item => item.id === orderId);
  if (!order) return;
  order.paymentStatus = order.paymentStatus === 'paid' ? 'unpaid' : 'paid';
  order.updatedAt = new Date().toISOString();
  queueOfflineChangeSafe('order', 'upsert', order, order.serverUpdatedAt || null);
  saveAppState();
  renderOrdersBoard();
}

function completeOrderAsSale(orderId) {
  const order = (appState.orders || []).find(item => item.id === orderId);
  if (!order || order.saleTransactionId) return;
  const transactionId = `txn_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const timestamp = new Date().toISOString();
  const newSales = [];
  const touchedProducts = new Map();

  order.items.forEach(item => {
    const product = appState.products.find(p => p.id === item.productId);
    const isService = product?.itemType === 'service' || product?.stockType === 'service' || product?.category === 'service';
    const unitCost = getProductCost(product, item.price);
    const costTotal = unitCost * item.quantity;
    if (product && !isService) {
      touchedProducts.set(product.id, { product, baseUpdatedAt: product.serverUpdatedAt || product.updatedAt || null });
      product.stock = Math.max(0, Number(product.stock || 0) - item.quantity);
      product.updatedAt = timestamp;
    }
    const saleRecord = {
      id: `sale_${Date.now()}_${Math.random()}`,
      transactionId,
      orderId: order.id,
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
      price: item.price,
      costPrice: unitCost,
      costTotal,
      total: item.total,
      profit: item.total - costTotal,
      employee: order.employee,
      customerId: order.customerId || null,
      customerName: order.customerName,
      customerPhone: order.customerPhone || '',
      paymentStatus: 'paid',
      itemType: item.itemType,
      unitType: item.unitType,
      measurement: item.measurement,
      comment: order.comment,
      timestamp,
      date: timestamp.slice(0, 10)
    };
    appState.sales.push(saleRecord);
    newSales.push(saleRecord);
  });

  const receipt = createReceiptFromSales(transactionId, newSales, order.customerName, timestamp, {
    customerId: order.customerId || null,
    customerPhone: order.customerPhone || '',
    paymentStatus: 'paid',
    paidAmount: order.total,
    debtAmount: 0
  });
  receipt.employee = order.employee;
  appState.receipts.push(receipt);
  appState.lastReceiptId = receipt.id;
  order.saleTransactionId = transactionId;
  order.paymentStatus = 'paid';
  order.status = order.status === 'delivered' ? order.status : 'ready';
  order.updatedAt = timestamp;

  newSales.forEach(sale => queueOfflineChangeSafe('sale', 'insert', sale));
  queueOfflineChangeSafe('receipt', 'upsert', receipt);
  queueOfflineChangeSafe('order', 'upsert', order, order.serverUpdatedAt || null);
  touchedProducts.forEach(({ product, baseUpdatedAt }) => queueOfflineChangeSafe('product', 'upsert', product, baseUpdatedAt));
  saveAppState();
  renderOrdersBoard();
  renderInventoryTable();
  updateDashboard();
  renderHistoryTable();
  renderStaffSalesPanel();
  renderDailyReportStatus();
  renderCustomersView();
  showNotification('Order imehifadhiwa kama sale');
  openReceiptModal(receipt.id);
}

// ==========================================
// DASHBOARD & ANALYTICS
// ==========================================

function updateDashboard() {
  updateBusinessHeaderName();

  // Calculate metrics
  const todaysSales = getVisibleSales(appState.sales).filter(s => s.date === TODAY);
  const visibleProducts = getVisibleProducts();
  const dailySummary = summarizeSales(todaysSales, getPeriodExpenses('daily'));
  const totalRevenue = dailySummary.revenue;
  const totalItems = dailySummary.items;
  const transactions = dailySummary.transactions;
  
  // Update KPIs
  $('kpiRevenue').textContent = formatCurrency(totalRevenue);
  $('kpiSold').textContent = totalItems;
  $('kpiTransactions').textContent = transactions;
  
  // Low stock count
  const lowStock = visibleProducts.filter(p => p.itemType !== 'service' && p.stock > 0 && p.stock <= appState.settings.lowStockThreshold);
  $('kpiLowStock').textContent = lowStock.length;
  if ($('kpiProfit')) $('kpiProfit').textContent = formatCurrency(dailySummary.profit);
  if ($('kpiCost')) $('kpiCost').textContent = formatCurrency(dailySummary.expenses);
  if ($('kpiStockRemaining')) $('kpiStockRemaining').textContent = visibleProducts.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  if ($('kpiStockSold')) $('kpiStockSold').textContent = dailySummary.items;
  
  // Update status
  if (appState.currentEmployee) {
    const employeeSales = todaysSales.filter(s => s.employee === appState.currentEmployee);
    const productName = String(appState.settings.dashboardProductName || '').trim();
    if (productName) {
      const filteredSales = employeeSales.filter(sale => String(sale.productName || '').toLowerCase().includes(productName.toLowerCase()));
      const totalItems = filteredSales.reduce((sum, s) => sum + s.quantity, 0);
      $('statusSales').textContent = `${totalItems} ${t('items')} (${productName})`;
    } else {
      $('statusSales').textContent = `${employeeSales.reduce((sum, s) => sum + s.quantity, 0)} ${t('items')}`;
    }
  }
  
  // Render best sellers
  renderBestSellers();

  // Render product snapshot on dashboard
  renderDashboardProducts();
  
  // Render low stock alerts
  renderLowStockAlerts();
  
  // Render recent transactions
  renderRecentTransactions();
  renderDashboardEmployeePerformance();
  renderRoleBusinessDashboard();
  renderOrdersBoard();
  
  // Update analytics
  updateCharts();
  renderDailySummary();
  renderEmployeePerformanceReport();
  renderStaffSalesPanel();
}

function renderBestSellers() {
  const productSales = {};
  getVisibleSales(getPeriodSales(dashboardChartPeriod)).forEach(sale => {
    if (!productSales[sale.productName]) {
      productSales[sale.productName] = { qty: 0, revenue: 0 };
    }
    productSales[sale.productName].qty += sale.quantity;
    productSales[sale.productName].revenue += sale.total;
  });
  
  const best = Object.entries(productSales)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);
  
  const container = $('bestSellers');
  container.innerHTML = '';
  
  best.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'product-item';
    el.innerHTML = `
      <div class="product-item-rank">${index + 1}</div>
      <div class="product-item-info">
        <div class="product-item-name">${escapeHtml(item[0])}</div>
        <div class="product-item-stats">${item[1].qty} sold</div>
      </div>
      <div class="product-item-revenue">${formatCurrency(item[1].revenue)}</div>
    `;
    container.appendChild(el);
  });

  if (best.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">${t('noSalesToday')}</div>`;
  }
}

function renderDashboardProducts() {
  const container = $('dashboardProducts');
  if (!container) return;

  const products = getVisibleProducts()
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 8);

  container.innerHTML = '';

  if (products.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">No products added yet</div>';
    return;
  }

  products.forEach(product => {
    const el = document.createElement('div');
    el.className = 'product-item';
    el.innerHTML = `
      <div class="product-item-rank">${product.itemType === 'service' ? 'SVC' : product.stock}</div>
      <div class="product-item-info">
        <div class="product-item-name">${escapeHtml(product.name)}</div>
        <div class="product-item-stats">${escapeHtml(product.category || 'General')} • ${escapeHtml(product.sku)}</div>
      </div>
      <div class="product-item-revenue">${formatCurrency(product.price)}</div>
    `;
    container.appendChild(el);
  });
}

function renderLowStockAlerts() {
  const lowStockProducts = getVisibleProducts()
    .filter(p => p.itemType !== 'service' && p.stock > 0 && p.stock <= appState.settings.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);
  
  const container = $('lowStockAlert');
  container.innerHTML = '';
  
  if (lowStockProducts.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">${t('allProductsStocked')}</div>`;
  } else {
    lowStockProducts.forEach(product => {
      const el = document.createElement('div');
      el.className = 'alert-item';
      el.innerHTML = `
        <div class="alert-icon-small">⚠️</div>
        <div class="alert-item-info">
          <div class="alert-item-name">${escapeHtml(product.name)}</div>
          <div class="alert-item-stock">${t('stock')}: ${product.stock}</div>
        </div>
      `;
      container.appendChild(el);
    });
  }
}

function renderRecentTransactions() {
  const recent = groupSalesByTransaction(getVisibleSales(appState.sales).filter(s => s.date === TODAY))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);
  
  const container = $('recentTransactions');
  container.innerHTML = '';
  
  if (recent.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">${t('noTransactions')}</div>`;
  } else {
    recent.forEach(sale => {
      const el = document.createElement('div');
      el.className = 'transaction-item';
      el.innerHTML = `
        <div class="transaction-product">
          <div class="transaction-name">${sale.items} ${t('items')}</div>
          <div class="transaction-detail">${sale.employee} • ${formatTime(sale.timestamp)}</div>
        </div>
        <div class="transaction-amount">${formatCurrency(sale.total)}</div>
      `;
      container.appendChild(el);
    });
  }
}

// ==========================================
// CHARTS & ANALYTICS
// ==========================================

function updateCharts() {
  if (typeof Chart === 'undefined') {
    return;
  }

  updateSalesChart();
  updateTrendChart();
  updatePerformanceChart();
  updateCategoryChart();
  updateReportsChart();
  updateAnalyticsData();
}

function getSaleTransactionKey(sale) {
  return sale.transactionId || sale.id;
}

function getHistorySales() {
  const selectedDate = $('dateFilter')?.value;
  return getVisibleSales(appState.sales)
    .filter(sale => selectedDate ? sale.date === selectedDate : sale.date === TODAY)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function getVisibleSales(sales = appState.sales) {
  if (isSuperAdmin()) return sales;
  if (isAdmin()) {
    const accounts = new Set(getAccountsForBusiness(getBusinessForEmployee(appState.currentEmployee)));
    accounts.add(appState.currentEmployee);
    return sales.filter(sale => accounts.has(sale.employee));
  }
  if (appState.currentRole === 'user') {
    return sales.filter(sale => sale.employee === appState.currentEmployee);
  }
  return sales;
}

function getVisibleOrders(orders = appState.orders || []) {
  if (isSuperAdmin()) return orders;
  if (isAdmin()) {
    const accounts = new Set(getAccountsForBusiness(getBusinessForEmployee(appState.currentEmployee)));
    accounts.add(appState.currentEmployee);
    return orders.filter(order => accounts.has(order.employee) || order.ownerAdmin === appState.currentEmployee);
  }
  if (appState.currentRole === 'user') {
    return orders.filter(order => order.employee === appState.currentEmployee);
  }
  return orders;
}

function groupSalesByTransaction(sales) {
  const transactions = new Map();

  sales.forEach(sale => {
    const key = getSaleTransactionKey(sale);
    const existing = transactions.get(key) || {
      id: key,
      employee: sale.employee || 'Unknown',
      timestamp: sale.timestamp,
      date: sale.date,
      items: 0,
      total: 0,
      products: []
    };

    existing.items += sale.quantity;
    existing.total += sale.total;
    existing.products.push(`${sale.productName} x${sale.quantity}`);

    if (new Date(sale.timestamp) > new Date(existing.timestamp)) {
      existing.timestamp = sale.timestamp;
    }

    transactions.set(key, existing);
  });

  return [...transactions.values()];
}

function getCurrentEmployeeTodaySales() {
  if (!appState.currentEmployee) return [];
  return appState.sales
    .filter(sale => sale.date === TODAY && sale.employee === appState.currentEmployee)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function getVisibleExpenses(expenses = appState.expenses || []) {
  if (isSuperAdmin()) return expenses;
  if (isAdmin()) {
    const business = getBusinessForEmployee(appState.currentEmployee);
    const accounts = new Set(getAccountsForBusiness(business));
    accounts.add(appState.currentEmployee);
    return expenses.filter(expense => accounts.has(expense.employee));
  }
  if (appState.currentRole === 'user') {
    return expenses.filter(expense => expense.employee === appState.currentEmployee);
  }
  return [];
}

function getCurrentEmployeeTodayExpenses() {
  if (!appState.currentEmployee) return [];
  return (appState.expenses || [])
    .filter(expense => expense.date === TODAY && expense.employee === appState.currentEmployee)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function getPeriodExpenses(period) {
  const expenses = getVisibleExpenses(appState.expenses || []);
  if (period === 'weekly') {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    return expenses.filter(expense => expense.date >= weekStartStr);
  }
  if (period === 'monthly') {
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    return expenses.filter(expense => expense.date >= monthStartStr);
  }
  return expenses.filter(expense => expense.date === TODAY);
}

function sumExpenses(expenses) {
  return (expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
}

function getSaleCost(sale) {
  if (typeof sale.costTotal === 'number') return sale.costTotal;
  const product = appState.products.find(item => item.id === sale.productId || item.name === sale.productName);
  return getProductCost(product, sale.price) * sale.quantity;
}

function getPeriodSales(period) {
  if (period === 'weekly') {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    return getVisibleSales(appState.sales).filter(s => s.date >= weekStartStr);
  }

  if (period === 'monthly') {
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    return getVisibleSales(appState.sales).filter(s => s.date >= monthStartStr);
  }

  return getVisibleSales(appState.sales).filter(s => s.date === TODAY);
}

function summarizeSales(sales, expenseRows = null) {
  const transactions = new Set(sales.map(getSaleTransactionKey)).size;
  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const cost = sales.reduce((sum, sale) => sum + getSaleCost(sale), 0);
  const items = sales.reduce((sum, sale) => sum + sale.quantity, 0);
  const dates = new Set(sales.map(sale => sale.date).filter(Boolean));
  const employees = new Set(sales.map(sale => sale.employee).filter(Boolean));
  const expenses = Array.isArray(expenseRows)
    ? expenseRows
    : getVisibleExpenses(appState.expenses || []).filter(expense => {
      const dateMatch = dates.size > 0 && dates.has(expense.date);
      const employeeMatch = employees.size === 0 || employees.has(expense.employee);
      return dateMatch && employeeMatch;
    });
  const expenseTotal = sumExpenses(expenses);
  return {
    revenue,
    cost,
    grossProfit: revenue - cost,
    expenses: expenseTotal,
    profit: revenue - expenseTotal,
    items,
    transactions
  };
}

function getEmployeePerformance(sales = appState.sales, expenseRows = null) {
  const performance = new Map();
  const dates = new Set(sales.map(sale => sale.date).filter(Boolean));
  sales.forEach(sale => {
    const employee = sale.employee || 'Unknown';
    const row = performance.get(employee) || {
      employee,
      transactions: new Set(),
      items: 0,
      revenue: 0,
      cost: 0,
      expenses: 0,
      profit: 0
    };

    row.transactions.add(getSaleTransactionKey(sale));
    row.items += sale.quantity;
    row.revenue += sale.total;
    row.cost += getSaleCost(sale);
    row.grossProfit = row.revenue - row.cost;
    row.profit = row.revenue - row.expenses;
    performance.set(employee, row);
  });

  const expenses = Array.isArray(expenseRows)
    ? expenseRows
    : getVisibleExpenses(appState.expenses || []).filter(expense => dates.size > 0 && dates.has(expense.date));

  expenses.forEach(expense => {
    const employee = expense.employee || 'Unknown';
    const row = performance.get(employee) || {
      employee,
      transactions: new Set(),
      items: 0,
      revenue: 0,
      cost: 0,
      grossProfit: 0,
      expenses: 0,
      profit: 0
    };
    row.expenses += Number(expense.amount || 0);
    row.profit = row.revenue - row.expenses;
    performance.set(employee, row);
  });

  return [...performance.values()].sort((a, b) => b.revenue - a.revenue);
}

function updateSalesChart() {
  const ctx = $('salesChart')?.getContext('2d');
  if (!ctx) return;
  
  const productData = {};
  getVisibleSales(appState.sales).forEach(sale => {
    if (!productData[sale.productName]) {
      productData[sale.productName] = 0;
    }
    productData[sale.productName] += sale.quantity;
  });
  
  const sorted = Object.entries(productData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  
  if (charts.sales) charts.sales.destroy();
  
  charts.sales = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(item => item[0]),
      datasets: [{
        label: 'Units Sold',
        data: sorted.map(item => item[1]),
        backgroundColor: [
          'rgba(255, 140, 66, 0.8)',
          'rgba(26, 188, 156, 0.8)',
          'rgba(52, 211, 153, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(14, 165, 233, 0.8)'
        ],
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1100,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 140, 66, 0.1)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function updateTrendChart() {
  const ctx = $('trendChart')?.getContext('2d');
  if (!ctx) return;
  
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    last7Days.push(date.toISOString().slice(0, 10));
  }
  
  const salesByDay = {};
  const visibleSales = getVisibleSales(appState.sales);
  last7Days.forEach(day => {
    salesByDay[day] = visibleSales
      .filter(s => s.date === day)
      .reduce((sum, s) => sum + s.total, 0);
  });
  
  if (charts.trend) charts.trend.destroy();
  
  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last7Days.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [{
        label: 'Daily Revenue',
        data: last7Days.map(d => salesByDay[d]),
        borderColor: '#008000',
        backgroundColor: 'rgba(255, 140, 66, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 6,
        pointBackgroundColor: '#008000',
        pointBorderColor: 'white',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 140, 66, 0.1)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function updatePerformanceChart() {
  const ctx = $('performanceChart')?.getContext('2d');
  if (!ctx) return;

  const rows = getEmployeePerformance(getVisibleSales(appState.sales)).slice(0, 6);
  if (charts.performance) charts.performance.destroy();

  charts.performance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(row => row.employee),
      datasets: [{
        label: 'Revenue',
        data: rows.map(row => row.revenue),
        backgroundColor: 'rgba(26, 188, 156, 0.8)',
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1200,
        easing: 'easeOutBounce'
      },
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255, 140, 66, 0.1)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function updateCategoryChart() {
  const ctx = $('categoryChart')?.getContext('2d');
  if (!ctx) return;

  const categoryData = {};
  getVisibleSales(appState.sales).forEach(sale => {
    const product = appState.products.find(item => item.id === sale.productId);
    const category = product?.category || 'General';
    categoryData[category] = (categoryData[category] || 0) + sale.total;
  });

  const rows = Object.entries(categoryData).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (charts.category) charts.category.destroy();

  charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: rows.map(row => row[0]),
      datasets: [{
        data: rows.map(row => row[1]),
        backgroundColor: ['#008000', '#006400', '#22C55E', '#10B981', '#84CC16', '#16A34A']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function updateReportsChart() {
  const ctx = $('reportsChart')?.getContext('2d');
  if (!ctx) return;

  const labels = ['Daily', 'Weekly', 'Monthly'];
  const revenueData = ['daily', 'weekly', 'monthly'].map(period => summarizeSales(getPeriodSales(period)).revenue);

  if (charts.reports) charts.reports.destroy();

  charts.reports = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Sales',
        data: revenueData,
        borderColor: '#1ABC9C',
        backgroundColor: 'rgba(26, 188, 156, 0.12)',
        borderWidth: 3,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255, 140, 66, 0.1)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function updateAnalyticsData() {
  const visibleSales = getVisibleSales(appState.sales);
  const totalRevenue = visibleSales.reduce((sum, s) => sum + s.total, 0);
  const avgTransaction = visibleSales.length > 0 ? totalRevenue / visibleSales.length : 0;
  
  const container = $('revenueMetrics');
  container.innerHTML = `
    <div class="metric-item">
      <div class="metric-value">${formatCurrency(totalRevenue)}</div>
      <div class="metric-label">Total Revenue</div>
    </div>
    <div class="metric-item">
      <div class="metric-value">${formatCurrency(avgTransaction)}</div>
      <div class="metric-label">Avg. Transaction</div>
    </div>
    <div class="metric-item">
      <div class="metric-value">${visibleSales.length}</div>
      <div class="metric-label">Total Transactions</div>
    </div>
    <div class="metric-item">
      <div class="metric-value">${visibleSales.reduce((sum, s) => sum + s.quantity, 0)}</div>
      <div class="metric-label">Items Sold</div>
    </div>
  `;
}

// ==========================================
// REPORTS & EXPORTING
// ==========================================

function renderDailyReport() {
  ensureMissingDailyReports();
  const summary = summarizeSales(getPeriodSales('daily'), getPeriodExpenses('daily'));
  renderDailyReportStatus();
  renderStaffReportArchive();
  
  $('dailyReport').innerHTML = `
    <div style="display:grid;gap:12px;">
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('totalRevenue')}:</span>
        <strong>${formatCurrency(summary.revenue)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('dailyExpenses')}:</span>
        <strong>${formatCurrency(summary.expenses)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('netProfit')}:</span>
        <strong>${formatCurrency(summary.profit)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('itemsSold')}:</span>
        <strong>${summary.items}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('transactions')}:</span>
        <strong>${summary.transactions}</strong>
      </div>
    </div>
  `;
}

function getDailyReportRecord(date = TODAY, employee = appState.currentEmployee) {
  if (!Array.isArray(appState.dailyReports)) appState.dailyReports = [];
  return appState.dailyReports.find(report => report.date === date && report.employee === employee) || null;
}

function getVisibleDailyReports(reports = appState.dailyReports || []) {
  if (isSuperAdmin()) return reports;
  if (isAdmin()) {
    const accounts = new Set(getAccountsForBusiness(getBusinessForEmployee(appState.currentEmployee)));
    accounts.add(appState.currentEmployee);
    return reports.filter(report => accounts.has(report.employee));
  }
  if (appState.currentRole === 'user') {
    return reports.filter(report => report.employee === appState.currentEmployee);
  }
  return [];
}

function shouldAutoGenerateReportForDate(date) {
  if (!date) return false;
  if (date < TODAY) return true;
  if (date > TODAY) return false;
  const [hour, minute] = (appState.settings.closingTime || '22:00').split(':').map(Number);
  const now = new Date();
  const closing = new Date();
  closing.setHours(Number.isFinite(hour) ? hour : 22, Number.isFinite(minute) ? minute : 0, 0, 0);
  return now >= closing;
}

function buildDailyReportRecord(date, employeeName, source = 'auto') {
  const employeeExpenses = (appState.expenses || []).filter(expense => expense.date === date && expense.employee === employeeName);
  const employeeSales = (appState.sales || []).filter(sale => sale.date === date && sale.employee === employeeName);
  return {
    id: `daily_report_${date}_${employeeName.replace(/\W+/g, '_')}`,
    date,
    employee: employeeName,
    source,
    autoGenerated: source === 'auto',
    generatedAt: new Date().toISOString(),
    label: source === 'auto' ? `AUTO GENERATED - ${employeeName}` : `REPORT BY ${employeeName}`,
    summary: summarizeSales(employeeSales, employeeExpenses),
    sales: employeeSales,
    expenses: employeeExpenses
  };
}

function getReportSalesRows(report) {
  if (Array.isArray(report?.sales) && report.sales.length > 0) return report.sales;
  return (appState.sales || []).filter(sale => sale.date === report.date && sale.employee === report.employee);
}

function getReportSoldItems(report) {
  const items = new Map();
  getReportSalesRows(report).forEach(sale => {
    const key = sale.productName || 'Bidhaa';
    const row = items.get(key) || {
      productName: key,
      quantity: 0,
      total: 0
    };
    row.quantity += Number(sale.quantity || 0);
    row.total += Number(sale.total || 0);
    items.set(key, row);
  });
  return [...items.values()].sort((a, b) => b.total - a.total);
}

function getReportExpenseRows(report) {
  if (Array.isArray(report?.expenses) && report.expenses.length > 0) return report.expenses;
  return (appState.expenses || []).filter(expense => expense.date === report.date && expense.employee === report.employee);
}

function ensureMissingDailyReports() {
  if (!appState.currentEmployee) return [];
  if (!Array.isArray(appState.dailyReports)) appState.dailyReports = [];
  const activityKeys = new Map();
  const visibleSales = getVisibleSales(appState.sales || []);
  const visibleExpenses = getVisibleExpenses(appState.expenses || []);

  [...visibleSales, ...visibleExpenses].forEach(row => {
    const date = row.date || String(row.timestamp || '').slice(0, 10);
    const employee = row.employee;
    if (!date || !employee || !shouldAutoGenerateReportForDate(date)) return;
    activityKeys.set(`${date}|${employee}`, { date, employee });
  });

  const created = [];
  activityKeys.forEach(({ date, employee }) => {
    if (getDailyReportRecord(date, employee)) return;
    const record = buildDailyReportRecord(date, employee, 'auto');
    appState.dailyReports.push(record);
    created.push(record);
    queueOfflineChangeSafe('dailyReport', 'upsert', record, null);
  });

  if (created.length > 0) {
    saveAppState();
  }
  return created;
}

function getReportPdfSyncKey(report) {
  return `pdf_report_sent_${report.id || `${report.date}_${report.employee}`}`;
}

async function sendAutoGeneratedReportPdf(report) {
  if (!report || !report.autoGenerated) return null;
  const syncKey = getReportPdfSyncKey(report);
  if (localStorage.getItem(syncKey)) return null;

  const reportSales = (appState.sales || []).filter(sale => sale.date === report.date && sale.employee === report.employee);
  const payload = {
    adminPhone: appState.settings?.bossPhone || '',
    report: {
      ...report,
      businessName: appState.settings?.businessName || 'MO SaaS',
      sales: reportSales,
      caption: `Ripoti PDF ya ${report.employee} - ${report.date}`
    }
  };

  try {
    const response = await fetch(`${PAYMENT_API_BASE_URL}/reports/send-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'PDF report backend failed');
    }
    localStorage.setItem(syncKey, new Date().toISOString());
    return result;
  } catch (error) {
    console.warn('Auto PDF report send failed:', error.message);
    return null;
  }
}

function sendAutoGeneratedReportPdfs(reports = []) {
  reports
    .filter(report => report?.autoGenerated)
    .forEach(report => {
      sendAutoGeneratedReportPdf(report).then(result => {
        if (!result) return;
        const sent = result.whatsapp?.sent;
        showNotification(sent ? 'PDF report imetumwa WhatsApp kwa Admin.' : 'PDF report imetengenezwa backend; WhatsApp haijasanidiwa.');
      });
    });
}

function renderDailyReportStatus() {
  const target = $('dailyReportStatus');
  if (!target) return;
  const todaysReports = getVisibleDailyReports(appState.dailyReports || []).filter(report => report.date === TODAY);
  target.innerHTML = todaysReports.length
    ? todaysReports.map(report => `<span class="report-label ${report.autoGenerated ? 'auto' : ''}">${escapeHtml(report.label || `REPORT BY ${report.employee}`)}</span>`).join('')
    : '<span class="report-label muted">No staff report submitted today. Auto report runs at 22:00.</span>';
}

function renderStaffReportArchive() {
  const container = $('staffReportArchive');
  if (!container) return;
  const reports = getVisibleDailyReports(appState.dailyReports || [])
    .slice()
    .sort((a, b) => `${b.date || ''}${b.submittedAt || b.generatedAt || ''}`.localeCompare(`${a.date || ''}${a.submittedAt || a.generatedAt || ''}`))
    .slice(0, 30);

  if (reports.length === 0) {
    container.innerHTML = '<div class="admin-staff-empty">Bado hakuna staff report iliyohifadhiwa.</div>';
    return;
  }

  container.innerHTML = reports.map(report => {
    const summary = report.summary || { revenue: 0, expenses: 0, profit: 0, transactions: 0 };
    const soldItems = getReportSoldItems(report);
    const soldItemsHtml = soldItems.length
      ? soldItems.map(item => `
          <span>
            <strong>${escapeHtml(item.productName)}</strong>
            x${item.quantity} - ${formatCurrency(item.total)}
          </span>
        `).join('')
      : '<span class="muted">Hakuna bidhaa zilizorekodiwa kwenye report hii.</span>';
    const expenseRows = getReportExpenseRows(report);
    const expensesHtml = expenseRows.length
      ? expenseRows.map(expense => `
          <span>
            <strong>${escapeHtml(expense.name || 'Matumizi')}</strong>
            ${formatCurrency(expense.amount || 0)}
            <small>${expense.timestamp ? formatTime(expense.timestamp) : ''}</small>
          </span>
        `).join('')
      : '<span class="muted">Hakuna matumizi yaliyorekodiwa kwenye report hii.</span>';
    return `
      <div class="staff-report-archive-row ${report.autoGenerated ? 'auto' : 'submitted'}">
        <div>
          <strong>${escapeHtml(report.label || `REPORT BY ${report.employee}`)}</strong>
          <span>${formatDate(report.date)} | ${escapeHtml(report.employee || 'Unknown')}</span>
        </div>
        <div class="staff-report-archive-metrics">
          <span>Mauzo: <strong>${formatCurrency(summary.revenue || 0)}</strong></span>
          <span>Matumizi: <strong>${formatCurrency(summary.expenses || 0)}</strong></span>
          <span>Kilichobaki: <strong>${formatCurrency(summary.profit || 0)}</strong></span>
          <span>Miamala: <strong>${summary.transactions || 0}</strong></span>
        </div>
        <div class="staff-report-sold-items">
          <strong>Kilichouzwa</strong>
          <div>${soldItemsHtml}</div>
        </div>
        <div class="staff-report-expense-items">
          <strong>Matumizi</strong>
          <div>${expensesHtml}</div>
        </div>
      </div>
    `;
  }).join('');
}

function submitStaffDailyReport() {
  if (!appState.currentEmployee) {
    alert(t('invalidEmployee'));
    return;
  }
  markStaffDailyReportSubmitted(appState.currentEmployee);
  renderDailyReportStatus();
  renderStaffReportArchive();
  showNotification(`REPORT BY ${appState.currentEmployee}`);
}

function markStaffDailyReportSubmitted(employeeName) {
  if (!Array.isArray(appState.dailyReports)) appState.dailyReports = [];
  const existing = getDailyReportRecord(TODAY, employeeName);
  const record = existing || buildDailyReportRecord(TODAY, employeeName, 'manual');
  record.submittedAt = new Date().toISOString();
  record.autoGenerated = false;
  record.source = 'manual';
  record.label = `REPORT BY ${employeeName}`;
  const employeeExpenses = (appState.expenses || []).filter(expense => expense.date === TODAY && expense.employee === employeeName);
  const employeeSales = appState.sales.filter(sale => sale.date === TODAY && sale.employee === employeeName);
  record.summary = summarizeSales(employeeSales, employeeExpenses);
  record.sales = employeeSales;
  record.expenses = employeeExpenses;
  if (!existing) appState.dailyReports.push(record);
  saveAppState();
  queueOfflineChangeSafe('dailyReport', 'upsert', record, existing?.serverUpdatedAt || existing?.updatedAt || null);
  return record;
}

function runDailyAutoReport({ force = false } = {}) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const reportKey = `auto_report_${date}`;
  if (!force && localStorage.getItem(reportKey)) return;

  const created = ensureMissingDailyReports();
  localStorage.setItem(reportKey, new Date().toISOString());
  renderDailyReportStatus();
  renderStaffReportArchive();
  if (created.length > 0) {
    showNotification(`${created.length} AUTO GENERATED report zimehifadhiwa kwa Admin.`);
    sendAutoGeneratedReportPdfs(created);
  }
}

function scheduleDailyAutoReport() {
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 22 && now.getMinutes() === 0) {
      runDailyAutoReport();
    }
  }, 30000);
}

function renderWeeklyReport() {
  const summary = summarizeSales(getPeriodSales('weekly'), getPeriodExpenses('weekly'));
  
  $('weeklyReport').innerHTML = `
    <div style="display:grid;gap:12px;">
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('weeklySalesReport')}:</span>
        <strong>${formatCurrency(summary.revenue)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('dailyExpenses')}:</span>
        <strong>${formatCurrency(summary.expenses)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('netProfit')}:</span>
        <strong>${formatCurrency(summary.profit)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('itemsSold')}:</span>
        <strong>${summary.items}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('transactions')}:</span>
        <strong>${summary.transactions}</strong>
      </div>
    </div>
  `;
}

function renderMonthlyReport() {
  const summary = summarizeSales(getPeriodSales('monthly'), getPeriodExpenses('monthly'));
  
  $('monthlyReport').innerHTML = `
    <div style="display:grid;gap:12px;">
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('monthlySalesReport')}:</span>
        <strong>${formatCurrency(summary.revenue)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('dailyExpenses')}:</span>
        <strong>${formatCurrency(summary.expenses)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('netProfit')}:</span>
        <strong>${formatCurrency(summary.profit)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('itemsSold')}:</span>
        <strong>${summary.items}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(255,140,66,0.05);border-radius:8px;">
        <span>${t('transactions')}:</span>
        <strong>${summary.transactions}</strong>
      </div>
    </div>
  `;
}

function renderDailySummary() {
  const summary = summarizeSales(getPeriodSales('daily'), getPeriodExpenses('daily'));
  const target = $('dailySummaryText');
  if (target) {
    target.textContent = `Leo umeuza ${formatCurrency(summary.revenue)}; matumizi ni ${formatCurrency(summary.expenses)}; kilichobaki ni ${formatCurrency(summary.profit)}.`;
  }
}

function renderEmployeePerformanceReport() {
  renderPerformanceList('employeePerformanceReport', getPeriodSales('daily'), 'Hakuna mauzo bado', getPeriodExpenses('daily'));
}

function renderEmployeeComments() {
  const container = $('employeeComments');
  container.innerHTML = '';
  
  if (appState.comments.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">${t('noComments')}</div>`;
  } else {
    appState.comments.forEach(comment => {
      const el = document.createElement('div');
      el.className = 'comment-item';
      el.innerHTML = `
        <div class="comment-author">${comment.employee}</div>
        <div class="comment-text">${comment.text}</div>
        <div class="comment-time">${formatDateTime(comment.timestamp)}</div>
      `;
      container.appendChild(el);
    });
  }
}

function saveBossComment() {
  const text = $('bossCommentInput').value.trim();
  if (!text) {
    alert(t('bossCommentPlaceholder'));
    return;
  }
  
  if (!appState.currentEmployee) {
    alert(t('invalidEmployee'));
    return;
  }
  
  appState.comments.push({
    employee: appState.currentEmployee,
    text,
    timestamp: new Date().toISOString()
  });
  
  saveAppState();
  $('bossCommentInput').value = '';
  renderEmployeeComments();
  showNotification(t('addComment'));
}

function renderHistoryTable() {
  renderSavedSalesList();

  const tbody = $('historyTableBody');
  tbody.innerHTML = '';
  
  const sales = getHistorySales();
  const summary = new Map();

  sales.forEach(sale => {
    const employee = sale.employee || 'Unknown';
    const row = summary.get(employee) || {
      employee,
      transactions: new Set(),
      items: 0,
      total: 0,
      lastSale: sale.timestamp
    };

    row.transactions.add(getSaleTransactionKey(sale));
    row.items += sale.quantity;
    row.total += sale.total;

    if (new Date(sale.timestamp) > new Date(row.lastSale)) {
      row.lastSale = sale.timestamp;
    }

    summary.set(employee, row);
  });
  
  const rows = [...summary.values()].sort((a, b) => b.total - a.total);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted);">${t('noSavedSales')}</td></tr>`;
  } else {
    rows.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.employee}</td>
        <td>${item.transactions.size}</td>
        <td>${item.items}</td>
        <td>${formatCurrency(item.total)}</td>
        <td>${formatTime(item.lastSale)}</td>
      `;
      tbody.appendChild(row);
    });
  }
}

function renderPerformanceList(containerId, sales, emptyText = 'Hakuna mauzo bado', expenses = null) {
  const container = $(containerId);
  if (!container) return;

  const rows = getEmployeePerformance(sales, expenses);
  container.innerHTML = '';

  if (rows.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">${emptyText}</div>`;
    return;
  }

  rows.forEach(row => {
    const item = document.createElement('div');
    item.className = 'performance-item';
    item.innerHTML = `
      <div>
        <strong>${row.employee}</strong>
        <span>${row.transactions.size} ${t('sales')} • ${row.items} ${t('items')}</span>
      </div>
      <div>
        <strong>${formatCurrency(row.revenue)}</strong>
        <span>${t('dailyExpenses')}: ${formatCurrency(row.expenses || 0)} | ${t('netProfit')}: ${formatCurrency(row.profit)}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

function renderDashboardEmployeePerformance() {
  renderPerformanceList('dashboardEmployeePerformance', getPeriodSales('daily'), 'Hakuna mauzo bado', getPeriodExpenses('daily'));
}

function renderStaffSalesPanel() {
  const sales = getCurrentEmployeeTodaySales();
  const expenses = getCurrentEmployeeTodayExpenses();
  const expenseTotal = sumExpenses(expenses);
  const summary = summarizeSales(sales, expenses);
  const transactions = groupSalesByTransaction(sales);

  if ($('staffTodayTotal')) $('staffTodayTotal').textContent = formatCurrency(summary.revenue);
  if ($('staffTodayItems')) $('staffTodayItems').textContent = summary.items;
  if ($('staffTodayTransactions')) $('staffTodayTransactions').textContent = transactions.length;
  if ($('staffTodayExpenses')) $('staffTodayExpenses').textContent = formatCurrency(expenseTotal);
  if ($('staffTodayNet')) $('staffTodayNet').textContent = formatCurrency(summary.profit);

  renderStaffExpenseList(expenses);

  const container = $('staffSalesList');
  if (!container) return;
  container.innerHTML = '';

  if (!appState.currentEmployee) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Login kwanza kuona mauzo yako</div>';
    return;
  }

  if (sales.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Bado hujauza bidhaa leo</div>';
    return;
  }

  sales.forEach(sale => {
    const row = document.createElement('div');
    row.className = 'staff-sale-row';
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(sale.productName)}</strong>
        <span>${formatTime(sale.timestamp)} • ${sale.quantity} x ${formatCurrency(sale.price)}</span>
      </div>
      <div class="staff-sale-price">${formatCurrency(sale.total)}</div>
    `;
    container.appendChild(row);
  });
}

function renderStaffExpenseList(expenses = getCurrentEmployeeTodayExpenses()) {
  const container = $('staffExpenseList');
  if (!container) return;
  container.innerHTML = '';

  if (!appState.currentEmployee) {
    container.innerHTML = `<div class="staff-expense-empty">${t('invalidEmployee')}</div>`;
    return;
  }

  if (expenses.length === 0) {
    container.innerHTML = `<div class="staff-expense-empty">${t('noExpensesToday')}</div>`;
    return;
  }

  expenses.forEach(expense => {
    const row = document.createElement('div');
    row.className = 'staff-expense-row';
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(expense.name)}</strong>
        <span>${formatTime(expense.timestamp)}</span>
      </div>
      <div class="staff-expense-side">
        <div class="staff-expense-amount">${formatCurrency(expense.amount)}</div>
        <div class="staff-expense-actions">
          <button class="btn btn-icon staff-expense-action" type="button" onclick="editStaffExpense('${expense.id}')" title="${t('editExpense')}" aria-label="${t('editExpense')}">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn btn-icon staff-expense-action danger" type="button" onclick="deleteStaffExpense('${expense.id}')" title="${t('deleteExpense')}" aria-label="${t('deleteExpense')}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    container.appendChild(row);
  });
}

function canManageStaffExpense(expense) {
  return Boolean(expense && expense.date === TODAY && expense.employee === appState.currentEmployee);
}

function refreshExpenseViews() {
  renderStaffSalesPanel();
  updateDashboard();
  renderDailyReport();
  renderWeeklyReport();
  renderMonthlyReport();
  renderDailySummary();
  renderEmployeePerformanceReport();
}

function addStaffExpense() {
  if (!appState.currentEmployee) {
    alert(t('invalidEmployee'));
    return false;
  }

  const nameInput = $('staffExpenseName');
  const amountInput = $('staffExpenseAmount');
  const name = nameInput?.value.trim() || '';
  const amount = Number(amountInput?.value || 0);

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    alert(t('expenseInvalid'));
    return false;
  }

  if (!Array.isArray(appState.expenses)) appState.expenses = [];
  const timestamp = new Date().toISOString();
  const expense = {
    id: `expense_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    employee: appState.currentEmployee,
    ownerAdmin: getOwnerAdminForUser(appState.currentEmployee) || null,
    name,
    amount,
    date: TODAY,
    timestamp
  };

  appState.expenses.push(expense);
  saveAppState();
  queueOfflineChangeSafe('expense', 'insert', expense);
  if (nameInput) nameInput.value = '';
  if (amountInput) amountInput.value = '';
  renderStaffSalesPanel();
  updateDashboard();
  renderDailyReport();
  renderDailySummary();
  showNotification(t('expenseSaved'));
  return true;
}

function editStaffExpense(expenseId) {
  const expense = (appState.expenses || []).find(item => item.id === expenseId);
  if (!canManageStaffExpense(expense)) {
    alert(t('invalidEmployee'));
    return false;
  }

  const nextName = prompt(t('expenseNamePlaceholder'), expense.name);
  if (nextName === null) return false;

  const nextAmountText = prompt(t('expenseAmountPlaceholder'), String(expense.amount));
  if (nextAmountText === null) return false;

  const name = nextName.trim();
  const amount = Number(nextAmountText);
  if (!name || !Number.isFinite(amount) || amount <= 0) {
    alert(t('expenseInvalid'));
    return false;
  }

  expense.name = name;
  expense.amount = amount;
  expense.updatedAt = new Date().toISOString();
  saveAppState();
  queueOfflineChangeSafe('expense', 'upsert', expense, expense.serverUpdatedAt || null);
  refreshExpenseViews();
  showNotification(t('expenseUpdated'));
  return true;
}

function deleteStaffExpense(expenseId) {
  const expense = (appState.expenses || []).find(item => item.id === expenseId);
  if (!canManageStaffExpense(expense)) {
    alert(t('invalidEmployee'));
    return false;
  }

  if (!confirm(`${t('deleteExpense')}: ${expense.name}?`)) return false;
  appState.expenses = (appState.expenses || []).filter(item => item.id !== expenseId);
  saveAppState();
  queueOfflineChangeSafe('expense', 'delete', { id: expenseId, deletedAt: new Date().toISOString() }, expense.serverUpdatedAt || null);
  refreshExpenseViews();
  showNotification(t('expenseDeleted'));
  return true;
}

function saveCustomerFromForm() {
  const name = $('customerFormName')?.value.trim() || '';
  const phone = $('customerFormPhone')?.value.trim() || '';
  const email = $('customerFormEmail')?.value.trim() || '';
  const notes = $('customerFormNotes')?.value.trim() || '';
  if (!name) {
    alert(t('customerName'));
    return false;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert(t('signupEmailInvalid'));
    return false;
  }
  upsertCustomer({ name, phone, email, notes });
  saveAppState();
  ['customerFormName', 'customerFormPhone', 'customerFormEmail', 'customerFormNotes'].forEach(id => {
    const input = $(id);
    if (input) input.value = '';
  });
  renderCustomersView();
  updateCustomerSuggestions();
  showNotification(t('customers'));
  return true;
}

function recordCustomerPayment(customerId) {
  const customer = (appState.customers || []).find(item => item.id === customerId);
  if (!customer) return false;
  const balance = getCustomerBalance(customerId);
  if (balance <= 0) {
    showNotification('Hakuna deni lililobaki');
    return false;
  }
  const value = prompt(`${t('recordPayment')} - ${customer.name}`, String(balance));
  if (value === null) return false;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    alert(t('expenseInvalid'));
    return false;
  }
  const timestamp = new Date().toISOString();
  const payment = {
    id: `custpay_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    customerId,
    customerName: customer.name,
    amount: Math.min(amount, balance),
    employee: appState.currentEmployee,
    ownerAdmin: customer.ownerAdmin || getCurrentOwnerAdmin(),
    date: TODAY,
    timestamp
  };
  if (!Array.isArray(appState.customerPayments)) appState.customerPayments = [];
  appState.customerPayments.push(payment);
  queueOfflineChangeSafe('customerPayment', 'upsert', payment);
  saveAppState();
  renderCustomersView();
  updateDashboard();
  showNotification(t('recordPayment'));
  return true;
}

function deleteCustomerPayment(paymentId) {
  const payment = (appState.customerPayments || []).find(item => item.id === paymentId);
  if (!payment) return false;
  const customer = (appState.customers || []).find(item => item.id === payment.customerId);
  const ownerAdmin = getCurrentOwnerAdmin();
  const accounts = getVisibleBusinessAccounts();
  const canManage = isSuperAdmin()
    || payment.employee === appState.currentEmployee
    || payment.ownerAdmin === ownerAdmin
    || accounts?.has(payment.employee);
  if (!canManage) {
    alert(t('invalidEmployee'));
    return false;
  }
  if (!confirm(`Futa payment ya ${formatCurrency(payment.amount)}${customer ? ` - ${customer.name}` : ''}?`)) return false;
  appState.customerPayments = (appState.customerPayments || []).filter(item => item.id !== paymentId);
  queueOfflineChangeSafe('customerPayment', 'delete', { id: paymentId, deletedAt: new Date().toISOString() }, payment.serverUpdatedAt || null);
  saveAppState();
  renderCustomersView();
  updateDashboard();
  showNotification('Payment imefutwa');
  return true;
}

function clearPaidCustomerDebt(customerId) {
  const customer = (appState.customers || []).find(item => item.id === customerId);
  if (!customer) return false;
  const balance = getCustomerBalance(customerId);
  if (balance > 0) {
    alert(`Mteja bado ana deni: ${formatCurrency(balance)}`);
    return false;
  }
  if (!confirm(`Safisha debt records zilizolipwa za ${customer.name}?`)) return false;
  const now = new Date().toISOString();
  getVisibleCustomerDebts(appState.customerDebts || [])
    .filter(debt => debt.customerId === customerId && !debt.clearedAt)
    .forEach(debt => {
      debt.clearedAt = now;
      debt.status = 'settled';
      debt.updatedAt = now;
      queueOfflineChangeSafe('customerDebt', 'upsert', debt, debt.serverUpdatedAt || null);
    });
  getVisibleCustomerPayments(appState.customerPayments || [])
    .filter(payment => payment.customerId === customerId && !payment.clearedAt)
    .forEach(payment => {
      payment.clearedAt = now;
      payment.updatedAt = now;
      queueOfflineChangeSafe('customerPayment', 'upsert', payment, payment.serverUpdatedAt || null);
    });
  saveAppState();
  renderCustomersView();
  updateDashboard();
  showNotification('Deni lililolipwa limesafishwa');
  return true;
}

function deleteCustomerIfSettled(customerId) {
  const customer = (appState.customers || []).find(item => item.id === customerId);
  if (!customer) return false;
  const visibleBalance = getCustomerBalance(customerId);
  const globalBalance = getCustomerGlobalBalance(customerId);
  if (visibleBalance > 0 || globalBalance > 0) {
    alert(`Huwezi kufuta mteja mwenye deni: ${formatCurrency(Math.max(visibleBalance, globalBalance))}`);
    return false;
  }
  if (!confirm(`Futa mteja ${customer.name}? Historia ya mauzo haitafutwa.`)) return false;
  const now = new Date().toISOString();
  getVisibleCustomerDebts(appState.customerDebts || [])
    .filter(debt => debt.customerId === customerId)
    .forEach(debt => {
      debt.clearedAt = debt.clearedAt || now;
      debt.status = 'settled';
      debt.updatedAt = now;
      queueOfflineChangeSafe('customerDebt', 'upsert', debt, debt.serverUpdatedAt || null);
    });
  getVisibleCustomerPayments(appState.customerPayments || [])
    .filter(payment => payment.customerId === customerId)
    .forEach(payment => {
      payment.clearedAt = payment.clearedAt || now;
      payment.updatedAt = now;
      queueOfflineChangeSafe('customerPayment', 'upsert', payment, payment.serverUpdatedAt || null);
    });
  appState.customers = (appState.customers || []).filter(item => item.id !== customerId);
  queueOfflineChangeSafe('customer', 'delete', { id: customerId, deletedAt: now }, customer.serverUpdatedAt || null);
  saveAppState();
  renderCustomersView();
  updateCustomerSuggestions();
  updateDashboard();
  showNotification('Mteja amefutwa');
  return true;
}

function seedDemoCustomerDebts() {
  if (!appState.currentEmployee) {
    alert(t('invalidEmployee'));
    return false;
  }

  const ownerAdmin = getCurrentOwnerAdmin() || (isSuperAdmin() ? getAdminEmployees()[0] : appState.currentEmployee);
  const now = new Date().toISOString();
  const demoCustomers = [
    { name: 'Asha Juma', phone: '+255712000001', amount: 25000, paid: 5000 },
    { name: 'Baraka Mushi', phone: '+255712000002', amount: 42000, paid: 0 },
    { name: 'Neema Ally', phone: '+255712000003', amount: 18000, paid: 8000 },
    { name: 'Hassan Said', phone: '+255712000004', amount: 65000, paid: 15000 }
  ];

  demoCustomers.forEach((item, index) => {
    const customer = upsertCustomer({
      name: item.name,
      phone: item.phone,
      notes: 'Demo debt customer'
    });
    customer.ownerAdmin = ownerAdmin;
    customer.createdBy = appState.currentEmployee;
    customer.updatedAt = now;
    queueOfflineChangeSafe('customer', 'upsert', customer, customer.serverUpdatedAt || null);

    const debtId = `demo_debt_${ownerAdmin}_${index + 1}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!(appState.customerDebts || []).some(debt => debt.id === debtId)) {
      const debt = {
        id: debtId,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        transactionId: `demo_txn_${index + 1}`,
        saleIds: [],
        amount: item.amount,
        originalAmount: item.amount,
        paidAtSale: 0,
        total: item.amount,
        status: 'credit',
        employee: appState.currentEmployee,
        ownerAdmin,
        date: TODAY,
        timestamp: now,
        updatedAt: now
      };
      if (!Array.isArray(appState.customerDebts)) appState.customerDebts = [];
      appState.customerDebts.push(debt);
      queueOfflineChangeSafe('customerDebt', 'upsert', debt);
    }

    const paymentId = `demo_payment_${ownerAdmin}_${index + 1}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (item.paid > 0 && !(appState.customerPayments || []).some(payment => payment.id === paymentId)) {
      const payment = {
        id: paymentId,
        customerId: customer.id,
        customerName: customer.name,
        amount: item.paid,
        employee: appState.currentEmployee,
        ownerAdmin,
        date: TODAY,
        timestamp: now
      };
      if (!Array.isArray(appState.customerPayments)) appState.customerPayments = [];
      appState.customerPayments.push(payment);
      queueOfflineChangeSafe('customerPayment', 'upsert', payment);
    }
  });

  saveAppState();
  updateDashboard();
  renderCustomersView();
  updateCustomerSuggestions();
  showNotification('Demo customers added');
  return true;
}

function renderCustomersView() {
  updateCustomerSuggestions();
  const container = $('customersList');
  const customers = getVisibleCustomers();
  const debts = getVisibleCustomerDebts();
  const payments = getVisibleCustomerPayments();
  const search = String($('customerSearchInput')?.value || '').trim().toLowerCase();
  const filtered = customers
    .filter(customer => !search
      || String(customer.name || '').toLowerCase().includes(search)
      || String(customer.phone || '').toLowerCase().includes(search))
    .sort((a, b) => getCustomerBalance(b.id) - getCustomerBalance(a.id));

  if ($('customerTotalCount')) $('customerTotalCount').textContent = customers.length;
  if ($('customerTotalDebt')) {
    const totalDebt = debts.filter(debt => !debt.clearedAt).reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
    const totalPayments = payments.filter(payment => !payment.clearedAt).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    $('customerTotalDebt').textContent = formatCurrency(Math.max(0, totalDebt - totalPayments));
  }
  if ($('customerTotalPayments')) {
    $('customerTotalPayments').textContent = formatCurrency(payments.filter(payment => !payment.clearedAt).reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  }
  updateCustomerInsightPanel();
  if ($('debtsPageTitle')) {
    $('debtsPageTitle').textContent = appState.currentRole === 'user' ? 'Madeni Uliyokopesha' : 'Madeni ya Wateja';
  }
  if ($('debtsListTitle')) {
    $('debtsListTitle').textContent = appState.currentRole === 'user' ? 'Wateja Uliowakopesha' : 'Madeni ya Users Wako';
  }
  if ($('debtsHelpText')) {
    $('debtsHelpText').textContent = appState.currentRole === 'user'
      ? 'Ukiuza kwa Credit au Partial kwenye POS, deni la mteja litaonekana hapa kwako.'
      : 'Admin anaona madeni yote yaliyoingizwa na users wake. Tumia Pokea Malipo kupunguza deni.';
  }

  if (!container) return;
  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = `<div class="customer-empty">${t('noCustomers')}</div>`;
    return;
  }

  filtered.forEach(customer => {
    const balance = getCustomerBalance(customer.id);
    const debtCount = debts.filter(debt => debt.customerId === customer.id && !debt.clearedAt).length;
    const customerPayments = payments
      .filter(payment => payment.customerId === customer.id && !payment.clearedAt)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 3);
    const debtOwners = [...new Set(debts
      .filter(debt => debt.customerId === customer.id && !debt.clearedAt)
      .map(debt => debt.employee)
      .filter(Boolean))];
    const row = document.createElement('div');
    row.className = 'customer-row';
    row.innerHTML = `
      <div class="customer-main">
        <strong>${escapeHtml(customer.name)}</strong>
        <span>${escapeHtml(customer.phone || '-')}</span>
        ${customer.email ? `<span>${escapeHtml(customer.email)}</span>` : ''}
        ${debtOwners.length && appState.currentRole !== 'user' ? `<small>Aliyekopesha: ${escapeHtml(debtOwners.join(', '))}</small>` : ''}
        ${appState.currentRole === 'user' ? `<small>Uliyemkopesha kupitia POS</small>` : ''}
        ${customer.notes ? `<small>${escapeHtml(customer.notes)}</small>` : ''}
        ${customer.lastReminderAt ? `<small>Reminder: ${escapeHtml(customer.lastReminderChannel || '-')}, ${formatDateTime(customer.lastReminderAt)}</small>` : ''}
        ${customerPayments.length ? `
          <div class="customer-payments">
            ${customerPayments.map(payment => `
              <span>
                ${formatCurrency(payment.amount)}
                <button class="customer-link danger" type="button" onclick="deleteCustomerPayment('${payment.id}')">Futa</button>
              </span>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="customer-metrics">
        <span>${t('outstandingDebt')}</span>
        <strong class="${balance > 0 ? 'debt' : 'paid'}">${formatCurrency(balance)}</strong>
        <small>${debtCount} ${debtCount === 1 ? 'debt record' : 'debt records'}</small>
      </div>
      <div class="customer-actions">
        <div class="reminder-actions" aria-label="Debt reminders">
          <button class="btn btn-small btn-success" type="button" onclick="sendCustomerDebtReminder('${customer.id}', 'whatsapp')" ${balance <= 0 || !customer.phone ? 'disabled' : ''}>WhatsApp</button>
          <button class="btn btn-small btn-secondary" type="button" onclick="sendCustomerDebtReminder('${customer.id}', 'sms')" ${balance <= 0 || !customer.phone ? 'disabled' : ''}>SMS</button>
          <button class="btn btn-small btn-secondary" type="button" onclick="sendCustomerDebtReminder('${customer.id}', 'email')" ${balance <= 0 || !customer.email ? 'disabled' : ''}>Email</button>
        </div>
        <button class="btn btn-secondary" type="button" onclick="recordCustomerPayment('${customer.id}')" ${balance <= 0 ? 'disabled' : ''}>${t('recordPayment')}</button>
        <button class="btn btn-secondary" type="button" onclick="clearPaidCustomerDebt('${customer.id}')" ${balance > 0 || debtCount === 0 ? 'disabled' : ''}>Safisha</button>
        <button class="btn btn-danger" type="button" onclick="deleteCustomerIfSettled('${customer.id}')" ${balance > 0 ? 'disabled' : ''}>Futa</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderAdminStaffPanel() {
  const container = $('adminStaffList');
  if (!container) return;
  if (!isAdmin() && !isSuperAdmin()) {
    container.innerHTML = '';
    return;
  }

  const adminName = isSuperAdmin() ? getAdminEmployees()[0] : appState.currentEmployee;
  const employees = getAdminUserAssignments(adminName)
    .filter(employeeName => appState.employees?.[employeeName] && !appState.employees[employeeName].removed);

  if (employees.length === 0) {
    container.innerHTML = '<div class="admin-staff-empty">Bado hakuna mfanyakazi aliyesajiliwa chini yako.</div>';
    return;
  }

  container.innerHTML = employees.map(employeeName => {
    const account = appState.employees[employeeName] || {};
    const isOnline = Boolean(account.isOnline);
    const lastLogin = account.lastLogin ? formatDateTime(account.lastLogin) : 'Hajaingia bado';
    const statusText = isOnline ? 'Active' : 'Not Active';
    const encodedName = encodeURIComponent(employeeName);
    return `
      <div class="admin-staff-row">
        <div>
          <strong>${escapeHtml(employeeName)}</strong>
          <span>${escapeHtml(lastLogin)}</span>
        </div>
        <div class="admin-staff-actions">
          <span class="staff-online-badge ${isOnline ? 'active' : 'inactive'}">${statusText}</span>
          <button class="btn btn-small btn-secondary" type="button" onclick="openAdminEmployeeTimeline(decodeURIComponent('${encodedName}'))">Mtiririko</button>
          <button class="btn btn-small btn-danger" type="button" onclick="adminRemoveStaffMember(decodeURIComponent('${encodedName}'))">Ondoa</button>
        </div>
      </div>
    `;
  }).join('');
}

function canViewAdminEmployeeTimeline(employeeName) {
  if (!employeeName || (!isAdmin() && !isSuperAdmin())) return false;
  if (isSuperAdmin()) return Boolean(appState.employees?.[employeeName]);
  const adminName = appState.currentEmployee;
  return getAdminUserAssignments(adminName).includes(employeeName);
}

function getAdminEmployeeTimelineDateRange() {
  const state = adminEmployeeTimelineState;
  if (state.period === 'today') {
    return { from: TODAY, to: TODAY };
  }
  if (state.period === 'weekly') {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    return { from: weekStart.toISOString().slice(0, 10), to: TODAY };
  }
  if (state.period === 'monthly') {
    const monthStart = new Date();
    monthStart.setDate(1);
    return { from: monthStart.toISOString().slice(0, 10), to: TODAY };
  }
  if (state.period === 'custom') {
    return { from: state.from || '', to: state.to || '' };
  }
  return { from: '', to: '' };
}

function isDateInAdminEmployeeTimelineRange(date) {
  const range = getAdminEmployeeTimelineDateRange();
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function updateAdminEmployeeTimelineFilterButtons() {
  document.querySelectorAll('[data-employee-timeline-period]').forEach(button => {
    button.classList.toggle('active', button.dataset.employeeTimelinePeriod === adminEmployeeTimelineState.period);
  });
}

function getAdminEmployeeTimelineRows(employeeName) {
  const employeeSales = getVisibleSales(appState.sales || [])
    .filter(sale => {
      const date = sale.date || String(sale.timestamp || '').slice(0, 10) || TODAY;
      return sale.employee === employeeName && isDateInAdminEmployeeTimelineRange(date);
    });
  const employeeExpenses = getVisibleExpenses(appState.expenses || [])
    .filter(expense => {
      const date = expense.date || String(expense.timestamp || '').slice(0, 10) || TODAY;
      return expense.employee === employeeName && isDateInAdminEmployeeTimelineRange(date);
    });
  const rowsByDate = new Map();

  employeeSales.forEach(sale => {
    const date = sale.date || String(sale.timestamp || '').slice(0, 10) || TODAY;
    const row = rowsByDate.get(date) || { date, sales: [], expenses: [] };
    row.sales.push(sale);
    rowsByDate.set(date, row);
  });

  employeeExpenses.forEach(expense => {
    const date = expense.date || String(expense.timestamp || '').slice(0, 10) || TODAY;
    const row = rowsByDate.get(date) || { date, sales: [], expenses: [] };
    row.expenses.push(expense);
    rowsByDate.set(date, row);
  });

  return [...rowsByDate.values()]
    .map(row => ({ ...row, summary: summarizeSales(row.sales, row.expenses) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function openAdminEmployeeTimeline(employeeName) {
  if (!canViewAdminEmployeeTimeline(employeeName)) {
    showNotification('Huna ruhusa ya kuona mtiririko wa mfanyakazi huyu.');
    return;
  }

  adminEmployeeTimelineState.employeeName = employeeName;
  const panel = $('adminEmployeeTimelinePanel');
  const list = $('adminEmployeeTimelineList');
  if (!panel || !list) return;

  const rows = getAdminEmployeeTimelineRows(employeeName);
  const totalSales = rows.reduce((sum, row) => sum + row.summary.revenue, 0);
  const totalExpenses = rows.reduce((sum, row) => sum + row.summary.expenses, 0);

  if ($('adminEmployeeTimelineName')) $('adminEmployeeTimelineName').textContent = employeeName;
  if ($('adminEmployeeTimelineSales')) $('adminEmployeeTimelineSales').textContent = formatCurrency(totalSales);
  if ($('adminEmployeeTimelineExpenses')) $('adminEmployeeTimelineExpenses').textContent = formatCurrency(totalExpenses);
  if ($('adminEmployeeTimelineProfit')) $('adminEmployeeTimelineProfit').textContent = formatCurrency(totalSales - totalExpenses);
  if ($('adminEmployeeTimelineFrom')) $('adminEmployeeTimelineFrom').value = adminEmployeeTimelineState.from || '';
  if ($('adminEmployeeTimelineTo')) $('adminEmployeeTimelineTo').value = adminEmployeeTimelineState.to || '';
  updateAdminEmployeeTimelineFilterButtons();

  if (rows.length === 0) {
    list.innerHTML = '<div class="admin-staff-empty">Bado hakuna mauzo au matumizi yaliyohifadhiwa kwa mfanyakazi huyu.</div>';
  } else {
    list.innerHTML = rows.map(row => {
      const expenseItems = row.expenses
        .map(expense => `<span>${escapeHtml(expense.name)}: ${formatCurrency(expense.amount)}</span>`)
        .join('');
      const productItems = row.sales.reduce((acc, sale) => {
        const name = sale.productName || 'Unknown';
        acc[name] = (acc[name] || 0) + Number(sale.quantity || 0);
        return acc;
      }, {});
      const productLines = Object.entries(productItems)
        .map(([name, quantity]) => `<span>${escapeHtml(name)} x${quantity}</span>`)
        .join('');
      return `
        <div class="admin-employee-day-row">
          <div class="admin-employee-day-title">
            <strong>${formatDate(row.date)}</strong>
            <span>${row.summary.transactions} miamala | ${row.summary.items} bidhaa</span>
          </div>
          <div class="admin-employee-day-metrics">
            <span>Mauzo: <strong>${formatCurrency(row.summary.revenue)}</strong></span>
            <span>Matumizi: <strong>${formatCurrency(row.summary.expenses)}</strong></span>
            <span>Kilichobaki: <strong>${formatCurrency(row.summary.profit)}</strong></span>
          </div>
          <div class="admin-employee-day-products ${productLines ? '' : 'muted'}">
            ${productLines || 'Hakuna mauzo siku hii'}
          </div>
          <div class="admin-employee-expense-lines ${expenseItems ? '' : 'muted'}">
            ${expenseItems || 'Hakuna matumizi siku hii'}
          </div>
        </div>
      `;
    }).join('');
  }

  panel.classList.remove('hidden');
}

function getTodaySalesCount() {
  return getVisibleSales(appState.sales || []).filter(sale => sale.date === TODAY).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
}

function getCustomerInsightStats() {
  const sales = getVisibleSales(appState.sales || []);
  const customerTotals = {};
  const productTotals = {};

  sales.forEach(sale => {
    const customerKey = sale.customerId || sale.customerName || 'Unknown';
    const customerName = sale.customerName || sale.customerId || 'Unknown';
    if (!customerTotals[customerKey]) {
      customerTotals[customerKey] = { name: customerName, revenue: 0, quantity: 0, transactions: 0 };
    }
    customerTotals[customerKey].revenue += Number(sale.total || 0);
    customerTotals[customerKey].quantity += Number(sale.quantity || 0);
    customerTotals[customerKey].transactions += 1;

    const productName = sale.productName || 'Unknown';
    if (!productTotals[productName]) {
      productTotals[productName] = { name: productName, quantity: 0, revenue: 0 };
    }
    productTotals[productName].quantity += Number(sale.quantity || 0);
    productTotals[productName].revenue += Number(sale.total || 0);
  });

  const customerList = Object.values(customerTotals).sort((a, b) => b.revenue - a.revenue);
  const productList = Object.values(productTotals).sort((a, b) => b.quantity - a.quantity);

  return {
    customerList,
    productList,
    totalCustomers: customerList.length,
    totalSalesRevenue: sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)
  };
}

function updateCustomerInsightPanel() {
  const containerRows = $('customerInsightRows');
  if (!containerRows) return;

  const stats = getCustomerInsightStats();
  const bestCustomer = stats.customerList[0] || null;
  const bestProduct = stats.productList[0] || null;

  if ($('bestCustomerName')) $('bestCustomerName').textContent = bestCustomer ? bestCustomer.name : '-';
  if ($('bestCustomerTotal')) $('bestCustomerTotal').textContent = bestCustomer ? formatCurrency(bestCustomer.revenue) : '-';
  if ($('bestProductName')) $('bestProductName').textContent = bestProduct ? bestProduct.name : '-';
  if ($('bestProductCount')) $('bestProductCount').textContent = bestProduct ? `${bestProduct.quantity} sold` : '-';
  if ($('customerInsightCount')) $('customerInsightCount').textContent = stats.totalCustomers;

  if (stats.customerList.length === 0 || stats.productList.length === 0) {
    containerRows.innerHTML = '<div style="color:var(--text-muted);padding:12px;">Hakuna data ya mauzo ya sasa.</div>';
    return;
  }

  const topCustomersHtml = stats.customerList.slice(0, 3).map((customer, index) => `
    <div class="insight-detail-row">
      <strong>${index + 1}. ${escapeHtml(customer.name)}</strong>
      <span>${formatCurrency(customer.revenue)} • ${customer.quantity} items</span>
    </div>
  `).join('');

  const topProductsHtml = stats.productList.slice(0, 3).map((product, index) => `
    <div class="insight-detail-row">
      <strong>${index + 1}. ${escapeHtml(product.name)}</strong>
      <span>${product.quantity} sold</span>
    </div>
  `).join('');

  containerRows.innerHTML = `
    <div style="display:grid;gap:10px;">
      <div style="padding:12px;background:var(--surface);border-radius:12px;">
        <strong>Top customers</strong>
        ${topCustomersHtml}
      </div>
      <div style="padding:12px;background:var(--surface);border-radius:12px;">
        <strong>Top products</strong>
        ${topProductsHtml}
      </div>
    </div>
  `;
}

function refreshAdminEmployeeTimeline() {
  if (!adminEmployeeTimelineState.employeeName) return;
  openAdminEmployeeTimeline(adminEmployeeTimelineState.employeeName);
}

function setAdminEmployeeTimelinePeriod(period) {
  adminEmployeeTimelineState.period = period;
  if (period !== 'custom') {
    adminEmployeeTimelineState.from = '';
    adminEmployeeTimelineState.to = '';
  }
  refreshAdminEmployeeTimeline();
}

function setAdminEmployeeTimelineCustomDates() {
  adminEmployeeTimelineState.period = 'custom';
  adminEmployeeTimelineState.from = $('adminEmployeeTimelineFrom')?.value || '';
  adminEmployeeTimelineState.to = $('adminEmployeeTimelineTo')?.value || '';
  refreshAdminEmployeeTimeline();
}

function getAdminEmployeeTimelinePeriodLabel() {
  const range = getAdminEmployeeTimelineDateRange();
  if (adminEmployeeTimelineState.period === 'today') return `Leo (${TODAY})`;
  if (adminEmployeeTimelineState.period === 'weekly') return `Wiki hii (${range.from} - ${range.to})`;
  if (adminEmployeeTimelineState.period === 'monthly') return `Mwezi huu (${range.from} - ${range.to})`;
  if (adminEmployeeTimelineState.period === 'custom') {
    if (range.from && range.to) return `${range.from} - ${range.to}`;
    if (range.from) return `Kuanzia ${range.from}`;
    if (range.to) return `Mpaka ${range.to}`;
  }
  return 'Siku zote';
}

function exportAdminEmployeeTimelineCsv() {
  const employeeName = adminEmployeeTimelineState.employeeName;
  if (!canViewAdminEmployeeTimeline(employeeName)) return;
  const rows = getAdminEmployeeTimelineRows(employeeName);
  const csvRows = [
    ['Employee', 'Period', 'Date', 'Transactions', 'Items', 'Sales', 'Expenses', 'Net Profit', 'Expense Details']
  ];

  rows.forEach(row => {
    csvRows.push([
      employeeName,
      getAdminEmployeeTimelinePeriodLabel(),
      row.date,
      row.summary.transactions,
      row.summary.items,
      row.summary.revenue,
      row.summary.expenses,
      row.summary.profit,
      row.expenses.map(expense => `${expense.name}: ${expense.amount}`).join('; ')
    ]);
  });

  const csv = csvRows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mtiririko_${employeeName.replace(/\s+/g, '_')}_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function printAdminEmployeeTimeline() {
  const employeeName = adminEmployeeTimelineState.employeeName;
  if (!canViewAdminEmployeeTimeline(employeeName)) return;
  const rows = getAdminEmployeeTimelineRows(employeeName);
  const totalSales = rows.reduce((sum, row) => sum + row.summary.revenue, 0);
  const totalExpenses = rows.reduce((sum, row) => sum + row.summary.expenses, 0);
  const reportWindow = window.open('', '_blank');

  if (!reportWindow) {
    showNotification('Popup imezuiwa. Ruhusu popups ili kuchapisha report.');
    return;
  }

  const dayRows = rows.map(row => `
    <tr>
      <td>${formatDate(row.date)}</td>
      <td>${row.summary.transactions}</td>
      <td>${row.summary.items}</td>
      <td>${formatCurrency(row.summary.revenue)}</td>
      <td>${formatCurrency(row.summary.expenses)}</td>
      <td>${formatCurrency(row.summary.profit)}</td>
      <td>${escapeHtml(row.expenses.map(expense => `${expense.name}: ${formatCurrency(expense.amount)}`).join('; ') || 'Hakuna')}</td>
    </tr>
  `).join('') || '<tr><td colspan="7">Hakuna data kwenye kipindi hiki</td></tr>';

  reportWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Mtiririko - ${escapeHtml(employeeName)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #17202a; padding: 32px; }
          h1 { margin: 0 0 6px; }
          .muted { color: #667085; margin-bottom: 22px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
          .box { border: 1px solid #d0d5dd; border-radius: 8px; padding: 14px; }
          .label { color: #667085; font-size: 12px; }
          .value { font-size: 20px; font-weight: 700; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border-bottom: 1px solid #eaecf0; text-align: left; padding: 10px; vertical-align: top; }
          th { background: #f2f4f7; }
          @media print { body { padding: 18px; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(appState.settings.businessName)} - Mtiririko wa Mfanyakazi</h1>
        <div class="muted">${escapeHtml(employeeName)} | ${escapeHtml(getAdminEmployeeTimelinePeriodLabel())} | Generated ${formatDateTime(new Date())}</div>
        <div class="grid">
          <div class="box"><div class="label">Mauzo yote</div><div class="value">${formatCurrency(totalSales)}</div></div>
          <div class="box"><div class="label">Matumizi yote</div><div class="value">${formatCurrency(totalExpenses)}</div></div>
          <div class="box"><div class="label">Kilichobaki</div><div class="value">${formatCurrency(totalSales - totalExpenses)}</div></div>
        </div>
        <table>
          <thead><tr><th>Tarehe</th><th>Miamala</th><th>Bidhaa</th><th>Mauzo</th><th>Matumizi</th><th>Kilichobaki</th><th>Maelezo ya matumizi</th></tr></thead>
          <tbody>${dayRows}</tbody>
        </table>
        <script>window.onload = () => window.print();<\/script>
      </body>
    </html>
  `);
  reportWindow.document.close();
}

function closeAdminEmployeeTimeline() {
  const panel = $('adminEmployeeTimelinePanel');
  if (panel) panel.classList.add('hidden');
}

function getCurrentAdminNameForStaffManagement() {
  if (isAdmin()) return appState.currentEmployee;
  if (isSuperAdmin()) return getAdminEmployees()[0] || null;
  return null;
}

function adminAddStaffMember() {
  const adminName = getCurrentAdminNameForStaffManagement();
  if (!adminName) {
    alert('Admin pekee anaweza kuongeza mfanyakazi');
    return;
  }

  const nameInput = $('adminStaffName');
  const passwordInput = $('adminStaffPassword');
  const employeeName = nameInput?.value.trim();
  const password = passwordInput?.value.trim() || '';

  if (!employeeName) {
    alert('Weka jina la mfanyakazi');
    return;
  }
  if (appState.employees?.[employeeName] && !appState.employees[employeeName].removed) {
    alert('Mfanyakazi huyu tayari yupo');
    return;
  }
  const passwordErrors = validatePasswordStrength(password);
  if (passwordErrors.length > 0) {
    alert(`Password ya mfanyakazi iwe na: ${passwordErrors.join(', ')}`);
    return;
  }

  if (!appState.registry) ensureRegistry();
  if (!appState.registry.userAssignments) appState.registry.userAssignments = {};
  const assignments = new Set(getAdminUserAssignments(adminName));
  assignments.add(employeeName);
  appState.registry.userAssignments[adminName] = [...assignments];
  appState.employees[employeeName] = {
    role: 'user',
    ownerAdmin: adminName,
    password,
    passwordChangedAt: new Date().toISOString(),
    mustChangePassword: false,
    lastLogin: null,
    isOnline: false,
    locked: false,
    removed: false
  };

  saveAppState();
  if (nameInput) nameInput.value = '';
  if (passwordInput) passwordInput.value = '';
  renderAdminStaffPanel();
  updateEmployeeLoginUI();
  showNotification(`Mfanyakazi ameongezwa: ${employeeName}`);
}

function adminRemoveStaffMember(employeeName) {
  const adminName = getCurrentAdminNameForStaffManagement();
  const account = appState.employees?.[employeeName];
  if (!adminName || !account || account.ownerAdmin !== adminName) {
    alert('Huwezi kumuondoa mfanyakazi huyu');
    return;
  }

  const reason = prompt(`Sababu ya kumuondoa ${employeeName}:`, 'Ameondolewa na Admin');
  if (reason === null) return;

  account.removed = true;
  account.locked = true;
  account.lockedReason = reason || 'Ameondolewa na Admin';
  account.isOnline = false;
  account.removedAt = new Date().toISOString();
  const currentAssignments = new Set(appState.registry?.userAssignments?.[adminName] || []);
  currentAssignments.delete(employeeName);
  appState.registry.userAssignments[adminName] = [...currentAssignments];

  appState.comments.push({
    employee: adminName,
    text: `Mfanyakazi ${employeeName} ameondolewa. Sababu: ${account.lockedReason}`,
    timestamp: new Date().toISOString()
  });

  saveAppState();
  renderAdminStaffPanel();
  renderEmployeeComments();
  updateEmployeeLoginUI();
  showNotification(`Mfanyakazi ameondolewa: ${employeeName}`);
}

function buildStaffReportMessage() {
  const sales = getCurrentEmployeeTodaySales();
  const expenses = getCurrentEmployeeTodayExpenses();
  const summary = summarizeSales(sales, expenses);
  const transactions = groupSalesByTransaction(sales);
  const products = sales
    .map(sale => `- ${sale.productName}: ${sale.quantity} x ${formatCurrency(sale.price)} = ${formatCurrency(sale.total)}`)
    .join('\n') || '- Hakuna mauzo bado';
  const expenseLines = expenses
    .map(expense => `- ${expense.name}: ${formatCurrency(expense.amount)}`)
    .join('\n') || '- Hakuna matumizi';

  return `*Ripoti ya Mfanyakazi*
Mfanyakazi: ${appState.currentEmployee || 'Unknown'}
Tarehe: ${formatDate(new Date())}
Jumla ya mauzo: ${formatCurrency(summary.revenue)}
Matumizi: ${formatCurrency(summary.expenses)}
Kilichobaki: ${formatCurrency(summary.profit)}
Bidhaa zilizouzwa: ${summary.items}
Miamala: ${transactions.length}

Bidhaa na bei:
${products}

Matumizi ya leo:
${expenseLines}

MO SaaS`;
}

function openBossWhatsApp(message) {
  const phone = appState.settings.bossPhone.replace(/\D/g, '');
  if (!phone) {
    alert('Weka namba ya boss kwenye Settings kwanza');
    return;
  }
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

function sendStaffReportToBoss() {
  if (!appState.currentEmployee) {
    alert(t('invalidEmployee'));
    return;
  }
  markStaffDailyReportSubmitted(appState.currentEmployee);
  renderDailyReportStatus();
  openBossWhatsApp(buildStaffReportMessage());
}

function sendStaffCommentToBoss() {
  if (!appState.currentEmployee) {
    alert(t('invalidEmployee'));
    return;
  }

  const input = $('staffWhatsappComment');
  const text = input?.value.trim();
  if (!text) {
    alert('Andika maoni kwanza');
    return;
  }

  appState.comments.push({
    employee: appState.currentEmployee,
    text,
    timestamp: new Date().toISOString()
  });
  saveAppState();
  renderEmployeeComments();
  if (input) input.value = '';

  const message = `*Maoni ya Mfanyakazi*
Mfanyakazi: ${appState.currentEmployee}
Tarehe: ${formatDateTime(new Date())}

${text}

MO SaaS`;
  openBossWhatsApp(message);
}

function renderSavedSalesList() {
  const container = $('savedSalesList');
  if (!container) return;

  const savedSales = groupSalesByTransaction(getHistorySales());
  const groupedByEmployee = new Map();

  savedSales.forEach(sale => {
    const employee = sale.employee || 'Unknown';
    const group = groupedByEmployee.get(employee) || {
      employee,
      items: 0,
      total: 0,
      sales: []
    };
    group.items += sale.items;
    group.total += sale.total;
    group.sales.push(sale);
    groupedByEmployee.set(employee, group);
  });

  container.innerHTML = '';

  if (groupedByEmployee.size === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">${t('noSavedSales')}</div>`;
    return;
  }

  [...groupedByEmployee.values()]
    .sort((a, b) => b.total - a.total)
    .forEach(group => {
      const details = document.createElement('details');
      details.className = 'employee-sales-group';
      details.innerHTML = `
        <summary>
          <span>${group.employee}</span>
          <strong>${group.sales.length} ${t('sales')} • ${group.items} ${t('items')} • ${formatCurrency(group.total)}</strong>
        </summary>
        <div class="employee-sales-details"></div>
      `;

      const detailList = details.querySelector('.employee-sales-details');
      group.sales
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .forEach(sale => {
          const item = document.createElement('div');
          item.className = 'saved-sale-item';
          item.innerHTML = `
            <div class="saved-sale-main">
              <strong>${formatTime(sale.timestamp)}</strong>
              <span>${sale.items} ${t('items')}</span>
            </div>
            <div class="saved-sale-products">${sale.products.join(', ')}</div>
            <div class="saved-sale-total">${formatCurrency(sale.total)}</div>
          `;
          detailList.appendChild(item);
        });

      container.appendChild(details);
    });
}

function updateSettingsControls() {
  const languageSelect = $('languageSelect');
  const themeSelect = $('themeSelect');
  const headerLanguageSelect = $('headerLanguageSelect');
  const headerThemeSelect = $('headerThemeSelect');
  if (languageSelect) languageSelect.value = appState.settings.language || 'sw';
  if (themeSelect) themeSelect.value = appState.settings.theme || 'dark';
  if (headerLanguageSelect) headerLanguageSelect.value = appState.settings.language || 'sw';
  if (headerThemeSelect) headerThemeSelect.value = appState.settings.theme || 'dark';
  if ($('backupTime')) $('backupTime').value = appState.settings.backupTime || '00:00';
  if ($('lastBackupDate')) $('lastBackupDate').textContent = appState.settings.lastBackupDate || (appState.settings.language === 'en' ? 'Never' : appState.settings.language === 'zh' ? '尚无' : 'Bado');
  updateModernSelects();
  updateLicenseSettingsDisplay();
}

function updateLicenseSettingsDisplay() {
  updateLicenseStatus();
  const daysLeft = getDaysRemaining();
  const expiryDate = getLicenseExpiryDate().toLocaleDateString();
  const status = normalizeLicenseStatus(licenseData.status);
  const statusText = status === LICENSE_STATUS.ACTIVE
    ? t('licenseActive')
    : status === LICENSE_STATUS.SUSPEND
      ? 'SUSPEND'
      : t('licenseExpired');
  const planLabel = getPlanDetails(licenseData.plan).displayName;

  if ($('settingsLicenseCompanyId')) $('settingsLicenseCompanyId').textContent = licenseData.company_id;
  if ($('settingsLicensePlan')) $('settingsLicensePlan').textContent = planLabel;
  if ($('settingsLicenseStatus')) {
    $('settingsLicenseStatus').textContent = statusText;
    $('settingsLicenseStatus').className = `settings-license-status status-${status.toLowerCase()}`;
  }
  if ($('settingsLicenseExpires')) $('settingsLicenseExpires').textContent = expiryDate;
  if ($('settingsLicenseDaysLeft')) $('settingsLicenseDaysLeft').textContent = `${Math.max(0, daysLeft)} ${t('daysRemaining')}`;
}

function getModernSelectLabel(selectId, value) {
  const labels = {
    headerLanguageSelect: { sw: 'Kiswahili', en: 'English', zh: '中文' },
    languageSelect: { sw: 'Kiswahili', en: 'English', zh: '中文' },
    headerThemeSelect: { dark: t('dark'), light: t('light') },
    themeSelect: { dark: t('dark'), light: t('light') },
    calculatorMode: { area: 'Eneo: Width x Height', length: 'Mita / Urefu', quantity: 'Idadi / Pieces', custom: 'Bei Maalum' },
    calculatorWidthUnit: { cm: 'cm', m: 'm', inch: 'inch' },
    calculatorHeightUnit: { cm: 'cm', m: 'm', inch: 'inch' }
  };
  if (selectId === 'calculatorItemSelect') {
    const product = appState.products.find(item => item.id === value);
    return product ? `${product.name} - ${formatCurrency(product.price)}` : 'Chagua bidhaa';
  }
  return labels[selectId]?.[value] || value;
}

function updateModernSelects() {
  document.querySelectorAll('.modern-select').forEach(wrapper => {
    const selectId = wrapper.dataset.selectTarget;
    const select = $(selectId);
    if (!select) return;

    const value = select.value;
    const label = getModernSelectLabel(selectId, value);
    const text = wrapper.querySelector('.modern-select-text');
    if (text) text.textContent = label;

    wrapper.querySelectorAll('.modern-select-option').forEach(option => {
      const optionLabel = getModernSelectLabel(selectId, option.dataset.value);
      option.textContent = optionLabel;
      option.classList.toggle('active', option.dataset.value === value);
    });
  });
}

function applyModernSelectValue(select, value) {
  if (!select) return;
  select.value = value || select.value;
  if (select.id.includes('Language') || select.id === 'languageSelect') {
    setLanguage(select.value);
  } else if (select.id.includes('Theme') || select.id === 'themeSelect') {
    setTheme(select.value);
  } else if (select.id.startsWith('calculator')) {
    updateCalculatorPreview();
    updateModernSelects();
  } else {
    updateModernSelects();
  }
  closeModernSelects();
}

function closeModernSelects(except = null) {
  document.querySelectorAll('.modern-select').forEach(wrapper => {
    if (wrapper === except) return;
    wrapper.classList.remove('open');
    wrapper.querySelector('.modern-select-menu')?.classList.add('hidden');
  });
}

function setLanguage(language) {
  appState.settings.language = language || 'sw';
  saveAppState();
  updateSettingsControls();
  applyLanguage();
  updateViewText();
  updateEmployeeLoginUI();
  renderProductsGrid();
  renderInventoryTable();
  renderCart();
  updateDashboard();
  renderDailyReport();
  renderWeeklyReport();
  renderMonthlyReport();
  renderDailySummary();
  renderEmployeePerformanceReport();
  renderEmployeeComments();
  renderHistoryTable();
  renderStaffSalesPanel();
  renderCustomersView();
  applyRoleAccess();
}

function setTheme(theme) {
  appState.settings.theme = theme || 'dark';
  saveAppState();
  updateSettingsControls();
  applyTheme();
}

function updateViewText() {
  const titles = getViewTitles();
  const activeView = document.querySelector('.view-section.active')?.id || 'dashboard';
  if (titles[activeView]) {
    $('viewTitle').textContent = titles[activeView].title;
    $('viewDesc').textContent = titles[activeView].desc;
  }
}

function getViewTitles() {
  const passwordTitle = t('password') === 'password' ? 'Badilisha Password' : t('password');
  return {
    dashboard: { title: t('dashboard'), desc: t('todaysSummary') },
    pos: { title: t('pointOfSale'), desc: t('saveSale') },
    orders: { title: 'Orders', desc: 'Simamia kazi na malipo ya wateja' },
    password: { title: passwordTitle, desc: 'Badilisha nywila ya akaunti yako' },
    customers: { title: t('customerManagement'), desc: `${t('customers')} / ${t('outstandingDebt')}` },
    inventory: { title: t('productInventory'), desc: t('stock') },
    analytics: { title: t('analyticsInsights'), desc: t('revenueAnalytics') },
    reports: { title: t('dailyBossReports'), desc: t('generateReport') },
    history: { title: t('salesHistory'), desc: t('savedSales') },
    settings: { title: t('settings'), desc: `${t('language')} / ${t('theme')}` },
    developer: { title: 'Developer Dashboard', desc: 'SaaS users, subscriptions, payments, and audit trail' }
  };

  const language = appState.settings?.language || 'sw';
  const titles = {
    sw: {
      dashboard: { title: 'Dashibodi', desc: 'Muhtasari wa mauzo na viashiria vya leo' },
      pos: { title: 'Sehemu ya Mauzo', desc: 'Hifadhi mauzo haraka kwa mfanyakazi aliyeingia' },
      orders: { title: 'Orders', desc: 'Simamia kazi, status na malipo' },
      inventory: { title: 'Bidhaa na Stock', desc: 'Simamia bidhaa na idadi iliyopo' },
      analytics: { title: 'Uchambuzi', desc: 'Takwimu na mwenendo wa mauzo' },
      reports: { title: 'Ripoti', desc: 'Tengeneza na tuma ripoti kwa boss' },
      history: { title: 'Historia ya Mauzo', desc: 'Mauzo yaliyohifadhiwa kwa mfanyakazi' },
      settings: { title: 'Mipangilio', desc: 'Lugha, muonekano na mipangilio ya mfumo' }
    },
    en: {
      dashboard: { title: 'Dashboard', desc: 'Today\'s sales summary and key metrics' },
      pos: { title: 'Point of Sale', desc: 'Save sales quickly for the logged-in employee' },
      orders: { title: 'Orders', desc: 'Manage job status and payments' },
      inventory: { title: 'Product Inventory', desc: 'Manage stock and product information' },
      analytics: { title: 'Analytics', desc: 'Sales insights and performance data' },
      reports: { title: 'Daily Reports', desc: 'Generate and send boss reports' },
      history: { title: 'Sales History', desc: 'Saved sales grouped by employee' },
      settings: { title: 'Settings', desc: 'Language, mode and system configuration' }
    },
    zh: {
      dashboard: { title: '仪表板', desc: '今日销售汇总和关键指标' },
      pos: { title: '销售点', desc: '为已登录员工快速保存销售' },
      orders: { title: 'Orders', desc: 'Manage job status and payments' },
      inventory: { title: '商品库存', desc: '管理库存和商品信息' },
      analytics: { title: '分析', desc: '销售洞察和业绩数据' },
      reports: { title: '日报', desc: '生成并发送老板报告' },
      history: { title: '销售历史', desc: '按员工查看已保存销售' },
      settings: { title: '设置', desc: '语言、模式和系统配置' }
    }
  };

  return titles[language] || titles.en;
}

function generateWhatsAppReport(period) {
  if (!isAdmin()) {
    showNotification('Boss pekee anaweza kutuma ripoti');
    return;
  }

  const sales = getPeriodSales(period);
  const periodText = period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : 'Daily';
  const summary = summarizeSales(sales);
  const employees = getEmployeePerformance(sales)
    .map(row => `${row.employee}: ${formatCurrency(row.revenue)} (${row.items} ${t('items')})`)
    .join('\n') || 'No employee sales';
  const revenue = summary.revenue;
  const items = summary.items;
  
  const report = `📊 *${periodText} Sales Report*
━━━━━━━━━━━━━━━━━
💰 Total Revenue: ${formatCurrency(revenue)}
📦 Items Sold: ${items}
🛍️ Transactions: ${sales.length}
━━━━━━━━━━━━━━━━━
🏪 MO SaaS System`;
  
  const phone = appState.settings.bossPhone.replace(/\D/g, '');
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(report)}`;
  window.open(url, '_blank');
}

function exportReport(period, format) {
  if (format === 'pdf') {
    if (!isAdmin()) {
      showNotification('Boss pekee anaweza kupakua PDF');
      return;
    }
    openPrintableReport(period);
  }
}

function openPrintableReport(period, options = {}) {
  const sales = getPeriodSales(period);
  const expenses = getPeriodExpenses(period);
  const summary = summarizeSales(sales, expenses);
  const title = period === 'weekly' ? 'Weekly Sales Report' : period === 'monthly' ? 'Monthly Sales Report' : 'Daily Sales Report';
  const submittedReports = (appState.dailyReports || []).filter(report => report.date === TODAY);
  const reportLabel = options.titleSuffix || (submittedReports.length
    ? submittedReports.map(report => `REPORT BY ${report.employee}`).join(', ')
    : '');
  const employeeRows = getEmployeePerformance(sales, expenses)
    .map(row => `<tr><td>${escapeHtml(row.employee)}</td><td>${row.transactions.size}</td><td>${row.items}</td><td>${formatCurrency(row.revenue)}</td><td>${formatCurrency(row.expenses || 0)}</td><td>${formatCurrency(row.profit)}</td></tr>`)
    .join('') || '<tr><td colspan="6">No sales</td></tr>';
  const expenseRows = expenses
    .map(expense => `<tr><td>${formatTime(expense.timestamp)}</td><td>${escapeHtml(expense.employee || 'Unknown')}</td><td>${escapeHtml(expense.name)}</td><td>${formatCurrency(expense.amount)}</td></tr>`)
    .join('') || '<tr><td colspan="4">No expenses</td></tr>';
  const stockSold = summary.items;
  const stockRemaining = appState.products.reduce((sum, product) => sum + Number(product.stock || 0), 0);

  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    showNotification('Popup imezuiwa. Ruhusu popups ili kupakua PDF.');
    return;
  }

  reportWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #17202a; padding: 32px; }
          h1 { margin: 0 0 6px; }
          .muted { color: #667085; margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .box { border: 1px solid #d0d5dd; border-radius: 8px; padding: 14px; }
          .label { color: #667085; font-size: 12px; }
          .value { font-size: 20px; font-weight: 700; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border-bottom: 1px solid #eaecf0; text-align: left; padding: 10px; }
          th { background: #f2f4f7; }
        </style>
      </head>
      <body>
        <h1>${appState.settings.businessName} - ${title}</h1>
        <div class="muted">Generated ${formatDateTime(new Date())}</div>
        ${reportLabel ? `<div class="box" style="margin-bottom:16px;"><strong>${escapeHtml(reportLabel)}</strong></div>` : ''}
        <div class="grid">
          <div class="box"><div class="label">Revenue</div><div class="value">${formatCurrency(summary.revenue)}</div></div>
          <div class="box"><div class="label">Daily Expenses</div><div class="value">${formatCurrency(summary.expenses)}</div></div>
          <div class="box"><div class="label">Net Profit</div><div class="value">${formatCurrency(summary.profit)}</div></div>
          <div class="box"><div class="label">Transactions</div><div class="value">${summary.transactions}</div></div>
          <div class="box"><div class="label">Stock Sold</div><div class="value">${stockSold}</div></div>
          <div class="box"><div class="label">Stock Remaining</div><div class="value">${stockRemaining}</div></div>
        </div>
        <h2>Employee Performance</h2>
        <table>
          <thead><tr><th>Employee</th><th>Sales</th><th>Items</th><th>Revenue</th><th>Expenses</th><th>Net Profit</th></tr></thead>
          <tbody>${employeeRows}</tbody>
        </table>
        <h2>Expenses</h2>
        <table>
          <thead><tr><th>Time</th><th>Employee</th><th>Expense</th><th>Amount</th></tr></thead>
          <tbody>${expenseRows}</tbody>
        </table>
        <h2>Orders</h2>
        <table>
          <thead><tr><th>Time</th><th>Customer</th><th>Item</th><th>Measurements</th><th>Total</th></tr></thead>
          <tbody>${sales.map(sale => `<tr><td>${formatTime(sale.timestamp)}</td><td>${escapeHtml(sale.customerName || 'Walk-in Customer')}</td><td>${escapeHtml(sale.productName)}</td><td>${escapeHtml(sale.measurement?.text || sale.unitType || '-')}</td><td>${formatCurrency(sale.total)}</td></tr>`).join('') || '<tr><td colspan="5">No orders</td></tr>'}</tbody>
        </table>
      </body>
    </html>
  `);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

function exportData(format) {
  let content = '';
  
  if (format === 'csv') {
    let csv = 'Date,Time,Product,Quantity,Price,Total,Employee\n';
    getVisibleSales(appState.sales).forEach(sale => {
      csv += [
        escapeCsv(sale.date),
        escapeCsv(formatTime(sale.timestamp)),
        escapeCsv(sale.productName),
        Number(sale.quantity || 0),
        Number(sale.price || 0),
        Number(sale.total || 0),
        escapeCsv(sale.employee)
      ].join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `sales_${TODAY}.csv`);
  } else if (format === 'json') {
    const blob = new Blob([JSON.stringify(getVisibleSales(appState.sales), null, 2)], { type: 'application/json' });
    downloadBlob(blob, `sales_${TODAY}.json`);
  } else if (format === 'print') {
    window.print();
  }
  
  closeExportMenu();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportAllData() {
  const data = createBackupPayload();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, getBackupFilename());
  showNotification('Backup imepakuliwa!');
}

function exportSalesReport() {
  exportData('csv');
}

function openBackupFilePicker() {
  $('restoreBackupFile')?.click();
}

function restoreBackupFromInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!confirm('Restore itaweka data za backup kwenye mfumo. Endelea?')) return;
      normalizeRestoredState(data);
      saveAppState();
      refreshAllViews();
      showNotification('Data zimerejeshwa kutoka backup!');
    } catch (error) {
      console.error('Restore failed:', error);
      alert('Backup file si sahihi au imeharibika.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function openBackupDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(BACKUP_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function setBackupDirectoryHandle(handle) {
  const db = await openBackupDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE_NAME, 'readwrite');
    tx.objectStore(BACKUP_STORE_NAME).put(handle, BACKUP_FOLDER_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBackupDirectoryHandle() {
  const db = await openBackupDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE_NAME, 'readonly');
    const request = tx.objectStore(BACKUP_STORE_NAME).get(BACKUP_FOLDER_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function ensureDirectoryPermission(handle) {
  if (!handle) return false;
  const options = { mode: 'readwrite' };
  if ((await handle.queryPermission(options)) === 'granted') return true;
  return (await handle.requestPermission(options)) === 'granted';
}

async function chooseBackupFolder() {
  if (!window.showDirectoryPicker) {
    showNotification('Browser hii hairuhusu kuchagua folder. Tumia Export All Data.');
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await setBackupDirectoryHandle(handle);
    showNotification('Folder ya backup imehifadhiwa. Weka Google Drive au flash folder.');
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Folder selection failed:', error);
      showNotification('Imeshindikana kuchagua folder ya backup.');
    }
  }
}

async function writeBackupToChosenFolder(payload, filename) {
  const handle = await getBackupDirectoryHandle();
  if (!handle || !(await ensureDirectoryPermission(handle))) return false;

  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
  return true;
}

async function runAutomaticBackup(forceDownload = false) {
  const today = getTodayString();
  const payload = createBackupPayload();
  const filename = getBackupFilename(today);

  try {
    const savedToFolder = !forceDownload && await writeBackupToChosenFolder(payload, filename);
    if (!savedToFolder) {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, filename);
    }
    appState.settings.lastBackupDate = today;
    saveAppState();
    showNotification(savedToFolder ? 'Backup imehifadhiwa kwenye folder uliyochagua.' : 'Backup imepakuliwa.');
  } catch (error) {
    console.error('Automatic backup failed:', error);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, filename);
    appState.settings.lastBackupDate = today;
    saveAppState();
    showNotification('Backup imepakuliwa kwa sababu folder haikupatikana.');
  }
}

function scheduleDailyBackup() {
  const checkBackupTime = () => {
    const now = new Date();
    const today = getTodayString();
    const [hour, minute] = (appState.settings.backupTime || '00:00').split(':').map(Number);
    const backupTime = new Date();
    backupTime.setHours(hour, minute, 0, 0);

    if (now >= backupTime && appState.settings.lastBackupDate !== today) {
      runAutomaticBackup();
    }
  };

  checkBackupTime();
  setInterval(checkBackupTime, 60000);
}

// ==========================================
// CLOSING & TIME REMINDER SYSTEM
// ==========================================

function scheduleClosingReminder() {
  const [closingHour, closingMinute] = appState.settings.closingTime.split(':').map(Number);
  
  function checkClosingTime() {
    const now = new Date();
    const closing = new Date();
    closing.setHours(closingHour, closingMinute, 0, 0);
    
    const minutesBefore = 15;
    const reminderTime = new Date(closing.getTime() - minutesBefore * 60000);
    
    if (now >= reminderTime && now < closing) {
      startClosingCountdown(minutesBefore * 60);
    }
  }
  
  setInterval(checkClosingTime, 60000); // Check every minute
}

function scheduleStaffAccessLock() {
  updateLoginGate();
  setInterval(() => {
    if (appState.currentRole === 'user') {
      updateLoginGate();
    }
  }, 60000);
}

function startClosingCountdown(seconds) {
  const banner = $('closingBanner');
  banner.classList.remove('hidden');
  
  let remaining = seconds;
  const closingTime = new Date();
  const [hour, minute] = appState.settings.closingTime.split(':').map(Number);
  closingTime.setHours(hour, minute, 0, 0);
  
  $('closingHourDisplay').textContent = closingTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  
  function updateCountdown() {
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    $('closingCountdown').textContent = `${m}:${s}`;
    $('countdownValue').textContent = `${m}:${s}`;
    
    remaining--;
    
    if (remaining < 0) {
      clearInterval(closingTimerInterval);
      lockSalesInterface();
      banner.classList.add('hidden');
    }
  }
  
  updateCountdown();
  closingTimerInterval = setInterval(updateCountdown, 1000);
}

function lockSalesInterface() {
  $('finalizeSaleBtn').disabled = true;
  $('finalizeSaleBtn').style.opacity = '0.5';
  
  document.querySelectorAll('.product-card button').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
  });
  
  showNotification('🔒 Sales interface has been locked - Only comments are available');
}

// ==========================================
// SETTINGS
// ==========================================

function saveSettings() {
  appState.settings.businessName = $('businessName').value || appState.settings.businessName;
  appState.settings.bossPhone = $('bossPhone').value || appState.settings.bossPhone;
  appState.settings.closingTime = $('closingTime').value || '22:00';
  appState.settings.backupTime = $('backupTime')?.value || '00:00';
  appState.settings.language = $('languageSelect')?.value || appState.settings.language || 'sw';
  appState.settings.theme = $('themeSelect')?.value || appState.settings.theme || 'dark';
  
  saveAppState();
  updateSettingsControls();
  applyLanguage();
  applyTheme();
  updateViewText();
  renderProductsGrid();
  renderInventoryTable();
  renderCart();
  updateDashboard();
  renderDailyReport();
  renderWeeklyReport();
  renderMonthlyReport();
  renderDailySummary();
  renderEmployeePerformanceReport();
  renderEmployeeComments();
  renderHistoryTable();
  renderStaffSalesPanel();
  applyRoleAccess();
  showNotification(t('settingsSaved'));
}

function resetSystemConfirm() {
  if (confirm('⚠️ This will delete ALL data. Are you sure?')) {
    if (confirm('Last chance! Delete everything?')) {
      localStorage.clear();
      appState = {
        products: [],
        sales: [],
        employees: {},
        settings: appState.settings,
        currentEmployee: null,
        currentRole: 'guest',
        clockInTime: null,
        orders: [],
        comments: [],
        dailyReports: [],
        receipts: [],
        customers: [],
        customerDebts: [],
        customerPayments: [],
        lastReceiptId: null
      };
      initializeSampleData();
      location.reload();
    }
  }
}

async function clearBackendSalesAndExpensesOnly(employeeOverride = null) {
  const authToken = await getBackendAuthToken();
  if (!authToken || !navigator.onLine) return null;
  const employees = Array.isArray(employeeOverride) ? employeeOverride : getEmployeesForSalesExpenseClear();

  const response = await fetch(`${PAYMENT_API_BASE_URL}/sync/clear-sales-expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify({
      company_id: getSyncCompanyId(),
      employees
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Backend clear failed');
  }
  return result.data || {};
}

function getEmployeesForSalesExpenseClear() {
  if (isSuperAdmin()) return [];
  if (isAdmin()) {
    const employees = new Set(getAdminUserAssignments(appState.currentEmployee));
    employees.add(appState.currentEmployee);
    return [...employees];
  }
  return appState.currentEmployee ? [appState.currentEmployee] : [];
}

function isRecordInSalesExpenseClearScope(record) {
  if (isSuperAdmin()) return true;
  const employees = new Set(getEmployeesForSalesExpenseClear());
  return employees.has(record?.employee);
}

async function clearSalesAndExpensesOnly() {
  if (!isAdmin() && !isSuperAdmin()) {
    alert('Admin pekee anaweza kufuta mauzo na matumizi.');
    return;
  }

  if (!confirm('Utafuta MAUZO, MATUMIZI, RECEIPTS/HISTORY na STAFF REPORTS za Admin huyu na Users wake tu. Admin wengine hawataguswa. Endelea?')) return;
  if (!confirm('Hakuna kurudisha bila backup. Una uhakika unataka kuanza data mpya za mauzo na matumizi kwa Admin huyu?')) return;

  const salesToClear = (appState.sales || []).filter(isRecordInSalesExpenseClearScope);
  const expensesToClear = (appState.expenses || []).filter(isRecordInSalesExpenseClearScope);
  const reportsToClear = (appState.dailyReports || []).filter(isRecordInSalesExpenseClearScope);
  const receiptIdsToClear = new Set(salesToClear.map(sale => sale.receiptId || sale.transactionId || sale.id).filter(Boolean));
  const receiptsToClear = (appState.receipts || []).filter(receipt => {
    const receiptEmployee = receipt.employee || receipt.cashier || receipt.createdBy;
    return isRecordInSalesExpenseClearScope({ employee: receiptEmployee })
      || receiptIdsToClear.has(receipt.id)
      || receiptIdsToClear.has(receipt.transactionId);
  });

  const clearedCounts = {
    sales: salesToClear.length,
    expenses: expensesToClear.length,
    receipts: receiptsToClear.length,
    reports: reportsToClear.length
  };

  appState.sales = (appState.sales || []).filter(record => !isRecordInSalesExpenseClearScope(record));
  appState.expenses = (appState.expenses || []).filter(record => !isRecordInSalesExpenseClearScope(record));
  appState.dailyReports = (appState.dailyReports || []).filter(record => !isRecordInSalesExpenseClearScope(record));
  appState.receipts = (appState.receipts || []).filter(receipt => !receiptsToClear.some(item => item.id === receipt.id));
  if (appState.lastReceiptId && receiptsToClear.some(receipt => receipt.id === appState.lastReceiptId)) {
    appState.lastReceiptId = null;
  }

  Object.keys(localStorage).forEach(key => {
    if (
      key.startsWith(`${STORAGE_KEY}:sales:`)
      || key.startsWith('auto_report_')
      || key.startsWith('pdf_report_sent_')
    ) {
      localStorage.removeItem(key);
    }
  });

  let backendClearResult = null;
  try {
    backendClearResult = await clearBackendSalesAndExpensesOnly();
  } catch (error) {
    console.warn('Failed to clear backend sales data:', error.message);
  }

  try {
    await Promise.all([
      ...salesToClear.map(record => idbDelete('sales', record.id)),
      ...receiptsToClear.map(record => idbDelete('receipts', record.id)),
      ...reportsToClear.map(record => idbDelete('dailyReports', record.id))
    ]);
    const outboxRows = await idbGetAll('outbox');
    const clearEntities = new Set(['sale', 'receipt', 'dailyReport', 'expense']);
    await Promise.all(outboxRows
      .filter(change => clearEntities.has(change.entity) && isRecordInSalesExpenseClearScope(change.payload || {}))
      .map(change => idbDelete('outbox', change.id)));
  } catch (error) {
    console.warn('Failed to clear offline sales cache:', error.message);
  }

  saveAppState();
  renderCart();
  updateDashboard();
  renderDailyReport();
  renderWeeklyReport();
  renderMonthlyReport();
  renderDailySummary();
  renderEmployeePerformanceReport();
  renderHistoryTable();
  renderStaffSalesPanel();
  renderStaffReportArchive();
  if (typeof refreshDevStats === 'function') refreshDevStats();

  showNotification(`Imefuta: mauzo ${clearedCounts.sales}, matumizi ${clearedCounts.expenses}, receipts ${clearedCounts.receipts}, reports ${clearedCounts.reports}.`);
  if (backendClearResult) {
    showNotification('Cloud/backend sales na matumizi zimesafishwa pia.');
  }
}

// ==========================================
// VIEW SWITCHING
// ==========================================

function getDefaultViewForCurrentUser() {
  return canAccessAdminViews() ? 'dashboard' : 'pos';
}

function viewExists(viewName) {
  return Boolean(viewName && document.getElementById(viewName)?.classList.contains('view-section'));
}

function getSpaViewFromLocation() {
  const match = String(location.hash || '').match(/^#\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

function getInitialSpaView(fallback = getDefaultViewForCurrentUser()) {
  const view = getSpaViewFromLocation();
  return view && viewExists(view) && canAccessView(view) ? view : fallback;
}

function loadSpaViewState() {
  try {
    viewStateCache = JSON.parse(localStorage.getItem(SPA_VIEW_STATE_KEY) || '{}') || {};
  } catch (error) {
    viewStateCache = {};
  }
}

function persistSpaViewState() {
  try {
    localStorage.setItem(SPA_VIEW_STATE_KEY, JSON.stringify(viewStateCache));
  } catch (error) {
    console.warn('SPA state save failed:', error);
  }
}

function getViewFormState(viewName) {
  const formIdsByView = {
    pos: ['searchProducts', 'saleCustomerName', 'saleComment', 'calculatorItemSelect', 'calculatorMode', 'calculatorWidth', 'calculatorWidthUnit', 'calculatorHeight', 'calculatorHeightUnit', 'calculatorQuantity', 'calculatorCustomPrice', 'calculatorDesignFee'],
    orders: ['orderStatusFilter', 'orderPaymentFilter'],
    inventory: ['searchInventory'],
    history: ['dateFilter'],
    developer: ['devUserSearch', 'devUserStatusFilter']
  };
  const values = {};
  (formIdsByView[viewName] || []).forEach(id => {
    const element = $(id);
    if (element) values[id] = element.type === 'checkbox' ? element.checked : element.value;
  });
  return values;
}

function saveViewState(viewName = activeViewName) {
  if (!viewName) return;
  const section = $(viewName);
  viewStateCache[viewName] = {
    scrollY: window.scrollY || 0,
    sectionScrollTop: section?.scrollTop || 0,
    forms: getViewFormState(viewName),
    savedAt: new Date().toISOString()
  };
  persistSpaViewState();
}

function saveCurrentViewState() {
  saveViewState(activeViewName);
}

function restoreViewState(viewName) {
  const state = viewStateCache[viewName];
  if (!state) return;

  Object.entries(state.forms || {}).forEach(([id, value]) => {
    const element = $(id);
    if (element?.type === 'checkbox') {
      element.checked = Boolean(value);
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (element && element.value !== value) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  if (viewName === 'orders') renderOrdersBoard();
  if (viewName === 'history') renderHistoryTable();
  if (viewName === 'developer' && typeof renderDeveloperUsers === 'function') renderDeveloperUsers();

  requestAnimationFrame(() => {
    const section = $(viewName);
    if (section) section.scrollTop = state.sectionScrollTop || 0;
    window.scrollTo(0, state.scrollY || 0);
  });
}

function pushSpaHistory(viewName, replace = false) {
  if (!spaNavigationReady || !appState.currentEmployee) return;
  const url = `${location.pathname}${location.search}#/${viewName}`;
  const state = {
    view: viewName,
    viewState: viewStateCache[viewName] || {},
    timestamp: Date.now()
  };
  if (replace) history.replaceState(state, '', url);
  else history.pushState(state, '', url);
}

function initSpaNavigation() {
  if (spaNavigationReady) return;
  loadSpaViewState();
  spaNavigationReady = true;
  window.addEventListener('popstate', (event) => {
    const view = event.state?.view || getInitialSpaView();
    switchView(view, { pushState: false, restoreState: true });
  });
  if (appState.currentEmployee) {
    history.replaceState({ view: getInitialSpaView(), viewState: viewStateCache[getInitialSpaView()] || {} }, '', `${location.pathname}${location.search}#/${getInitialSpaView()}`);
  }
}

function switchView(viewName, options = {}) {
  const previousView = activeViewName || document.querySelector('.view-section.active')?.id;
  if (previousView && previousView !== viewName) saveViewState(previousView);

  if (!viewExists(viewName)) {
    showNotification('Panel hii haijapatikana kwenye app.');
    viewName = getDefaultViewForCurrentUser();
  }

  if (!canAccessView(viewName)) {
    showNotification(viewName === 'developer'
      ? 'Developer panel ni kwa super_admin pekee'
      : 'Ruhusa haitoshi kufungua panel hii');
    viewName = getDefaultViewForCurrentUser();
  }

  // Hide all sections
  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Show selected section
  const section = $(`${viewName}`);
  if (section) {
    section.classList.add('active');
  }
  
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');
  
  // Update header
  const titles = getViewTitles();
  
  if (titles[viewName]) {
    $('viewTitle').textContent = titles[viewName].title;
    $('viewDesc').textContent = titles[viewName].desc;
  }

  if (viewName === 'developer') {
    refreshDevStats();
  }
  if (viewName === 'dashboard') {
    renderRoleBusinessDashboard();
  }
  if (viewName === 'settings') {
    renderAdminStaffPanel();
  }
  if (viewName === 'orders') {
    renderOrdersBoard();
  }
  if (viewName === 'password') {
    updatePasswordStatus();
  }
  if (viewName === 'customers') {
    renderCustomersView();
  }

  activeViewName = viewName;
  if (options.restoreState !== false) restoreViewState(viewName);
  if (options.pushState !== false) pushSpaHistory(viewName, Boolean(options.replaceState));
}

function closeExportMenu() {
  $('exportModal').classList.add('hidden');
}

function openExportMenu() {
  $('exportModal').classList.remove('hidden');
}

function clearHistoryFilter() {
  $('dateFilter').value = '';
  renderHistoryTable();
}

// ==========================================
// NOTIFICATIONS
// ==========================================

function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #008000 0%, #006400 100%);
    color: white;
    padding: 14px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-weight: 600;
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function setupButtonReliability() {
  document.querySelectorAll('button:not([type])').forEach(button => {
    button.type = 'button';
  });

  const missingHandlers = [];
  document.querySelectorAll('[onclick]').forEach(element => {
    const expression = element.getAttribute('onclick') || '';
    const calls = [...expression.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)]
      .map(match => match[1])
      .filter(name => !['document', 'confirm', 'alert', 'decodeURIComponent', 'querySelector', 'click'].includes(name));
    calls.forEach(name => {
      if (typeof window[name] !== 'function' && typeof globalThis[name] !== 'function') {
        missingHandlers.push(name);
      }
    });
  });
  if (missingHandlers.length > 0) {
    console.warn('Buttons missing handlers:', [...new Set(missingHandlers)]);
  }

  if (buttonReliabilityReady) return;
  buttonReliabilityReady = true;

  window.addEventListener('error', event => {
    if (String(event.message || '').includes('Script error')) return;
    console.error('UI action error:', event.error || event.message);
    showNotification('Kitufe kimepata hitilafu. Jaribu tena au angalia console.');
  });

  window.addEventListener('unhandledrejection', event => {
    console.error('Async action error:', event.reason);
    showNotification('Ombi limeshindikana. Jaribu tena.');
  });
}

function handleNotificationButton() {
  const lowStock = appState.products.filter(product => product.itemType !== 'service' && Number(product.stock || 0) <= appState.settings.lowStockThreshold).length;
  const pendingOrders = (appState.orders || []).filter(order => order.status !== 'completed').length;
  const pendingSync = offlineConflictCount;
  const unpaidUsers = canAccessDeveloperPanel() ? getUnpaidDeveloperUsers().length : 0;
  const debtCustomers = getVisibleCustomers().filter(customer => getCustomerBalance(customer.id) > 0).length;
  const messages = [];
  if (lowStock > 0) messages.push(`${lowStock} low stock`);
  if (pendingOrders > 0) messages.push(`${pendingOrders} orders`);
  if (pendingSync > 0) messages.push(`${pendingSync} sync conflicts`);
  if (unpaidUsers > 0) messages.push(`${unpaidUsers} hawajalipa`);
  if (debtCustomers > 0) messages.push(`${debtCustomers} wateja wana deni`);
  showNotification(messages.length ? messages.join(' | ') : 'Hakuna notification mpya.');
}

function daysBetween(dateA, dateB) {
  const start = new Date(dateA);
  const end = new Date(dateB);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end - start) / 86400000);
}

function shouldRunReminder(bucket, key, intervalDays) {
  const last = appState.reminders?.[bucket]?.[key];
  return !last || daysBetween(last, TODAY) >= intervalDays;
}

function markReminderRun(bucket, key) {
  if (!appState.reminders) appState.reminders = { weekly: {}, monthly: {} };
  if (!appState.reminders[bucket]) appState.reminders[bucket] = {};
  appState.reminders[bucket][key] = TODAY;
}

function runScheduledReminderAlerts() {
  const debtCount = getVisibleCustomers().filter(customer => getCustomerBalance(customer.id) > 0).length;
  if (debtCount > 0 && shouldRunReminder('weekly', `customer_debts_${getCurrentOwnerAdmin() || appState.currentEmployee || 'all'}`, 7)) {
    showNotification(`Kikumbusho: ${debtCount} wateja bado wana deni. Tuma WhatsApp/SMS/Email kwenye Madeni.`);
    markReminderRun('weekly', `customer_debts_${getCurrentOwnerAdmin() || appState.currentEmployee || 'all'}`);
  }

  if (canAccessDeveloperPanel()) {
    const unpaid = getUnpaidDeveloperUsers();
    if (unpaid.length > 0 && shouldRunReminder('weekly', 'unpaid_subscription_weekly', 7)) {
      addDeveloperNotification('payment_reminder', `${unpaid.length} admins hawajalipa wiki hii`);
      showNotification(`Alarm: ${unpaid.length} admins hawajalipa. Tuma reminders Developer > Payments.`);
      markReminderRun('weekly', 'unpaid_subscription_weekly');
    }
    if (unpaid.length > 0 && shouldRunReminder('monthly', 'unpaid_subscription_monthly', 30)) {
      addDeveloperNotification('payment_reminder', `${unpaid.length} admins hawajalipa mwezi huu`);
      markReminderRun('monthly', 'unpaid_subscription_monthly');
    }
  }

  saveAppState();
}

function setDashboardChartPeriod(period) {
  dashboardChartPeriod = ['daily', 'weekly', 'monthly'].includes(period) ? period : 'daily';
  document.querySelectorAll('#dashboard .chart-controls .btn-small').forEach(button => {
    button.classList.toggle('active', button.dataset.period === dashboardChartPeriod);
  });
  if (typeof Chart === 'undefined') return;
  updateSalesChart();
}

// ==========================================
// INITIALIZATION
// ==========================================

function initializeApp() {
  try {
    // Load state
    loadAppState();
    console.log('[OK] App state loaded');
    
    // Set up date/time
    const todayEl = $('today');
    const currentDateEl = $('currentDate');
    if (todayEl) todayEl.textContent = new Date().toLocaleDateString();
    if (currentDateEl) currentDateEl.textContent = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Load settings (with fallbacks)
    const businessNameEl = $('businessName');
    const bossPhoneEl = $('bossPhone');
  const closingTimeEl = $('closingTime');
    const backupTimeEl = $('backupTime');
    
    if (businessNameEl) businessNameEl.value = appState.settings.businessName;
    if (bossPhoneEl) bossPhoneEl.value = appState.settings.bossPhone;
    if (closingTimeEl) closingTimeEl.value = appState.settings.closingTime;
    if (backupTimeEl) backupTimeEl.value = appState.settings.backupTime || '00:00';
    updateSettingsControls();
    applyLanguage();
    applyTheme();
    if (appState.currentEmployee) {
      $('statusEmployee').textContent = appState.currentEmployee;
      $('statusClockIn').textContent = appState.clockInTime ? formatTime(appState.clockInTime) : '-';
      $('employeeShort').textContent = appState.currentEmployee.substring(0, 2).toUpperCase();
    }
    if ($('dashboardProductName')) {
      $('dashboardProductName').value = appState.settings.dashboardProductName || '';
    }
    updateBusinessHeaderName();
    updateEmployeeLoginUI();
    applyRoleAccess();
    updateLoginGate();
    updateLoginLicenseBanner();
    updateLicenseExpiredScreenContent();
    
    // Render UI
    renderProductsGrid();
    renderCalculatorOptions();
    updateCalculatorPreview();
    renderInventoryTable();
    renderOrdersBoard();
    updateDashboard();
    renderEmployeeComments();
    renderDailyReport();
    renderWeeklyReport();
    renderMonthlyReport();
    renderDailySummary();
    renderEmployeePerformanceReport();
    renderDailyReportStatus();
    renderHistoryTable();
    renderStaffSalesPanel();
    renderAdminStaffPanel();
    updatePasswordStatus();
    initOfflineSync();
    updateInstallAppButton();
    
    console.log('[OK] UI rendered successfully');
    
    // Set up event listeners
    setupButtonReliability();
    setupEventListeners();
    initSessionSecurity();
    
    // Schedule closing reminder
    scheduleClosingReminder();
    scheduleStaffAccessLock();
    scheduleDailyBackup();
    scheduleDailyAutoReport();
    runScheduledReminderAlerts();
    setInterval(runScheduledReminderAlerts, 60 * 60 * 1000);
    setInterval(enforceCurrentAccountAccess, 5000);
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) enforceCurrentAccountAccess();
    });
    
    console.log('[OK] MO SaaS initialized successfully!');
  } catch (error) {
    console.error('[ERROR] Error initializing app:', error);
    alert('⚠️ Tatizo katika kuanzisha app. Angalia console.');
  }
}

function setupEventListeners() {
  try {
    // Navigation
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const view = e.target.closest('[data-view]')?.dataset.view;
        if (view) switchView(view);
      });
    });
    
    // Employee
    const setEmpBtn = $('setEmployee');
    const empInput = $('employeeInput');
    const empPin = $('employeePin');
    const logoutBtn = $('logoutEmployee');
    const gateLoginBtn = $('gateLoginBtn');
    const gateEmpInput = $('gateEmployeeInput');
    const gatePinInput = $('gateEmployeePin');
    const workStatusBtn = $('toggleWorkStatus');
    const notificationBtn = $('notificationBtn');
    if (setEmpBtn) setEmpBtn.addEventListener('click', () => {
      setEmployee(empInput?.value || '');
    });
    if (gateLoginBtn) gateLoginBtn.addEventListener('click', () => {
      setEmployee(gateEmpInput ? gateEmpInput.value : '');
    });
    $('showSignupBtn')?.addEventListener('click', showSignupGate);
    $('showLoginFromSignupBtn')?.addEventListener('click', showLoginGate);
    $('signupForm')?.addEventListener('submit', handleSignupSubmit);
    $('bossAddAdminBtn')?.addEventListener('click', () => bossAddAdminFromPanel());
    window.bossSetAdminLicenseStatus = bossSetAdminLicenseStatus;
    window.bossAdjustAdminDays = bossAdjustAdminDays;
    const licenseExpiredBackBtn = $('licenseExpiredBackBtn');
    if (licenseExpiredBackBtn) licenseExpiredBackBtn.addEventListener('click', () => {
      hideLicenseExpiredScreen();
      if (gateEmpInput) gateEmpInput.focus();
    });
    if ($('dashboardProductName')) {
      $('dashboardProductName').addEventListener('input', (e) => {
        const value = String(e.target.value || '').trim();
        appState.settings.dashboardProductName = value;
        saveAppState();
        updateDashboard();
      });
    }
    if (empInput) empInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') setEmployee(empInput.value);
    });
    if (empPin) empPin.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') setEmployee(empInput.value);
    });
    if (gateEmpInput) gateEmpInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && gatePinInput) gatePinInput.focus();
    });
    if (gatePinInput) gatePinInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') setEmployee(gateEmpInput ? gateEmpInput.value : '');
    });
    window.bossRemoveAdmin = bossRemoveAdmin;
    $('signupCaptchaRefresh')?.addEventListener('click', refreshSignupCaptcha);
    $('signupSendOtpBtn')?.addEventListener('click', () => sendSignupSmsOtp());
    const signupFullNameInput = $('signupFullName');
    if (signupFullNameInput) {
      signupFullNameInput.addEventListener('input', () => {
        if (!applySignupDraftSuggestion()) saveSignupDraft();
      });
      signupFullNameInput.addEventListener('change', applySignupDraftSuggestion);
    }
    ['signupBusinessName', 'signupEmail', 'signupPaymentReference'].forEach(id => {
      const input = $(id);
      if (input) input.addEventListener('input', saveSignupDraft);
    });
    $('signupPhone')?.addEventListener('input', () => {
      updateSignupSmsBlockVisibility();
      saveSignupDraft();
    });
    $('signupPhone')?.addEventListener('blur', updateSignupSmsBlockVisibility);
    document.querySelectorAll('input[name="signupPaymentMethod"]').forEach(input => {
      input.addEventListener('change', () => {
        const status = $('signupPaymentStatus');
        if (status) {
          status.textContent = '';
          status.classList.remove('success', 'error');
        }
        saveSignupDraft();
      });
    });
    if (logoutBtn) logoutBtn.addEventListener('click', logoutEmployee);
    const closedLogoutBtn = $('closedLogoutBtn');
    if (closedLogoutBtn) closedLogoutBtn.addEventListener('click', logoutEmployee);
    if (workStatusBtn) workStatusBtn.addEventListener('click', logoutEmployee);
    if (notificationBtn) notificationBtn.addEventListener('click', handleNotificationButton);
    $('installAppBtn')?.addEventListener('click', installAppToDevice);
    
    // Cart
    const clearBtn = $('clearCartBtn');
    const finalBtn = $('finalizeSaleBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearCart);
    if (finalBtn) finalBtn.addEventListener('click', completeSale);
    
    // Search Products
    const searchProd = $('searchProducts');
    if (searchProd) {
      searchProd.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.product-card').forEach(card => {
          const name = card.querySelector('.product-card-name')?.textContent.toLowerCase() || '';
          card.style.display = name.includes(term) ? '' : 'none';
        });
      });
    }

    ['calculatorItemSelect', 'calculatorMode', 'calculatorWidth', 'calculatorWidthUnit', 'calculatorHeight', 'calculatorHeightUnit', 'calculatorQuantity', 'calculatorCustomPrice', 'calculatorDesignFee'].forEach(id => {
      const input = $(id);
      if (input) input.addEventListener('input', updateCalculatorPreview);
      if (input) input.addEventListener('change', updateCalculatorPreview);
    });
    
    // Search Inventory
    const searchInv = $('searchInventory');
    if (searchInv) {
      searchInv.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('tbody tr').forEach(row => {
          const name = row.cells[0]?.textContent.toLowerCase() || '';
          row.style.display = name.includes(term) ? '' : 'none';
        });
      });
    }

    const dateFilter = $('dateFilter');
    if (dateFilter) dateFilter.addEventListener('change', renderHistoryTable);
    $('orderStatusFilter')?.addEventListener('change', renderOrdersBoard);
    $('orderPaymentFilter')?.addEventListener('change', renderOrdersBoard);
    const restoreBackupFile = $('restoreBackupFile');
    if (restoreBackupFile) restoreBackupFile.addEventListener('change', restoreBackupFromInput);
    const devUserSearch = $('devUserSearch');
    const devUserStatusFilter = $('devUserStatusFilter');
    if (devUserSearch) devUserSearch.addEventListener('input', renderDeveloperUsers);
    if (devUserStatusFilter) devUserStatusFilter.addEventListener('change', renderDeveloperUsers);

    const languageSelect = $('languageSelect');
    const themeSelect = $('themeSelect');
    const headerLanguageSelect = $('headerLanguageSelect');
    const headerThemeSelect = $('headerThemeSelect');
    document.querySelectorAll('.modern-select').forEach(wrapper => {
      const trigger = wrapper.querySelector('.modern-select-trigger');
      const menu = wrapper.querySelector('.modern-select-menu');
      const select = $(wrapper.dataset.selectTarget);
      if (!trigger || !menu || !select) return;

      trigger.addEventListener('click', () => {
        const willOpen = menu.classList.contains('hidden');
        closeModernSelects(wrapper);
        wrapper.classList.toggle('open', willOpen);
        menu.classList.toggle('hidden', !willOpen);
      });

      wrapper.querySelectorAll('.modern-select-option').forEach(option => {
        option.addEventListener('click', (event) => {
          event.stopPropagation();
          applyModernSelectValue(select, option.dataset.value);
        });
      });
      menu.addEventListener('click', (event) => {
        const option = event.target.closest('.modern-select-option');
        if (option) applyModernSelectValue(select, option.dataset.value);
      });
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.modern-select')) closeModernSelects();
    });
    if (languageSelect) languageSelect.addEventListener('change', (event) => setLanguage(event.target.value));
    if (headerLanguageSelect) headerLanguageSelect.addEventListener('change', (event) => setLanguage(event.target.value));
    if (themeSelect) themeSelect.addEventListener('change', (event) => setTheme(event.target.value));
    if (headerThemeSelect) headerThemeSelect.addEventListener('change', (event) => setTheme(event.target.value));
    
    // Dashboard chart period buttons
    document.querySelectorAll('#dashboard .chart-controls .btn-small').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const period = e.target.closest('[data-period]')?.dataset.period || 'daily';
        setDashboardChartPeriod(period);
      });
    });
    
    console.log('[OK] Event listeners setup successfully');
  } catch (error) {
    console.error('⚠️ Error setting up event listeners:', error);
  }
  
  // Initialize first view without reloading the page.
  initSpaNavigation();
  switchView(getInitialSpaView(), { replaceState: true });
}

// ==========================================
// GLOBAL WINDOW FUNCTIONS (for onclick handlers)
// ==========================================

window.switchView = switchView;
window.setEmployee = setEmployee;
window.logoutEmployee = logoutEmployee;
window.sessionStayLoggedIn = sessionStayLoggedIn;
window.sessionLogoutNow = sessionLogoutNow;
window.handleNotificationButton = handleNotificationButton;
window.setDashboardChartPeriod = setDashboardChartPeriod;
window.bossSetAdminLicenseStatus = bossSetAdminLicenseStatus;
window.bossAdjustAdminDays = bossAdjustAdminDays;
window.addToCart = addToCart;
window.selectCalculatorItem = selectCalculatorItem;
window.addCalculatedItemToCart = addCalculatedItemToCart;
window.removeFromCart = removeFromCart;
window.updateCartItemQty = updateCartItemQty;
window.clearCart = clearCart;
window.completeSale = completeSale;
window.createOrderFromCart = createOrderFromCart;
window.updateOrderStatus = updateOrderStatus;
window.toggleOrderPayment = toggleOrderPayment;
window.completeOrderAsSale = completeOrderAsSale;
window.openAddProductModal = openAddProductModal;
window.closeProductModal = closeProductModal;
window.saveProduct = saveProduct;
window.openAddStockModal = openAddStockModal;
window.editProduct = editProduct;
window.openExportMenu = openExportMenu;
window.closeExportMenu = closeExportMenu;
window.exportData = exportData;
window.exportReport = exportReport;
window.exportAllData = exportAllData;
window.exportSalesReport = exportSalesReport;
window.queueFullCloudSync = queueFullCloudSync;
window.chooseBackupFolder = chooseBackupFolder;
window.runAutomaticBackup = runAutomaticBackup;
window.openBackupFilePicker = openBackupFilePicker;
window.saveSettings = saveSettings;
window.resetSystemConfirm = resetSystemConfirm;
window.clearSalesAndExpensesOnly = clearSalesAndExpensesOnly;
window.renderBossBusinessInspector = renderBossBusinessInspector;
window.bossInspectorSetStatus = bossInspectorSetStatus;
window.bossClearSelectedAdminSalesExpenses = bossClearSelectedAdminSalesExpenses;
window.generateWhatsAppReport = generateWhatsAppReport;
window.sendStaffReportToBoss = sendStaffReportToBoss;
window.addStaffExpense = addStaffExpense;
window.editStaffExpense = editStaffExpense;
window.deleteStaffExpense = deleteStaffExpense;
window.saveCustomerFromForm = saveCustomerFromForm;
window.recordCustomerPayment = recordCustomerPayment;
window.deleteCustomerPayment = deleteCustomerPayment;
window.clearPaidCustomerDebt = clearPaidCustomerDebt;
window.deleteCustomerIfSettled = deleteCustomerIfSettled;
window.seedDemoCustomerDebts = seedDemoCustomerDebts;
window.renderCustomersView = renderCustomersView;
window.sendCustomerDebtReminder = sendCustomerDebtReminder;
window.submitStaffDailyReport = submitStaffDailyReport;
window.adminAddStaffMember = adminAddStaffMember;
window.adminRemoveStaffMember = adminRemoveStaffMember;
window.openLastReceipt = openLastReceipt;
window.closeReceiptModal = closeReceiptModal;
window.downloadLastReceiptPdf = downloadLastReceiptPdf;
window.shareLastReceiptWhatsApp = shareLastReceiptWhatsApp;
window.sendStaffCommentToBoss = sendStaffCommentToBoss;
window.changeOwnPassword = changeOwnPassword;
window.saveBossComment = saveBossComment;
window.clearHistoryFilter = clearHistoryFilter;
window.renderHistoryTable = renderHistoryTable;

// ==========================================
// DEVELOPER CONSOLE FUNCTIONS
// ==========================================

let auditLogs = [];

function addAuditLog(action, details, type = 'info') {
  addDeveloperAuditLog(action, '-', appState.currentEmployee || 'System', details, type);
}

function addDeveloperAuditLog(action, affectedUser = '-', actor = appState.currentEmployee || 'System', details = '', type = 'info') {
  ensureDeveloperData();
  const log = {
    id: `log_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    action,
    affectedUser,
    actor,
    details,
    type,
    timestamp: new Date().toISOString()
  };
  appState.developer.auditLogs.unshift(log);
  if (appState.developer.auditLogs.length > 200) appState.developer.auditLogs.pop();
  auditLogs = appState.developer.auditLogs;
}

function addDeveloperNotification(type, message) {
  ensureDeveloperData();
  appState.developer.notifications.unshift({
    id: `note_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    message,
    timestamp: new Date().toISOString(),
    read: false
  });
  if (appState.developer.notifications.length > 60) appState.developer.notifications.pop();
}

function getDeveloperUser(userId) {
  ensureDeveloperData();
  return appState.developer.users.find(user => user.id === userId);
}

function getDeveloperUserStatus(user) {
  const today = getTodayString();
  if (user.status === 'suspended') return 'suspended';
  if (user.expiryDate < today) return 'expired';
  return user.status || 'active';
}

function getDeveloperUserName(userId) {
  return getDeveloperUser(userId)?.name || 'Unknown user';
}

function formatCountdown(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `${Math.abs(days)} days expired`;
  if (days === 0) return 'Expires today';
  return `${days} days left`;
}

function renderDeveloperDashboard() {
  if (!canAccessDeveloperPanel()) return;
  ensureDeveloperData();
  updateSyncStatusDisplay();
  renderDeveloperOverview();
  renderBossBusinessInspector();
  renderBossAdminRegistry();
  renderBusinessProgress();
  renderDeveloperUsers();
  renderDeveloperPayments();
  renderDeveloperExpiryPanel();
  renderDeveloperNotifications();
  renderDeveloperAuditTrail();
  saveAppState();
}

function getBossInspectorAdmins() {
  return getRegistryAdmins().filter(admin => admin.loginName !== ADMIN_ACCOUNT);
}

function getBossInspectorSelectedAdmin() {
  const admins = getBossInspectorAdmins();
  const selectedId = $('bossInspectAdminSelect')?.value;
  return admins.find(admin => admin.id === selectedId) || admins[0] || null;
}

function getBossInspectorAccounts(admin) {
  if (!admin) return [];
  return [admin.loginName, ...getAdminUserAssignments(admin.loginName)];
}

let bossInspectorMode = 'admin';

function renderBossInspectorAdminOptions() {
  const select = $('bossInspectAdminSelect');
  if (!select) return;
  const admins = getBossInspectorAdmins();
  const current = select.value;
  select.innerHTML = admins.map(admin => `
    <option value="${admin.id}">${escapeHtml(admin.loginName)} - ${escapeHtml(admin.businessName || admin.fullName || '')}</option>
  `).join('');
  if (admins.some(admin => admin.id === current)) select.value = current;
}

function renderMiniList(containerId, rows, emptyText) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = rows.length
    ? rows.join('')
    : `<div class="dev-mini-item"><span>${emptyText}</span></div>`;
}

function renderBossBusinessInspector() {
  if (!canAccessDeveloperPanel()) return;
  renderBossInspectorAdminOptions();
  const admin = getBossInspectorSelectedAdmin();
  const summary = $('bossInspectorSummary');
  if (!admin || !summary) {
    if (summary) summary.innerHTML = '<div class="admin-staff-empty">Hakuna Admin wa kukagua.</div>';
    return;
  }

  const accounts = new Set(getBossInspectorAccounts(admin));
  const sales = (appState.sales || []).filter(sale => accounts.has(sale.employee));
  const expenses = (appState.expenses || []).filter(expense => accounts.has(expense.employee));
  const orders = (appState.orders || []).filter(order => accounts.has(order.employee) || order.ownerAdmin === admin.loginName);
  const reports = (appState.dailyReports || []).filter(report => accounts.has(report.employee));
  const status = getRegistryAdminBlockStatus(admin);
  const saleSummary = summarizeSales(sales, expenses);
  const users = getAdminUserAssignments(admin.loginName)
    .filter(employeeName => appState.employees?.[employeeName] && !appState.employees[employeeName].removed);

  summary.innerHTML = `
    <div><span>Admin</span><strong>${escapeHtml(admin.loginName)}</strong></div>
    <div><span>Biashara</span><strong>${escapeHtml(admin.businessName || admin.fullName || '-')}</strong></div>
    <div><span>Status</span><strong class="${status.blocked ? 'status-danger-text' : 'status-success-text'}">${status.status || admin.status || 'active'}</strong></div>
    <div><span>Users</span><strong>${users.length}</strong></div>
    <div><span>Mauzo</span><strong>${formatCurrency(saleSummary.revenue)}</strong></div>
    <div><span>Matumizi</span><strong>${formatCurrency(saleSummary.expenses)}</strong></div>
    <div><span>Kilichobaki</span><strong>${formatCurrency(saleSummary.profit)}</strong></div>
    <div><span>Expiry</span><strong>${admin.expiryDate || '-'}</strong></div>
  `;

  renderMiniList('bossInspectorUsers', users.map(employeeName => {
    const account = appState.employees?.[employeeName] || {};
    return `<div class="dev-mini-item"><strong>${escapeHtml(employeeName)}</strong><span>${account.isOnline ? 'Online' : 'Offline'} | ${account.lastLogin ? formatDateTime(account.lastLogin) : 'Hajaingia'}</span></div>`;
  }), 'Hakuna user chini ya Admin huyu.');

  const recentSales = groupSalesByTransaction(sales)
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 6);
  renderMiniList('bossInspectorSales', recentSales.map(sale => `
    <div class="dev-mini-item">
      <strong>${escapeHtml(sale.employee)} - ${formatCurrency(sale.total)}</strong>
      <span>${formatDateTime(sale.timestamp)} | ${sale.items} items</span>
      <small>${escapeHtml((sale.products || []).join(', '))}</small>
    </div>
  `), 'Hakuna mauzo yaliyorekodiwa.');

  renderMiniList('bossInspectorOrders', orders
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.timestamp || 0) - new Date(a.updatedAt || a.timestamp || 0))
    .slice(0, 6)
    .map(order => `
      <div class="dev-mini-item ${order.paymentStatus === 'paid' ? 'success' : 'warning'}">
        <strong>${escapeHtml(order.customerName || 'Walk-in Customer')} - ${formatCurrency(order.total || 0)}</strong>
        <span>${escapeHtml(order.employee || 'Unknown')} | ${escapeHtml(order.status || 'pending')} | ${formatDateTime(order.updatedAt || order.timestamp)}</span>
      </div>
    `), 'Hakuna oda zilizorekodiwa.');

  renderMiniList('bossInspectorReports', reports
    .slice()
    .sort((a, b) => `${b.date || ''}${b.submittedAt || b.generatedAt || ''}`.localeCompare(`${a.date || ''}${a.submittedAt || a.generatedAt || ''}`))
    .slice(0, 6)
    .map(report => `
      <div class="dev-mini-item ${report.autoGenerated ? 'warning' : 'success'}">
        <strong>${escapeHtml(report.label || `REPORT BY ${report.employee}`)}</strong>
        <span>${formatDate(report.date)} | ${formatCurrency(report.summary?.revenue || 0)}</span>
      </div>
    `), 'Hakuna report bado.');

  renderBossInspectorModeContent({ admin, sales, expenses, orders, reports, users });
}

function renderBossInspectorModeContent({ admin, sales, expenses, orders, reports, users }) {
  const container = $('bossInspectorModeContent');
  if (!container || !admin) return;
  const saleSummary = summarizeSales(sales, expenses);

  if (bossInspectorMode === 'staff') {
    const rows = users.map(employeeName => {
      const staffSales = sales.filter(sale => sale.employee === employeeName);
      const staffExpenses = expenses.filter(expense => expense.employee === employeeName);
      const summary = summarizeSales(staffSales, staffExpenses);
      return `
        <div class="dev-mini-item">
          <strong>${escapeHtml(employeeName)}</strong>
          <span>Mauzo: ${formatCurrency(summary.revenue)} | Matumizi: ${formatCurrency(summary.expenses)} | Oda: ${orders.filter(order => order.employee === employeeName).length}</span>
        </div>
      `;
    });
    container.innerHTML = `
      <h4>Wafanyakazi Progress</h4>
      <div class="dev-mini-list">${rows.join('') || '<div class="dev-mini-item"><span>Hakuna wafanyakazi chini ya Admin huyu.</span></div>'}</div>
    `;
    return;
  }

  container.innerHTML = `
    <h4>Admin Progress</h4>
    <div class="boss-inspector-summary">
      <div><span>Admin</span><strong>${escapeHtml(admin.loginName)}</strong></div>
      <div><span>Mauzo</span><strong>${formatCurrency(saleSummary.revenue)}</strong></div>
      <div><span>Matumizi</span><strong>${formatCurrency(saleSummary.expenses)}</strong></div>
      <div><span>Oda</span><strong>${orders.length}</strong></div>
      <div><span>Reports</span><strong>${reports.length}</strong></div>
    </div>
  `;
}

function setBossInspectorMode(mode) {
  bossInspectorMode = mode === 'staff' ? 'staff' : 'admin';
  renderBossBusinessInspector();
}

function bossInspectorSetStatus(status) {
  const admin = getBossInspectorSelectedAdmin();
  if (!admin) return;
  bossSetAdminLicenseStatus(admin.id, status);
  renderBossBusinessInspector();
}

async function bossClearSelectedAdminSalesExpenses() {
  const admin = getBossInspectorSelectedAdmin();
  if (!admin) return;
  const employees = getBossInspectorAccounts(admin);
  if (!confirm(`Futa mauzo na matumizi ya ${admin.loginName} na users wake tu?`)) return;
  if (!confirm('Hakuna kurudisha bila backup. Endelea?')) return;

  const employeeSet = new Set(employees);
  const inScope = record => employeeSet.has(record?.employee);
  const salesToClear = (appState.sales || []).filter(inScope);
  const expensesToClear = (appState.expenses || []).filter(inScope);
  const reportsToClear = (appState.dailyReports || []).filter(inScope);
  const receiptIds = new Set(salesToClear.map(sale => sale.receiptId || sale.transactionId || sale.id).filter(Boolean));
  const receiptsToClear = (appState.receipts || []).filter(receipt => employeeSet.has(receipt.employee || receipt.cashier || receipt.createdBy) || receiptIds.has(receipt.id) || receiptIds.has(receipt.transactionId));

  try {
    await clearBackendSalesAndExpensesOnly(employees);
  } catch (error) {
    console.warn('Boss backend clear failed:', error.message);
  }

  appState.sales = (appState.sales || []).filter(record => !inScope(record));
  appState.expenses = (appState.expenses || []).filter(record => !inScope(record));
  appState.dailyReports = (appState.dailyReports || []).filter(record => !inScope(record));
  appState.receipts = (appState.receipts || []).filter(receipt => !receiptsToClear.some(item => item.id === receipt.id));
  if (appState.lastReceiptId && receiptsToClear.some(receipt => receipt.id === appState.lastReceiptId)) appState.lastReceiptId = null;

  try {
    await Promise.all([
      ...salesToClear.map(record => idbDelete('sales', record.id)),
      ...receiptsToClear.map(record => idbDelete('receipts', record.id)),
      ...reportsToClear.map(record => idbDelete('dailyReports', record.id))
    ]);
  } catch (error) {
    console.warn('Boss local cache clear failed:', error.message);
  }

  addDeveloperAuditLog('boss_clear_admin_sales', admin.loginName, appState.currentEmployee, `Cleared scoped sales/expenses for ${admin.loginName}`, 'warning');
  saveAppState();
  updateDashboard();
  renderDailyReport();
  renderWeeklyReport();
  renderMonthlyReport();
  renderHistoryTable();
  renderBossBusinessInspector();
  renderDeveloperDashboard();
  showNotification(`Boss amefuta mauzo ${salesToClear.length}, matumizi ${expensesToClear.length}, reports ${reportsToClear.length} za ${admin.loginName}.`);
}

function renderDeveloperOverview() {
  const users = appState.developer.users;
  const payments = appState.developer.payments;
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const totalUsers = users.length;
  const activeUsers = users.filter(user => getDeveloperUserStatus(user) === 'active').length;
  const expiredUsers = users.filter(user => getDeveloperUserStatus(user) === 'expired').length;
  const monthlyRevenue = payments
    .filter(payment => payment.status === 'paid' && payment.timestamp.slice(0, 7) === monthKey)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const newSignups = users.filter(user => (user.signupDate || '').slice(0, 7) === monthKey).length;

  if ($('devDashTotalUsers')) $('devDashTotalUsers').textContent = totalUsers;
  if ($('devDashActiveUsers')) $('devDashActiveUsers').textContent = activeUsers;
  if ($('devDashExpiredSubs')) $('devDashExpiredSubs').textContent = expiredUsers;
  if ($('devDashMonthlyRevenue')) $('devDashMonthlyRevenue').textContent = formatCurrency(monthlyRevenue);
  if ($('devDashNewSignups')) $('devDashNewSignups').textContent = newSignups;
}

function getManagedAdminBusinesses() {
  const adminNames = new Set(getAdminEmployees());
  return appState.developer.users.filter(user => adminNames.has(user.adminName));
}

function getCurrentAdminBusiness() {
  ensureDeveloperData();
  return appState.developer.users.find(user => user.adminName === appState.currentEmployee);
}

function getBusinessOperationalMetrics(business) {
  const accounts = new Set(getAccountsForBusiness(business));
  const sales = accounts.size
    ? appState.sales.filter(sale => accounts.has(sale.employee))
    : appState.sales;
  const todaysSales = sales.filter(sale => sale.date === TODAY);
  return {
    salesToday: todaysSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    itemsSoldToday: todaysSales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0),
    productsRemaining: appState.products.reduce((sum, product) => sum + Number(product.stock || 0), 0),
    lowStock: appState.products.filter(product => product.stock > 0 && product.stock <= appState.settings.lowStockThreshold).length
  };
}

function renderRoleBusinessDashboard() {
  const panel = $('roleBusinessDashboard');
  if (!panel) return;

  ensureDeveloperData();
  panel.classList.add('hidden');
  panel.innerHTML = '';

  if (isSuperAdmin()) {
    const businesses = getManagedAdminBusinesses();
    const totalRevenue = businesses.reduce((sum, business) => sum + Number(business.revenue || 0), 0);
    const totalTransactions = businesses.reduce((sum, business) => sum + Number(business.transactions || 0), 0);
    const totalSalesToday = businesses.reduce((sum, business) => sum + getBusinessOperationalMetrics(business).salesToday, 0);
    const productsRemaining = appState.products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
    const activeCount = businesses.filter(business => getDeveloperUserStatus(business) === 'active').length;
    const expiredCount = businesses.filter(business => getDeveloperUserStatus(business) === 'expired').length;
    panel.innerHTML = `
      <div class="role-dashboard-header">
        <div>
          <span>Developer View</span>
          <h3>Maendeleo ya biashara zote za Admin</h3>
        </div>
        <button class="btn btn-secondary" onclick="switchView('developer')">Open Developer Panel</button>
      </div>
      <div class="role-dashboard-summary">
        <div><span>Admins</span><strong>${businesses.length}</strong></div>
        <div><span>Active</span><strong>${activeCount}</strong></div>
        <div><span>Expired</span><strong>${expiredCount}</strong></div>
        <div><span>Total Revenue</span><strong>${formatCurrency(totalRevenue)}</strong></div>
        <div><span>Transactions</span><strong>${totalTransactions}</strong></div>
        <div><span>Mauzo Leo</span><strong>${formatCurrency(totalSalesToday)}</strong></div>
        <div><span>Bidhaa Zimebaki</span><strong>${productsRemaining}</strong></div>
      </div>
      <div class="role-business-list">
        ${businesses.map((business, index) => {
          const status = getDeveloperUserStatus(business);
          const growth = Number(business.growth || 0);
          const metrics = getBusinessOperationalMetrics(business);
          return `
            <div class="role-business-card">
              <div class="role-business-title">
                <span>${index + 1}</span>
                <div>
                  <strong>${business.adminName}</strong>
                  <small>${business.businessName || business.name}</small>
                </div>
                <em class="dev-status-badge ${status}">${status}</em>
              </div>
              <div class="role-business-metrics">
                <div><small>Revenue</small><strong>${formatCurrency(business.revenue || 0)}</strong></div>
                <div><small>Transactions</small><strong>${business.transactions || 0}</strong></div>
                <div><small>Mauzo Leo</small><strong>${formatCurrency(metrics.salesToday)}</strong></div>
                <div><small>Bidhaa Zimebaki</small><strong>${metrics.productsRemaining}</strong></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    panel.classList.remove('hidden');
    return;
  }

  if (appState.currentRole === 'admin') {
    const business = getCurrentAdminBusiness();
    if (!business) return;
    const status = getDeveloperUserStatus(business);
    const growth = Number(business.growth || 0);
    const metrics = getBusinessOperationalMetrics(business);
    panel.innerHTML = `
      <div class="role-dashboard-header">
        <div>
          <span>${appState.currentEmployee}</span>
          <h3>${business.businessName || business.name}</h3>
        </div>
        <em class="dev-status-badge ${status}">${status}</em>
      </div>
      <div class="role-dashboard-summary">
        <div><span>Revenue</span><strong>${formatCurrency(business.revenue || 0)}</strong></div>
        <div><span>Transactions</span><strong>${business.transactions || 0}</strong></div>
        <div><span>Mauzo Leo</span><strong>${formatCurrency(metrics.salesToday)}</strong></div>
        <div><span>Bidhaa Zimebaki</span><strong>${metrics.productsRemaining}</strong></div>
        <div><span>Stock Value</span><strong>${formatCurrency(business.stockValue || 0)}</strong></div>
        <div><span>Growth</span><strong class="${growth >= 0 ? 'growth-up' : 'growth-down'}">${growth}%</strong></div>
        <div><span>Expires</span><strong>${formatCountdown(business.expiryDate)}</strong></div>
      </div>
    `;
    panel.classList.remove('hidden');
  }
}

function renderBusinessProgress() {
  const businesses = getManagedAdminBusinesses();
  const cards = $('devBusinessProgressCards');
  const tbody = $('devBusinessProgressTableBody');

  if (cards) {
    cards.innerHTML = businesses.map((business, index) => {
      const status = getDeveloperUserStatus(business);
      const growthClass = Number(business.growth || 0) >= 0 ? 'success' : 'danger';
      const metrics = getBusinessOperationalMetrics(business);
      return `
        <div class="business-progress-card">
          <div class="business-progress-top">
            <span>${index + 1}</span>
            <strong>${business.adminName}</strong>
            <em class="dev-status-badge ${status}">${status}</em>
          </div>
          <h4>${business.businessName || business.name}</h4>
          <div class="business-progress-metrics">
            <div><small>Mauzo Leo</small><strong>${formatCurrency(metrics.salesToday)}</strong></div>
            <div><small>Bidhaa Zimebaki</small><strong>${metrics.productsRemaining}</strong></div>
            <div><small>Revenue</small><strong>${formatCurrency(business.revenue || 0)}</strong></div>
            <div><small>Transactions</small><strong>${business.transactions || 0}</strong></div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (!tbody) return;
  tbody.innerHTML = '';
  businesses.forEach((business, index) => {
    const status = getDeveloperUserStatus(business);
    const growth = Number(business.growth || 0);
    const metrics = getBusinessOperationalMetrics(business);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${business.adminName}</strong><br><span>${business.email}</span></td>
      <td>${business.businessName || business.name}</td>
      <td><span class="dev-status-badge ${status}">${status}</span></td>
      <td>${formatCurrency(metrics.salesToday)}</td>
      <td>${metrics.productsRemaining}</td>
      <td>${formatCurrency(business.revenue || 0)}</td>
      <td>${business.transactions || 0}</td>
      <td>${business.customers || 0}</td>
      <td>${formatCurrency(business.stockValue || 0)}</td>
      <td><span class="${growth >= 0 ? 'growth-up' : 'growth-down'}">${growth}%</span></td>
    `;
    tbody.appendChild(row);
  });
}

function getFilteredDeveloperUsers() {
  const query = ($('devUserSearch')?.value || '').trim().toLowerCase();
  const status = $('devUserStatusFilter')?.value || 'all';
  return appState.developer.users.filter(user => {
    const userStatus = getDeveloperUserStatus(user);
    const matchesStatus = status === 'all' || userStatus === status;
    const matchesQuery = !query || `${user.adminName || ''} ${user.businessName || ''} ${user.name} ${user.email}`.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });
}

function renderDeveloperUsers() {
  const tbody = $('devUsersTableBody');
  const select = $('devOverrideUser');
  if (select) {
    select.innerHTML = appState.developer.users
      .map(user => `<option value="${user.id}">${user.adminName || 'User'} - ${user.businessName || user.name}</option>`)
      .join('');
  }
  if (!tbody) return;

  const rows = getFilteredDeveloperUsers();
  tbody.innerHTML = '';
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No users found</td></tr>';
    return;
  }

  rows.forEach(user => {
    const status = getDeveloperUserStatus(user);
    const pendingPayment = user.status === 'pending_payment';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${user.adminName || 'User'}</strong><br><span>${user.businessName || user.name}</span><br><span>${user.email}</span></td>
      <td><span class="dev-status-badge ${status}">${status}</span></td>
      <td>${getPlanDetails(user.plan).displayName}</td>
      <td>${user.expiryDate}<br><span>${formatCountdown(user.expiryDate)}</span></td>
      <td>
        <div class="dev-table-actions">
          <button class="btn btn-small btn-success" onclick="devActivateUser('${user.id}')">ACTIVE</button>
          ${pendingPayment ? `<button class="btn btn-small btn-primary" onclick="devConfirmPayment('${user.id}', 'BANK')">Paid BANK</button>` : ''}
          ${pendingPayment ? `<button class="btn btn-small btn-primary" onclick="devConfirmPayment('${user.id}', 'MITANDAO')">Paid MITANDAO</button>` : ''}
          <button class="btn btn-small btn-secondary" onclick="devSuspendUser('${user.id}')">SUSPEND</button>
          <button class="btn btn-small btn-primary" onclick="devExtendUser('${user.id}', 30)">+30d</button>
          <button class="btn btn-small btn-danger" onclick="devExpireUser('${user.id}')">EXPIRE</button>
          <button class="btn btn-small btn-danger" onclick="devDeleteUser('${user.id}')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderDeveloperPayments() {
  const payments = appState.developer.payments;
  const paidUsers = new Set(payments.filter(payment => payment.status === 'paid').map(payment => payment.userId)).size;
  const unpaidUsers = new Set(payments.filter(payment => ['unpaid', 'pending'].includes(payment.status)).map(payment => payment.userId)).size;
  const failedPayments = payments.filter(payment => payment.status === 'failed').length;
  if ($('devPaidUsers')) $('devPaidUsers').textContent = paidUsers;
  if ($('devUnpaidUsers')) $('devUnpaidUsers').textContent = unpaidUsers;
  if ($('devFailedPayments')) $('devFailedPayments').textContent = failedPayments;
  renderPaymentReminderPanel();

  const tbody = $('devPaymentsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  payments.forEach(payment => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${getDeveloperUserName(payment.userId)}</td>
      <td>${formatCurrency(payment.amount || 0)}</td>
      <td><span class="dev-status-badge ${payment.status}">${payment.status}</span></td>
      <td>${payment.method || '-'}${payment.reference ? `<br><small>${payment.reference}</small>` : ''}</td>
      <td>${formatDateTime(payment.timestamp)}</td>
    `;
    tbody.appendChild(row);
  });
}

function getUnpaidDeveloperUsers() {
  const users = appState.developer?.users || [];
  const paidIds = new Set((appState.developer?.payments || [])
    .filter(payment => payment.status === 'paid')
    .map(payment => payment.userId));
  return users.filter(user => {
    const status = getDeveloperUserStatus(user);
    return !paidIds.has(user.id) || ['pending_payment', 'expired', 'suspended'].includes(status);
  });
}

function buildSubscriptionReminderMessage(user, period = 'weekly') {
  const label = period === 'monthly' ? 'mwezi' : 'wiki';
  const amount = getMonthlyFeeForPlan(user.plan || LICENSE_PLANS.FREE);
  return `Habari ${user.fullName || user.adminName || user.name}, tunakukumbusha malipo ya ${label} ya ${user.businessName || user.name}. Kiasi: ${formatCurrency(amount)}. Tafadhali lipa ili huduma iendelee bila kusimama. MO SaaS.`;
}

function sendSubscriptionReminder(userId, channel = 'whatsapp', period = 'weekly') {
  if (!assertSuperAdminAction()) return false;
  const user = getDeveloperUser(userId);
  if (!user) return false;
  const message = buildSubscriptionReminderMessage(user, period);
  const phone = getWhatsAppPhone(user.phone);
  if (channel === 'whatsapp') {
    if (!phone) {
      alert('Admin huyu hana namba ya simu');
      return false;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  } else if (channel === 'sms') {
    if (!phone) {
      alert('Admin huyu hana namba ya simu');
      return false;
    }
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
  } else if (channel === 'email') {
    if (!user.email) {
      alert('Admin huyu hana email');
      return false;
    }
    window.location.href = `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent('Kikumbusho cha malipo')}&body=${encodeURIComponent(message)}`;
  }
  addDeveloperNotification('payment_reminder', `${period} reminder sent to ${user.businessName || user.name} via ${channel}`);
  saveAppState();
  renderDeveloperDashboard();
  showNotification(`Payment reminder imetumwa: ${channel}`);
  return true;
}

function renderPaymentReminderPanel() {
  const panel = $('devPaymentReminders');
  if (!panel) return;
  const users = getUnpaidDeveloperUsers().slice(0, 8);
  panel.innerHTML = `<h4>Unpaid reminders</h4>` + (users.map(user => `
    <div class="dev-mini-item warning payment-reminder-item">
      <div>
        <strong>${escapeHtml(user.businessName || user.name)}</strong>
        <span>${escapeHtml(user.adminName || user.fullName || '')} | ${formatCurrency(getMonthlyFeeForPlan(user.plan))}</span>
      </div>
      <div class="payment-reminder-actions">
        <button class="btn btn-small btn-success" type="button" onclick="sendSubscriptionReminder('${user.id}', 'whatsapp', 'weekly')" ${user.phone ? '' : 'disabled'}>WhatsApp</button>
        <button class="btn btn-small btn-secondary" type="button" onclick="sendSubscriptionReminder('${user.id}', 'sms', 'weekly')" ${user.phone ? '' : 'disabled'}>SMS</button>
        <button class="btn btn-small btn-secondary" type="button" onclick="sendSubscriptionReminder('${user.id}', 'email', 'monthly')" ${user.email ? '' : 'disabled'}>Email</button>
      </div>
    </div>
  `).join('') || '<p>No unpaid users</p>');
}

function renderDeveloperExpiryPanel() {
  const expiring = $('devExpiringUsers');
  const expired = $('devExpiredUsers');
  const users = appState.developer.users;
  const soon = users.filter(user => {
    const status = getDeveloperUserStatus(user);
    const daysText = formatCountdown(user.expiryDate);
    const days = Number(daysText.split(' ')[0]);
    return status === 'active' && days >= 0 && days <= 7;
  });
  const expiredRows = users.filter(user => getDeveloperUserStatus(user) === 'expired');

  if (expiring) {
    expiring.innerHTML = `<h4>Expiring in 7 days</h4>` + (soon.map(user => `
      <div class="dev-mini-item warning">
        <strong>${user.name}</strong>
        <span>${formatCountdown(user.expiryDate)}</span>
      </div>
    `).join('') || '<p>No users expiring soon</p>');
  }
  if (expired) {
    expired.innerHTML = `<h4>Expired users</h4>` + (expiredRows.map(user => `
      <div class="dev-mini-item danger">
        <strong>${user.name}</strong>
        <span>${formatCountdown(user.expiryDate)}</span>
      </div>
    `).join('') || '<p>No expired users</p>');
  }
}

function renderDeveloperNotifications() {
  const list = $('devNotificationsList');
  if (!list) return;
  const notifications = appState.developer.notifications.slice(0, 8);
  list.innerHTML = notifications.map(note => `
    <div class="dev-mini-item">
      <strong>${note.type}</strong>
      <span>${note.message}</span>
      <small>${formatDateTime(note.timestamp)}</small>
    </div>
  `).join('') || '<p>No notifications yet</p>';
}

function renderDeveloperAuditTrail() {
  const container = $('devAuditTrailList');
  if (!container) return;
  const logs = appState.developer.auditLogs.slice(0, 80);
  container.innerHTML = '';
  if (logs.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No audit logs yet</p>';
    return;
  }

  logs.forEach(log => {
    const item = document.createElement('div');
    item.className = `audit-log-item ${log.type || 'info'}`;
    item.innerHTML = `
      <span class="audit-log-time">${formatDateTime(log.timestamp)}</span>
      <span class="audit-log-action">${log.action} - ${log.affectedUser || '-'}</span>
      <span class="audit-log-detail">By ${log.actor || 'System'}: ${log.details || ''}</span>
    `;
    container.appendChild(item);
  });
}

async function loadBackendAuditLogs() {
  if (!assertSuperAdminAction()) return;
  const token = await getBackendAuthToken();
  if (!token) {
    showNotification('Login ya backend inahitajika kusoma audit logs.');
    return;
  }

  try {
    const response = await fetch(`${PAYMENT_API_BASE_URL}/audit?limit=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || 'Audit logs failed');

    const backendLogs = (result.data || []).map(row => ({
      id: `backend_${row.id}`,
      action: row.action,
      affectedUser: row.entity_id || row.entity || '-',
      actor: row.user_id || 'Backend',
      details: typeof row.details === 'string' ? row.details : JSON.stringify(row.details || {}),
      type: 'info',
      timestamp: row.created_at
    }));
    appState.developer.auditLogs = [...backendLogs, ...(appState.developer.auditLogs || [])]
      .slice(0, 200);
    auditLogs = appState.developer.auditLogs;
    renderDeveloperAuditTrail();
    showNotification('Backend audit logs loaded');
  } catch (error) {
    showNotification(getApiConnectionErrorMessage(error));
  }
}

function assertSuperAdminAction() {
  if (!canAccessDeveloperPanel()) {
    showNotification('Developer action denied');
    return false;
  }
  return true;
}

function syncRegistryAdminStatus(userId, status, expiryDate = null) {
  const registryAdmin = findRegistryAdminById(userId);
  if (!registryAdmin) return;
  registryAdmin.status = status;
  if (expiryDate) registryAdmin.expiryDate = expiryDate;
  syncRegistryToEmployees();
  if (registryAdmin.loginName === appState.currentEmployee) {
    syncCurrentLicenseFromAdminControl(registryAdmin.loginName);
  }
}

function bossSetAdminLicenseStatus(adminId, licenseStatus) {
  if (!assertSuperAdminAction()) return;
  const admin = findRegistryAdminById(adminId);
  if (!admin) {
    showNotification('Admin haijapatikana.');
    return;
  }

  const normalized = normalizeLicenseStatus(licenseStatus);
  const businessLockTarget = {
    id: admin.id,
    adminName: admin.loginName,
    name: admin.businessName,
    businessName: admin.businessName
  };

  if (normalized === LICENSE_STATUS.ACTIVE) {
    admin.status = 'active';
    if (!admin.expiryDate || admin.expiryDate < getTodayString()) {
      admin.expiryDate = getTodayString();
    }
    setBusinessAccountsLocked(businessLockTarget, false);
    addDeveloperAuditLog('boss_activate_admin', admin.loginName, appState.currentEmployee, `Boss activated ${admin.loginName}`, 'success');
    addDeveloperNotification('admin_action', `${admin.businessName} activated by Boss`);
    showNotification(`${admin.loginName} ACTIVE sasa.`);
  } else if (normalized === LICENSE_STATUS.SUSPEND) {
    admin.status = 'suspended';
    setBusinessAccountsLocked(businessLockTarget, true, buildAccountBlockMessage({ businessName: admin.businessName, status: 'suspended', actor: 'Boss Admin' }));
    addDeveloperAuditLog('boss_suspend_admin', admin.loginName, appState.currentEmployee, `Boss suspended ${admin.loginName}`, 'warning');
    addDeveloperNotification('admin_action', `${admin.businessName} suspended by Boss`);
    showNotification(`${admin.loginName} imefungwa (SUSPEND).`);
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    admin.status = 'expired';
    admin.expiryDate = yesterday.toISOString().split('T')[0];
    setBusinessAccountsLocked(businessLockTarget, true, buildAccountBlockMessage({ businessName: admin.businessName, status: 'expired', actor: 'Boss Admin' }));
    addDeveloperAuditLog('boss_expire_admin', admin.loginName, appState.currentEmployee, `Boss expired ${admin.loginName}`, 'warning');
    addDeveloperNotification('subscription', `${admin.businessName} expired by Boss`);
    showNotification(`${admin.loginName} imefungwa (EXPIRE).`);
  }

  syncRegistryToEmployees();
  const account = appState.employees?.[admin.loginName];
  if (account) {
    const block = getRegistryAdminBlockStatus(admin);
    account.locked = block.blocked;
    account.lockedReason = block.blocked
      ? buildAccountBlockMessage({ businessName: admin.businessName, status: block.status, actor: 'Boss Admin' })
      : null;
  }
  syncRegistryToDeveloperUsers();
  saveAppState();
  renderDeveloperDashboard();
  renderBossAdminRegistry();
  enforceCurrentAccountAccess();
}

function bossAdjustAdminDays(adminId, direction = 1) {
  if (!assertSuperAdminAction()) return;
  const admin = findRegistryAdminById(adminId);
  if (!admin) {
    showNotification('Admin haijapatikana.');
    return;
  }

  const input = $(`bossDays_${adminId}`);
  const days = Math.max(1, Math.abs(Number(input?.value || 30)));
  const signedDays = days * (Number(direction) >= 0 ? 1 : -1);
  const today = getTodayString();
  const baseDate = signedDays > 0 && (!admin.expiryDate || admin.expiryDate < today)
    ? new Date(today)
    : new Date(admin.expiryDate || today);

  baseDate.setDate(baseDate.getDate() + signedDays);
  admin.expiryDate = baseDate.toISOString().split('T')[0];
  admin.lastBossTimeChange = `${signedDays > 0 ? '+' : '-'}${days} siku | ${formatDateTime(new Date())}`;

  const businessLockTarget = {
    id: admin.id,
    adminName: admin.loginName,
    name: admin.businessName,
    businessName: admin.businessName
  };

  if (admin.expiryDate < today) {
    admin.status = 'expired';
    setBusinessAccountsLocked(businessLockTarget, true, buildAccountBlockMessage({ businessName: admin.businessName, status: 'expired', actor: 'Boss Admin' }));
  } else {
    admin.status = 'active';
    setBusinessAccountsLocked(businessLockTarget, false);
  }

  syncRegistryToEmployees();
  const account = appState.employees?.[admin.loginName];
  if (account) {
    const block = getRegistryAdminBlockStatus(admin);
    account.locked = block.blocked;
    account.lockedReason = block.blocked
      ? buildAccountBlockMessage({ businessName: admin.businessName, status: block.status, actor: 'Boss Admin' })
      : null;
  }
  syncRegistryToDeveloperUsers();
  saveAppState();
  renderDeveloperDashboard();
  renderBossAdminRegistry();
  enforceCurrentAccountAccess();

  const actionText = signedDays > 0 ? 'ameongezewa' : 'amepunguziwa';
  showNotification(`${admin.loginName} ${actionText} ${days} siku. Expiry: ${admin.expiryDate} (${formatCountdown(admin.expiryDate)}).`);
  addDeveloperAuditLog('boss_adjust_admin_days', admin.loginName, appState.currentEmployee, `${admin.loginName} ${actionText} ${days} siku. Expiry ${admin.expiryDate}`, signedDays > 0 ? 'success' : 'warning');
}

function devActivateUser(userId) {
  if (!assertSuperAdminAction()) return;
  const user = getDeveloperUser(userId);
  if (!user) return;
  user.status = 'active';
  if (user.expiryDate < getTodayString()) user.expiryDate = getTodayString();
  syncRegistryAdminStatus(userId, 'active', user.expiryDate);
  setBusinessAccountsLocked(user, false);
  addDeveloperAuditLog('activate_user', user.name, appState.currentEmployee, 'Activated user manually', 'success');
  addDeveloperNotification('admin_action', `${user.name} activated manually`);
  renderDeveloperDashboard();
}

function devSuspendUser(userId) {
  if (!assertSuperAdminAction()) return;
  const user = getDeveloperUser(userId);
  if (!user) return;
  user.status = 'suspended';
  syncRegistryAdminStatus(userId, 'suspended');
  setBusinessAccountsLocked(user, true, buildAccountBlockMessage({ businessName: user.businessName || user.name, status: 'suspended', actor: 'Boss Admin' }));
  addDeveloperAuditLog('suspend_user', user.name, appState.currentEmployee, 'Suspended user account', 'warning');
  addDeveloperNotification('admin_action', `${user.name} suspended`);
  renderDeveloperDashboard();
}

function devDeleteUser(userId) {
  if (!assertSuperAdminAction()) return;
  const user = getDeveloperUser(userId);
  if (!user) return;
  if (findRegistryAdminById(userId)) {
    bossRemoveAdmin(userId);
    return;
  }
  if (!confirm(`Delete ${user.name}?`)) return;
  appState.developer.users = appState.developer.users.filter(item => item.id !== userId);
  addDeveloperAuditLog('delete_user', user.name, appState.currentEmployee, 'Deleted user from SaaS dashboard', 'error');
  renderDeveloperDashboard();
}

function devExtendUser(userId, days = 30) {
  if (!assertSuperAdminAction()) return;
  const user = getDeveloperUser(userId);
  if (!user) return;
  const base = new Date(user.expiryDate < getTodayString() ? getTodayString() : user.expiryDate);
  base.setDate(base.getDate() + Number(days || 30));
  user.expiryDate = base.toISOString().split('T')[0];
  user.status = 'active';
  syncRegistryAdminStatus(userId, 'active', user.expiryDate);
  setBusinessAccountsLocked(user, false);
  addDeveloperAuditLog('extend_subscription', user.name, appState.currentEmployee, `Extended subscription by ${days} days`, 'success');
  addDeveloperNotification('subscription', `${user.name} subscription extended by ${days} days`);
  renderDeveloperDashboard();
}

function devExpireUser(userId) {
  if (!assertSuperAdminAction()) return;
  const user = getDeveloperUser(userId);
  if (!user) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  user.expiryDate = yesterday.toISOString().split('T')[0];
  user.status = 'expired';
  syncRegistryAdminStatus(userId, 'expired', user.expiryDate);
  setBusinessAccountsLocked(user, true, buildAccountBlockMessage({ businessName: user.businessName || user.name, status: 'expired', actor: 'Boss Admin' }));
  addDeveloperAuditLog('expire_subscription', user.name, appState.currentEmployee, 'Expired subscription manually', 'warning');
  addDeveloperNotification('subscription', `${user.name} subscription expired manually`);
  renderDeveloperDashboard();
}

function devExtendSelectedSubscription() {
  devExtendUser($('devOverrideUser')?.value, Number($('devOverrideDays')?.value || 30));
}

function devActivateSelectedUser() {
  devActivateUser($('devOverrideUser')?.value);
}

function devExpireSelectedUser() {
  devExpireUser($('devOverrideUser')?.value);
}

function devConfirmPayment(userId, method = 'BANK') {
  if (!assertSuperAdminAction()) return;
  const user = getDeveloperUser(userId);
  if (!user) return;
  const amount = getMonthlyFeeForPlan(user.plan);
  const reference = `DEV-${Date.now().toString().slice(-6)}`;
  recordPaymentEvent(userId, amount, 'paid', method, reference);
  devActivateUser(userId);
  addDeveloperNotification('payment', `${user.name} paid via ${method}`);
}

function autoActivateUserFromPayment(userId, method = 'AUTO') {
  const user = getDeveloperUser(userId);
  if (!user) return;
  user.status = 'active';
  if (user.expiryDate < getTodayString()) user.expiryDate = getTodayString();
  syncRegistryAdminStatus(userId, 'active', user.expiryDate);
  setBusinessAccountsLocked(user, false);
  addDeveloperAuditLog('auto_activate_payment', user.name, 'System', `Auto-activated after ${method} payment`, 'success');
  addDeveloperNotification('payment', `${user.name} auto-activated after payment`);
  saveAppState();
}

function recordPaymentEvent(userId, amount, status = 'paid', method = 'Manual', reference = '') {
  ensureDeveloperData();
  appState.developer.payments.unshift({
    id: `pay_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    userId,
    amount,
    status,
    method,
    reference,
    timestamp: new Date().toISOString()
  });
  addDeveloperAuditLog(
    'payment_event',
    getDeveloperUserName(userId),
    'System',
    `${status} payment via ${method}: ${formatCurrency(amount)}${reference ? ` (Ref: ${reference})` : ''}`,
    status === 'paid' ? 'success' : 'warning'
  );
  addDeveloperNotification('payment', `${status} payment from ${getDeveloperUserName(userId)}`);
}

function addAuditLogLegacy(action, details, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const log = { timestamp, action, details, type };
  auditLogs.unshift(log);
  if (auditLogs.length > 100) auditLogs.pop();
}

function refreshDevStats() {
  if (!canAccessDeveloperPanel()) return;
  renderDeveloperDashboard();
  const totalProducts = appState.products.length;
  const totalStockValue = appState.products.reduce((sum, p) => sum + (p.price * p.stock), 0);
  const totalSales = appState.sales.length;
  const totalRevenue = appState.sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const storageUsed = (JSON.stringify(appState).length / 1024).toFixed(2);

  if ($('devTotalProducts')) $('devTotalProducts').textContent = totalProducts;
  if ($('devTotalStockValue')) $('devTotalStockValue').textContent = formatCurrency(totalStockValue);
  if ($('devTotalSales')) $('devTotalSales').textContent = totalSales;
  if ($('devTotalRevenue')) $('devTotalRevenue').textContent = formatCurrency(totalRevenue);
  if ($('devStorageUsed')) $('devStorageUsed').textContent = storageUsed + ' KB';

  // Update license info
  if ($('devCompanyId')) $('devCompanyId').textContent = licenseData.company_id || '-';
  if ($('devLicensePlan')) $('devLicensePlan').textContent = getPlanDetails(licenseData.plan).displayName;
  if ($('devLicenseStatus')) $('devLicenseStatus').textContent = licenseData.status || 'UNKNOWN';
  if ($('devLicenseExpiry')) $('devLicenseExpiry').textContent = licenseData.expiry_date || '-';
  if ($('devDaysLeft')) $('devDaysLeft').textContent = getDaysRemaining() + ' days';

  // Update employee list
  renderDevEmployeeList();

  // Update backup status
  if ($('devLastBackup')) $('devLastBackup').textContent = appState.settings.lastBackupDate || 'Never';
  if ($('devBackupStatus')) $('devBackupStatus').textContent = 'Ready';

  addAuditLog('Refresh', 'Developer stats refreshed', 'info');
  saveAppState();
}

function renderDevEmployeeList() {
  const container = $('devEmployeeList');
  if (!container) return;
  container.innerHTML = '';

  ALLOWED_EMPLOYEES.forEach(emp => {
    const item = document.createElement('div');
    item.className = 'dev-employee-item';
    item.innerHTML = `
      <strong>${emp}</strong>
      <span>${ROLE_LABELS[getDefaultRoleForEmployee(emp)]}</span>
    `;
    container.appendChild(item);
  });
}

function devAddEmployee() {
  if (!assertSuperAdminAction()) return;
  const name = $('devNewEmployeeName').value.trim();
  const role = $('devNewEmployeeRole').value.trim();

  if (!name || !role) {
    alert('Weka jina na role');
    return;
  }

  // In a real app, this would add to database
  alert(`Employee "${name}" (${role}) added successfully!`);
  $('devNewEmployeeName').value = '';
  $('devNewEmployeeRole').value = '';
  addAuditLog('Add Employee', `Added ${name} as ${role}`, 'success');
}

function devRenewLicense() {
  if (!assertSuperAdminAction()) return;
  if (licenseData.creator_id && licenseData.creator_id !== appState.currentEmployee) {
    alert('Only the license creator can renew it!');
    return;
  }
  renewLicenseOneMonth();
}

function devUpgradePlan() {
  if (!assertSuperAdminAction()) return;
  const currentPlan = normalizePlanKey(licenseData.plan || LICENSE_PLANS.FREE);
  const plans = [LICENSE_PLANS.FREE, LICENSE_PLANS.PRO, LICENSE_PLANS.PRO_PLUS];
  const currentIndex = plans.indexOf(currentPlan);

  if (currentIndex >= plans.length - 1) {
    alert('Already on highest plan!');
    return;
  }

  const newPlan = plans[currentIndex + 1];
  licenseData.plan = newPlan;
  saveLicenseData();

  alert(`License upgraded to ${getPlanDetails(newPlan).displayName}!`);
  refreshDevStats();
  addAuditLog('Upgrade Plan', `Upgraded to ${newPlan}`, 'success');
}

function devBackupNow() {
  if (!assertSuperAdminAction()) return;
  appState.settings.lastBackupDate = new Date().toLocaleString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));

  alert('Backup completed successfully!');
  refreshDevStats();
  addAuditLog('Backup', 'System backup completed', 'success');
}

function devExportDB() {
  if (!assertSuperAdminAction()) return;
  const data = {
    appState,
    licenseData,
    exportTime: new Date().toISOString(),
    version: '1.0'
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mfumo_backup_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  addAuditLog('Export', 'Database exported', 'success');
}

function devClearDB() {
  if (!assertSuperAdminAction()) return;
  if (!confirm('WARNING: This will delete ALL data! Are you sure?')) return;
  if (!confirm('FINAL WARNING: This cannot be undone!')) return;

  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function devTestApi() {
  if (!assertSuperAdminAction()) return;
  const url = $('devApiUrl').value.trim();
  const method = $('devApiMethod').value;
  let body = null;

  try {
    const bodyText = $('devApiBody').value.trim();
    if (bodyText) body = JSON.parse(bodyText);
  } catch (e) {
    alert('Invalid JSON in request body: ' + e.message);
    return;
  }

  if (!url) {
    alert('Enter API URL');
    return;
  }

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
    .then(res => res.json())
    .then(data => {
      $('devApiResponseText').textContent = JSON.stringify(data, null, 2);
      $('devApiResponse').classList.remove('hidden');
      addAuditLog('API Test', `${method} ${url}`, 'success');
    })
    .catch(err => {
      $('devApiResponseText').textContent = 'Error: ' + err.message;
      $('devApiResponse').classList.remove('hidden');
      addAuditLog('API Test Error', `${method} ${url}: ${err.message}`, 'error');
    });
}

function devClearLogs() {
  if (!assertSuperAdminAction()) return;
  if (confirm('Clear all audit logs?')) {
    auditLogs = [];
    if (appState.developer) appState.developer.auditLogs = [];
    saveAppState();
    renderDevAuditLogs();
    renderDeveloperAuditTrail();
    addAuditLog('System', 'Audit logs cleared', 'warning');
  }
}

function renderDevAuditLogs() {
  const container = $('devAuditLogs');
  if (!container) return;
  container.innerHTML = '';
  auditLogs = appState.developer?.auditLogs || auditLogs;

  if (auditLogs.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No logs yet</p>';
    return;
  }

  auditLogs.forEach(log => {
    const item = document.createElement('div');
    item.className = `audit-log-item ${log.type}`;
    item.innerHTML = `
      <span class="audit-log-time">${log.timestamp ? formatDateTime(log.timestamp) : ''}</span>
      <span class="audit-log-action">${log.action}</span>
      <span class="audit-log-detail">${log.affectedUser || '-'} | ${log.actor || 'System'} | ${log.details || ''}</span>
    `;
    container.appendChild(item);
  });
}

// Make functions global
window.refreshDevStats = refreshDevStats;
window.devAddEmployee = devAddEmployee;
window.devRenewLicense = devRenewLicense;
window.devUpgradePlan = devUpgradePlan;
window.devBackupNow = devBackupNow;
window.devExportDB = devExportDB;
window.devClearDB = devClearDB;
window.devTestApi = devTestApi;
window.devClearLogs = devClearLogs;
window.renderDevAuditLogs = renderDevAuditLogs;
window.renderDeveloperDashboard = renderDeveloperDashboard;
window.loadBackendAuditLogs = loadBackendAuditLogs;
window.devActivateUser = devActivateUser;
window.devSuspendUser = devSuspendUser;
window.devDeleteUser = devDeleteUser;
window.devExtendUser = devExtendUser;
window.devExpireUser = devExpireUser;
window.devExtendSelectedSubscription = devExtendSelectedSubscription;
window.devActivateSelectedUser = devActivateSelectedUser;
window.devExpireSelectedUser = devExpireSelectedUser;
window.devConfirmPayment = devConfirmPayment;
window.sendSubscriptionReminder = sendSubscriptionReminder;
window.openAdminEmployeeTimeline = openAdminEmployeeTimeline;
window.closeAdminEmployeeTimeline = closeAdminEmployeeTimeline;
window.setAdminEmployeeTimelinePeriod = setAdminEmployeeTimelinePeriod;
window.setAdminEmployeeTimelineCustomDates = setAdminEmployeeTimelineCustomDates;
window.exportAdminEmployeeTimelineCsv = exportAdminEmployeeTimelineCsv;
window.printAdminEmployeeTimeline = printAdminEmployeeTimeline;

// Start the app
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  // Initialize developer stats when switching to dev view
  const devBtn = document.querySelector('[data-view="developer"]');
  if (devBtn) {
    devBtn.addEventListener('click', () => {
      setTimeout(() => {
        refreshDevStats();
        renderDevAuditLogs();
      }, 200);
    });
  }
});
