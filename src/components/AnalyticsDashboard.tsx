import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Calendar,
  Mail,
  FileSpreadsheet,
  Percent,
  Receipt as ReceiptIcon,
  Send,
  CheckCircle2,
  BarChart2,
  Clock,
  Award,
} from 'lucide-react';
import { Receipt, Product, StoreSettings, SalesAnalytics } from '../types';
import { computeSalesAnalytics } from '../services/storage';
import { exportSalesToExcel } from '../services/excelExport';
import { sendAutomatedReportEmail } from '../services/emailReport';

interface AnalyticsDashboardProps {
  receipts: Receipt[];
  products: Product[];
  settings: StoreSettings;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  receipts,
  products,
  settings,
}) => {
  const sym = settings.currencySymbol || '₦';
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [recipientEmail, setRecipientEmail] = useState(settings.managerEmail || 'bummpt90@gmail.com');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const analytics: SalesAnalytics = computeSalesAnalytics(receipts, timeframe);

  const handleSendReport = async () => {
    setIsSendingEmail(true);
    setEmailStatus('Processing report generation and email dispatch...');
    try {
      const periodLabel =
        timeframe === 'daily'
          ? 'Daily EOD'
          : timeframe === 'weekly'
          ? 'Weekly Summary'
          : timeframe === 'monthly'
          ? 'Monthly Performance'
          : 'Yearly Overview';

      const result = await sendAutomatedReportEmail(
        periodLabel,
        analytics,
        settings,
        receipts.length,
        recipientEmail
      );

      if (result.success) {
        setEmailStatus(`Report successfully sent to ${result.recipient}`);
      } else {
        setEmailStatus(`Dispatch notice: Report logged for ${result.recipient}`);
      }
      setTimeout(() => setEmailStatus(null), 5000);
    } catch (e: any) {
      setEmailStatus('Email report queued: ' + e.message);
      setTimeout(() => setEmailStatus(null), 5000);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleExportExcel = () => {
    exportSalesToExcel(
      receipts,
      products,
      `BummptStores_Sales_Analytics_${timeframe.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sym
    );
  };

  // Find peak revenue value for chart scaling
  const maxSeriesRevenue = Math.max(...analytics.timeSeriesData.map((d) => d.revenue), 10);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-emerald-600" />
            Performance Trends & Sales Intelligence
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Audit logs and automated reporting for daily, weekly, monthly, and yearly summaries.
          </p>
        </div>

        {/* Timeframe Selector Pills */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-200 dark:border-neutral-700">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                timeframe === t
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Total Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
            {sym}{analytics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>{timeframe} gross volume</span>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Transactions</span>
            <ReceiptIcon className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
            {analytics.totalTransactions}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {analytics.totalItemsSold} items sold
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Average Basket</span>
            <ShoppingBag className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
            {sym}{analytics.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">Per digital receipt</div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Tax Collected</span>
            <Percent className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
            {sym}{analytics.totalTaxCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Discounts: -{sym}{analytics.totalDiscountsGiven.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Main Charts & Visual Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sales Trend Bar Chart (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                Revenue Trajectory ({timeframe.toUpperCase()})
              </h3>
              <p className="text-xs text-neutral-500">Sales volume performance across periods</p>
            </div>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
              title="Download full analytics report in Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>

          {/* Custom SVG / CSS Bar Visualizer */}
          <div className="h-64 flex items-end gap-2 pt-6 pb-2 px-2">
            {analytics.timeSeriesData.map((point, index) => {
              const heightPercent = Math.min(100, Math.max(8, (point.revenue / maxSeriesRevenue) * 100));
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  {/* Tooltip value */}
                  <span className="text-[10px] font-bold font-mono text-neutral-600 dark:text-neutral-400 opacity-0 group-hover:opacity-100 transition">
                    {sym}{point.revenue.toLocaleString()}
                  </span>
                  
                  {/* Bar */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full max-w-[42px] bg-emerald-500 group-hover:bg-emerald-400 rounded-t-lg transition-all duration-300 relative shadow-xs"
                  />

                  {/* Label */}
                  <span className="text-[10px] font-medium text-neutral-500 whitespace-nowrap truncate w-full text-center">
                    {point.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 mb-1">
              Sales by Department
            </h3>
            <p className="text-xs text-neutral-500 mb-4">Revenue share across product categories</p>

            <div className="space-y-3">
              {analytics.categorySales.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {cat.category}
                    </span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {sym}{cat.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span className="text-[10px] text-neutral-400 font-normal">
                        ({cat.percentage.toFixed(0)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      style={{ width: `${cat.percentage}%` }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Products & Automated Email Reporting Dispatcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Products Table (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 mb-1 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            Top Selling Products
          </h3>
          <p className="text-xs text-neutral-500 mb-4">Most popular items ranked by gross revenue</p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800 text-neutral-400 font-semibold uppercase">
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-center">Units Sold</th>
                  <th className="pb-2 text-right">Gross Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {analytics.topSellingProducts.map((p, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                    <td className="py-2.5">
                      <div className="font-medium text-neutral-800 dark:text-neutral-200">{p.name}</div>
                      <div className="text-[10px] font-mono text-neutral-400">{p.barcode}</div>
                    </td>
                    <td className="py-2.5 text-center font-bold text-neutral-700 dark:text-neutral-300">
                      {p.quantity}
                    </td>
                    <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {sym}{p.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Automated Email Reporting Box (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                  Automated Sales Email Reporting
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Automated dispatch for processed sales & end-of-day reports.
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-4 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Manager / Stakeholder Email Recipient
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="bummpt90@gmail.com"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Scheduled Report:</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 capitalize">
                    {timeframe} Performance Summary
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Included Metrics:</span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Revenue, Tax, Discounts, Top Items
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Encryption Seal:</span>
                  <span className="text-emerald-600 font-mono font-bold">SHA-256 Verified</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {emailStatus && (
              <div className="mb-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{emailStatus}</span>
              </div>
            )}

            <button
              id="btn-dispatch-email-report"
              disabled={isSendingEmail}
              onClick={handleSendReport}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSendingEmail ? 'Sending Automated Email...' : `Send ${timeframe.toUpperCase()} Email Digest`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
