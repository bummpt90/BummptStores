import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CalculatorRegister } from './components/CalculatorRegister';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { CheckoutModal } from './components/CheckoutModal';
import { InventoryManager } from './components/InventoryManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ReceiptsArchive } from './components/ReceiptsArchive';
import { AdminSettings } from './components/AdminSettings';
import { LiveSalesTracker } from './components/LiveSalesTracker';
import { StaffLoginModal } from './components/StaffLoginModal';
import { CloseSalesModal } from './components/CloseSalesModal';
import { OnlineOrderingHub } from './components/OnlineOrderingHub';
import { LowStockAlertTriggerModal } from './components/LowStockAlertTriggerModal';
import { RestockModal } from './components/RestockModal';
import {
  Product,
  Receipt,
  StoreSettings,
  DiscountCode,
  CartItem,
  Customer,
  StaffUser,
  StaffShiftSession,
  ShiftCloseReport,
  OnlineOrder,
  OrderStatus,
} from './types';
import {
  loadProducts,
  saveProducts,
  loadReceipts,
  saveReceipts,
  loadSettings,
  saveSettings,
  loadDiscountCodes,
  saveDiscountCodes,
  getOfflineQueue,
  clearOfflineQueue,
  syncTransactionAcrossDevices,
  fetchServerSyncState,
  loadOnlineOrders,
  saveOnlineOrders,
  createOnlineOrder as createOnlineOrderStorage,
  updateOnlineOrderStatus as updateOnlineOrderStatusStorage,
  playBeepSound,
} from './services/storage';
import { encryptData, generateReceiptSignature } from './services/crypto';
import { initAuth, googleSignIn, logout } from './services/auth';
import { syncReceiptToGoogleSheets, syncInventoryToGoogleSheets } from './services/googleSheets';
import {
  getCurrentStaffSession,
  setCurrentStaffSession,
  loadStaffRoster,
  logoutStaff,
} from './services/staffAuth';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'register' | 'orders' | 'inventory' | 'analytics' | 'history' | 'settings' | 'live_radar'
  >('register');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem('superstore_pos_theme_dark') === 'true' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>(loadOnlineOrders);
  const [settings, setSettings] = useState<StoreSettings>(loadSettings);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState<number>(0);

  // Low Stock Trigger & Restock Modal states
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState<boolean>(false);
  const [restockProductTarget, setRestockProductTarget] = useState<Product | null>(null);

  // Staff Authentication & Shift Tracking State
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(() => {
    const session = getCurrentStaffSession();
    if (session) {
      const roster = loadStaffRoster();
      const found = roster.find((s) => s.id === session.staffId);
      if (found) return found;
      return {
        id: session.staffId,
        username: session.staffName.toLowerCase().replace(/\s+/g, ''),
        name: session.staffName,
        role: session.staffRole,
        password: '',
        terminalId: session.terminalId,
        isActive: true,
        createdAt: session.startTime,
      };
    }
    // Default active staff for smooth initial experience: Cashier Chinedu Okafor
    const roster = loadStaffRoster();
    return roster.find((s) => s.username === 'chinedu') || roster[1] || null;
  });

  const [activeShift, setActiveShift] = useState<StaffShiftSession | null>(() => {
    const session = getCurrentStaffSession();
    if (session) return session;
    // Auto-create initial shift session for default cashier
    const roster = loadStaffRoster();
    const defaultCashier = roster.find((s) => s.username === 'chinedu') || roster[1];
    if (defaultCashier) {
      const initShift: StaffShiftSession = {
        shiftId: 'SHF-' + Date.now(),
        staffId: defaultCashier.id,
        staffName: defaultCashier.name,
        staffRole: defaultCashier.role,
        terminalId: defaultCashier.terminalId || 'TERM-01',
        startTime: new Date().toISOString(),
        startingCash: 10000,
        isActive: true,
      };
      setCurrentStaffSession(initShift);
      return initShift;
    }
    return null;
  });

  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState<boolean>(false);
  const [isCloseSalesOpen, setIsCloseSalesOpen] = useState<boolean>(false);

  // Scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  // Checkout modal state
  const [activeCheckoutCart, setActiveCheckoutCart] = useState<{
    items: CartItem[];
    customer: Customer;
    subtotal: number;
    discountAmount: number;
    discountCode?: string;
    taxAmount: number;
    total: number;
  } | null>(null);

  // Google OAuth User state
  const [googleUser, setGoogleUser] = useState<any>(null);

  // Synchronize settings cashierName with current active staff
  useEffect(() => {
    if (currentStaff) {
      setSettings((prev) => ({
        ...prev,
        cashierName: currentStaff.name,
        terminalId: activeShift?.terminalId || prev.terminalId,
      }));
    }
  }, [currentStaff, activeShift]);

  // Initialize Theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('superstore_pos_theme_dark', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('superstore_pos_theme_dark', 'false');
    }
  }, [isDarkMode]);

  // Initial Data Load
  useEffect(() => {
    setProducts(loadProducts());
    setReceipts(loadReceipts());
    setDiscountCodes(loadDiscountCodes());
    setOfflineCount(getOfflineQueue().length);
  }, []);

  // Online / Offline Listeners & Queue Flusher
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const queue = getOfflineQueue();
      if (queue.length > 0) {
        console.log(`Reconnected! Flushing ${queue.length} offline transactions...`);
        for (const queuedReceipt of queue) {
          await syncTransactionAcrossDevices(queuedReceipt, []);
        }
        clearOfflineQueue();
        setOfflineCount(0);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Multi-Device Real-time Background Sync Poller
  useEffect(() => {
    const pollSync = async () => {
      if (!navigator.onLine) return;
      const state = await fetchServerSyncState();
      if (state) {
        if (state.inventory && state.inventory.length > 0) {
          setProducts(state.inventory);
        }
        if (state.transactions && state.transactions.length > 0) {
          // Merge server transactions with local
          setReceipts((prev) => {
            const map = new Map<string, Receipt>(prev.map((r) => [r.id, r]));
            state.transactions.forEach((st: Receipt) => map.set(st.id, st));
            return Array.from(map.values()).sort(
              (a: Receipt, b: Receipt) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        }
        if (state.onlineOrders && state.onlineOrders.length > 0) {
          setOnlineOrders((prev) => {
            const map = new Map<string, OnlineOrder>(prev.map((o) => [o.id, o]));
            state.onlineOrders.forEach((so: OnlineOrder) => map.set(so.id, so));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        }
      }
    };

    const interval = setInterval(pollSync, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  // Server-Sent Events (SSE) Listener for real-time sales radar, low-stock triggers, and online orders
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'LOW_STOCK_TRIGGER') {
            playBeepSound('low_stock');
          } else if (data.type === 'ONLINE_ORDER_NEW' && data.onlineOrder) {
            playBeepSound('checkout');
            setOnlineOrders((prev) => {
              if (prev.some((o) => o.id === data.onlineOrder.id)) return prev;
              return [data.onlineOrder, ...prev];
            });
          } else if (data.type === 'ONLINE_ORDER_STATUS' && data.onlineOrder) {
            setOnlineOrders((prev) =>
              prev.map((o) => (o.id === data.onlineOrder.id ? data.onlineOrder : o))
            );
          } else if (data.type === 'TRANSACTION_COMMITTED' && data.transaction) {
            setReceipts((prev) => {
              if (prev.some((r) => r.id === data.transaction.id)) return prev;
              return [data.transaction, ...prev];
            });
          }
        } catch (e) {
          // ignore parsing error
        }
      };
    } catch (e) {
      // ignore
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Initialize Google Workspace Authentication listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setGoogleUser(res.user);
      }
    } catch (e: any) {
      console.warn('Google Sign-in was cancelled or failed:', e);
    }
  };

  const handleGoogleSignOut = async () => {
    await logout();
    setGoogleUser(null);
  };

  // Complete checkout & generate encrypted digital receipt
  const handleCompleteCheckout = async (payload: {
    paymentMethod: 'cash' | 'card' | 'mobile_nfc' | 'gift_card' | 'split';
    amountTendered: number;
    changeDue: number;
    customerEmail?: string;
  }): Promise<Receipt> => {
    if (!activeCheckoutCart) throw new Error('No active cart');

    const nextSeq = receipts.length + 1;
    const receiptId = `REC-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;
    const timestamp = new Date().toISOString();

    // Generate tamper-evident SHA-256 signature
    const signatureSummary = `${receiptId}|${activeCheckoutCart.total}|${timestamp}|${payload.paymentMethod}`;
    const encryptedSignature = await generateReceiptSignature(signatureSummary);

    const newReceipt: Receipt = {
      id: receiptId,
      sequenceNumber: nextSeq,
      timestamp,
      cashier: currentStaff?.name || settings.cashierName,
      staffId: currentStaff?.id || activeShift?.staffId || 'STF-101',
      terminalId: activeShift?.terminalId || settings.terminalId,
      customer: {
        ...activeCheckoutCart.customer,
        email: payload.customerEmail || activeCheckoutCart.customer.email,
      },
      items: activeCheckoutCart.items,
      subtotal: activeCheckoutCart.subtotal,
      discountAmount: activeCheckoutCart.discountAmount,
      appliedDiscountCode: activeCheckoutCart.discountCode,
      taxRate: settings.taxRateStandard,
      taxAmount: activeCheckoutCart.taxAmount,
      total: activeCheckoutCart.total,
      paymentMethod: payload.paymentMethod,
      amountTendered: payload.amountTendered,
      changeDue: payload.changeDue,
      encryptedDataSignature: encryptedSignature,
      syncedToCloud: isOnline,
      syncedToGoogleSheets: false,
      offlineCreated: !isOnline,
    };

    // Update inventory stock levels locally & for cross-device sync
    const inventoryUpdates: { id: string; quantity: number }[] = [];
    const updatedProducts = products.map((prod) => {
      const purchased = activeCheckoutCart.items.find((i) => i.product.id === prod.id);
      if (purchased) {
        const newStock = Math.max(0, prod.stock - purchased.quantity);
        inventoryUpdates.push({ id: prod.id, quantity: purchased.quantity });
        return { ...prod, stock: newStock };
      }
      return prod;
    });

    setProducts(updatedProducts);
    saveProducts(updatedProducts);

    const updatedReceipts = [newReceipt, ...receipts];
    setReceipts(updatedReceipts);
    saveReceipts(updatedReceipts);

    // Sync across devices
    await syncTransactionAcrossDevices(newReceipt, inventoryUpdates);
    setOfflineCount(getOfflineQueue().length);

    return newReceipt;
  };

  const handleSyncGoogleSheetsReceipt = async (receipt: Receipt) => {
    const result = await syncReceiptToGoogleSheets(receipt, settings.googleSpreadsheetId);
    if (result.success && result.spreadsheetId && !settings.googleSpreadsheetId) {
      const updated = {
        ...settings,
        googleSpreadsheetId: result.spreadsheetId,
        googleSpreadsheetUrl: result.spreadsheetUrl,
      };
      setSettings(updated);
      saveSettings(updated);
    }
  };

  const handleSyncGoogleSheetsInventory = async () => {
    if (!settings.googleSpreadsheetId) {
      // First create sheet
      const result = await syncReceiptToGoogleSheets(receipts[0], undefined);
      if (result.spreadsheetId) {
        await syncInventoryToGoogleSheets(products, result.spreadsheetId);
        const updated = {
          ...settings,
          googleSpreadsheetId: result.spreadsheetId,
          googleSpreadsheetUrl: result.spreadsheetUrl,
        };
        setSettings(updated);
        saveSettings(updated);
        return;
      }
    } else {
      await syncInventoryToGoogleSheets(products, settings.googleSpreadsheetId);
    }
  };

  const handleAddNewProduct = (newProduct: Product) => {
    const updated = [newProduct, ...products];
    setProducts(updated);
    saveProducts(updated);
  };

  const handleCreateOnlineOrder = async (orderPayload: Omit<OnlineOrder, 'id' | 'createdAt'>): Promise<OnlineOrder> => {
    const created = createOnlineOrderStorage(orderPayload);
    setOnlineOrders((prev) => [created, ...prev]);

    // Deplete inventory for products ordered
    const inventoryUpdates: { id: string; quantity: number }[] = [];
    const updatedProducts = products.map((prod) => {
      const orderedItem = created.items.find((i) => i.product.id === prod.id);
      if (orderedItem) {
        const newStock = Math.max(0, prod.stock - orderedItem.quantity);
        inventoryUpdates.push({ id: prod.id, quantity: orderedItem.quantity });
        return { ...prod, stock: newStock };
      }
      return prod;
    });
    setProducts(updatedProducts);
    saveProducts(updatedProducts);

    // Sync to backend
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(created),
      });
    } catch (err) {
      console.warn('Online order saved locally, pending server sync');
    }

    return created;
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus, notes?: string) => {
    const updated = updateOnlineOrderStatusStorage(orderId, status, notes);
    if (updated) {
      setOnlineOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    }
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
    } catch (err) {
      console.warn('Order status updated locally');
    }
  };

  const handleConfirmRestock = (
    productId: string,
    addedStock: number,
    details: { supplier?: string; batchNumber?: string; costPerUnit?: number; notes?: string }
  ) => {
    const updatedProducts = products.map((p) => {
      if (p.id === productId) {
        return {
          ...p,
          stock: p.stock + addedStock,
          costPrice: details.costPerUnit || p.costPrice,
        };
      }
      return p;
    });
    setProducts(updatedProducts);
    saveProducts(updatedProducts);
    setRestockProductTarget(null);

    // Sync to server
    fetch('/api/sync/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory: updatedProducts }),
    }).catch(() => {});
  };

  const lowStockThreshold = settings.defaultLowStockThreshold || 5;
  const triggeredLowStockCount = products.filter(
    (p) => p.stock <= Math.max(p.minStockAlert, lowStockThreshold)
  ).length;
  const pendingOrdersCount = onlineOrders.filter(
    (o) => o.status === 'pending' || o.status === 'preparing'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-neutral-100/60 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans transition-colors selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        isOnline={isOnline}
        offlineCount={offlineCount}
        settings={settings}
        googleUser={googleUser}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        currentStaff={currentStaff}
        activeShift={activeShift}
        onOpenStaffLogin={() => setIsStaffLoginOpen(true)}
        onOpenCloseSales={() => setIsCloseSalesOpen(true)}
        lowStockCount={triggeredLowStockCount}
        pendingOrdersCount={pendingOrdersCount}
        onOpenLowStockModal={() => setIsLowStockModalOpen(true)}
      />

      {/* Main Screen Content */}
      <main className="flex-1 pb-10">
        {activeTab === 'register' && (
          <CalculatorRegister
            products={products}
            discountCodes={discountCodes}
            settings={settings}
            onOpenScanner={() => setIsScannerOpen(true)}
            onCheckout={(cart) => setActiveCheckoutCart(cart)}
            lastScannedBarcode={lastScannedBarcode}
            clearLastScanned={() => setLastScannedBarcode(null)}
            onAddNewProduct={handleAddNewProduct}
            onOpenLowStockModal={() => setIsLowStockModalOpen(true)}
          />
        )}

        {activeTab === 'orders' && (
          <OnlineOrderingHub
            products={products}
            orders={onlineOrders}
            settings={settings}
            onCreateOrder={handleCreateOnlineOrder}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onOpenInventory={() => setActiveTab('inventory')}
          />
        )}

        {activeTab === 'live_radar' && (
          <LiveSalesTracker
            receipts={receipts}
            settings={settings}
            currentStaff={currentStaff}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryManager
            products={products}
            onSaveProducts={(prods) => {
              setProducts(prods);
              saveProducts(prods);
            }}
            onSyncGoogleSheets={handleSyncGoogleSheetsInventory}
            googleSheetsConnected={Boolean(googleUser)}
            settings={settings}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            receipts={receipts}
            products={products}
            settings={settings}
          />
        )}

        {activeTab === 'history' && (
          <ReceiptsArchive
            receipts={receipts}
            products={products}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <AdminSettings
            settings={settings}
            onSaveSettings={(s) => {
              setSettings(s);
              saveSettings(s);
            }}
            discountCodes={discountCodes}
            onSaveDiscountCodes={(codes) => {
              setDiscountCodes(codes);
              saveDiscountCodes(codes);
            }}
            googleSheetsConnected={Boolean(googleUser)}
            onGoogleSignIn={handleGoogleSignIn}
          />
        )}
      </main>

      {/* Low Stock Alert Trigger & Replenishment Radar Modal */}
      <LowStockAlertTriggerModal
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        products={products}
        settings={settings}
        onRestockProduct={(product) => {
          setIsLowStockModalOpen(false);
          setRestockProductTarget(product);
        }}
      />

      {/* Restock Inventory Modal */}
      <RestockModal
        isOpen={Boolean(restockProductTarget)}
        product={restockProductTarget}
        onClose={() => setRestockProductTarget(null)}
        onConfirmRestock={handleConfirmRestock}
        cashierName={currentStaff?.name || settings.cashierName}
        currencySymbol={settings.currencySymbol}
      />

      {/* Staff Login & Shift Initiation Modal */}
      <StaffLoginModal
        isOpen={isStaffLoginOpen}
        onClose={() => setIsStaffLoginOpen(false)}
        canDismiss={Boolean(currentStaff)}
        settings={settings}
        onLoginSuccess={(user, session) => {
          setCurrentStaff(user);
          setActiveShift(session);
          setIsStaffLoginOpen(false);
          // If admin or manager logs in, prompt them to check live radar
          if (user.role === 'admin') {
            setActiveTab('live_radar');
          }
        }}
      />

      {/* Close of Sales & End Shift Report Modal */}
      <CloseSalesModal
        isOpen={isCloseSalesOpen}
        onClose={() => setIsCloseSalesOpen(false)}
        session={activeShift}
        receipts={receipts}
        settings={settings}
        onShiftClosed={(report) => {
          setActiveShift(null);
          setCurrentStaff(null);
          logoutStaff();
          // Prompt login for next cashier
          setTimeout(() => {
            setIsCloseSalesOpen(false);
            setIsStaffLoginOpen(true);
          }, 600);
        }}
      />

      {/* Barcode Camera Sensor Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(barcode) => {
          setLastScannedBarcode(barcode);
        }}
        products={products}
      />

      {/* Checkout & Detailed Summary Report Modal */}
      {activeCheckoutCart && (
        <CheckoutModal
          isOpen={Boolean(activeCheckoutCart)}
          onClose={() => setActiveCheckoutCart(null)}
          cart={activeCheckoutCart}
          settings={settings}
          onCompleteCheckout={handleCompleteCheckout}
          onSyncGoogleSheets={handleSyncGoogleSheetsReceipt}
          googleSheetsConnected={Boolean(googleUser)}
        />
      )}
    </div>
  );
}
