import {
  Product,
  Receipt,
  StoreSettings,
  DiscountCode,
  SalesAnalytics,
  RestockLog,
  OnlineOrder,
  DeliveryOption,
  LowStockAlertTrigger,
} from '../types';
import { INITIAL_PRODUCTS, INITIAL_DISCOUNT_CODES } from '../data/initialProducts';
import { generateReceiptSignature } from './crypto';

const STORAGE_KEYS = {
  PRODUCTS: 'superstore_pos_products_v1',
  RECEIPTS: 'superstore_pos_receipts_v1',
  SETTINGS: 'superstore_pos_settings_v1',
  DISCOUNTS: 'superstore_pos_discounts_v1',
  OFFLINE_QUEUE: 'superstore_pos_offline_queue_v1',
  DARK_MODE: 'superstore_pos_theme_dark',
  RESTOCK_LOGS: 'bummptstores_restock_logs_v1',
  ONLINE_ORDERS: 'bummptstores_online_orders_v1',
};

// BroadcastChannel for instant local cross-tab / cross-window sync
const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('superstore_sync') : null;

// Pleasant scanner audio feedback via Web Audio API
export function playBeepSound(type: 'scan' | 'checkout' | 'error' | 'low_stock' = 'scan') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'scan') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'checkout') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'low_stock') {
      // Dual-tone urgent alert chime
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(440.0, ctx.currentTime + 0.12); // A4
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Silent fail if audio blocked by browser policy
  }
}

export const DEFAULT_DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: 'del-std',
    name: 'Standard City Dispatch',
    fee: 1500,
    estimatedTime: '24-48 Hours',
    description: 'Affordable door delivery across the metropolitan area',
  },
  {
    id: 'del-express',
    name: 'Express Doorstep Courier',
    fee: 2500,
    estimatedTime: '2-4 Hours',
    description: 'High-priority direct dispatch for urgent pantry or pharmacy orders',
  },
  {
    id: 'del-island',
    name: 'Island / Lekki / Victoria Island Priority',
    fee: 3000,
    estimatedTime: 'Same Day',
    description: 'Dedicated courier across bridges and island business districts',
  },
  {
    id: 'del-mainland',
    name: 'Mainland / Ikeja / Surulere Route',
    fee: 2000,
    estimatedTime: 'Same Day',
    description: 'Regular mainland route express dispatch',
  },
  {
    id: 'del-pickup',
    name: 'Storefront Pickup (Curbside Collection)',
    fee: 0,
    estimatedTime: 'Ready in 15 Minutes',
    description: 'Pack and hold at BummptStores customer collection desk with ₦0 fee',
  },
];

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'BummptStores',
  storeAddress: '742 Evergreen Terrace, Suite 100',
  storePhone: '(555) 382-9000',
  storeEmail: 'pos-alerts@bummptstores.com',
  taxRateStandard: 0.075, // 7.5% Nigerian VAT
  taxRateReduced: 0.025,  // 2.5%
  enableGroceryTaxExemption: true,
  currencySymbol: '₦',
  receiptHeader: 'Welcome to BummptStores!',
  receiptFooter: 'Thank you for shopping at BummptStores! Return policy: 30 days with receipt.',
  managerEmail: 'bummpt90@gmail.com',
  autoEmailReports: true,
  emailReportFrequency: 'daily',
  autoGoogleSheetsSync: true,
  encryptionEnabled: true,
  terminalId: 'TERM-01',
  cashierName: 'Alex Rivera (Staff #104)',
  soundFeedback: true,
  defaultLowStockThreshold: 5,
  enableLowStockAlertSound: true,
  defaultDeliveryFee: 1500,
  enableOnlineOrders: true,
};

