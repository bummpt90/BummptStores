import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Barcode,
  Edit2,
  Trash2,
  FileSpreadsheet,
  AlertTriangle,
  Printer,
  Check,
  RotateCw,
  TrendingUp,
  Sparkles,
  History,
  ArrowUpRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { Product, StoreSettings, RestockLog } from '../types';
import * as XLSX from 'xlsx';
import { IntroduceProductModal } from './IntroduceProductModal';
import { RestockModal } from './RestockModal';
import { RestockHistoryModal } from './RestockHistoryModal';
import { loadRestockLogs, addRestockLog } from '../services/storage';

interface InventoryManagerProps {
  products: Product[];
  onSaveProducts: (products: Product[]) => void;
  onSyncGoogleSheets: () => Promise<void>;
  googleSheetsConnected: boolean;
  settings: StoreSettings;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  products,
  onSaveProducts,
  onSyncGoogleSheets,
  googleSheetsConnected,
  settings,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'depleted' | 'low' | 'healthy' | 'new'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [printBarcodeProduct, setPrintBarcodeProduct] = useState<Product | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  // Modals
  const [isIntroduceModalOpen, setIsIntroduceModalOpen] = useState(false);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [isRestockHistoryOpen, setIsRestockHistoryOpen] = useState(false);
  const [restockLogs, setRestockLogs] = useState<RestockLog[]>([]);

  useEffect(() => {
    setRestockLogs(loadRestockLogs());
  }, []);

