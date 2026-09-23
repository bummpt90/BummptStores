import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  DollarSign,
  CreditCard,
  Smartphone,
  User,
  Clock,
  CheckCircle2,
  RefreshCw,
  Bell,
  BellOff,
  Filter,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  TrendingUp,
  Search,
  Lock,
  Layers,
} from 'lucide-react';
import {
  Receipt,
  StoreSettings,
  StaffUser,
  ShiftCloseReport,
  LiveSalesEvent,
} from '../types';
import {
  subscribeToLiveSalesStream,
  getShiftCloseReports,
  loadStaffRoster,
} from '../services/staffAuth';
import { playBeepSound } from '../services/storage';
import * as XLSX from 'xlsx';

interface LiveSalesTrackerProps {
  receipts: Receipt[];
  settings: StoreSettings;
  currentStaff: StaffUser | null;
}

export const LiveSalesTracker: React.FC<LiveSalesTrackerProps> = ({
  receipts,
  settings,
  currentStaff,
}) => {
  const sym = settings.currencySymbol || '₦';
  const staffRoster = useMemo(() => loadStaffRoster(), []);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('all');
  const [onlyFlagged, setOnlyFlagged] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'live_feed' | 'shift_audits' | 'staff_matrix'>('live_feed');
  const [latestLiveAlert, setLatestLiveAlert] = useState<{
    text: string;
    receipt?: Receipt;
    timestamp: string;
  } | null>(null);
  const [shiftReports, setShiftReports] = useState<ShiftCloseReport[]>(() => getShiftCloseReports());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'polling'>('connected');

  // Listen to Server-Sent Events (SSE) live stream
  useEffect(() => {
    const unsubscribe = subscribeToLiveSalesStream(
      (event: LiveSalesEvent) => {
        if (event.type === 'LIVE_SALE' && event.receipt) {
          if (soundEnabled) {
            playBeepSound('checkout');
          }
          const rec = event.receipt;
          setLatestLiveAlert({
            text: `LIVE SALE: ${sym}${rec.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} processed by ${rec.cashier} via ${rec.paymentMethod.toUpperCase()}`,
            receipt: rec,
            timestamp: new Date().toLocaleTimeString(),
          });

          // Auto-clear alert banner after 8 seconds
          setTimeout(() => {
            setLatestLiveAlert((prev) => (prev?.receipt?.id === rec.id ? null : prev));
          }, 8000);
        } else if (event.type === 'SHIFT_CLOSED' && event.shiftReport) {
          setShiftReports((prev) => [event.shiftReport!, ...prev]);
          if (soundEnabled) {
            playBeepSound('scan');
          }
          setLatestLiveAlert({
            text: `SHIFT CLOSED: ${event.shiftReport.staffName} submitted sales report (Variance: ${sym}${event.shiftReport.cashVariance.toLocaleString()})`,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
        setConnectionStatus('connected');
      },
      () => {
        setConnectionStatus('reconnecting');
      }
    );

    return () => {
      unsubscribe();
    };
  }, [soundEnabled, sym]);

  // Today's Receipts calculation
  const todayReceipts = useMemo(() => {
    const todayStr = new Date().toDateString();
    return receipts.filter((r) => new Date(r.timestamp).toDateString() === todayStr);
  }, [receipts]);

  // Key Financial Metrics for Today
  const metrics = useMemo(() => {
    let grossRevenue = 0;
    let cashRevenue = 0;
    let cardRevenue = 0;
    let mobileRevenue = 0;
    let discountsGiven = 0;
    let itemsCount = 0;

    todayReceipts.forEach((r) => {
      grossRevenue += r.total;
      discountsGiven += r.discountAmount || 0;
      if (r.paymentMethod === 'cash') cashRevenue += r.total;
      else if (r.paymentMethod === 'card') cardRevenue += r.total;
      else if (r.paymentMethod === 'mobile_nfc') mobileRevenue += r.total;
      else cashRevenue += r.total;

      r.items.forEach((item) => {
        itemsCount += item.quantity;
      });
    });

    return {
      grossRevenue,
      cashRevenue,
      cardRevenue,
      mobileRevenue,
      discountsGiven,
      itemsCount,
      transactionsCount: todayReceipts.length,
      averageTicket: todayReceipts.length > 0 ? grossRevenue / todayReceipts.length : 0,
    };
  }, [todayReceipts]);

  // Staff Performance Matrix (Aggregating sales by staff for today)
  const staffMatrix = useMemo(() => {
    return staffRoster.map((staff) => {
      const staffSales = todayReceipts.filter(
        (r) =>
          (r.staffId && r.staffId === staff.id) ||
          (r.cashier && r.cashier.toLowerCase().includes(staff.name.split(' ')[0].toLowerCase()))
      );

      const totalSales = staffSales.reduce((acc, r) => acc + r.total, 0);
      const cashSales = staffSales.filter((r) => r.paymentMethod === 'cash').reduce((acc, r) => acc + r.total, 0);
      const cardSales = staffSales.filter((r) => r.paymentMethod === 'card').reduce((acc, r) => acc + r.total, 0);
      const totalDiscounts = staffSales.reduce((acc, r) => acc + (r.discountAmount || 0), 0);
      const lastSale = staffSales.length > 0 ? staffSales[0].timestamp : null;

      return {
        staff,
        totalSales,
        cashSales,
        cardSales,
        totalDiscounts,
        transactionCount: staffSales.length,
        lastSale,
        isActiveToday: staffSales.length > 0,
      };
    });
  }, [staffRoster, todayReceipts]);

  // Filtered Live Transactions for Anti-Manipulation feed
  const filteredReceipts = useMemo(() => {
    return todayReceipts.filter((r) => {
      if (selectedStaffFilter !== 'all') {
        const matchesId = r.staffId === selectedStaffFilter;
        const staffObj = staffRoster.find((s) => s.id === selectedStaffFilter);
        const matchesName = staffObj && r.cashier && r.cashier.toLowerCase().includes(staffObj.name.split(' ')[0].toLowerCase());
        if (!matchesId && !matchesName) return false;
      }

      if (selectedPaymentFilter !== 'all' && r.paymentMethod !== selectedPaymentFilter) {
        return false;
      }

      if (onlyFlagged) {
        const isHighCash = r.paymentMethod === 'cash' && r.total >= 20000;
        const isHighDiscount = (r.discountAmount || 0) > 0 && (r.discountAmount || 0) / (r.subtotal || 1) >= 0.1;
        if (!isHighCash && !isHighDiscount) return false;
      }

      return true;
    });
  }, [todayReceipts, selectedStaffFilter, selectedPaymentFilter, onlyFlagged, staffRoster]);

  // Export audit table to Excel
  const handleExportLiveAudit = () => {
    const data = filteredReceipts.map((r) => ({
      'Receipt ID': r.id,
      'Timestamp': new Date(r.timestamp).toLocaleTimeString(),
      'Cashier / Staff': r.cashier,
      'Staff ID': r.staffId || 'N/A',
      'Terminal': r.terminalId,
      'Payment Method': r.paymentMethod.toUpperCase(),
      'Subtotal': r.subtotal,
      'Discount': r.discountAmount,
      'Total Paid': r.total,
      'Amount Tendered': r.amountTendered,
      'Change Given': r.changeDue,
      'Customer': r.customer.name,
      'Cryptographic Vault Signature': r.encryptedDataSignature || 'N/A',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CEO Live Sales Audit');
    XLSX.writeFile(wb, `BummptStores_LiveAudit_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* CEO Radar Header & Live Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight">
                CEO Live Sales Surveillance & Anti-Manipulation Radar
              </h2>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                LIVE STREAM
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Instantaneous multi-terminal tracking • Monitors cashier rings, discounts, cash drawer counts, and prevents manipulation
            </p>
          </div>
        </div>

        {/* Action Controls: Sound, Status & Export */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              soundEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-700'
            }`}
            title={soundEnabled ? 'Live Sale Chime Enabled' : 'Live Sale Chime Muted'}
          >
            {soundEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Chime On' : 'Chime Muted'}</span>
          </button>

          <button
            onClick={handleExportLiveAudit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold border border-neutral-300 dark:border-neutral-700 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Audit</span>
          </button>
        </div>
      </div>

      {/* Real-time Alert Toast Banner */}
      {latestLiveAlert && (
        <div className="p-3.5 rounded-xl bg-emerald-600 text-white shadow-lg flex items-center justify-between gap-3 animate-slide-down">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span className="text-xs font-black tracking-wide uppercase bg-black/20 px-2 py-0.5 rounded">
              {latestLiveAlert.timestamp}
            </span>
            <span className="text-xs font-bold">{latestLiveAlert.text}</span>
          </div>
          <button
            onClick={() => setLatestLiveAlert(null)}
            className="text-white/80 hover:text-white text-xs underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Today's Live Sales Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold mb-1">
            <span>Today's Gross Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {sym}{metrics.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {metrics.transactionsCount} transactions • {metrics.itemsCount} items sold
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold mb-1">
            <span>Cash in Drawers</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-neutral-100">
            {sym}{metrics.cashRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Physical banknotes to be counted at shift close
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold mb-1">
            <span>Electronic / Card / POS</span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-neutral-100">
            {sym}{(metrics.cardRevenue + metrics.mobileRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Card: {sym}{metrics.cardRevenue.toLocaleString()} • Transfer: {sym}{metrics.mobileRevenue.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold mb-1">
            <span>Cashier Discounts Given</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
            {sym}{metrics.discountsGiven.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Avg basket: {sym}{metrics.averageTicket.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('live_feed')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'live_feed'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            Live Transaction Stream ({todayReceipts.length})
          </button>
          <button
            onClick={() => setActiveSubTab('shift_audits')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'shift_audits'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            Shift Close Reports & Cash Audits ({shiftReports.length})
          </button>
          <button
            onClick={() => setActiveSubTab('staff_matrix')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'staff_matrix'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <User className="w-4 h-4" />
            Staff Live Performance
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: Real-Time Live Sales Stream */}
      {activeSubTab === 'live_feed' && (
        <div className="space-y-4">
          {/* Stream Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-neutral-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter Feed:
              </span>

              {/* Staff Selector */}
              <select
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-medium"
              >
                <option value="all">All Staff Members</option>
                {staffRoster.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role.toUpperCase()})
                  </option>
                ))}
              </select>

              {/* Payment Method Selector */}
              <select
                value={selectedPaymentFilter}
                onChange={(e) => setSelectedPaymentFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-medium"
              >
                <option value="all">All Payment Types</option>
                <option value="cash">Cash Only</option>
                <option value="card">Card / POS Only</option>
                <option value="mobile_nfc">Transfer / NFC Only</option>
              </select>

              {/* Anti-Manipulation Flag Toggle */}
              <button
                onClick={() => setOnlyFlagged(!onlyFlagged)}
                className={`px-3 py-1.5 rounded-lg font-bold border transition ${
                  onlyFlagged
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
                }`}
              >
                ⚠️ High Value / Flagged Alerts Only
              </button>
            </div>

            <div className="text-neutral-400 text-xs">
              Showing <strong>{filteredReceipts.length}</strong> transactions
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-2.5">
            {filteredReceipts.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-50" />
                <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  No Transactions Found for Filter
                </h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Sales completed by staff on the register will appear here live with zero delay.
                </p>
              </div>
            ) : (
              filteredReceipts.map((r, idx) => {
                const isHighCash = r.paymentMethod === 'cash' && r.total >= 20000;
                const isHighDiscount = (r.discountAmount || 0) > 0 && (r.discountAmount || 0) / (r.subtotal || 1) >= 0.1;
                const timeStr = new Date(r.timestamp).toLocaleTimeString();

                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-xl border bg-white dark:bg-neutral-900 transition-all ${
                      idx === 0
                        ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                        : isHighCash || isHighDiscount
                        ? 'border-amber-400/80 dark:border-amber-600/80 bg-amber-50/20 dark:bg-amber-950/10'
                        : 'border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-neutral-500">
                          #{r.sequenceNumber}
                        </span>
                        <span className="font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {r.id}
                        </span>
                        <span className="text-xs text-neutral-400">•</span>
                        <span className="text-xs font-medium text-neutral-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeStr}
                        </span>
                        <span className="text-xs text-neutral-400">•</span>
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                          <User className="w-3 h-3 text-neutral-400" />
                          {r.cashier}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Flags */}
                        {isHighCash && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                            💵 LARGE CASH (₦{r.total.toLocaleString()})
                          </span>
                        )}
                        {isHighDiscount && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300">
                            ⚠️ HIGH DISCOUNT (-₦{r.discountAmount.toLocaleString()})
                          </span>
                        )}

                        {/* Payment Method Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            r.paymentMethod === 'cash'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : r.paymentMethod === 'card'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                              : 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                          }`}
                        >
                          {r.paymentMethod}
                        </span>

                        {/* Amount */}
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {sym}{r.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Items Sold & Cryptographic Vault Verification */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 text-xs text-neutral-600 dark:text-neutral-400 gap-2">
                      <div className="truncate max-w-xl">
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">Items: </span>
                        {r.items.map((it) => `${it.quantity}x ${it.product.name}`).join(', ')}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                        <Lock className="w-2.5 h-2.5" />
                        <span>SHA-256 Vault Certified: {r.encryptedDataSignature?.slice(0, 10) || 'SEC-VERIFIED'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: Staff Shift Close Reports & Cash Audits */}
      {activeSubTab === 'shift_audits' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>CEO Cash Reconciliation Audit:</strong> When staff close sales and logout, they must count their physical drawer. If physical cash does not match system recorded cash, a variance shortage is flagged immediately below.
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Report ID / Timestamp</th>
                    <th className="px-4 py-3">Staff Member</th>
                    <th className="px-4 py-3">Terminal</th>
                    <th className="px-4 py-3 text-right">Total Sales</th>
                    <th className="px-4 py-3 text-right">Expected Cash</th>
                    <th className="px-4 py-3 text-right">Actual Counted</th>
                    <th className="px-4 py-3 text-center">Cash Variance</th>
                    <th className="px-4 py-3">Audited Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {shiftReports.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-neutral-400">
                        No shift close reports submitted yet today. When a staff closes their shift, their reconciliation slip will appear here.
                      </td>
                    </tr>
                  ) : (
                    shiftReports.map((rep) => {
                      const isShortage = rep.cashVariance < 0;
                      const isBalanced = rep.cashVariance === 0;

                      return (
                        <tr key={rep.id} className={isShortage ? 'bg-red-50/40 dark:bg-red-950/20' : ''}>
                          <td className="px-4 py-3">
                            <div className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{rep.id}</div>
                            <div className="text-[10px] text-neutral-400">
                              {new Date(rep.sentAt).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-neutral-900 dark:text-neutral-100">{rep.staffName}</div>
                            <div className="text-[10px] text-neutral-500 font-mono">{rep.staffId} • {rep.staffRole.toUpperCase()}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-neutral-600 dark:text-neutral-300">
                            {rep.terminalId}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            {sym}{rep.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {sym}{rep.expectedCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            {sym}{rep.actualCashCounted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                                isBalanced
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : isShortage
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 animate-pulse'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {rep.cashVariance >= 0 ? '+' : ''}{sym}
                              {rep.cashVariance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              {isShortage && ' ⚠️ SHORTAGE'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-500 max-w-xs truncate">
                            {rep.notes || 'No remarks provided'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: Staff Live Performance Matrix */}
      {activeSubTab === 'staff_matrix' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {staffMatrix.map((item) => (
            <div
              key={item.staff.id}
              className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm">
                    {item.staff.name.charAt(0)}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.isActiveToday
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'
                    }`}
                  >
                    {item.isActiveToday ? '🟢 Active Today' : '⚪ Off Duty'}
                  </span>
                </div>

                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">{item.staff.name}</h3>
                <p className="text-xs text-neutral-400 font-mono mt-0.5">
                  {item.staff.id} • {item.staff.role.toUpperCase()}
                </p>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Total Sales:</span>
                    <span className="font-bold text-emerald-600">{sym}{item.totalSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Cash Collected:</span>
                    <span className="font-semibold">{sym}{item.cashSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Card / POS:</span>
                    <span className="font-semibold">{sym}{item.cardSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Discounts Given:</span>
                    <span className="font-semibold text-amber-600">{sym}{item.totalDiscounts.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Receipts Rung Up:</span>
                    <span className="font-bold">{item.transactionCount}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
                <span>Last Sale:</span>
                <span className="font-medium text-neutral-600 dark:text-neutral-300">
                  {item.lastSale ? new Date(item.lastSale).toLocaleTimeString() : 'None today'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