// Seed historical receipts for rich analytics across Daily, Weekly, Monthly, and Yearly views
function generateHistoricalReceipts(products: Product[]): Receipt[] {
  const receipts: Receipt[] = [];
  const now = new Date();

  // Helper to generate a realistic receipt in the past
  const addReceipt = (daysAgo: number, hourOffset: number, itemsCount: number, method: 'cash' | 'card' | 'mobile_nfc') => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(9 + (hourOffset % 11), Math.floor(Math.random() * 59));

    const selectedItems: any[] = [];
    let subtotal = 0;
    for (let i = 0; i < itemsCount; i++) {
      const p = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const lineTotal = Number((p.price * qty).toFixed(2));
      selectedItems.push({
        id: 'li-' + Math.random().toString(36).substr(2, 6),
        product: p,
        quantity: qty,
        unitPrice: p.price,
        discountPercent: 0,
        lineTotal,
      });
      subtotal += lineTotal;
    }

    const discountAmount = subtotal > 20000 ? Number((subtotal * 0.1).toFixed(2)) : 0;
    const taxableSubtotal = subtotal - discountAmount;
    const taxAmount = Number((taxableSubtotal * 0.075).toFixed(2));
    const total = Number((taxableSubtotal + taxAmount).toFixed(2));

    receipts.push({
      id: `REC-${d.getFullYear()}-${String(receipts.length + 1).padStart(4, '0')}`,
      sequenceNumber: receipts.length + 1,
      timestamp: d.toISOString(),
      cashier: 'Alex Rivera (Staff #104)',
      terminalId: 'TERM-01',
      customer: {
        name: ['Emma Watson', 'David Miller', 'Sophia Chen', 'Liam O’Connor', 'James Wilson', 'Chioma Adebayo', 'Emeka Okonkwo'][Math.floor(Math.random() * 7)],
      },
      items: selectedItems,
      subtotal,
      discountAmount,
      appliedDiscountCode: discountAmount > 0 ? 'SAVE10' : undefined,
      taxRate: 0.075,
      taxAmount,
      total,
      paymentMethod: method,
      amountTendered: method === 'cash' ? Math.ceil(total / 1000) * 1000 : total,
      changeDue: method === 'cash' ? (Math.ceil(total / 1000) * 1000) - total : 0,
      encryptedDataSignature: 'SIG-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      syncedToCloud: true,
      syncedToGoogleSheets: false,
      offlineCreated: false,
    });
  };

  // Generate today's receipts (8 receipts)
  for (let i = 0; i < 8; i++) {
    addReceipt(0, i, Math.floor(Math.random() * 3) + 1, i % 2 === 0 ? 'card' : 'cash');
  }

  // Generate this week's receipts (15 receipts)
  for (let d = 1; d <= 6; d++) {
    for (let i = 0; i < 3; i++) {
      addReceipt(d, i * 2, Math.floor(Math.random() * 4) + 1, 'card');
    }
  }

  // Generate past 4 weeks (monthly trends)
  for (let d = 7; d <= 28; d += 2) {
    addReceipt(d, 3, Math.floor(Math.random() * 3) + 2, 'mobile_nfc');
  }

  // Generate past months across the year (yearly trends)
  for (let m = 30; m <= 330; m += 20) {
    addReceipt(m, 5, Math.floor(Math.random() * 4) + 1, 'card');
  }

  return receipts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Load products
export function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (raw) {
      let prods: Product[] = JSON.parse(raw);
      // Ensure pharmaceutical products and new initial products are present
      const existingBarcodes = new Set(prods.map((p) => p.barcode));
      const missingProducts = INITIAL_PRODUCTS.filter((p) => !existingBarcodes.has(p.barcode));

      // If old cached products have dollar prices (< 100), migrate them to Naira
      const hasDollarPricing = prods.some((p) => p.price < 100);
      if (hasDollarPricing) {
        const initialMap = new Map(INITIAL_PRODUCTS.map((p) => [p.barcode, p]));
        prods = prods.map((p) => {
          const match = initialMap.get(p.barcode);
          if (match) {
            return {
              ...p,
              price: match.price,
              costPrice: match.costPrice,
              category: match.category,
              taxCategory: match.taxCategory || p.taxCategory,
            };
          }
          return {
            ...p,
            price: p.price < 100 ? Math.round(p.price * 1000) : p.price,
            costPrice: p.costPrice < 100 ? Math.round(p.costPrice * 1000) : p.costPrice,
          };
        });
      }

      if (missingProducts.length > 0) {
        prods = [...missingProducts, ...prods];
      }
      saveProducts(prods);
      return prods;
    }
  } catch (e) {
    console.error('Failed to parse products from storage', e);
  }
  saveProducts(INITIAL_PRODUCTS);
  return INITIAL_PRODUCTS;
}

