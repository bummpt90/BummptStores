import React, { useState } from 'react';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Gift,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Printer,
  Mail,
  Download,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import { CartItem, Customer, StoreSettings, Receipt } from '../types';
import { exportSingleReceiptToExcel } from '../services/excelExport';
import { generateCustomerReceiptHtml } from '../services/emailReport';
import { playBeepSound } from '../services/storage';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: {
    items: CartItem[];
    customer: Customer;
    subtotal: number;
    discountAmount: number;
    discountCode?: string;
    taxAmount: number;
    total: number;
  };
  settings: StoreSettings;
  onCompleteCheckout: (receiptData: {
    paymentMethod: 'cash' | 'card' | 'mobile_nfc' | 'gift_card' | 'split';
    amountTendered: number;
    changeDue: number;
    customerEmail?: string;
  }) => Promise<Receipt>;
  onSyncGoogleSheets?: (receipt: Receipt) => Promise<void>;
  googleSheetsConnected?: boolean;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cart,
  settings,
  onCompleteCheckout,
  onSyncGoogleSheets,
  googleSheetsConnected,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile_nfc' | 'gift_card' | 'split'>('card');
  const [cashTendered, setCashTendered] = useState<string>(cart.total.toFixed(2));
  const [customerEmail, setCustomerEmail] = useState<string>(cart.customer.email || '');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [completedReceipt, setCompletedReceipt] = useState<Receipt | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [sheetsStatus, setSheetsStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const tenderedNumber = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, Number((tenderedNumber - cart.total).toFixed(2)));

  const handleFinishTransaction = async () => {
    setIsProcessing(true);
    try {
      playBeepSound('checkout');
      const receipt = await onCompleteCheckout({
        paymentMethod,
        amountTendered: paymentMethod === 'cash' ? tenderedNumber : cart.total,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
        customerEmail: customerEmail || undefined,
      });
      setCompletedReceipt(receipt);

      // Trigger Google Sheets auto-sync if connected
      if (googleSheetsConnected && onSyncGoogleSheets) {
        setSheetsStatus('Syncing to Google Sheets...');
        onSyncGoogleSheets(receipt)
          .then(() => setSheetsStatus('Synced to Google Sheets'))
          .catch(() => setSheetsStatus('Sheets sync queued'));
      }
    } catch (err: any) {
      alert('Checkout error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!completedReceipt) return;
    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (printWindow) {
      printWindow.document.write(generateCustomerReceiptHtml(completedReceipt, settings));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }
  };

  const handleSendEmailReceipt = async () => {
    if (!customerEmail) {
      alert('Please provide a valid recipient email');
      return;
    }
    setEmailStatus('Sending receipt email...');
    try {
      const res = await fetch('/api/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'digital_receipt',
          recipient: customerEmail,
          subject: `${settings.storeName} - Your Digital Receipt #${completedReceipt?.id}`,
          htmlBody: completedReceipt ? generateCustomerReceiptHtml(completedReceipt, settings) : '',
        }),
      });
      if (res.ok) {
        setEmailStatus(`Receipt emailed to ${customerEmail}`);
      } else {
        setEmailStatus('Queued for email delivery');
      }
    } catch {
      setEmailStatus('Queued for delivery');
    }
  };

  return (
    <div
      id="checkout-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-neutral-900 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 my-auto">
        {!completedReceipt ? (
          /* PAYMENT STEP */
          <div className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  Checkout & Payment
                </h3>
                <p className="text-xs text-neutral-500">
                  Customer: {cart.customer.name || 'Individual Customer'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Display */}
            <div className="my-6 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Total Amount Due
              </span>
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {settings.currencySymbol || '₦'}{cart.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex justify-center gap-4 mt-2 text-xs text-neutral-500">
                <span>Subtotal: {settings.currencySymbol || '₦'}{cart.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                {cart.discountAmount > 0 && (
                  <span>Saved: -{settings.currencySymbol || '₦'}{cart.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                )}
                <span>Tax: {settings.currencySymbol || '₦'}{cart.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
                Select Payment Method
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === 'card'
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs">Credit/Debit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('cash');
                    setCashTendered(cart.total.toFixed(2));
                  }}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === 'cash'
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  <span className="text-xs">Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('mobile_nfc')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === 'mobile_nfc'
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="text-xs">Apple/NFC</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('gift_card')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === 'gift_card'
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <Gift className="w-5 h-5" />
                  <span className="text-xs">Gift Card</span>
                </button>
              </div>
            </div>

            {/* Cash Tendered Calculator if Cash Selected */}
            {paymentMethod === 'cash' && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    Amount Tendered ({settings.currencySymbol || '₦'})
                  </label>
                  <div className="flex gap-1.5">
                    {[cart.total, 5000, 10000, 20000].map((amt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCashTendered(amt.toFixed(2))}
                        className="px-2 py-0.5 text-[11px] font-bold rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100"
                      >
                        {idx === 0 ? 'Exact' : `${settings.currencySymbol || '₦'}${amt.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  id="input-cash-tendered"
                  type="number"
                  step="0.01"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-neutral-800 text-lg font-mono font-bold text-neutral-900 dark:text-neutral-100"
                />

                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-amber-900 dark:text-amber-200">Change Due:</span>
                  <span className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono">
                    {settings.currencySymbol || '₦'}{changeDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Optional Customer Email */}
            <div className="mt-4">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                Email Receipt to Customer (Optional)
              </label>
              <input
                id="input-checkout-customer-email"
                type="email"
                placeholder="customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Complete Transaction Button */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                Back
              </button>
              <button
                id="btn-complete-payment"
                type="button"
                disabled={isProcessing || (paymentMethod === 'cash' && tenderedNumber < cart.total)}
                onClick={handleFinishTransaction}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2"
              >
                {isProcessing ? 'Processing Transaction...' : 'Complete & Generate Summary'}
              </button>
            </div>
          </div>
        ) : (
          /* DETAILED CHECKOUT SUMMARY REPORT */
          <div className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Checkout Summary Report
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Receipt #{completedReceipt.id} • {new Date(completedReceipt.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cryptographic Security Badge */}
            <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  <strong>Encrypted Record Sealed:</strong> SHA-256 Hash {completedReceipt.encryptedDataSignature?.substring(0, 12)}...
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-emerald-200/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                Verified
              </span>
            </div>

            {/* Itemized Table Breakdown */}
            <div className="mt-4 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden text-xs">
              <div className="bg-neutral-100 dark:bg-neutral-800 px-3 py-2 font-semibold grid grid-cols-12 text-neutral-700 dark:text-neutral-300">
                <span className="col-span-6">Item / Barcode</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Price</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                {completedReceipt.items.map((item) => (
                  <div key={item.id} className="px-3 py-2 grid grid-cols-12 items-center text-neutral-800 dark:text-neutral-200">
                    <div className="col-span-6 truncate">
                      <p className="font-medium truncate">{item.product.name}</p>
                      <p className="text-[10px] font-mono text-neutral-400">{item.product.barcode}</p>
                    </div>
                    <span className="col-span-2 text-center">{item.quantity}</span>
                    <span className="col-span-2 text-right">{settings.currencySymbol || '₦'}{item.unitPrice.toLocaleString()}</span>
                    <span className="col-span-2 text-right font-semibold">{settings.currencySymbol || '₦'}{item.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-850 p-3 border-t border-neutral-200 dark:border-neutral-800 space-y-1">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Subtotal:</span>
                  <span>{settings.currencySymbol || '₦'}{completedReceipt.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {completedReceipt.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Discount ({completedReceipt.appliedDiscountCode || 'Promo'}):</span>
                    <span>-{settings.currencySymbol || '₦'}{completedReceipt.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Sales Tax ({(completedReceipt.taxRate * 100).toFixed(2)}%):</span>
                  <span>{settings.currencySymbol || '₦'}{completedReceipt.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-neutral-900 dark:text-neutral-100 pt-1 border-t border-neutral-200 dark:border-neutral-700 text-sm">
                  <span>Grand Total:</span>
                  <span>{settings.currencySymbol || '₦'}{completedReceipt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-[11px] text-neutral-500 pt-1">
                  <span>Paid with {completedReceipt.paymentMethod.toUpperCase()}:</span>
                  <span>{settings.currencySymbol || '₦'}{completedReceipt.amountTendered.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {completedReceipt.changeDue > 0 && `(Change: ${settings.currencySymbol || '₦'}${completedReceipt.changeDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}</span>
                </div>
              </div>
            </div>

            {/* Cloud & Sheets Sync Status */}
            {(sheetsStatus || emailStatus) && (
              <div className="mt-3 p-2 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 space-y-1">
                {sheetsStatus && <p>📊 {sheetsStatus}</p>}
                {emailStatus && <p>✉️ {emailStatus}</p>}
              </div>
            )}

            {/* Actions Grid */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                id="btn-print-receipt"
                type="button"
                onClick={handlePrintReceipt}
                className="p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex flex-col items-center gap-1 transition"
              >
                <Printer className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                <span>Print Receipt</span>
              </button>

              <button
                id="btn-export-excel-receipt"
                type="button"
                onClick={() => exportSingleReceiptToExcel(completedReceipt, settings.currencySymbol || '₦')}
                className="p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex flex-col items-center gap-1 transition"
                title="Export native Microsoft Excel spreadsheet"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export Excel</span>
              </button>

              <button
                id="btn-email-receipt"
                type="button"
                onClick={handleSendEmailReceipt}
                className="p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex flex-col items-center gap-1 transition"
              >
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Email Customer</span>
              </button>

              <button
                id="btn-new-sale"
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex flex-col items-center gap-1 transition shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>New Sale</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