  // Quick categories
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  // Stock status counts
  const depletedProducts = products.filter((p) => p.stock <= 0);
  const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= p.minStockAlert);
  const healthyProducts = products.filter((p) => p.stock > p.minStockAlert);
  const newlyIntroducedProducts = products.filter((p) => {
    if (!p.introducedAt) return false;
    const diffHours = (Date.now() - new Date(p.introducedAt).getTime()) / (1000 * 3600);
    return diffHours <= 72; // Introduced in the last 3 days
  });

  // Filtered Products
  const filtered = products.filter((p) => {
    // Category match
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;

    // Search query match
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q);

    // Stock Status filter match
    let matchesStock = true;
    if (stockFilter === 'depleted') matchesStock = p.stock <= 0;
    else if (stockFilter === 'low') matchesStock = p.stock > 0 && p.stock <= p.minStockAlert;
    else if (stockFilter === 'healthy') matchesStock = p.stock > p.minStockAlert;
    else if (stockFilter === 'new') {
      matchesStock = Boolean(
        p.introducedAt &&
          (Date.now() - new Date(p.introducedAt).getTime()) / (1000 * 3600) <= 72
      );
    }

    return matchesCat && matchesSearch && matchesStock;
  });

  // Handle Introduction of a brand-new product
  const handleProductIntroduced = (newProduct: Product) => {
    const updated = [newProduct, ...products];
    onSaveProducts(updated);
    setFeedbackToast({
      type: 'success',
      text: `✨ Successfully introduced "${newProduct.name}" into store inventory!`,
    });
    setTimeout(() => setFeedbackToast(null), 4500);
  };

  // Handle Restocking a product (adds newly received inventory to old stock)
  const handleConfirmRestock = (
    productId: string,
    addedStock: number,
    details: {
      supplier?: string;
      batchNumber?: string;
      costPerUnit?: number;
      notes?: string;
    }
  ) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;

    const oldStock = target.stock;
    const newStock = oldStock + addedStock;

    // Create audit log
    const log: RestockLog = {
      id: 'rst-' + Date.now(),
      productId: target.id,
      productName: target.name,
      barcode: target.barcode,
      previousStock: oldStock,
      addedStock,
      newStock,
      restockedAt: new Date().toISOString(),
      restockedBy: settings.cashierName,
      supplier: details.supplier,
      batchNumber: details.batchNumber,
      costPerUnit: details.costPerUnit || target.costPrice,
      notes: details.notes,
    };

    addRestockLog(log);
    setRestockLogs((prev) => [log, ...prev]);

    // Update product stock and stats
    const updated = products.map((p) => {
      if (p.id === productId) {
        return {
          ...p,
          stock: newStock,
          costPrice: details.costPerUnit || p.costPrice,
          lastRestockedAt: new Date().toISOString(),
          timesRestocked: (p.timesRestocked || 0) + 1,
        };
      }
      return p;
    });

    onSaveProducts(updated);
    setFeedbackToast({
      type: 'success',
      text: `📦 Replenished "${target.name}": Added +${addedStock} to old stock (${oldStock} ➔ ${newStock} units)`,
    });
    setTimeout(() => setFeedbackToast(null), 5000);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Remove "${name}" from store inventory catalog?`)) {
      const updated = products.filter((p) => p.id !== id);
      onSaveProducts(updated);
      setFeedbackToast({ type: 'info', text: `Removed "${name}" from inventory.` });
      setTimeout(() => setFeedbackToast(null), 3000);
    }
  };

  // Export Inventory to Microsoft Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = products.map((p) => ({
      Barcode: p.barcode,
      'Product Name': p.name,
      Category: p.category,
      Unit: p.unit,
      [`Retail Price (${settings.currencySymbol || '₦'})`]: p.price,
      [`Cost Price (${settings.currencySymbol || '₦'})`]: p.costPrice,
      'Current Stock': p.stock,
      'Min Alert Level': p.minStockAlert,
      'Stock Status':
        p.stock <= 0
          ? 'DEPLETED (OUT OF STOCK)'
          : p.stock <= p.minStockAlert
          ? 'LOW STOCK'
          : 'HEALTHY',
      'Tax Classification': p.taxCategory,
      'Introduced Date': p.introducedAt ? new Date(p.introducedAt).toLocaleDateString() : 'Initial Stock',
      'Last Restocked': p.lastRestockedAt ? new Date(p.lastRestockedAt).toLocaleDateString() : 'N/A',
      'Times Restocked': p.timesRestocked || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'BummptStores Inventory');
    XLSX.writeFile(wb, `BummptStores_Inventory_Catalog_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Sync to Google Sheets
  const handleTriggerSheetsSync = async () => {
    setSyncStatus('Syncing inventory to Google Sheets...');
    try {
      await onSyncGoogleSheets();
      setSyncStatus('Inventory catalog synchronized with Google Sheets');
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (e: any) {
      setSyncStatus('Sync error: ' + (e.message || 'Check connection'));
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header & Core Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                BummptStores Inventory &amp; Stock Depletion
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Real-time stock depletion upon sales, replenishment restock to old stock, and new product introductions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Restock History Audit Button */}
          <button
            id="btn-restock-history"
            onClick={() => setIsRestockHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition"
            title="View audit logs of past restocks added to old stock"
          >
            <History className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            <span>Restock History ({restockLogs.length})</span>
          </button>

          {/* Export to Excel */}
          <button
            id="btn-inventory-export-excel"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition"
            title="Download universal Microsoft Excel workbook"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          {/* Sync to Google Sheets */}
          {googleSheetsConnected && (
            <button
              id="btn-inventory-sync-sheets"
              onClick={handleTriggerSheetsSync}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 transition"
            >
              <RotateCw className="w-4 h-4" />
              <span>Sync Sheets</span>
            </button>
          )}

          {/* Introduce Brand-New Product Button (Highlighted) */}
          <button
            id="btn-introduce-product"
            onClick={() => setIsIntroduceModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold transition shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Introduce New Product</span>
          </button>
        </div>
      </div>

      {/* Depletion Notice & Alert Banner */}
      {(depletedProducts.length > 0 || lowStockProducts.length > 0) && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Stock Depletion Notice ({depletedProducts.length} Depleted, {lowStockProducts.length} Low Stock)
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                When items are sold at checkout, stock depletes in real time. Use the{' '}
                <span className="font-semibold underline">+ Restock</span> button on any depleted product to add incoming inventory units to old stock.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {depletedProducts.length > 0 && (
              <button
                onClick={() => setStockFilter('depleted')}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition"
              >
                View {depletedProducts.length} Depleted Items
              </button>
            )}
            {lowStockProducts.length > 0 && (
              <button
                onClick={() => setStockFilter('low')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition"
              >
                View Low Stock ({lowStockProducts.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive Toast Alerts */}
      {feedbackToast && (
        <div
          className={`p-3 text-xs rounded-xl flex items-center gap-2 border animate-fade-in ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{feedbackToast.text}</span>
        </div>
      )}

      {syncStatus && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* Stock Status Quick Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setStockFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            stockFilter === 'all'
              ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
              : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
          }`}
        >
          All Items ({products.length})
        </button>

        <button
          onClick={() => setStockFilter('depleted')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            stockFilter === 'depleted'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Depleted / Out of Stock ({depletedProducts.length})</span>
        </button>

        <button
          onClick={() => setStockFilter('low')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            stockFilter === 'low'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
          }`}
        >
          <span>Low Stock ({lowStockProducts.length})</span>
        </button>

        <button
          onClick={() => setStockFilter('healthy')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            stockFilter === 'healthy'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
          }`}
        >
          Healthy Stock ({healthyProducts.length})
        </button>

        {newlyIntroducedProducts.length > 0 && (
          <button
            onClick={() => setStockFilter('new')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              stockFilter === 'new'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Newly Introduced ({newlyIntroducedProducts.length})</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search inventory by product name or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Item &amp; Barcode</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4 text-right">Retail Price</th>
                <th className="py-3.5 px-4 text-right">Cost</th>
                <th className="py-3.5 px-4 text-center">Stock Level (Live)</th>
                <th className="py-3.5 px-4 text-center">Restock Info</th>
                <th className="py-3.5 px-4 text-right">Actions &amp; Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <p className="text-sm font-semibold">No products found matching filters.</p>
                    <button
                      onClick={() => setIsIntroduceModalOpen(true)}
                      className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      Introduce New Product
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((prod) => {
                  const isDepleted = prod.stock <= 0;
                  const isLow = prod.stock > 0 && prod.stock <= prod.minStockAlert;
                  const isNew = Boolean(
                    prod.introducedAt &&
                      (Date.now() - new Date(prod.introducedAt).getTime()) / (1000 * 3600) <= 72
                  );

                  return (
                    <tr
                      key={prod.id}
                      className={`transition-colors ${
                        isDepleted
                          ? 'bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50/70 dark:hover:bg-red-950/30'
                          : isLow
                          ? 'bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50/60 dark:hover:bg-amber-950/20'
                          : 'hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      {/* Product Name & Barcode */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl shrink-0">{prod.icon || '📦'}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                                {prod.name}
                              </span>
                              {isNew && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  New
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-400 mt-0.5">
                              <Barcode className="w-3.5 h-3.5" />
                              <span>{prod.barcode}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px]">
                          {prod.category}
                        </span>
                      </td>

                      {/* Retail Price */}
                      <td className="py-3 px-4 text-right font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                        {settings.currencySymbol || '₦'}{prod.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-[10px] font-normal text-neutral-400">/{prod.unit}</span>
                      </td>

                      {/* Cost Price */}
                      <td className="py-3 px-4 text-right text-neutral-500 font-mono">
                        {settings.currencySymbol || '₦'}{prod.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Stock Level (Depleted, Low, or Healthy) */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                              isDepleted
                                ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 animate-pulse'
                                : isLow
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {isDepleted ? (
                              <>
                                <AlertTriangle className="w-3 h-3" />
                                Depleted (0)
                              </>
                            ) : isLow ? (
                              <>
                                <AlertTriangle className="w-3 h-3" />
                                {prod.stock} left (Low)
                              </>
                            ) : (
                              <>{prod.stock} in stock</>
                            )}
                          </span>
                          <span className="text-[10px] text-neutral-400 mt-0.5">
                            Min Alert: {prod.minStockAlert}
                          </span>
                        </div>
                      </td>

                      {/* Restock info */}
                      <td className="py-3 px-4 text-center text-[11px] text-neutral-500">
                        {prod.timesRestocked && prod.timesRestocked > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                            Restocked {prod.timesRestocked}x
                          </span>
                        ) : (
                          <span className="text-neutral-400">Original stock</span>
                        )}
                      </td>

                      {/* Actions with Highlighted "+ Restock" */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Dedicated Restock Action Button */}
                          <button
                            id={`btn-restock-${prod.id}`}
                            onClick={() => setRestockingProduct(prod)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                              isDepleted
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-300 dark:border-emerald-800'
                            }`}
                            title="Restock this product and add incoming quantity to old stock"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>+ Restock</span>
                          </button>

                          {/* Print Barcode */}
                          <button
                            onClick={() => setPrintBarcodeProduct(prod)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                            title="Print barcode label"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => setEditingProduct(prod)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                            title="Edit product details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(prod.id, prod.name)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 transition"
                            title="Delete product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Introduce New Product Modal */}
      <IntroduceProductModal
        isOpen={isIntroduceModalOpen}
        onClose={() => setIsIntroduceModalOpen(false)}
        onProductIntroduced={handleProductIntroduced}
        source="inventory"
        currencySymbol={settings.currencySymbol}
      />

      {/* Modal 2: Restock & Add to Old Stock Modal */}
      <RestockModal
        isOpen={Boolean(restockingProduct)}
        product={restockingProduct}
        onClose={() => setRestockingProduct(null)}
        onConfirmRestock={handleConfirmRestock}
        cashierName={settings.cashierName}
        currencySymbol={settings.currencySymbol}
      />

      {/* Modal 3: Restock History Audit Modal */}
      <RestockHistoryModal
        isOpen={isRestockHistoryOpen}
        onClose={() => setIsRestockHistoryOpen(false)}
        logs={restockLogs}
        currencySymbol={settings.currencySymbol}
      />

      {/* Modal 4: Edit Existing Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Edit Product Details: {editingProduct.name}
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const updated = products.map((p) =>
                  p.id === editingProduct.id ? editingProduct : p
                );
                onSaveProducts(updated);
                setEditingProduct(null);
                setFeedbackToast({ type: 'success', text: `Saved changes to ${editingProduct.name}.` });
                setTimeout(() => setFeedbackToast(null), 3500);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, name: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Barcode (UPC / EAN) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.barcode}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, barcode: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 font-mono text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editingProduct.category}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, category: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Retail Price ({settings.currencySymbol || '₦'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingProduct.price}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Cost Price ({settings.currencySymbol || '₦'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct.costPrice}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        costPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingProduct.stock}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        stock: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Min Stock Alert Level
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingProduct.minStockAlert}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        minStockAlert: parseInt(e.target.value) || 5,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Tax Category
                  </label>
                  <select
                    value={editingProduct.taxCategory}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        taxCategory: e.target.value as any,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="standard">Standard Tax</option>
                    <option value="grocery_exempt">Grocery Exempt</option>
                    <option value="reduced">Reduced Rate</option>
                    <option value="zero">Zero Tax</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Print Barcode Label Modal */}
      {printBarcodeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl max-w-sm w-full text-center space-y-4">
            <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
              BummptStores Barcode Shelf Label
            </h3>
            <div className="p-5 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl bg-white text-neutral-900">
              <p className="font-bold text-sm uppercase">{printBarcodeProduct.name}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{printBarcodeProduct.category}</p>

              {/* Barcode Visual Bars */}
              <div className="my-4 flex justify-center items-center gap-[2px] h-14">
                {printBarcodeProduct.barcode.split('').map((char, idx) => (
                  <div
                    key={idx}
                    className={`h-full bg-black ${
                      parseInt(char, 10) % 2 === 0 ? 'w-[3px]' : 'w-[1.5px]'
                    }`}
                  />
                ))}
              </div>

              <p className="font-mono text-base font-bold tracking-widest">
                {printBarcodeProduct.barcode}
              </p>
              <p className="text-lg font-black text-emerald-600 mt-2">
                {settings.currencySymbol || '₦'}{printBarcodeProduct.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-neutral-400 mt-1 font-mono">
                Stock: {printBarcodeProduct.stock} {printBarcodeProduct.unit}s
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPrintBarcodeProduct(null)}
                className="w-1/2 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="w-1/2 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Label</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