export function saveProducts(products: Product[]) {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  if (syncChannel) {
    syncChannel.postMessage({ type: 'INVENTORY_UPDATED', products });
  }
}

// Load receipts
export function loadReceipts(): Receipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    if (raw) {
      const parsed: Receipt[] = JSON.parse(raw);
      // If cached receipts are still in old dollar values (< 200), re-seed with Naira
      const isDollarPriced = parsed.length > 0 && parsed.every((r) => r.total < 300);
      if (!isDollarPriced) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse receipts from storage', e);
  }
  const seeded = generateHistoricalReceipts(INITIAL_PRODUCTS);
  saveReceipts(seeded);
  return seeded;
}

export function saveReceipts(receipts: Receipt[]) {
  localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
  if (syncChannel) {
    syncChannel.postMessage({ type: 'RECEIPTS_UPDATED', receipts });
  }
}

// Load settings
export function loadSettings(): StoreSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate store title to BummptStores if previously set to default or empty
      if (!parsed.storeName || parsed.storeName === 'Metro Superstore & Mart') {
        parsed.storeName = 'BummptStores';
        parsed.receiptHeader = 'Welcome to BummptStores!';
        parsed.receiptFooter = 'Thank you for shopping at BummptStores! Return policy: 30 days with receipt.';
      }
      // Migrate currency to Naira if it was still '$' or unset
      if (!parsed.currencySymbol || parsed.currencySymbol === '$') {
        parsed.currencySymbol = '₦';
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to parse settings', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: StoreSettings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// Restock logs management (tracks when depleted products are replenished and added to old stock)
export function loadRestockLogs(): RestockLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RESTOCK_LOGS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load restock logs', e);
  }
  // Seed sample restock logs including Pharmaceuticals so managers can see restocking history
  const sampleLogs: RestockLog[] = [
    {
      id: 'rst-seed-pharma',
      productId: 'prod-pharma-001',
      productName: 'Paracetamol 500mg (Emzor) 20 Caplets',
      barcode: '615110001024',
      previousStock: 15,
      addedStock: 50,
      newStock: 65,
      restockedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      restockedBy: 'Pharm. Bummpt Lead',
      batchNumber: 'BATCH-EMZ-2026B',
      supplier: 'Emzor Pharmaceuticals Ltd',
      costPerUnit: 750,
      notes: 'Pharmacy department restocking to shelf dispensary',
    },
    {
      id: 'rst-seed-1',
      productId: 'prod-001',
      productName: 'Organic Whole Milk 1 Gal',
      barcode: '011110038245',
      previousStock: 5,
      addedStock: 40,
      newStock: 45,
      restockedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      restockedBy: 'Alex Rivera (Staff #104)',
      batchNumber: 'LOT-9921',
      supplier: 'Valley Dairy Farms',
      costPerUnit: 4200,
      notes: 'Weekly routine replenishment into refrigerator bank',
    },
    {
      id: 'rst-seed-2',
      productId: 'prod-004',
      productName: 'Sparkling Mineral Water 12pk',
      barcode: '049000000443',
      previousStock: 10,
      addedStock: 50,
      newStock: 60,
      restockedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      restockedBy: 'Inventory Lead #201',
      batchNumber: 'LOT-8402',
      supplier: 'Apex Beverage Distributors',
      costPerUnit: 4500,
      notes: 'Summer beverage replenishment',
    },
  ];
  saveRestockLogs(sampleLogs);
  return sampleLogs;
}

export function saveRestockLogs(logs: RestockLog[]) {
  localStorage.setItem(STORAGE_KEYS.RESTOCK_LOGS, JSON.stringify(logs));
}

