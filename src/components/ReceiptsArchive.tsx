import React, { useState } from 'react';
import {
  ReceiptText,
  Search,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  Eye,
  Calendar,
  Lock,
  Download,
  Filter,
} from 'lucide-react';
import { Receipt, StoreSettings, Product } from '../types';
import { exportSalesToExcel, exportSingleReceiptToExcel } from '../services/excelExport';
import { generateCustomerReceiptHtml } from '../services/emailReport';

interface ReceiptsArchiveProps {
  receipts: Receipt[];
  products: Product[];
  settings: StoreSettings;
  onViewReceipt?: (receipt: Receipt) => void;
}

export const ReceiptsArchive: React.FC<ReceiptsArchiveProps> = ({
  receipts,
  products,
  settings,
}) => {
  const sym = settings.currencySymbol || '₦';
  const [search, setSearch] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [filterMethod, setFilterMethod] = useState<string>('all');

  const filtered = receipts.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.id.toLowerCase().includes(q) ||
      (r.customer.name && r.customer.name.toLowerCase().includes(q)) ||
      r.cashier.toLowerCase().includes(q);

    const matchesMethod = filterMethod === 'all' || r.paymentMethod === filterMethod;
    return matchesSearch && matchesMethod;
  });

  const handleExportAllToExcel = () => {
    exportSalesToExcel(
      receipts,
      products,
      `BummptStores_Digital_Receipts_Master_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sym
    );
  };

  const handlePrint = (receipt: Receipt) => {
    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (printWindow) {
      printWindow.document.write(generateCustomerReceiptHtml(receipt, settings));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-emerald-600" />
            Digital Receipts Archive
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Encrypted purchase ledger with universal Microsoft Excel export.
          </p>
        </div>

        <button
          id="btn-export-all-excel"
          onClick={handleExportAllToExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export All to Microsoft Excel (.xlsx)</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by receipt ID (e.g. REC-2026-0001) or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-300"
        >
          <option value="all">All Payment Methods</option>
          <option value="card">Card Only</option>
          <option value="cash">Cash Only</option>
          <option value="mobile_nfc">Apple/NFC Only</option>
        </select>
      </div>

      {/* Receipts Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Receipt ID</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4 text-center">Items</th>
                <th className="py-3.5 px-4 text-right">Subtotal</th>
                <th className="py-3.5 px-4 text-right">Tax</th>
                <th className="py-3.5 px-4 text-right">Total Paid</th>
                <th className="py-3.5 px-4 text-center">Payment</th>
                <th className="py-3.5 px-4 text-center">Integrity Hash</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    {r.id}
                  </td>
                  <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-medium text-neutral-800 dark:text-neutral-200">
                    {r.customer.name || 'Walk-in Guest'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 font-semibold">
                      {r.items.reduce((acc, i) => acc + i.quantity, 0)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">
                    {sym}{r.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400">
                    {sym}{r.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    {sym}{r.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {r.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                      <ShieldCheck className="w-3 h-3" />
                      {r.encryptedDataSignature?.substring(0, 8)}...
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedReceipt(r)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                        title="View Detailed Summary"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrint(r)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                        title="Print Receipt"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => exportSingleReceiptToExcel(r, sym)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                        title="Download Microsoft Excel Receipt (.xlsx)"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Selected Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-neutral-900 max-w-md w-full rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3 dark:border-neutral-800">
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                Digital Receipt #{selectedReceipt.id}
              </h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1 text-neutral-600 dark:text-neutral-400">
              <p><strong>Date:</strong> {new Date(selectedReceipt.timestamp).toLocaleString()}</p>
              <p><strong>Customer:</strong> {selectedReceipt.customer.name || 'Walk-in'}</p>
              <p><strong>Cashier:</strong> {selectedReceipt.cashier} ({selectedReceipt.terminalId})</p>
              <p><strong>Security Signature:</strong> <span className="font-mono text-emerald-600">{selectedReceipt.encryptedDataSignature}</span></p>
            </div>

            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 max-h-44 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {selectedReceipt.items.map((i) => (
                <div key={i.id} className="py-1.5 flex justify-between">
                  <div>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{i.product.name}</span>
                    <span className="text-[10px] text-neutral-400 block font-mono">{i.product.barcode} • {i.quantity}x {sym}{i.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">{sym}{i.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>

            <div className="text-xs space-y-1 pt-2 border-t dark:border-neutral-800">
              <div className="flex justify-between"><span>Subtotal:</span><span>{sym}{selectedReceipt.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              {selectedReceipt.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600"><span>Discount:</span><span>-{sym}{selectedReceipt.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              )}
              <div className="flex justify-between"><span>Tax:</span><span>{sym}{selectedReceipt.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between font-bold text-sm text-neutral-900 dark:text-neutral-100 pt-1">
                <span>Total:</span><span>{sym}{selectedReceipt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handlePrint(selectedReceipt)}
                className="w-1/2 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg font-medium text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={() => exportSingleReceiptToExcel(selectedReceipt, sym)}
                className="w-1/2 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center justify-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel .xlsx</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
