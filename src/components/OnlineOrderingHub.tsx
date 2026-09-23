import React, { useState } from 'react';
import {
  ShoppingBag,
  Truck,
  Plus,
  Minus,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  AlertCircle,
  Printer,
  FileSpreadsheet,
  ArrowRight,
  Filter,
  DollarSign,
  Send,
  Sparkles,
  ChevronRight,
  Package,
  Bike,
  Navigation,
} from 'lucide-react';
import {
  Product,
  CartItem,
  StoreSettings,
  OnlineOrder,
  DeliveryOption,
  OrderStatus,
  Receipt,
} from '../types';
import { DEFAULT_DELIVERY_OPTIONS, playBeepSound } from '../services/storage';
import * as XLSX from 'xlsx';

interface OnlineOrderingHubProps {
  products: Product[];
  settings: StoreSettings;
  orders: OnlineOrder[];
  onCreateOrder: (order: Omit<OnlineOrder, 'id' | 'createdAt'>) => Promise<OnlineOrder>;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, notes?: string) => Promise<void>;
  onConvertToReceipt?: (order: OnlineOrder) => Promise<Receipt>;
}

export const OnlineOrderingHub: React.FC<OnlineOrderingHubProps> = ({
  products,
  settings,
  orders,
  onCreateOrder,
  onUpdateOrderStatus,
  onConvertToReceipt,
}) => {
  const sym = settings.currencySymbol || '₦';

  // Navigation tab within the hub
  const [activeTab, setActiveTab] = useState<'create' | 'orders'>('create');

  // Order Creation State
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [orderCart, setOrderCart] = useState<CartItem[]>([]);
  
  // Delivery details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [selectedDeliveryOptionId, setSelectedDeliveryOptionId] = useState<string>('del-std');
  const [customDeliveryFee, setCustomDeliveryFee] = useState<string>('');
  const [isCustomDelivery, setIsCustomDelivery] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer' | 'pay_on_delivery'>('card');
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrderSuccess, setCreatedOrderSuccess] = useState<OnlineOrder | null>(null);
  const [selectedOrderForWaybill, setSelectedOrderForWaybill] = useState<OnlineOrder | null>(null);

  // Filter in Orders Dashboard
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  // Delivery fee calculation
  const chosenOption = DEFAULT_DELIVERY_OPTIONS.find((opt) => opt.id === selectedDeliveryOptionId);
  const deliveryFee = isCustomDelivery
    ? parseFloat(customDeliveryFee) || 0
    : chosenOption
    ? chosenOption.fee
    : settings.defaultDeliveryFee || 1500;

  // Cost calculations
  const itemsCost = orderCart.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = Math.round(itemsCost * settings.taxRateStandard);
  const totalAmount = itemsCost + deliveryFee + taxAmount;

  // Catalog item addition
  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) {
      playBeepSound('error');
      alert(`⚠️ "${product.name}" is currently depleted (0 stock in store).`);
      return;
    }

    setOrderCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Cannot order more than available stock (${product.stock} available).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                lineTotal: (item.quantity + 1) * item.unitPrice,
              }
            : item
        );
      } else {
        const newItem: CartItem = {
          id: 'li-online-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          product,
          quantity: 1,
          unitPrice: product.price,
          discountPercent: 0,
          lineTotal: product.price,
        };
        return [...prev, newItem];
      }
    });
    playBeepSound('scan');
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setOrderCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stock) {
              alert(`Cannot exceed available inventory (${item.product.stock} in stock).`);
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              lineTotal: newQty * item.unitPrice,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setOrderCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Submit Order
  const handlePlaceOnlineOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderCart.length === 0) {
      alert('Please add at least one product to the online order.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      alert('Customer Name, Phone number, and Delivery Address are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      playBeepSound('checkout');
      const orderPayload: Omit<OnlineOrder, 'id' | 'createdAt'> = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        deliveryAddress: deliveryAddress.trim(),
        deliveryZone: isCustomDelivery ? 'Custom Courier Route' : chosenOption?.name || 'Standard City Dispatch',
        deliveryInstructions: deliveryInstructions.trim() || undefined,
        items: orderCart,
        itemsCost, // Explicitly store cost for the products ordered
        deliveryCost: deliveryFee, // Explicitly store delivery cost
        discountAmount: 0,
        taxAmount,
        totalAmount,
        paymentMethod,
        paymentStatus: paymentMethod === 'pay_on_delivery' ? 'cash_on_delivery' : 'paid',
        status: 'pending',
        assignedRider: riderName.trim() ? { name: riderName.trim(), phone: riderPhone.trim() } : undefined,
      };

      const newOrder = await onCreateOrder(orderPayload);
      setCreatedOrderSuccess(newOrder);

      // Reset form
      setOrderCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setDeliveryAddress('');
      setDeliveryInstructions('');
      setRiderName('');
      setRiderPhone('');
    } catch (err: any) {
      alert('Failed to place online order: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print Delivery Waybill / Packing Slip
  const handlePrintWaybill = (order: OnlineOrder) => {
    const printWindow = window.open('', '_blank', 'width=520,height=750');
    if (!printWindow) return;

    const itemsRows = order.items
      .map(
        (it) => `
        <tr>
          <td style="padding: 6px 0; border-bottom: 1px solid #eee;">
            <strong>${it.product.name}</strong><br>
            <span style="font-size: 11px; color: #666;">Barcode: ${it.product.barcode}</span>
          </td>
          <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: center;">${it.quantity}</td>
          <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right;">${sym}${it.unitPrice.toLocaleString()}</td>
          <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${sym}${it.lineTotal.toLocaleString()}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Delivery Waybill - ${order.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 24px; color: #1e293b; font-size: 13px; line-height: 1.4; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: bold; text-transform: uppercase; background: #e2e8f0; }
            .table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 12px; }
            .breakdown-row { display: flex; justify-content: space-between; padding: 4px 0; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #0f172a; font-weight: bold; font-size: 15px; margin-top: 6px; }
          </style>
        </head>
        <body>
          <div style="text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 12px;">
            <h2 style="margin: 0; font-size: 18px;">${settings.storeName}</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">OFFICIAL DISPATCH WAYBILL & PACKING SLIP</div>
            <div style="font-weight: bold; font-size: 14px; margin-top: 6px;">Order #${order.id}</div>
            <div style="font-size: 11px; color: #64748b;">Date: ${new Date(order.createdAt).toLocaleString()}</div>
          </div>

          <div class="box">
            <strong style="display: block; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 4px;">Customer & Delivery Destination</strong>
            <div><strong>Recipient:</strong> ${order.customerName}</div>
            <div><strong>Phone Number:</strong> ${order.customerPhone}</div>
            ${order.customerEmail ? `<div><strong>Email:</strong> ${order.customerEmail}</div>` : ''}
            <div><strong>Delivery Address:</strong> ${order.deliveryAddress}</div>
            <div><strong>Delivery Zone:</strong> ${order.deliveryZone}</div>
            ${order.deliveryInstructions ? `<div style="margin-top: 4px; font-style: italic; color: #d97706;"><strong>Note:</strong> ${order.deliveryInstructions}</div>` : ''}
          </div>

          ${
            order.assignedRider
              ? `<div class="box" style="background: #eff6ff; border-color: #bfdbfe;">
                  <strong style="display: block; font-size: 11px; text-transform: uppercase; color: #1e40af; margin-bottom: 4px;">Assigned Dispatch Courier</strong>
                  <div><strong>Rider:</strong> ${order.assignedRider.name}</div>
                  <div><strong>Rider Phone:</strong> ${order.assignedRider.phone}</div>
                </div>`
              : ''
          }

          <table class="table">
            <thead>
              <tr style="border-bottom: 2px solid #0f172a; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569;">
                <th style="padding-bottom: 6px;">Product Ordered</th>
                <th style="padding-bottom: 6px; text-align: center;">Qty</th>
                <th style="padding-bottom: 6px; text-align: right;">Unit Price</th>
                <th style="padding-bottom: 6px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div style="margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
            <div class="breakdown-row">
              <span style="color: #64748b;">Cost for Products Ordered:</span>
              <span><strong>${sym}${order.itemsCost.toLocaleString()}</strong></span>
            </div>
            <div class="breakdown-row">
              <span style="color: #64748b;">Delivery / Courier Fee:</span>
              <span><strong>${sym}${order.deliveryCost.toLocaleString()}</strong></span>
            </div>
            ${
              order.taxAmount > 0
                ? `<div class="breakdown-row">
                    <span style="color: #64748b;">VAT (7.5%):</span>
                    <span>${sym}${order.taxAmount.toLocaleString()}</span>
                  </div>`
                : ''
            }
            <div class="total-row">
              <span>TOTAL ORDER AMOUNT:</span>
              <span>${sym}${order.totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div style="margin-top: 12px; padding: 8px; background: ${order.paymentStatus === 'paid' ? '#f0fdf4' : '#fffbeb'}; border: 1px solid ${order.paymentStatus === 'paid' ? '#bbf7d0' : '#fde68a'}; border-radius: 6px; text-align: center; font-weight: bold; font-size: 12px; color: ${order.paymentStatus === 'paid' ? '#166534' : '#92400e'};">
            Payment Status: ${order.paymentStatus === 'paid' ? 'PAID IN FULL (Card/Transfer)' : 'PAY ON DELIVERY (Collect Cash/Transfer at Doorstep)'}
          </div>

          <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8;">
            Thank you for ordering with ${settings.storeName}!<br>
            For customer support call ${settings.storePhone}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Export orders to Excel
  const handleExportOrdersToExcel = () => {
    const data = orders.map((o) => ({
      'Order ID': o.id,
      Date: new Date(o.createdAt).toLocaleString(),
      'Customer Name': o.customerName,
      'Customer Phone': o.customerPhone,
      'Delivery Address': o.deliveryAddress,
      'Delivery Zone': o.deliveryZone,
      'Products Cost': o.itemsCost,
      'Delivery Fee': o.deliveryCost,
      'Tax Amount': o.taxAmount,
      'Total Amount': o.totalAmount,
      'Payment Method': o.paymentMethod,
      'Payment Status': o.paymentStatus,
      'Order Status': o.status,
      'Assigned Courier': o.assignedRider ? `${o.assignedRider.name} (${o.assignedRider.phone})` : 'Unassigned',
      Items: o.items.map((i) => `${i.product.name} (x${i.quantity})`).join(', '),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Online Orders');
    XLSX.writeFile(wb, `BummptStores_Online_Orders_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Filtered orders in dashboard
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
    const q = orderSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      o.id.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.includes(q) ||
      o.deliveryAddress.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              Online Ordering & Dispatch Hub
            </h1>
            <p className="text-xs text-neutral-500">
              Manage doorstep deliveries, dispatch couriers, and transparently itemize product costs and delivery fees
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'create'
                ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>New Online Order</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition relative ${
              activeTab === 'orders'
                ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Orders Board</span>
            {orders.filter((o) => o.status === 'pending' || o.status === 'preparing').length > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-black">
                {orders.filter((o) => o.status === 'pending' || o.status === 'preparing').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Success Modal upon Placing an Order */}
      {createdOrderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100">
                Online Order Dispatched!
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Order <span className="font-bold text-neutral-800 dark:text-neutral-200">#{createdOrderSuccess.id}</span> has been logged and queued for courier packing.
              </p>
            </div>

            {/* Financial Breakdown Card */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 text-left text-xs space-y-1.5">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Cost for Products Ordered:</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {sym}{createdOrderSuccess.itemsCost.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Delivery & Courier Cost:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {sym}{createdOrderSuccess.deliveryCost.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between font-bold text-sm text-neutral-900 dark:text-neutral-100 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                <span>Total Amount:</span>
                <span>{sym}{createdOrderSuccess.totalAmount.toLocaleString()}</span>
              </div>
              <div className="text-[11px] text-neutral-500 pt-1">
                Recipient: {createdOrderSuccess.customerName} • {createdOrderSuccess.customerPhone}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handlePrintWaybill(createdOrderSuccess)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print Waybill</span>
              </button>
              <button
                onClick={() => {
                  setCreatedOrderSuccess(null);
                  setActiveTab('orders');
                }}
                className="flex-1 py-2.5 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 text-xs font-bold transition"
              >
                View on Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: CREATE NEW ONLINE ORDER */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Product Selection & Catalog (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Select Products to Order</span>
                </h2>

                {/* Catalog Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search products or barcode..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border-none text-xs focus:ring-2 focus:ring-blue-500 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCatalogCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
                      catalogCategory === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Catalog Product Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1">
                {products
                  .filter((p) => {
                    const matchCat = catalogCategory === 'All' || p.category === catalogCategory;
                    const q = catalogSearch.toLowerCase().trim();
                    const matchSearch =
                      !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q);
                    return matchCat && matchSearch;
                  })
                  .map((product) => {
                    const isDepleted = product.stock <= 0;
                    const isLow = !isDepleted && product.stock <= product.minStockAlert;
                    const inCartItem = orderCart.find((i) => i.product.id === product.id);

                    return (
                      <div
                        key={product.id}
                        className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                          isDepleted
                            ? 'bg-neutral-50 dark:bg-neutral-800/30 border-neutral-200 dark:border-neutral-800 opacity-60'
                            : 'bg-white dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 hover:border-blue-500 hover:shadow-xs'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xl">{product.icon || '📦'}</span>
                            {isDepleted ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                OUT OF STOCK
                              </span>
                            ) : isLow ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                LOW: {product.stock}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {product.stock} in stock
                              </span>
                            )}
                          </div>

                          <div className="font-bold text-xs text-neutral-900 dark:text-neutral-100 mt-2 line-clamp-2">
                            {product.name}
                          </div>
                          <div className="text-[11px] font-mono text-neutral-400 mt-0.5">
                            {product.barcode}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                          <span className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                            {sym}{product.price.toLocaleString()}
                          </span>

                          <button
                            type="button"
                            disabled={isDepleted}
                            onClick={() => handleAddToCart(product)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition active:scale-95 ${
                              isDepleted
                                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                : inCartItem
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{inCartItem ? `(${inCartItem.quantity})` : 'Add'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Current Cart Items List */}
            <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                  Products in Order ({orderCart.length} Items)
                </h3>
                {orderCart.length > 0 && (
                  <button
                    onClick={() => setOrderCart([])}
                    className="text-xs text-red-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Cart</span>
                  </button>
                )}
              </div>

              {orderCart.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-xs border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                  No items added yet. Click "+ Add" on any available product above.
                </div>
              ) : (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {orderCart.map((item) => (
                    <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{item.product.icon || '📦'}</span>
                        <div>
                          <div className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                            {item.product.name}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {sym}{item.unitPrice.toLocaleString()} each
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, -1)}
                            className="p-1 hover:bg-white dark:hover:bg-neutral-700 rounded text-neutral-600 dark:text-neutral-400"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 font-bold text-xs">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, 1)}
                            className="p-1 hover:bg-white dark:hover:bg-neutral-700 rounded text-neutral-600 dark:text-neutral-400"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 min-w-16 text-right">
                          {sym}{item.lineTotal.toLocaleString()}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.product.id)}
                          className="p-1 text-neutral-400 hover:text-red-500 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Customer Details, Delivery Zone, Cost Breakdown (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <form onSubmit={handlePlaceOnlineOrder} className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Delivery & Customer Details</span>
              </h2>

              {/* Customer Info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
                    Customer Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Chief Adeleke"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                      <input
                        type="tel"
                        required
                        placeholder="+234 803 000 0000"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="customer@email.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
                    Street Address & Landmark *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="House/Apartment #, Street name, Area (e.g., Near Admiralty toll gate, Lekki)"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
                    Rider Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ring bell, gate code #123, call when arriving"
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              {/* Delivery Zone & Courier Options */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 uppercase">
                  Select Delivery Zone & Courier Speed
                </label>

                <div className="space-y-2">
                  {DEFAULT_DELIVERY_OPTIONS.map((opt) => {
                    const isSelected = !isCustomDelivery && selectedDeliveryOptionId === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          setIsCustomDelivery(false);
                          setSelectedDeliveryOptionId(opt.id);
                        }}
                        className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-500 shadow-xs'
                            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="delivery_zone"
                            checked={isSelected}
                            onChange={() => {
                              setIsCustomDelivery(false);
                              setSelectedDeliveryOptionId(opt.id);
                            }}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <div className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                              {opt.name}
                            </div>
                            <div className="text-[10px] text-neutral-500">
                              {opt.estimatedTime} • {opt.description}
                            </div>
                          </div>
                        </div>

                        <span className="font-black text-xs text-neutral-900 dark:text-neutral-100">
                          {opt.fee === 0 ? 'FREE (₦0)' : `${sym}${opt.fee.toLocaleString()}`}
                        </span>
                      </div>
                    );
                  })}

                  {/* Custom Delivery Fee Toggle */}
                  <div
                    onClick={() => setIsCustomDelivery(true)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isCustomDelivery
                        ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-500'
                        : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="delivery_zone"
                        checked={isCustomDelivery}
                        onChange={() => setIsCustomDelivery(true)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                        Custom Courier Fee Rate
                      </span>
                    </div>

                    {isCustomDelivery && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-neutral-500">{sym}</span>
                        <input
                          type="number"
                          placeholder="e.g. 1800"
                          value={customDeliveryFee}
                          onChange={(e) => setCustomDeliveryFee(e.target.value)}
                          className="w-24 px-2 py-1 rounded-lg bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 text-xs font-bold text-right"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 uppercase">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-2.5 rounded-xl border font-bold transition text-center ${
                      paymentMethod === 'card'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    Card / Transfer (Prepaid)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pay_on_delivery')}
                    className={`p-2.5 rounded-xl border font-bold transition text-center ${
                      paymentMethod === 'pay_on_delivery'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    Pay on Delivery (COD)
                  </button>
                </div>
              </div>

              {/* Optional Rider Dispatch */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 uppercase flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-blue-600" />
                  <span>Assign Rider / Dispatcher (Optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Rider Name (e.g. Musa Bike #4)"
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-neutral-100"
                  />
                  <input
                    type="tel"
                    placeholder="Rider Phone (+234...)"
                    value={riderPhone}
                    onChange={(e) => setRiderPhone(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              {/* ITEMIZED FINANCIAL BREAKDOWN (As Requested: product cost + delivery cost) */}
              <div className="p-4 rounded-xl bg-neutral-900 text-white space-y-2 shadow-md">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Order Breakdown & Total
                </div>

                <div className="flex justify-between text-xs text-neutral-300">
                  <span>Cost for Products Ordered:</span>
                  <span className="font-bold text-white">
                    {sym}{itemsCost.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-xs text-blue-400">
                  <span>Delivery Cost / Courier Fee:</span>
                  <span className="font-bold">
                    {deliveryFee === 0 ? 'FREE (₦0)' : `${sym}${deliveryFee.toLocaleString()}`}
                  </span>
                </div>

                {taxAmount > 0 && (
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>VAT (7.5%):</span>
                    <span>{sym}{taxAmount.toLocaleString()}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-neutral-700 flex justify-between items-center text-sm font-black">
                  <span>Total Amount Payable:</span>
                  <span className="text-emerald-400 text-base">
                    {sym}{totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || orderCart.length === 0}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Online Order...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit & Dispatch Online Order</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 2: ORDERS DASHBOARD & DISPATCH BOARD */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Dashboard Controls & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {(['all', 'pending', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setOrderStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition uppercase tracking-wider ${
                      orderStatusFilter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                    }`}
                  >
                    {status.replace('_', ' ')}{' '}
                    {status !== 'all' && `(${orders.filter((o) => o.status === status).length})`}
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Filter by customer, phone, ID..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border-none text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
                />
              </div>

              <button
                onClick={handleExportOrdersToExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Orders Cards Grid */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 p-12 text-center rounded-2xl border border-neutral-200 dark:border-neutral-800 text-neutral-400 space-y-2">
              <ShoppingBag className="w-10 h-10 mx-auto text-neutral-300" />
              <div className="font-bold text-sm text-neutral-700 dark:text-neutral-300">
                No orders match your filter criteria
              </div>
              <p className="text-xs">Switch filters or click "New Online Order" to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.map((order) => {
                const statusColors = {
                  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300',
                  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300',
                  preparing: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300',
                  out_for_delivery: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300',
                  delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
                  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300',
                };

                return (
                  <div
                    key={order.id}
                    className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-neutral-300 transition"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-neutral-900 dark:text-neutral-100">
                              #{order.id}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                statusColors[order.status] || 'bg-neutral-100 text-neutral-700'
                              }`}
                            >
                              {order.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            {new Date(order.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-base text-neutral-900 dark:text-neutral-100 block">
                            {sym}{order.totalAmount.toLocaleString()}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              order.paymentStatus === 'paid'
                                ? 'text-emerald-600'
                                : 'text-amber-600'
                            }`}
                          >
                            {order.paymentStatus === 'paid' ? 'PAID' : 'PAY ON DELIVERY'}
                          </span>
                        </div>
                      </div>

                      {/* Recipient info & Destination */}
                      <div className="mt-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-neutral-800 dark:text-neutral-200">
                          <User className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{order.customerName}</span>
                          <span className="text-neutral-400 font-normal">•</span>
                          <Phone className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="font-mono">{order.customerPhone}</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-neutral-600 dark:text-neutral-400">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                          <span>{order.deliveryAddress} ({order.deliveryZone})</span>
                        </div>
                        {order.assignedRider && (
                          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold pt-1">
                            <Bike className="w-3.5 h-3.5" />
                            <span>Rider: {order.assignedRider.name} ({order.assignedRider.phone})</span>
                          </div>
                        )}
                      </div>

                      {/* Cost Breakdown (Clearly itemized product cost and delivery cost) */}
                      <div className="mt-3 py-2 px-3 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/50 text-xs space-y-1">
                        <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                          <span>Cost for Products Ordered:</span>
                          <span className="font-bold text-neutral-800 dark:text-neutral-200">
                            {sym}{order.itemsCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                          <span>Delivery Cost:</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {sym}{order.deliveryCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 pt-1 border-t border-neutral-200 dark:border-neutral-700">
                          {order.items.length} item(s):{' '}
                          {order.items.map((i) => `${i.product.name} (x${i.quantity})`).join(', ')}
                        </div>
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <button
                        onClick={() => handlePrintWaybill(order)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Waybill</span>
                      </button>

                      {/* Status Advancement Shortcuts */}
                      <div className="flex items-center gap-1.5">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'preparing')}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition"
                          >
                            Pack & Prepare
                          </button>
                        )}

                        {order.status === 'preparing' && (
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'out_for_delivery')}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1"
                          >
                            <Bike className="w-3.5 h-3.5" />
                            <span>Dispatch to Courier</span>
                          </button>
                        )}

                        {order.status === 'out_for_delivery' && (
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'delivered')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Delivered & Paid</span>
                          </button>
                        )}

                        {order.status === 'delivered' && (
                          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Completed</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