export function addRestockLog(log: RestockLog) {
  const current = loadRestockLogs();
  const updated = [log, ...current];
  saveRestockLogs(updated);
  if (syncChannel) {
    syncChannel.postMessage({ type: 'RESTOCK_COMPLETED', log });
  }
}

// Load discount codes
export function loadDiscountCodes(): DiscountCode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DISCOUNTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse discounts', e);
  }
  return INITIAL_DISCOUNT_CODES;
}

export function saveDiscountCodes(codes: DiscountCode[]) {
  localStorage.setItem(STORAGE_KEYS.DISCOUNTS, JSON.stringify(codes));
}

// Offline queue management
export function getOfflineQueue(): Receipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToOfflineQueue(receipt: Receipt) {
  const queue = getOfflineQueue();
  queue.push(receipt);
  localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
}

export function clearOfflineQueue() {
  localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
}

// Sync transaction to backend server and dedupe across devices
export async function syncTransactionAcrossDevices(receipt: Receipt, inventoryUpdates: { id: string; quantity: number }[]): Promise<boolean> {
  try {
    const res = await fetch('/api/sync/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt, inventoryUpdates }),
    });
    if (res.ok) {
      return true;
    }
    // Fallback if offline
    addToOfflineQueue(receipt);
    return false;
  } catch (err) {
    // Network offline
    addToOfflineQueue(receipt);
    return false;
  }
}

