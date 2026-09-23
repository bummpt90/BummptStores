import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Package,
  Barcode,
  X,
  Check,
  AlertTriangle,
  Layers,
  Truck,
  Plus,
} from 'lucide-react';
import { Product } from '../types';

interface RestockModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onConfirmRestock: (
    productId: string,
    addedStock: number,
    details: {
      supplier?: string;
      batchNumber?: string;
      costPerUnit?: number;
      notes?: string;
    }
  ) => void;
  cashierName: string;
  currencySymbol?: string;
}

export const RestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  product,
  onClose,
  onConfirmRestock,
  cashierName,
  currencySymbol = '₦',
}) => {
  const [addedStock, setAddedStock] = useState<number>(25);
  const [supplier, setSupplier] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [unitCost, setUnitCost] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (product) {
      // Default restock suggestion based on minStockAlert
      const suggested = Math.max(10, (product.minStockAlert || 5) * 3);
      setAddedStock(suggested);
      setSupplier('');
      setBatchNumber('LOT-' + Math.floor(1000 + Math.random() * 9000));
      setUnitCost(product.costPrice ? product.costPrice.toFixed(2) : '');
      setNotes('');
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const oldStock = product.stock;
  const newStock = oldStock + (addedStock > 0 ? addedStock : 0);
  const isDepleted = oldStock <= 0;
  const isLowStock = oldStock <= product.minStockAlert && !isDepleted;

  const handleQuickAdd = (qty: number) => {
    setAddedStock((prev) => Math.max(1, prev + qty));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (addedStock <= 0) {
      alert('Please enter a positive restock quantity to add to old stock.');
      return;
    }

    onConfirmRestock(product.id, addedStock, {
      supplier: supplier.trim() || undefined,
      batchNumber: batchNumber.trim() || undefined,
      costPerUnit: unitCost ? parseFloat(unitCost) : undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-2xl p-5 sm:p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Inventory Replenishment
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
              Restock &amp; Replenish Product
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Add freshly received inventory units to existing old stock.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Identity Card */}
        <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-xs">
              {product.icon || '📦'}
            </span>
            <div>
              <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                {product.name}
              </h4>
              <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5 font-mono">
                <span className="flex items-center gap-1">
                  <Barcode className="w-3 h-3 text-neutral-400" />
                  {product.barcode}
                </span>
                <span>•</span>
                <span className="px-1.5 py-0.2 rounded-md bg-neutral-200 dark:bg-neutral-700 text-[10px]">
                  {product.category}
                </span>
              </div>
            </div>
          </div>

          {/* Current Stock Status Pill */}
          <div className="text-right shrink-0">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                isDepleted
                  ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800'
                  : isLowStock
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              {isDepleted ? (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  Depleted (0 units)
                </>
              ) : isLowStock ? (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  Low ({oldStock} left)
                </>
              ) : (
                <>{oldStock} in stock</>
              )}
            </span>
          </div>
        </div>

        {/* Calculation Visualizer Card */}
        <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50">
          <div className="grid grid-cols-3 text-center gap-2 items-center">
            <div>
              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                Old Stock
              </p>
              <p className="text-xl font-bold text-neutral-700 dark:text-neutral-300 font-mono mt-0.5">
                {oldStock}
              </p>
              <p className="text-[10px] text-neutral-400">on shelf / store</p>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                + Restock
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                +{addedStock}
              </span>
              <span className="text-[10px] text-emerald-600/80">incoming batch</span>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                New Total Stock
              </p>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                {newStock}
              </p>
              <p className="text-[10px] text-emerald-600/80">{product.unit}s available</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Restock Quantity Input & Quick Increment Chips */}
          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Restock Quantity to Add (+units) *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                required
                value={addedStock}
                onChange={(e) => setAddedStock(parseInt(e.target.value, 10) || 0)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-mono font-bold text-base focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex items-center gap-1.5">
                {[5, 10, 25, 50, 100].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleQuickAdd(num)}
                    className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 border border-neutral-200 dark:border-neutral-700 transition"
                  >
                    +{num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Logistics / Supplier / Lot Tracking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-neutral-400" />
                Supplier / Vendor (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Metro Wholesale Foods Inc."
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Batch / Delivery Ref #
              </label>
              <input
                type="text"
                placeholder="e.g. LOT-4910"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono"
              />
            </div>
          </div>

          {/* Unit Cost & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Restock Unit Cost ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={product.costPrice ? product.costPrice.toFixed(2) : '0.00'}
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Restock Note / Shelf Location
              </label>
              <input
                type="text"
                placeholder="e.g. Aisle 3 Refrigerator Bay"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] text-neutral-400">
              Staff: {cashierName}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Restock (+{addedStock})</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
