import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Tag,
  Receipt as ReceiptIcon,
  CreditCard,
  User,
  Sparkles,
  Percent,
  Check,
  AlertCircle,
  AlertTriangle,
  Camera,
  Keyboard,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { Product, CartItem, DiscountCode, StoreSettings, Customer } from '../types';
import { playBeepSound, DEFAULT_DELIVERY_OPTIONS } from '../services/storage';
import { IntroduceProductModal } from './IntroduceProductModal';

interface CalculatorRegisterProps {
  products: Product[];
  discountCodes: DiscountCode[];
  settings: StoreSettings;
  onOpenScanner: () => void;
  onCheckout: (cart: {
    items: CartItem[];
    customer: Customer;
    subtotal: number;
    discountAmount: number;
    discountCode?: string;
    taxAmount: number;
    total: number;
  }) => void;
  lastScannedBarcode?: string | null;
  clearLastScanned?: () => void;
  onAddNewProduct?: (product: Product, addToCartImmediately?: boolean) => void;
  onOpenLowStockModal?: () => void;
}

export const CalculatorRegister: React.FC<CalculatorRegisterProps> = ({
  products,
  discountCodes,
  settings,
  onOpenScanner,
  onCheckout,
  lastScannedBarcode,
  clearLastScanned,
  onAddNewProduct,
  onOpenLowStockModal,
}) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [isDeliveryOrder, setIsDeliveryOrder] = useState<boolean>(false);
  const [selectedDeliveryFee, setSelectedDeliveryFee] = useState<number>(settings.defaultDeliveryFee || 1500);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string>('');
  const [promoDiscountAmount, setPromoDiscountAmount] = useState<number>(0);
  const [promoMessage, setPromoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeNumpadTarget, setActiveNumpadTarget] = useState<'search' | 'promo' | null>('search');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Unrecognized Barcode & Introduce Modal states
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState<string | null>(null);
  const [isIntroduceModalOpen, setIsIntroduceModalOpen] = useState(false);
  const [introduceInitialName, setIntroduceInitialName] = useState('');
  const [introduceInitialBarcode, setIntroduceInitialBarcode] = useState('');

  // Hardware barcode scanner wedge listener (detects fast sequence of barcode characters + Enter)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes inside regular input forms
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 120) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 6) {
          handleBarcodeScanned(buffer.trim());
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  // Handle barcode scanned from camera modal
  useEffect(() => {
    if (lastScannedBarcode) {
      handleBarcodeScanned(lastScannedBarcode);
      if (clearLastScanned) clearLastScanned();
    }
  }, [lastScannedBarcode]);

  const handleBarcodeScanned = (barcode: string) => {
    const trimmed = barcode.trim();
    const found = products.find((p) => p.barcode === trimmed);
    if (found) {
      if (found.stock <= 0) {
        playBeepSound('error');
        setPromoMessage({
          type: 'error',
          text: `⚠️ Cannot add "${found.name}": Product is depleted (0 stock). Restock in Inventory first.`,
        });
        setTimeout(() => setPromoMessage(null), 4500);
        return;
      }
      addItemToCart(found);
      playBeepSound('scan');
      setSearchQuery('');
      setUnrecognizedBarcode(null);
    } else {
      playBeepSound('error');
      setUnrecognizedBarcode(trimmed);
      setPromoMessage({
        type: 'error',
        text: `Unrecognized Barcode "${trimmed}". Not yet in store stock. Click 'Introduce Product' to add it!`,
      });
      setTimeout(() => setPromoMessage(null), 5000);
    }
  };

  const addItemToCart = (product: Product) => {
    if (product.stock <= 0) {
      playBeepSound('error');
      setPromoMessage({
        type: 'error',
        text: `⚠️ Cannot add "${product.name}": Stock is depleted (0 units). Replenish in Inventory first.`,
      });
      setTimeout(() => setPromoMessage(null), 4500);
      return;
    }

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const current = updated[existingIndex];
        const newQty = current.quantity + 1;

        if (newQty > product.stock) {
          playBeepSound('error');
          setPromoMessage({
            type: 'error',
            text: `⚠️ Store stock limit reached for "${product.name}". Only ${product.stock} available.`,
          });
          setTimeout(() => setPromoMessage(null), 3500);
          return prev;
        }

        const lineTotal = Number((newQty * current.unitPrice * (1 - current.discountPercent / 100)).toFixed(2));
        updated[existingIndex] = {
          ...current,
          quantity: newQty,
          lineTotal,
        };
        return updated;
      } else {
        const newItem: CartItem = {
          id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          product,
          quantity: 1,
          unitPrice: product.price,
          discountPercent: 0,
          lineTotal: product.price,
        };
        return [...prev, newItem];
      }
    });

    if (product.stock <= product.minStockAlert) {
      playBeepSound('low_stock');
      setPromoMessage({
        type: 'error',
        text: `⚠️ LOW STOCK ALERT TRIGGERED: "${product.name}" has only ${product.stock} left in store!`,
      });
      setTimeout(() => setPromoMessage(null), 4500);
    } else {
      playBeepSound('scan');
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (delta > 0 && newQty > item.product.stock) {
              setPromoMessage({
                type: 'error',
                text: `Cannot exceed available store stock (${item.product.stock} in stock).`,
              });
              setTimeout(() => setPromoMessage(null), 3000);
              return item;
            }
            const lineTotal = Number((newQty * item.unitPrice * (1 - item.discountPercent / 100)).toFixed(2));
            return { ...item, quantity: newQty, lineTotal };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleProductIntroduced = (newProduct: Product, addToCartImmediately?: boolean) => {
    if (onAddNewProduct) {
      onAddNewProduct(newProduct, addToCartImmediately);
    }
    if (addToCartImmediately) {
      addItemToCart(newProduct);
    }
    setUnrecognizedBarcode(null);
    setPromoMessage({
      type: 'success',
      text: `✨ Successfully introduced "${newProduct.name}" to BummptStores!`,
    });
    setTimeout(() => setPromoMessage(null), 4000);
  };

  const removeItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const clearReceipt = () => {
    if (cartItems.length > 0 && confirm('Clear all items from this digital receipt?')) {
      setCartItems([]);
      setAppliedPromoCode('');
      setPromoDiscountAmount(0);
      setCustomerName('');
      setCustomerEmail('');
    }
  };

  // Calculate totals
  const subtotal = cartItems.reduce((acc, item) => acc + item.lineTotal, 0);

  // Apply Promo Discount Code calculation
  const applyPromoCode = (codeToApply: string) => {
    const code = codeToApply.trim().toUpperCase();
    if (!code) {
      setAppliedPromoCode('');
      setPromoDiscountAmount(0);
      return;
    }

    const promo = discountCodes.find((d) => d.code.toUpperCase() === code && d.isActive);
    if (!promo) {
      setPromoMessage({ type: 'error', text: `Invalid or expired coupon code "${code}"` });
      setTimeout(() => setPromoMessage(null), 3000);
      return;
    }

    if (subtotal < promo.minSpend) {
      setPromoMessage({
        type: 'error',
        text: `Code "${promo.code}" requires min spend of ${settings.currencySymbol || '₦'}${promo.minSpend.toLocaleString()}`,
      });
      setTimeout(() => setPromoMessage(null), 3500);
      return;
    }

    let discount = 0;
    if (promo.type === 'percentage') {
      discount = Number(((subtotal * promo.value) / 100).toFixed(2));
    } else {
      discount = Math.min(subtotal, promo.value);
    }

    setAppliedPromoCode(promo.code);
    setPromoDiscountAmount(discount);
    setPromoMessage({
      type: 'success',
      text: `Applied "${promo.code}": Saved ${settings.currencySymbol || '₦'}${discount.toLocaleString()}!`,
    });
    setTimeout(() => setPromoMessage(null), 3000);
  };

  // Calculate tax with grocery exemptions
  let taxAmount = 0;
  cartItems.forEach((item) => {
    const isExempt = settings.enableGroceryTaxExemption && item.product.taxCategory === 'grocery_exempt';
    if (!isExempt) {
      const rate = item.product.taxCategory === 'reduced' ? settings.taxRateReduced : settings.taxRateStandard;
      taxAmount += item.lineTotal * rate;
    }
  });

  // Scale tax if promo code was applied proportionally
  if (subtotal > 0 && promoDiscountAmount > 0) {
    const discountRatio = Math.max(0, (subtotal - promoDiscountAmount) / subtotal);
    taxAmount = taxAmount * discountRatio;
  }
  taxAmount = Number(taxAmount.toFixed(2));

  // Delivery calculation
  const effectiveDeliveryFee = isDeliveryOrder ? selectedDeliveryFee : 0;
  const grandTotal = Math.max(0, Number((subtotal - promoDiscountAmount + taxAmount + effectiveDeliveryFee).toFixed(2)));

  // Low stock triggered products counter
  const lowStockThreshold = settings.defaultLowStockThreshold || 5;
  const triggeredLowStockProducts = products.filter(
    (p) => p.stock <= Math.max(p.minStockAlert, lowStockThreshold)
  );

  // Categories list
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  // Filter products by search or category
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesCat;
    const matchesName = p.name.toLowerCase().includes(query);
    const matchesBarcode = p.barcode.includes(query);
    return (matchesName || matchesBarcode) && matchesCat;
  });

  // Handle Checkout submission
  const handleProceedToCheckout = () => {
    if (cartItems.length === 0) return;
    onCheckout({
      items: cartItems,
      customer: {
        name: customerName || 'Individual Customer',
        email: customerEmail || undefined,
        address: isDeliveryOrder ? customerAddress : undefined,
      },
      subtotal,
      discountAmount: promoDiscountAmount,
      discountCode: appliedPromoCode || undefined,
      taxAmount,
      total: grandTotal,
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT COLUMN: Product Catalog, Sensor Scanner & Quick Select (lg:col-span-7) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Anti-Stockout Low Stock Alert Trigger Banner */}
        {triggeredLowStockProducts.length > 0 && onOpenLowStockModal && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/80 flex items-center justify-between gap-3 text-xs animate-fade-in shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500 text-white font-bold animate-pulse">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200 block">
                  {triggeredLowStockProducts.length} Product(s) Triggered Low Stock Threshold
                </span>
                <span className="text-[11px] text-amber-700/80 dark:text-amber-400">
                  Depleted or low inventory in store. Trigger supplier purchase order or restock now.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenLowStockModal}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs shrink-0 transition shadow-xs"
            >
              Review Radar →
            </button>
          </div>
        )}

        {/* Top Search & Barcode Detection Header */}
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col sm:flex-row gap-2.5">
          {/* Search by Product Name or Barcode */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              id="input-product-search"
              ref={searchInputRef}
              type="text"
              placeholder="Search product name or scan Barcode (e.g. 011110038245)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const query = searchQuery.trim();
                  if (!query) return;
                  const found =
                    products.find((p) => p.barcode === query) ||
                    products.find((p) => p.name.toLowerCase() === query.toLowerCase()) ||
                    filteredProducts[0];
                  if (found) {
                    addItemToCart(found);
                    setSearchQuery('');
                  }
                }
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Barcode Camera Sensor Scanner Button */}
          <button
            id="btn-scan-barcode-sensor"
            onClick={onOpenScanner}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-semibold text-xs sm:text-sm shadow-xs transition"
            title="Open camera sensor to detect barcodes automatically"
          >
            <Camera className="w-4 h-4" />
            <span>Scan Barcode</span>
          </button>

          {/* Quick Introduce New Product Button */}
          <button
            id="btn-register-introduce-product"
            onClick={() => {
              setIntroduceInitialBarcode('');
              setIntroduceInitialName(searchQuery);
              setIsIntroduceModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-xs sm:text-sm font-semibold transition"
            title="Introduce a new product not yet in store catalog"
          >
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Introduce Product</span>
          </button>
        </div>

        {/* Unrecognized Barcode Alert Banner */}
        {unrecognizedBarcode && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-between gap-2 text-xs animate-fade-in shadow-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Barcode className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Barcode <strong className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded-sm">{unrecognizedBarcode}</strong> is not recognized in store catalog.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setIntroduceInitialBarcode(unrecognizedBarcode);
                  setIntroduceInitialName('');
                  setIsIntroduceModalOpen(true);
                }}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-xs shadow-xs"
              >
                ✨ Introduce Now
              </button>
              <button
                onClick={() => setUnrecognizedBarcode(null)}
                className="text-neutral-400 hover:text-neutral-600 px-1.5 py-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Category Pills Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 border border-neutral-200 dark:border-neutral-700/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="col-span-2 sm:col-span-3 p-8 text-center bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                No items found matching "{searchQuery || selectedCategory}".
              </p>
              <p className="text-xs text-neutral-400">
                Is this a newly introduced product not yet in the store?
              </p>
              <button
                type="button"
                onClick={() => {
                  setIntroduceInitialBarcode('');
                  setIntroduceInitialName(searchQuery);
                  setIsIntroduceModalOpen(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>✨ Introduce "{searchQuery || 'New Product'}"</span>
              </button>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const inCart = cartItems.find((i) => i.product.id === product.id);
              const isDepleted = product.stock <= 0;
              const isLowStock = product.stock > 0 && product.stock <= product.minStockAlert;
              const isNew = Boolean(
                product.introducedAt &&
                  (Date.now() - new Date(product.introducedAt).getTime()) / (1000 * 3600) <= 72
              );

              return (
                <div
                  key={product.id}
                  onClick={() => addItemToCart(product)}
                  className={`group relative p-3 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                    isDepleted
                      ? 'border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10 opacity-75'
                      : inCart
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs'
                      : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-emerald-400 hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1">
                        <span className="text-2xl">{product.icon || '📦'}</span>
                        {isNew && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300">
                            New
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isDepleted
                            ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900'
                            : isLowStock
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {isDepleted ? '🚨 Depleted (0)' : isLowStock ? `⚠️ Low (${product.stock})` : `${product.stock} in stock`}
                      </span>
                    </div>
                    <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm line-clamp-2 leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {product.name}
                    </h4>
                    <div className="flex items-center gap-1 mt-1 text-[11px] font-mono text-neutral-400">
                      <Barcode className="w-3 h-3" />
                      <span>{product.barcode}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                    <span className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                      {settings.currencySymbol || '₦'}{product.price.toLocaleString()}
                      <span className="text-[11px] font-normal text-neutral-400">/{product.unit}</span>
                    </span>
                    <button
                      type="button"
                      className={`w-7 h-7 rounded-lg text-white flex items-center justify-center transition ${
                        isDepleted
                          ? 'bg-neutral-400 dark:bg-neutral-700 cursor-not-allowed'
                          : 'bg-emerald-600 group-hover:bg-emerald-500'
                      }`}
                      title={isDepleted ? 'Depleted stock (0 remaining) - Restock in Inventory' : 'Add to receipt'}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {inCart && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                      {inCart.quantity}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Digital Receipt Calculator (lg:col-span-5) */}
      <div className="lg:col-span-5 flex flex-col bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden min-h-[640px]">
        {/* Receipt Header & Individual Assignment */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <ReceiptIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                  Active Digital Receipt
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {cartItems.reduce((acc, i) => acc + i.quantity, 0)} items recorded
                </p>
              </div>
            </div>

            {cartItems.length > 0 && (
              <button
                id="btn-clear-receipt"
                onClick={clearReceipt}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1 font-medium transition"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {/* Individual Customer Tagging */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <User className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
              <input
                id="input-customer-name"
                type="text"
                placeholder="Individual Customer (Optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <input
              id="input-customer-email"
              type="email"
              placeholder="Receipt Email (Optional)"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Receipt Line Items List */}
        <div className="flex-1 p-4 overflow-y-auto max-h-[300px] space-y-2">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-2">
                <ReceiptIcon className="w-6 h-6 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Receipt is empty
              </p>
              <p className="text-xs text-neutral-400 max-w-xs mt-1">
                Scan barcodes with the sensor camera or click items on the left to tally purchases.
              </p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 text-xs"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {item.product.name}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-2">
                    <span>{item.product.barcode}</span>
                    <span>{settings.currencySymbol || '₦'}{item.unitPrice.toLocaleString()} ea</span>
                    {item.product.taxCategory === 'grocery_exempt' && settings.enableGroceryTaxExemption && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-sans font-medium">
                        Tax-Exempt
                      </span>
                    )}
                  </div>
                </div>

                {/* Steppers & Line Total */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-white dark:bg-neutral-700 rounded-lg border border-neutral-200 dark:border-neutral-600">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 rounded-l-lg"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold text-neutral-800 dark:text-neutral-200">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 rounded-r-lg"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="w-20 text-right font-bold text-neutral-900 dark:text-neutral-100">
                    {settings.currencySymbol || '₦'}{item.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-neutral-400 hover:text-red-500 p-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Discount Code Section */}
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-850">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Tag className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
              <input
                id="input-promo-code"
                type="text"
                placeholder="Discount Code (e.g. SAVE10, 5OFF, STAFF15)"
                value={appliedPromoCode}
                onChange={(e) => setAppliedPromoCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyPromoCode(appliedPromoCode);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-mono uppercase"
              />
            </div>
            <button
              id="btn-apply-promo"
              type="button"
              onClick={() => applyPromoCode(appliedPromoCode)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 transition"
            >
              Apply
            </button>
          </div>

          {/* Preset Promos Quick Click */}
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
            <span className="text-[10px] text-neutral-400 whitespace-nowrap">Coupons:</span>
            {discountCodes.slice(0, 4).map((dc) => (
              <button
                key={dc.code}
                type="button"
                onClick={() => {
                  setAppliedPromoCode(dc.code);
                  applyPromoCode(dc.code);
                }}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 border border-neutral-200 dark:border-neutral-700"
              >
                {dc.code}
              </button>
            ))}
          </div>

          {promoMessage && (
            <div
              className={`mt-2 p-1.5 rounded-lg text-xs flex items-center gap-1.5 ${
                promoMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300'
              }`}
            >
              {promoMessage.type === 'success' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              <span>{promoMessage.text}</span>
            </div>
          )}
        </div>

        {/* Optional Delivery Dispatch Fee for phone/delivery orders */}
        <div className="px-4 py-2.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-850/60 text-xs">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-neutral-800 dark:text-neutral-200">
              <input
                type="checkbox"
                checked={isDeliveryOrder}
                onChange={(e) => setIsDeliveryOrder(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="flex items-center gap-1.5">
                <span>🚚</span>
                <span>Delivery Dispatch Order</span>
              </span>
            </label>
            {isDeliveryOrder && (
              <span className="font-bold text-blue-600 dark:text-blue-400">
                +{settings.currencySymbol || '₦'}{selectedDeliveryFee.toLocaleString()}
              </span>
            )}
          </div>

          {isDeliveryOrder && (
            <div className="mt-2.5 space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <input
                type="text"
                placeholder="Delivery Address & Landmark..."
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
              />
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500">Zone:</span>
                <select
                  value={selectedDeliveryFee}
                  onChange={(e) => setSelectedDeliveryFee(Number(e.target.value))}
                  className="flex-1 px-2 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs"
                >
                  {DEFAULT_DELIVERY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.fee}>
                      {opt.name} ({settings.currencySymbol || '₦'}{opt.fee.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Calculation Summary Box */}
        <div className="p-4 bg-neutral-100/70 dark:bg-neutral-800/80 border-t border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
          <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
            <span>Cost for Products Ordered</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              {settings.currencySymbol || '₦'}{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {isDeliveryOrder && (
            <div className="flex justify-between text-blue-600 dark:text-blue-400 font-semibold">
              <span>Delivery Cost / Courier Fee</span>
              <span>+{settings.currencySymbol || '₦'}{selectedDeliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          {promoDiscountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
              <span>Promotional Discount ({appliedPromoCode})</span>
              <span>-{settings.currencySymbol || '₦'}{promoDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
            <span className="flex items-center gap-1">
              Sales Tax
              <span className="text-[10px] text-neutral-400">
                ({(settings.taxRateStandard * 100).toFixed(2)}% base)
              </span>
            </span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              {settings.currencySymbol || '₦'}{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700 flex justify-between items-baseline">
            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              TOTAL DUE
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {settings.currencySymbol || '₦'}{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Checkout Trigger */}
          <button
            id="btn-checkout-summary"
            disabled={cartItems.length === 0}
            onClick={handleProceedToCheckout}
            className="w-full mt-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
          >
            <span>Checkout & Detailed Summary</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Introduce Brand-New Product Modal (on floor / register) */}
      <IntroduceProductModal
        isOpen={isIntroduceModalOpen}
        onClose={() => setIsIntroduceModalOpen(false)}
        onProductIntroduced={handleProductIntroduced}
        initialBarcode={introduceInitialBarcode}
        initialName={introduceInitialName}
        source="register"
        currencySymbol={settings.currencySymbol}
      />
    </div>
  );
};