// Poll server sync state to integrate cross-device updates
export async function fetchServerSyncState(): Promise<{
  transactions: Receipt[];
  inventory: Product[];
  onlineOrders?: OnlineOrder[];
} | null> {
  try {
    const res = await fetch('/api/sync/state');
    if (res.ok) {
      const data = await res.json();
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

// Compute Analytics for a given timeframe
export function computeSalesAnalytics(
  receipts: Receipt[],
  timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily'
): SalesAnalytics {
  const now = new Date();
  const filtered = receipts.filter((r) => {
    const d = new Date(r.timestamp);
    const diffMs = now.getTime() - d.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (timeframe === 'daily') return diffDays <= 1;
    if (timeframe === 'weekly') return diffDays <= 7;
    if (timeframe === 'monthly') return diffDays <= 30;
    if (timeframe === 'yearly') return diffDays <= 365;
    return true;
  });

  const totalRevenue = filtered.reduce((acc, r) => acc + r.total, 0);
  const totalTaxCollected = filtered.reduce((acc, r) => acc + r.taxAmount, 0);
  const totalDiscountsGiven = filtered.reduce((acc, r) => acc + r.discountAmount, 0);
  const totalTransactions = filtered.length;
  const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Items and Category tallies
  const productMap = new Map<string, { name: string; barcode: string; quantity: number; revenue: number; cost: number }>();
  const categoryMap = new Map<string, number>();
  let totalItemsSold = 0;
  let totalCost = 0;

  filtered.forEach((r) => {
    r.items.forEach((item) => {
      totalItemsSold += item.quantity;
      const cat = item.product.category || 'General';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + item.lineTotal);

      const existing = productMap.get(item.product.barcode) || {
        name: item.product.name,
        barcode: item.product.barcode,
        quantity: 0,
        revenue: 0,
        cost: item.product.costPrice * item.quantity,
      };
      existing.quantity += item.quantity;
      existing.revenue += item.lineTotal;
      totalCost += (item.product.costPrice || (item.unitPrice * 0.6)) * item.quantity;
      productMap.set(item.product.barcode, existing);
    });
  });

  const topSellingProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const categorySales = Array.from(categoryMap.entries()).map(([category, revenue]) => ({
    category,
    revenue,
    percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
  }));

  // Group by time series
  const timeSeriesData: { label: string; revenue: number; count: number }[] = [];
  if (timeframe === 'daily') {
    // 2-hour buckets for today (8am to 10pm)
    for (let h = 8; h <= 22; h += 2) {
      const label = `${h}:00`;
      const matching = filtered.filter((r) => {
        const hour = new Date(r.timestamp).getHours();
        return hour >= h && hour < h + 2;
      });
      const rev = matching.reduce((sum, r) => sum + r.total, 0);
      timeSeriesData.push({ label, revenue: rev, count: matching.length });
    }
  } else if (timeframe === 'weekly') {
    // 7 days
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - i);
      const dayLabel = days[targetDate.getDay()];
      const matching = filtered.filter((r) => {
        const d = new Date(r.timestamp);
        return d.toDateString() === targetDate.toDateString();
      });
      const rev = matching.reduce((sum, r) => sum + r.total, 0);
      timeSeriesData.push({ label: dayLabel, revenue: rev, count: matching.length });
    }
  } else if (timeframe === 'monthly') {
    // 4 weeks
    for (let w = 4; w >= 1; w--) {
      const label = `Week ${5 - w}`;
      const matching = filtered.filter((r) => {
        const diffDays = (now.getTime() - new Date(r.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= (w - 1) * 7 && diffDays < w * 7;
      });
      const rev = matching.reduce((sum, r) => sum + r.total, 0);
      timeSeriesData.push({ label, revenue: rev, count: matching.length });
    }
  } else {
    // 12 months for yearly
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let m = 0; m < 12; m++) {
      const label = months[m];
      const matching = filtered.filter((r) => new Date(r.timestamp).getMonth() === m);
      const rev = matching.reduce((sum, r) => sum + r.total, 0);
      timeSeriesData.push({ label, revenue: rev, count: matching.length });
    }
  }

  return {
    totalRevenue,
    totalTransactions,
    totalItemsSold,
    averageOrderValue,
    totalTaxCollected,
    totalDiscountsGiven,
    netProfit: Math.max(0, totalRevenue - totalCost - totalTaxCollected),
    topSellingProducts,
    categorySales,
    timeSeriesData,
  };
}

// Initial sample online orders with both product cost and delivery cost
export const INITIAL_ONLINE_ORDERS: OnlineOrder[] = [
  {
    id: 'ORD-2026-001',
    customerName: 'Kemi Adeleke',
    customerPhone: '+234 803 776 5432',
    customerEmail: 'kemi.adeleke@gmail.com',
    deliveryAddress: 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos',
    deliveryZone: 'Island / Lekki / Victoria Island Priority',
    deliveryInstructions: 'Ring doorbell twice. Gate code is #409.',
    items: [
      {
        id: 'li-ord-1',
        product: INITIAL_PRODUCTS[0], // Organic Whole Milk
        quantity: 2,
        unitPrice: INITIAL_PRODUCTS[0].price,
        discountPercent: 0,
        lineTotal: INITIAL_PRODUCTS[0].price * 2,
      },
      {
        id: 'li-ord-2',
        product: INITIAL_PRODUCTS[3], // Whole Bean Dark Roast Coffee
        quantity: 1,
        unitPrice: INITIAL_PRODUCTS[3].price,
        discountPercent: 0,
        lineTotal: INITIAL_PRODUCTS[3].price,
      },
    ],
    itemsCost: INITIAL_PRODUCTS[0].price * 2 + INITIAL_PRODUCTS[3].price,
    deliveryCost: 3000,
    discountAmount: 0,
    taxAmount: Math.round((INITIAL_PRODUCTS[0].price * 2 + INITIAL_PRODUCTS[3].price) * 0.075),
    totalAmount:
      INITIAL_PRODUCTS[0].price * 2 +
      INITIAL_PRODUCTS[3].price +
      3000 +
      Math.round((INITIAL_PRODUCTS[0].price * 2 + INITIAL_PRODUCTS[3].price) * 0.075),
    paymentMethod: 'card',
    paymentStatus: 'paid',
    status: 'preparing',
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 mins ago
    assignedRider: {
      name: 'Musa Ibrahim (Dispatch Bike #4)',
      phone: '+234 812 345 6789',
    },
    notes: 'Fragile dairy items - keep chilled.',
  },
  {
    id: 'ORD-2026-002',
    customerName: 'Dr. Emeka Nnamdi',
    customerPhone: '+234 802 119 8765',
    customerEmail: 'emeka.nnamdi@healthclinic.ng',
    deliveryAddress: '22 Isaac John Street, GRA Ikeja, Lagos',
    deliveryZone: 'Mainland / Ikeja / Surulere Route',
    deliveryInstructions: 'Reception desk delivery. Call on arrival.',
    items: [
      {
        id: 'li-ord-3',
        product: INITIAL_PRODUCTS[18] || INITIAL_PRODUCTS[1], // Paracetamol / Pharma
        quantity: 4,
        unitPrice: (INITIAL_PRODUCTS[18] || INITIAL_PRODUCTS[1]).price,
        discountPercent: 0,
        lineTotal: (INITIAL_PRODUCTS[18] || INITIAL_PRODUCTS[1]).price * 4,
      },
    ],
    itemsCost: (INITIAL_PRODUCTS[18] || INITIAL_PRODUCTS[1]).price * 4,
    deliveryCost: 2000,
    discountAmount: 500,
    appliedDiscountCode: 'FIRSTBUY',
    taxAmount: 0,
    totalAmount: (INITIAL_PRODUCTS[18] || INITIAL_PRODUCTS[1]).price * 4 + 2000 - 500,
    paymentMethod: 'pay_on_delivery',
    paymentStatus: 'cash_on_delivery',
    status: 'out_for_delivery',
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    assignedRider: {
      name: 'Sunday Okafor (QuickVan Express)',
      phone: '+234 809 998 8776',
    },
    notes: 'Payment to be collected via POS machine on delivery.',
  },
];

// Load Online Orders
export function loadOnlineOrders(): OnlineOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ONLINE_ORDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load online orders:', err);
  }
  saveOnlineOrders(INITIAL_ONLINE_ORDERS);
  return INITIAL_ONLINE_ORDERS;
}

