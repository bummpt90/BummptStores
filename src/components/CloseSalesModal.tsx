import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Printer,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  LogOut,
  Send,
  Building,
  CreditCard,
  Smartphone,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { StaffShiftSession, Receipt, StoreSettings, ShiftCloseReport } from '../types';
import { calculateShiftSummary, submitShiftCloseReport } from '../services/staffAuth';
import * as XLSX from 'xlsx';

interface CloseSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StaffShiftSession | null;
  receipts: Receipt[];
  settings: StoreSettings;
  onShiftClosed: (report: ShiftCloseReport) => void;
}

export const CloseSalesModal: React.FC<CloseSalesModalProps> = ({
  isOpen,
  onClose,
  session,
  receipts,
  settings,
  onShiftClosed,
}) => {
  if (!isOpen || !session) return null;

  const sym = settings.currencySymbol || '₦';
  const shiftSummary = calculateShiftSummary(session, receipts);

  const [actualCashInput, setActualCashInput] = useState<string>(
    shiftSummary.expectedCash > 0 ? String(shiftSummary.expectedCash) : '0'
  );
  const [shiftNotes, setShiftNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedReport, setSubmittedReport] = useState<ShiftCloseReport | null>(null);

  const actualCash = parseFloat(actualCashInput) || 0;
  const variance = actualCash - shiftSummary.expectedCash;

  const shiftStart = new Date(session.startTime);
  const shiftEnd = new Date();
  const durationMs = Math.max(0, shiftEnd.getTime() - shiftStart.getTime());
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  const handleConfirmClose = async () => {
    setIsSubmitting(true);
    try {
      const recipient = settings.managerEmail || 'bummpt90@gmail.com';
      const reportPayload = {
        shiftId: session.shiftId,
        staffId: session.staffId,
        staffName: session.staffName,
        staffRole: session.staffRole,
        terminalId: session.terminalId,
        startTime: session.startTime,
        endTime: new Date().toISOString(),
        startingCash: session.startingCash,
        cashSales: shiftSummary.cashSales,
        cardSales: shiftSummary.cardSales,
        mobileSales: shiftSummary.mobileSales,
        splitSales: shiftSummary.splitSales,
        totalSales: shiftSummary.totalSales,
        totalTransactions: shiftSummary.totalTransactions,
        totalItemsSold: shiftSummary.totalItemsSold,
        totalDiscounts: shiftSummary.totalDiscounts,
        totalTax: shiftSummary.totalTax,
        expectedCash: shiftSummary.expectedCash,
        actualCashCounted: actualCash,
        cashVariance: variance,
        notes: shiftNotes.trim() || undefined,
        sentToEmail: recipient,
        receiptIds: shiftSummary.receiptIds,
      };

      const finalReport = await submitShiftCloseReport(reportPayload);
      setSubmittedReport(finalReport);
      onShiftClosed(finalReport);
    } catch (err) {
      console.error('Failed to submit shift report:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    if (!submittedReport && !session) return;
    const rep = submittedReport || {
      staffName: session.staffName,
      staffId: session.staffId,
      terminalId: session.terminalId,
      startTime: session.startTime,
      endTime: new Date().toISOString(),
      startingCash: session.startingCash,
      cashSales: shiftSummary.cashSales,
      cardSales: shiftSummary.cardSales,
      mobileSales: shiftSummary.mobileSales,
      totalSales: shiftSummary.totalSales,
      totalTransactions: shiftSummary.totalTransactions,
      expectedCash: shiftSummary.expectedCash,
      actualCashCounted: actualCash,
      cashVariance: variance,
      notes: shiftNotes,
    };

    const data = [
      { Metric: 'Store Name', Value: settings.storeName },
      { Metric: 'Cashier / Staff Name', Value: rep.staffName },
      { Metric: 'Staff ID', Value: rep.staffId },
      { Metric: 'Terminal', Value: rep.terminalId },
      { Metric: 'Shift Start Time', Value: new Date(rep.startTime).toLocaleString() },
      { Metric: 'Shift End Time', Value: new Date(rep.endTime).toLocaleString() },
      { Metric: 'Opening Cash Float', Value: `${sym}${rep.startingCash.toLocaleString()}` },
      { Metric: 'Cash Sales Collected', Value: `${sym}${rep.cashSales.toLocaleString()}` },
      { Metric: 'Card / POS Sales', Value: `${sym}${rep.cardSales.toLocaleString()}` },
      { Metric: 'Mobile NFC / Transfer', Value: `${sym}${rep.mobileSales.toLocaleString()}` },
      { Metric: 'Total Shift Revenue', Value: `${sym}${rep.totalSales.toLocaleString()}` },
      { Metric: 'Total Receipts Processed', Value: rep.totalTransactions },
      { Metric: 'Expected Physical Cash', Value: `${sym}${rep.expectedCash.toLocaleString()}` },
      { Metric: 'Actual Cash Counted', Value: `${sym}${rep.actualCashCounted.toLocaleString()}` },
      { Metric: 'Cash Discrepancy / Variance', Value: `${sym}${rep.cashVariance.toLocaleString()}` },
      { Metric: 'Variance Status', Value: rep.cashVariance === 0 ? 'Balanced' : rep.cashVariance < 0 ? 'Shortage' : 'Overage' },
      { Metric: 'Staff Notes', Value: rep.notes || 'None' },
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shift Close Report');
    XLSX.writeFile(wb, `BummptStores_ShiftClose_${session.staffId}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                Close Sales & End Shift
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold">
                  {session.staffRole.toUpperCase()}
                </span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Reconcile physical cash drawer, send sales intelligence report to CEO, and logout
              </p>
            </div>
          </div>
          {!submittedReport && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {submittedReport ? (
            /* Success confirmation screen */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Sales Closed & Report Dispatched!
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
                Shift report for <strong>{submittedReport.staffName}</strong> has been logged to the CEO Audit Vault and dispatched to{' '}
                <span className="font-semibold text-neutral-900 dark:text-neutral-200">{submittedReport.sentToEmail}</span>.
              </p>

              {/* Quick Summary Slip */}
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700 max-w-md mx-auto text-left text-xs space-y-2 font-mono">
                <div className="flex justify-between pb-2 border-b border-neutral-200 dark:border-neutral-700">
                  <span className="text-neutral-500">Report ID:</span>
                  <span className="font-bold">{submittedReport.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Total Shift Revenue:</span>
                  <span className="font-bold text-emerald-600">
                    {sym}{submittedReport.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Transactions Count:</span>
                  <span>{submittedReport.totalTransactions} receipts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Expected Cash in Drawer:</span>
                  <span>{sym}{submittedReport.expectedCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Actual Cash Counted:</span>
                  <span>{sym}{submittedReport.actualCashCounted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
                  <span className="font-bold">Cash Variance:</span>
                  <span
                    className={`font-bold ${
                      submittedReport.cashVariance === 0
                        ? 'text-emerald-600'
                        : submittedReport.cashVariance < 0
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {submittedReport.cashVariance >= 0 ? '+' : ''}{sym}
                    {submittedReport.cashVariance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    ({submittedReport.cashVariance === 0 ? 'Balanced' : submittedReport.cashVariance < 0 ? 'Shortage' : 'Overage'})
                  </span>
                </div>
              </div>

              {/* Action Buttons for Completed Report */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <button
                  onClick={handlePrintSlip}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold transition"
                >
                  <Printer className="w-4 h-4" />
                  Print Shift Slip
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Download Excel
                </button>
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition"
                >
                  Complete Logout & Return to Sign-In
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Active Form to Reconcile and Send Report */
            <>
              {/* Staff & Shift Metadata Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 text-xs">
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase font-bold tracking-wider">Staff On Duty</span>
                  <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 mt-0.5">
                    <User className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="truncate">{session.staffName}</span>
                  </div>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase font-bold tracking-wider">Staff / Terminal ID</span>
                  <div className="font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                    {session.staffId} • {session.terminalId}
                  </div>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase font-bold tracking-wider">Shift Started</span>
                  <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    {shiftStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase font-bold tracking-wider">Shift Duration</span>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {durationHours}h {durationMinutes}m
                  </div>
                </div>
              </div>

              {/* Shift Financial Summary Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                  Shift Sales Performance Breakdown
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40">
                    <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Total Revenue</span>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 block mt-1">
                      {sym}{shiftSummary.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {shiftSummary.totalTransactions} sales • {shiftSummary.totalItemsSold} items
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400 block text-[11px] flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-emerald-600" />
                      Cash Sales
                    </span>
                    <span className="text-base font-bold text-neutral-900 dark:text-neutral-100 block mt-1">
                      {sym}{shiftSummary.cashSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-neutral-400">Paid in cash</span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400 block text-[11px] flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-blue-600" />
                      Card / POS Sales
                    </span>
                    <span className="text-base font-bold text-neutral-900 dark:text-neutral-100 block mt-1">
                      {sym}{shiftSummary.cardSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-neutral-400">Electronic slips</span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400 block text-[11px] flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-purple-600" />
                      Transfer / NFC
                    </span>
                    <span className="text-base font-bold text-neutral-900 dark:text-neutral-100 block mt-1">
                      {sym}{shiftSummary.mobileSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-neutral-400">Instant transfer</span>
                  </div>
                </div>
              </div>

              {/* Cash Reconciliation & Anti-Manipulation Audit */}
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-4">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      Physical Cash Drawer Reconciliation (Anti-Manipulation Audit)
                    </h4>
                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                      Count all physical banknotes and coins currently in the cash drawer. Any variance is automatically audited and sent directly to the CEO.
                    </p>
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <div>
                    <span className="text-neutral-500 text-[11px] block">Opening Cash Float:</span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {sym}{session.startingCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[11px] block">+ Cash Sales Rung Up:</span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {sym}{shiftSummary.cashSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="sm:border-l sm:pl-3 border-neutral-200 dark:border-neutral-800">
                    <span className="text-neutral-500 text-[11px] block font-semibold">= Expected Cash in Drawer:</span>
                    <span className="font-black text-emerald-600 text-sm">
                      {sym}{shiftSummary.expectedCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Cash count input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    Actual Cash Counted in Drawer ({sym})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">
                      {sym}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={actualCashInput}
                      onChange={(e) => setActualCashInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono font-bold text-base text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Variance Status Pill */}
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors ${
                    variance === 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : variance < 0
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
                      : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {variance === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                    <span>
                      {variance === 0
                        ? 'Cash Drawer is Balanced (Exact match)'
                        : variance < 0
                        ? `CASH SHORTAGE DETECTED: -${sym}${Math.abs(variance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `CASH OVERAGE: +${sym}${variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm">
                    {variance >= 0 ? '+' : ''}{sym}
                    {variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Handover Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Shift Notes / Cash Handover Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="e.g. Returned change float, all POS electronic merchant slips filed in drawer..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* CEO Email Notice */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[11px]">
                <Send className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Report will be automatically emailed to CEO at{' '}
                  <strong className="text-neutral-800 dark:text-neutral-200">
                    {settings.managerEmail || 'bummpt90@gmail.com'}
                  </strong>
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        {!submittedReport && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition"
            >
              Cancel / Continue Shift
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleConfirmClose}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending Report & Closing...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Report & Logout Staff
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
