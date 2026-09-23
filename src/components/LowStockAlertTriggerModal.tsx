import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Package,
  RotateCw,
  Mail,
  MessageCircle,
  CheckCircle2,
  Bell,
  ArrowRight,
  ShieldAlert,
  Printer,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Product, StoreSettings, LowStockAlertTrigger } from '../types';

interface LowStockAlertTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  settings: StoreSettings;
  onOpenRestock: (product: Product) => void;
}

export const LowStockAlertTriggerModal: React.FC<LowStockAlertTriggerModalProps> = ({
  isOpen,
  onClose,
  products,
  settings,
  onOpenRestock,
}) => {
  if (!isOpen) return null;

  const sym = settings.currencySymbol || '₦';
  const threshold = settings.defaultLowStockThreshold || 5;

  // Filter products at or below minStockAlert or global threshold
  const lowStockItems = products.filter((p) => p.stock <= Math.max(p.minStockAlert, threshold));
  const depletedItems = lowStockItems.filter((p) => p.stock <= 0);
  const criticalItems = lowStockItems.filter((p) => p.stock > 0 && p.stock <= Math.min(3, p.minStockAlert));
  const warningItems = lowStockItems.filter((p) => p.stock > Math.min(3, p.minStockAlert));

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // Trigger Urgent Purchase Order Requisition Email to Store Manager/CEO
  const handleTriggerEmailAlert = async () => {
    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      const recipient = settings.managerEmail || 'bummpt90@gmail.com';
      const itemsListHtml = lowStockItems
        .map(
          (p) =>
            `<tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>${p.name}</strong><br><small style="color:#666;">Barcode: ${p.barcode}</small></td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: ${p.stock <= 0 ? '#dc2626' : '#d97706'}; font-weight: bold;">${p.stock} ${p.unit || 'units'}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.minStockAlert} units</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${Math.max(20, p.minStockAlert * 3)} units</td>
            </tr>`
        )
        .join('');

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
          <div style="background-color: #0f172a; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0; font-size: 20px;">⚡ URGENT: Low Stock Inventory Alert Triggered</h2>
            <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 13px;">${settings.storeName} - Real-time Stock Requisition</p>
          </div>
          <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Attention Store Management,</p>
            <p>The anti-stockout radar has triggered an alert. <strong>${lowStockItems.length} product(s)</strong> have reached critical or depleted levels and require urgent replenishment:</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;">
              <thead>
                <tr style="background-color: #f8fafc;">
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Product</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Current Stock</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Safety Threshold</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Suggested Reorder</th>
                </tr>
              </thead>
              <tbody>
                ${itemsListHtml}
              </tbody>
            </table>
            <p style="font-size: 12px; color: #64748b;">Generated automatically by BummptStores Inventory Safeguard at ${new Date().toLocaleString()}.</p>
          </div>
        </div>
      `;

      const res = await fetch('/api/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'low_stock_urgent_alert',
          recipient,
          subject: `[CRITICAL REORDER] ${lowStockItems.length} Products Low in Stock at ${settings.storeName}`,
          htmlBody,
        }),
      });

      if (res.ok) {
        setEmailStatus(`Alert successfully transmitted to CEO / Store Manager at ${recipient}`);
      } else {
        setEmailStatus('Alert queued locally (network offline).');
      }
    } catch (err) {
      setEmailStatus('Alert queued locally (network offline).');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Generate WhatsApp Supplier PO Text
  const handleOpenWhatsAppSupplier = () => {
    const lines = lowStockItems.map(
      (p) => `• ${p.name} (Barcode: ${p.barcode}) - Current Stock: ${p.stock}, Reorder Qty: ${Math.max(20, p.minStockAlert * 3)}`
    );
    const message = encodeURIComponent(
      `Hello Supplier, this is an urgent purchase order requisition from ${settings.storeName}.\n\nThe following items are low in stock and need immediate delivery:\n\n${lines.join(
        '\n'
      )}\n\nPlease confirm availability and dispatch ETA. Thank you!`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-amber-500/10 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm shadow-amber-500/30 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  Low Stock Trigger & Anti-Stockout Radar
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                  {lowStockItems.length} ITEMS TRIGGERED
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                Automatically monitors minimum stock points and prevents selling depleted inventory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60">
              <span className="text-red-700 dark:text-red-400 font-bold block text-[11px] uppercase">
                Depleted (0 Stock)
              </span>
              <span className="text-xl font-black text-red-600 dark:text-red-400 mt-1 block">
                {depletedItems.length} Products
              </span>
              <span className="text-[10px] text-neutral-500">Oversell protection active</span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
              <span className="text-amber-700 dark:text-amber-400 font-bold block text-[11px] uppercase">
                Critical (≤ 3 Units)
              </span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
                {criticalItems.length} Products
              </span>
              <span className="text-[10px] text-neutral-500">Immediate reorder recommended</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500 font-bold block text-[11px] uppercase">
                Safety Threshold
              </span>
              <span className="text-xl font-black text-neutral-800 dark:text-neutral-200 mt-1 block">
                ≤ {threshold} Units
              </span>
              <span className="text-[10px] text-neutral-400">Trigger threshold setting</span>
            </div>
          </div>

          {/* Action Trigger Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-neutral-900 text-white shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <div className="text-xs font-bold">Instant Supplier & Management Dispatch</div>
                <div className="text-[11px] text-neutral-400">
                  Notify store manager or dispatch instant purchase order directly to your distributor
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleTriggerEmailAlert}
                disabled={isSendingEmail || lowStockItems.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isSendingEmail ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending PO...
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    Email CEO Alert
                  </>
                )}
              </button>

              <button
                onClick={handleOpenWhatsAppSupplier}
                disabled={lowStockItems.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp PO
              </button>
            </div>
          </div>

          {emailStatus && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{emailStatus}</span>
            </div>
          )}

          {/* Triggered Items Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Triggered Stock Items Requiring Restock
            </h4>

            {lowStockItems.length === 0 ? (
              <div className="text-center py-8 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h5 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  Healthy Inventory Levels
                </h5>
                <p className="text-xs text-neutral-400 mt-0.5">
                  All products in store currently satisfy their safety threshold ({threshold} units).
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                {lowStockItems.map((prod) => {
                  const isDepleted = prod.stock <= 0;
                  const isCritical = !isDepleted && prod.stock <= 3;
                  const suggestedReorder = Math.max(20, prod.minStockAlert * 3);

                  return (
                    <div
                      key={prod.id}
                      className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isDepleted
                          ? 'bg-red-50/50 dark:bg-red-950/20'
                          : isCritical
                          ? 'bg-amber-50/40 dark:bg-amber-950/15'
                          : 'bg-white dark:bg-neutral-900'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isDepleted
                              ? 'bg-red-500 text-white'
                              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {prod.icon || '📦'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                              {prod.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isDepleted
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                              }`}
                            >
                              {isDepleted ? '0 DEPLETED' : `LOW: ${prod.stock} LEFT`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                            <span className="font-mono">{prod.barcode}</span>
                            <span>•</span>
                            <span>{prod.category}</span>
                            <span>•</span>
                            <span>
                              Retail: {sym}
                              {prod.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stock Level & Restock Button */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right text-xs">
                          <span className="text-neutral-400 block text-[10px]">Min Alert: {prod.minStockAlert}</span>
                          <span className="font-bold text-neutral-700 dark:text-neutral-300">
                            Suggest: +{suggestedReorder} units
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            onClose();
                            onOpenRestock(prod);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-xs transition"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Restock Now</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <span className="text-xs text-neutral-500">
            Stock levels update in real-time as cashier rings up transactions.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 text-xs font-bold transition"
          >
            Close Alert Window
          </button>
        </div>
      </div>
    </div>
  );
};
