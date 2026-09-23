import React, { useState } from 'react';
import {
  Settings,
  Percent,
  Tag,
  Mail,
  Shield,
  FileSpreadsheet,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Lock,
  Download,
  Upload,
} from 'lucide-react';
import { StoreSettings, DiscountCode } from '../types';
import { StaffManager } from './StaffManager';

interface AdminSettingsProps {
  settings: StoreSettings;
  onSaveSettings: (settings: StoreSettings) => void;
  discountCodes: DiscountCode[];
  onSaveDiscountCodes: (codes: DiscountCode[]) => void;
  googleSheetsConnected: boolean;
  onGoogleSignIn: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings,
  onSaveSettings,
  discountCodes,
  onSaveDiscountCodes,
  googleSheetsConnected,
  onGoogleSignIn,
}) => {
  const [formData, setFormData] = useState<StoreSettings>({ ...settings });
  const [newPromo, setNewPromo] = useState<Partial<DiscountCode>>({
    code: '',
    type: 'percentage',
    value: 10,
    minSpend: 25,
    description: '',
    isActive: true,
  });
  const [saveAlert, setSaveAlert] = useState<string | null>(null);

  const handleSaveAllSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSaveAlert('All store, tax, and automated email settings saved successfully.');
    setTimeout(() => setSaveAlert(null), 4000);
  };

  const handleAddDiscountCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.code || !newPromo.value) {
      alert('Code and value required');
      return;
    }
    const cleanCode = newPromo.code.trim().toUpperCase();
    if (discountCodes.some((d) => d.code === cleanCode)) {
      alert('A discount code with this name already exists');
      return;
    }
    const created: DiscountCode = {
      code: cleanCode,
      type: newPromo.type || 'percentage',
      value: Number(newPromo.value),
      minSpend: Number(newPromo.minSpend || 0),
      description: newPromo.description || `${newPromo.value}% discount`,
      isActive: true,
    };
    const updated = [created, ...discountCodes];
    onSaveDiscountCodes(updated);
    setNewPromo({
      code: '',
      type: 'percentage',
      value: 10,
      minSpend: 20,
      description: '',
      isActive: true,
    });
  };

  const togglePromoActive = (code: string) => {
    const updated = discountCodes.map((d) =>
      d.code === code ? { ...d, isActive: !d.isActive } : d
    );
    onSaveDiscountCodes(updated);
  };

  const deletePromo = (code: string) => {
    if (confirm(`Delete promotional code "${code}"?`)) {
      onSaveDiscountCodes(discountCodes.filter((d) => d.code !== code));
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" />
            Administrator Control Center
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configure sales tax calculations, discount codes, email automation, security keys, and universal spreadsheet integrations.
          </p>
        </div>
      </div>

      {saveAlert && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveAlert}</span>
        </div>
      )}

      <form onSubmit={handleSaveAllSettings} className="space-y-6">
        {/* Section 1: Store & Terminal Identity */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide flex items-center gap-2">
            Store & Terminal Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">Store Name</label>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">Currency Symbol</label>
              <input
                type="text"
                value={formData.currencySymbol || '₦'}
                onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                placeholder="₦"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold"
              />
            </div>
            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">Terminal ID</label>
              <input
                type="text"
                value={formData.terminalId}
                onChange={(e) => setFormData({ ...formData, terminalId: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">Default Cashier Name</label>
              <input
                type="text"
                value={formData.cashierName}
                onChange={(e) => setFormData({ ...formData, cashierName: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Tax Calculation Engine */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide flex items-center gap-2">
            <Percent className="w-4 h-4 text-purple-600" />
            Tax Calculation Parameters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                Standard Sales Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="30"
                value={(formData.taxRateStandard * 100).toFixed(2)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    taxRateStandard: parseFloat(e.target.value) / 100 || 0,
                  })
                }
                className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 font-mono text-neutral-900 dark:text-neutral-100"
              />
              <span className="text-[10px] text-neutral-400">Default applied to general merchandise</span>
            </div>

            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                Reduced Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="30"
                value={(formData.taxRateReduced * 100).toFixed(2)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    taxRateReduced: parseFloat(e.target.value) / 100 || 0,
                  })
                }
                className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 font-mono text-neutral-900 dark:text-neutral-100"
              />
              <span className="text-[10px] text-neutral-400">Special reduced tax classifications</span>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.enableGroceryTaxExemption}
                  onChange={(e) =>
                    setFormData({ ...formData, enableGroceryTaxExemption: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Grocery Tax Exemption
                </span>
              </label>
              <span className="text-[11px] text-neutral-400 mt-1">
                Zero tax on qualified staple foods (dairy, produce, bread, eggs)
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Automated Email Reporting */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            Automated Sales Email Reporting
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                Recipient Email Address
              </label>
              <input
                type="email"
                value={formData.managerEmail}
                onChange={(e) => setFormData({ ...formData, managerEmail: e.target.value })}
                placeholder="store-manager@superstore.com"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                Automated Digest Frequency
              </label>
              <select
                value={formData.emailReportFrequency}
                onChange={(e) =>
                  setFormData({ ...formData, emailReportFrequency: e.target.value as any })
                }
                className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="daily">Daily End-of-Day (EOD) Digest</option>
                <option value="weekly">Weekly Summary Digest</option>
                <option value="monthly">Monthly Executive Review</option>
              </select>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.autoEmailReports}
                  onChange={(e) => setFormData({ ...formData, autoEmailReports: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Enable Automated Emailing
                </span>
              </label>
              <span className="text-[11px] text-neutral-400 mt-1">
                Dispatches automated performance digest for all processed transactions
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Data Encryption & Security */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            Security & AES-256 Data Encryption
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col justify-center p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.encryptionEnabled}
                  onChange={(e) => setFormData({ ...formData, encryptionEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Enable Client-Side AES-256-GCM Encryption
                </span>
              </label>
              <span className="text-[11px] text-neutral-400 mt-1">
                Secures customer payment data and digital receipt records before persistence.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200 block mb-1">
                Receipt Integrity Hash
              </span>
              <p className="text-[11px] text-neutral-400">
                Every digital checkout generates a SHA-256 tamper-evident cryptographic seal for accounting and fraud prevention.
              </p>
            </div>
          </div>
        </div>

        {/* Section 5: Cross-Platform Universal Spreadsheets (Excel & Google Sheets) */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Universal Spreadsheet Compatibility
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-neutral-100">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Microsoft Excel (.xlsx) Universal Support
              </div>
              <p className="text-neutral-500 text-[11px]">
                Fully native Microsoft Excel workbooks are generated with multi-tab architectures: Sales Receipts, Itemized Purchases, Inventory, and KPI Summaries.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  Google Sheets Integration
                </span>
                {googleSheetsConnected ? (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                    Connected
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    Connect with Google
                  </button>
                )}
              </div>
              <p className="text-neutral-500 text-[11px]">
                Syncs real-time checkout receipts and inventory directly into cloud-accessible Google Sheets spreadsheets.
              </p>
            </div>
          </div>
        </div>

        {/* Save Settings Submit Button */}
        <div className="flex justify-end">
          <button
            id="btn-save-admin-settings"
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition"
          >
            Save Admin Settings
          </button>
        </div>
      </form>

      {/* Section 5.5: Staff Accounts & Anti-Manipulation Access Control */}
      <StaffManager />

      {/* Section 6: Discount Codes Management */}
      <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide flex items-center gap-2">
          <Tag className="w-4 h-4 text-amber-500" />
          Discount Code Promotions Management
        </h3>

        {/* Add New Promo Code Form */}
        <form
          onSubmit={handleAddDiscountCode}
          className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 text-xs"
        >
          <div>
            <label className="font-semibold text-neutral-600 dark:text-neutral-400">Code</label>
            <input
              type="text"
              placeholder="e.g. FLASH25"
              value={newPromo.code}
              onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value })}
              className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 uppercase font-mono"
            />
          </div>
          <div>
            <label className="font-semibold text-neutral-600 dark:text-neutral-400">Type</label>
            <select
              value={newPromo.type}
              onChange={(e) => setNewPromo({ ...newPromo, type: e.target.value as any })}
              className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed ({formData.currencySymbol || '₦'})</option>
            </select>
          </div>
          <div>
            <label className="font-semibold text-neutral-600 dark:text-neutral-400">Discount Value</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              placeholder="Value"
              value={newPromo.value}
              onChange={(e) => setNewPromo({ ...newPromo, value: parseFloat(e.target.value) || 0 })}
              className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono"
            />
          </div>
          <div>
            <label className="font-semibold text-neutral-600 dark:text-neutral-400">Min Spend ({formData.currencySymbol || '₦'})</label>
            <input
              type="number"
              min="0"
              placeholder="0.00"
              value={newPromo.minSpend}
              onChange={(e) => setNewPromo({ ...newPromo, minSpend: parseFloat(e.target.value) || 0 })}
              className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Code</span>
            </button>
          </div>
        </form>

        {/* Existing Promo Codes List */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800 text-neutral-400 font-semibold uppercase">
                <th className="pb-2">Code</th>
                <th className="pb-2">Type & Value</th>
                <th className="pb-2">Min Spend</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {discountCodes.map((dc) => (
                <tr key={dc.code} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                  <td className="py-2 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    {dc.code}
                  </td>
                  <td className="py-2 text-neutral-700 dark:text-neutral-300 font-semibold">
                    {dc.type === 'percentage'
                      ? `${dc.value}% OFF`
                      : `${formData.currencySymbol || '₦'}${dc.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} OFF`}
                  </td>
                  <td className="py-2 text-neutral-500 font-mono">
                    {formData.currencySymbol || '₦'}{dc.minSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => togglePromoActive(dc.code)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        dc.isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                      }`}
                    >
                      {dc.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => deletePromo(dc.code)}
                      className="text-neutral-400 hover:text-red-600 p-1"
                      title="Delete code"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
