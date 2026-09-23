import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Barcode,
  Package,
  DollarSign,
  Layers,
  X,
  Plus,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Product } from '../types';

interface IntroduceProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductIntroduced: (product: Product, addToCartImmediately?: boolean) => void;
  initialBarcode?: string;
  initialName?: string;
  source?: 'register' | 'inventory';
  currencySymbol?: string;
}

const DEFAULT_CATEGORIES = [
  'Pharmaceuticals',
  'Groceries',
  'Dairy & Eggs',
  'Produce',
  'Bakery',
  'Beverages',
  'Snacks & Confectionery',
  'Meat & Seafood',
  'Frozen Foods',
  'Personal Care',
  'Household & Cleaning',
  'Electronics & Hardware',
  'General Merchandise',
];

const EMOJI_OPTIONS = ['💊', '🩹', '🩺', '🌡️', '📦', '🍎', '🥛', '🍞', '🥤', '🥚', '🍫', '🥩', '🧀', '🧼', '🔋', '☕', '🧴', '🍯'];

export const IntroduceProductModal: React.FC<IntroduceProductModalProps> = ({
  isOpen,
  onClose,
  onProductIntroduced,
  initialBarcode = '',
  initialName = '',
  source = 'inventory',
  currencySymbol = '₦',
}) => {
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Pharmaceuticals');
  const [customCategory, setCustomCategory] = useState('');
  const [retailPrice, setRetailPrice] = useState<string>('2500');
  const [costPrice, setCostPrice] = useState<string>('1500');
  const [initialStock, setInitialStock] = useState<string>('24');
  const [minAlert, setMinAlert] = useState<string>('6');
  const [unit, setUnit] = useState('each');
  const [taxCategory, setTaxCategory] = useState<'standard' | 'grocery_exempt' | 'reduced' | 'zero'>('standard');
  const [description, setDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📦');
  const [autoAddCart, setAutoAddCart] = useState(source === 'register');

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      // If initialBarcode is provided, use it; otherwise generate a valid 12-digit UPC code
      if (initialBarcode && initialBarcode.trim()) {
        setBarcode(initialBarcode.trim());
      } else {
        generateRandomBarcode();
      }
      setAutoAddCart(source === 'register');
    }
  }, [isOpen, initialBarcode, initialName, source]);

  const generateRandomBarcode = () => {
    // Standard 12-digit UPC-A style barcode
    const randomSuffix = Math.floor(10000000000 + Math.random() * 90000000000).toString();
    setBarcode('0' + randomSuffix.slice(0, 11));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanBarcode = barcode.trim();

    if (!cleanName || !cleanBarcode) {
      alert('Product Name and Barcode are required');
      return;
    }

    const finalCategory = category === '__custom__' ? (customCategory.trim() || 'General') : category;
    const priceNum = Math.max(0.01, parseFloat(retailPrice) || 0.01);
    const costNum = Math.max(0, parseFloat(costPrice) || 0);
    const stockNum = Math.max(0, parseInt(initialStock, 10) || 0);
    const alertNum = Math.max(1, parseInt(minAlert, 10) || 5);

    const newProduct: Product = {
      id: 'prod-intro-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      barcode: cleanBarcode,
      category: finalCategory,
      price: Number(priceNum.toFixed(2)),
      costPrice: Number(costNum.toFixed(2)),
      stock: stockNum,
      minStockAlert: alertNum,
      unit,
      taxCategory,
      description: description.trim() || `Newly introduced product: ${cleanName}`,
      icon: selectedEmoji,
      introducedAt: new Date().toISOString(),
      lastRestockedAt: new Date().toISOString(),
      timesRestocked: 0,
    };

    onProductIntroduced(newProduct, autoAddCart);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-2xl p-5 sm:p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Store Introduction
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
              Introduce New Store Product
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Add a brand-new item not currently in store stock. Barcode &amp; initial stock are synced live.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Product Name */}
          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Product Title / Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g., Premium Roasted Hazelnut Butter 12oz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          {/* Barcode with Auto-Generate helper */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-neutral-500" />
                Barcode / UPC Code *
              </label>
              <button
                type="button"
                onClick={generateRandomBarcode}
                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Auto-Generate Code
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="e.g. 012345678905"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono text-sm tracking-wider focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Department / Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__custom__">+ Add Custom Department...</option>
              </select>
              {category === '__custom__' && (
                <input
                  type="text"
                  placeholder="Enter new category name..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full mt-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              )}
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Pricing Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="each">each (item)</option>
                <option value="lb">lb (pound)</option>
                <option value="kg">kg (kilogram)</option>
                <option value="pack">pack</option>
                <option value="box">box</option>
                <option value="carton">carton</option>
                <option value="gal">gallon</option>
                <option value="oz">oz</option>
              </select>
            </div>
          </div>

          {/* Pricing: Retail & Wholesale Cost */}
          <div className="grid grid-cols-2 gap-3 bg-neutral-50 dark:bg-neutral-800/60 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <div>
              <label className="block font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Retail Price ({currencySymbol}) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-neutral-400 font-mono text-xs">{currencySymbol}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Wholesale Cost ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-neutral-400 font-mono text-xs">{currencySymbol}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Stock Levels: Initial Introduced Stock & Low Stock Alert */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Initial Stock Count *
              </label>
              <input
                type="number"
                min="0"
                required
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono font-bold"
              />
              <span className="text-[10px] text-neutral-400">Available on shelves immediately</span>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Low Stock Alert Threshold
              </label>
              <input
                type="number"
                min="1"
                required
                value={minAlert}
                onChange={(e) => setMinAlert(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono"
              />
              <span className="text-[10px] text-neutral-400">Triggers restock alert</span>
            </div>
          </div>

          {/* Tax Classification & Icon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Tax Classification
              </label>
              <select
                value={taxCategory}
                onChange={(e) => setTaxCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="standard">Standard Tax Rate</option>
                <option value="grocery_exempt">Grocery Exempt (0% Tax)</option>
                <option value="reduced">Reduced Rate</option>
                <option value="zero">Zero Tax</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Visual Icon Badge
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition border ${
                      selectedEmoji === emoji
                        ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-500 shadow-xs'
                        : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional: Add to active receipt if on register floor */}
          {source === 'register' && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <input
                id="auto-add-cart-checkbox"
                type="checkbox"
                checked={autoAddCart}
                onChange={(e) => setAutoAddCart(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
              />
              <label htmlFor="auto-add-cart-checkbox" className="text-xs text-emerald-900 dark:text-emerald-200 font-semibold cursor-pointer">
                Add this new product directly to current active customer receipt
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
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
              <span>Introduce &amp; Save Product</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