// Save Online Orders
export function saveOnlineOrders(orders: OnlineOrder[]) {
  localStorage.setItem(STORAGE_KEYS.ONLINE_ORDERS, JSON.stringify(orders));
  if (syncChannel) {
    syncChannel.postMessage({ type: 'ONLINE_ORDERS_UPDATED', orders });
  }
}

// Create New Online Order
export function createOnlineOrder(orderData: Omit<OnlineOrder, 'id' | 'createdAt'>): OnlineOrder {
  const newOrder: OnlineOrder = {
    ...orderData,
    id: `ORD-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`,
    createdAt: new Date().toISOString(),
  };

  const current = loadOnlineOrders();
  const updated = [newOrder, ...current];
  saveOnlineOrders(updated);
  return newOrder;
}

// Update status of Online Order
export function updateOnlineOrderStatus(orderId: string, status: OnlineOrder['status'], notes?: string): OnlineOrder[] {
  const current = loadOnlineOrders();
  const updated = current.map((ord) => {
    if (ord.id === orderId) {
      return {
        ...ord,
        status,
        updatedAt: new Date().toISOString(),
        notes: notes !== undefined ? notes : ord.notes,
        paymentStatus: status === 'delivered' && ord.paymentStatus === 'cash_on_delivery' ? ('paid' as const) : ord.paymentStatus,
      };
    }
    return ord;
  });
  saveOnlineOrders(updated);
  return updated;
}

// Detect and trigger low stock alerts
export function detectLowStockTriggers(products: Product[], customThreshold?: number): LowStockAlertTrigger[] {
  const alerts: LowStockAlertTrigger[] = [];

  products.forEach((p) => {
    const threshold = customThreshold !== undefined ? customThreshold : p.minStockAlert;
    if (p.stock <= threshold) {
      alerts.push({
        id: `alert-${p.id}`,
        productId: p.id,
        productName: p.name,
        barcode: p.barcode,
        currentStock: p.stock,
        minStockAlert: p.minStockAlert,
        severity: p.stock <= 0 ? 'critical' : p.stock <= Math.min(2, threshold) ? 'critical' : 'warning',
        triggeredAt: new Date().toISOString(),
      });
    }
  });

  return alerts.sort((a, b) => {
    // Sort critical first, then lowest stock
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return a.currentStock - b.currentStock;
  });
}
