import React, { useState } from 'react';
import {
  History,
  X,
  Search,
  FileSpreadsheet,
  TrendingUp,
  Package,
  Calendar,
  User,
  Barcode,
} from 'lucide-react';
import { RestockLog } from '../types';
import * as XLSX from 'xlsx';

interface RestockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: RestockLog[];
  currencySymbol?: string;
}

export const RestockHistoryModal: React.FC<RestockHistoryModalProps> = ({
  isOpen,
  onClose,
  logs,
  currencySymbol = '₦',
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      log.productName.toLowerCase().includes(q) ||
      log.barcode.includes(q) ||
      (log.supplier && log.supplier.toLowerCase().includes(q)) ||
      (log.batchNumber && log.batchNumber.toLowerCase().includes(q))
    );
  });

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = logs.map((log) => ({
      'Restock Date': new Date(log.restockedAt).toLocaleString(),
      'Product Name': log.productName,
      Barcode: log.barcode,
      'Old Stock (Before)': log.previousStock,
      'Quantity Added (+Units)': log.addedStock,
      'New Total Stock': log.newStock,
      'Restocked By': log.restockedBy,
      Supplier: log.supplier || 'N/A',
      'Batch Number': log.batchNumber || 'N/A',
      [`Unit Cost (${currencySymbol})`]: log.costPerUnit != null ? `${currencySymbol}${log.costPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A',
      Notes: log.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Restock Replenishment Audit');
    XLSX.writeFile(wb, `BummptStores_Restock_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const totalReplenishedUnits = logs.reduce((sum, l) => sum + l.addedStock, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-4xl rounded-2xl p-5 sm:p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 mb-1">
              <History className="w-3.5 h-3.5 text-emerald-600" />
              Inventory Replenishment Audit Log
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
              Restock History &amp; Depletion Replenishment
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Historical ledger of depleted products being restocked and added to existing old stock.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Stats & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
              <span className="text-neutral-500">Restock Events: </span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">{logs.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
              <span className="text-emerald-700 dark:text-emerald-300">Total Units Replenished: </span>
              <span className="font-bold text-emerald-800 dark:text-emerald-200 font-mono">
                +{totalReplenishedUnits}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search restock logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 font-semibold text-neutral-600 dark:text-neutral-400">
              <tr>
                <th className="py-2.5 px-3">Date &amp; Time</th>
                <th className="py-2.5 px-3">Product &amp; Barcode</th>
                <th className="py-2.5 px-3 text-center">Old Stock</th>
                <th className="py-2.5 px-3 text-center">Added Stock</th>
                <th className="py-2.5 px-3 text-center">New Total</th>
                <th className="py-2.5 px-3">Staff</th>
                <th className="py-2.5 px-3">Batch / Supplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400 text-xs">
                    No restock history records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap text-neutral-500 font-mono text-[11px]">
                      {new Date(log.restockedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {log.productName}
                      </div>
                      <div className="font-mono text-[10px] text-neutral-400">
                        {log.barcode}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-neutral-500">
                      {log.previousStock}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{log.addedStock}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-neutral-900 dark:text-neutral-100">
                      {log.newStock}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400 text-[11px]">
                      {log.restockedBy}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500 text-[11px]">
                      {log.batchNumber && (
                        <span className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded-sm mr-1">
                          {log.batchNumber}
                        </span>
                      )}
                      <span>{log.supplier || 'Direct'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-neutral-200 dark:border-neutral-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
