export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  minStockAlert: number;
  taxCategory: 'standard' | 'grocery_exempt' | 'reduced' | 'zero';
  unit: string;
  description?: string;
  icon?: string;
  introducedAt?: string;
  lastRestockedAt?: string;
  timesRestocked?: number;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  notes?: string;
}

export interface DiscountCode {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minSpend: number;
  description: string;
  isActive: boolean;
}

export interface Customer {
  name: string;
  email?: string;
  phone?: string;
  loyaltyId?: string;
  notes?: string;
}

export type UserRole = 'admin' | 'manager' | 'staff';

export interface StaffUser {
  id: string; // e.g. 'STF-101'
  username: string; // login identifier
  name: string;
  role: UserRole;
  password: string; // login password
  email?: string;
  phone?: string;
  terminalId?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface StaffShiftSession {
  shiftId: string;
  staffId: string;
  staffName: string;
  staffRole: UserRole;
  terminalId: string;
  startTime: string;
  startingCash: number;
  isActive: boolean;
}

export interface ShiftCloseReport {
  id: string;
  shiftId: string;
  staffId: string;
  staffName: string;
  staffRole: UserRole;
  terminalId: string;
  startTime: string;
  endTime: string;
  startingCash: number;
  cashSales: number;
  cardSales: number;
  mobileSales: number;
  splitSales: number;
  totalSales: number;
  totalTransactions: number;
  totalItemsSold: number;
  totalDiscounts: number;
  totalTax: number;
  expectedCash: number; // startingCash + cashSales
  actualCashCounted: number;
  cashVariance: number; // actualCashCounted - expectedCash (0 is balanced, negative is shortage, positive is overage)
  notes?: string;
  sentToEmail: string;
  sentAt: string;
  receiptIds: string[];
}

export interface DeliveryOption {
  id: string;
  name: string;
  fee: number;
  estimatedTime: string;
  description?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface OnlineOrder {
  id: string; // e.g. 'ORD-2026-001'
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  deliveryZone: string;
  deliveryInstructions?: string;
  items: CartItem[];
  itemsCost: number; // Cost for the products ordered
  deliveryCost: number; // Delivery cost
  discountAmount: number;
  appliedDiscountCode?: string;
  taxAmount: number;
  totalAmount: number; // itemsCost + deliveryCost - discountAmount + taxAmount
  paymentMethod: 'card' | 'transfer' | 'pay_on_delivery' | 'cash';
  paymentStatus: 'paid' | 'pending' | 'cash_on_delivery';
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  assignedRider?: {
    name: string;
    phone: string;
  };
  notes?: string;
  convertedToReceiptId?: string;
}

export interface LowStockAlertTrigger {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  currentStock: number;
  minStockAlert: number;
  severity: 'critical' | 'warning'; // critical: 0 or <= 2, warning: <= minStockAlert
  triggeredAt: string;
  dismissed?: boolean;
}

export interface LiveSalesEvent {
  id: string;
  type: 'LIVE_SALE' | 'STAFF_SHIFT_START' | 'SHIFT_CLOSED' | 'PRICE_ALERT' | 'VOID_ALERT' | 'LOW_STOCK_TRIGGER' | 'ONLINE_ORDER_NEW' | 'ONLINE_ORDER_STATUS';
  timestamp: string;
  receipt?: Receipt;
  onlineOrder?: OnlineOrder;
  lowStockAlert?: LowStockAlertTrigger;
  staff?: {
    id: string;
    name: string;
    role: UserRole;
    terminalId?: string;
  };
  shiftReport?: ShiftCloseReport;
  notes?: string;
}

export interface Receipt {
  id: string;
  sequenceNumber: number;
  timestamp: string;
  cashier: string;
  staffId?: string;
  terminalId: string;
  customer: Customer;
  items: CartItem[];
  subtotal: number;
  itemsCost?: number; // Cost for products ordered
  deliveryCost?: number; // Delivery charge if delivery order
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryZone?: string;
  isDeliveryOrder?: boolean;
  onlineOrderId?: string;
  discountAmount: number;
  appliedDiscountCode?: string;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile_nfc' | 'gift_card' | 'split';
  amountTendered: number;
  changeDue: number;
  encryptedDataSignature?: string;
  syncedToCloud: boolean;
  syncedToGoogleSheets: boolean;
  offlineCreated: boolean;
}

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  taxRateStandard: number; // e.g. 0.0825 (8.25%)
  taxRateReduced: number;  // e.g. 0.025 (2.5%)
  enableGroceryTaxExemption: boolean;
  currencySymbol: string;
  receiptHeader: string;
  receiptFooter: string;
  managerEmail: string;
  autoEmailReports: boolean;
  emailReportFrequency: 'daily' | 'weekly' | 'monthly';
  autoGoogleSheetsSync: boolean;
  googleSpreadsheetId?: string;
  googleSpreadsheetUrl?: string;
  encryptionEnabled: boolean;
  encryptionPassphrase?: string;
  terminalId: string;
  cashierName: string;
  soundFeedback: boolean;
  defaultLowStockThreshold: number; // e.g. 5 units
  enableLowStockAlertSound: boolean;
  defaultDeliveryFee: number; // e.g. 1500
  enableOnlineOrders: boolean;
}

export interface SalesAnalytics {
  totalRevenue: number;
  totalTransactions: number;
  totalItemsSold: number;
  averageOrderValue: number;
  totalTaxCollected: number;
  totalDiscountsGiven: number;
  netProfit: number;
  topSellingProducts: { name: string; barcode: string; quantity: number; revenue: number }[];
  categorySales: { category: string; revenue: number; percentage: number }[];
  timeSeriesData: { label: string; revenue: number; count: number }[];
}

export interface EmailReportLog {
  id: string;
  sentAt: string;
  reportType: 'daily_eod' | 'weekly' | 'monthly' | 'yearly' | 'receipt';
  recipient: string;
  subject: string;
  status: 'Delivered' | 'Queued' | 'Failed';
  summary?: any;
}

export interface RestockLog {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  previousStock: number; // old stock before restock
  addedStock: number;    // quantity added to old stock
  newStock: number;      // previousStock + addedStock
  restockedAt: string;
  restockedBy: string;
  batchNumber?: string;
  supplier?: string;
  costPerUnit?: number;
  notes?: string;
}

