import React from 'react';
import {
  ShoppingCart,
  Package,
  BarChart3,
  ReceiptText,
  Settings,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  FileSpreadsheet,
  Lock,
  Activity,
  User,
  LogOut,
  LogIn,
  ShieldCheck,
  Truck,
  AlertTriangle,
} from 'lucide-react';
import { StoreSettings, StaffUser, StaffShiftSession } from '../types';

interface NavbarProps {
  activeTab: 'register' | 'orders' | 'inventory' | 'analytics' | 'history' | 'settings' | 'live_radar';
  setActiveTab: (tab: 'register' | 'orders' | 'inventory' | 'analytics' | 'history' | 'settings' | 'live_radar') => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  isOnline: boolean;
  offlineCount: number;
  settings: StoreSettings;
  googleUser: any;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  currentStaff: StaffUser | null;
  activeShift: StaffShiftSession | null;
  onOpenStaffLogin: () => void;
  onOpenCloseSales: () => void;
  lowStockCount?: number;
  pendingOrdersCount?: number;
  onOpenLowStockModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isDarkMode,
  setIsDarkMode,
  isOnline,
  offlineCount,
  settings,
  googleUser,
  onGoogleSignIn,
  onGoogleSignOut,
  currentStaff,
  activeShift,
  onOpenStaffLogin,
  onOpenCloseSales,
  lowStockCount = 0,
  pendingOrdersCount = 0,
  onOpenLowStockModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand & Store Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-emerald-600/20 shrink-0">
              🛒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-neutral-900 dark:text-neutral-100 text-base sm:text-lg leading-tight tracking-tight">
                  {settings.storeName}
                </h1>
                <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                  <Lock className="w-2.5 h-2.5" />
                  Anti-Manipulation
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="font-mono text-[11px] font-semibold">{activeShift?.terminalId || settings.terminalId}</span>
                <span>•</span>
                {currentStaff ? (
                  <span className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    {currentStaff.name.split(' ')[0]} ({currentStaff.role})
                  </span>
                ) : (
                  <span className="truncate max-w-[100px] sm:max-w-none">{settings.cashierName}</span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Controls for Tablets & Desktops */}
          <nav className="hidden lg:flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/60 p-1 rounded-xl border border-neutral-200/80 dark:border-neutral-700/60">
            <button
              id="tab-btn-register"
              onClick={() => setActiveTab('register')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'register'
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Register
            </button>

            {/* Online Orders Tab */}
            <button
              id="tab-btn-orders"
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
                activeTab === 'orders'
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Online Orders</span>
              {pendingOrdersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            {/* Live CEO Radar Tab */}
            <button
              id="tab-btn-live-radar"
              onClick={() => setActiveTab('live_radar')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
                activeTab === 'live_radar'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Activity className="w-4 h-4 text-emerald-500" />
              CEO Live Radar
            </button>

            <button
              id="tab-btn-inventory"
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Package className="w-4 h-4" />
              Inventory
            </button>
            <button
              id="tab-btn-analytics"
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </button>
            <button
              id="tab-btn-history"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <ReceiptText className="w-4 h-4" />
              Receipts
            </button>
            <button
              id="tab-btn-settings"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'settings'
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              Admin
            </button>
          </nav>

          {/* Right Status Actions */}
          <div className="flex items-center gap-2">
            {/* Low Stock Alert Bell Trigger Button */}
            {onOpenLowStockModal && (
              <button
                id="btn-low-stock-alert-trigger"
                onClick={onOpenLowStockModal}
                className={`relative p-2 rounded-xl border transition flex items-center justify-center ${
                  lowStockCount > 0
                    ? 'bg-amber-500/10 border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 animate-pulse'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                }`}
                title={
                  lowStockCount > 0
                    ? `⚠️ ${lowStockCount} items have reached low stock triggers! Click to open reorder radar`
                    : 'Inventory stock levels healthy'
                }
              >
                <AlertTriangle className="w-4 h-4" />
                {lowStockCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-black shadow-xs">
                    {lowStockCount}
                  </span>
                )}
              </button>
            )}

            {/* Real-time Sync & Online / Offline Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isOnline
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
              title={isOnline ? 'Real-time multi-device sync active' : 'Offline mode active - transactions saved locally'}
            >
              {isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden sm:inline">Sync Active</span>
                  <Wifi className="w-3.5 h-3.5 sm:hidden" />
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>Offline {offlineCount > 0 && `(${offlineCount})`}</span>
                </>
              )}
            </div>

            {/* Staff Shift Actions: Close Sales & Logout / Staff Login */}
            {currentStaff && activeShift ? (
              <div className="flex items-center gap-1.5">
                <button
                  id="btn-close-sales-logout"
                  onClick={onOpenCloseSales}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold shadow-xs transition"
                  title="Reconcile Cash Drawer, Send Sales Report to CEO, and Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Close Shift</span>
                </button>

                <button
                  onClick={onOpenStaffLogin}
                  className="p-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition"
                  title="Switch Staff Account"
                >
                  <User className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn-staff-login"
                onClick={onOpenStaffLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-xs transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Staff Sign In</span>
              </button>
            )}

            {/* Google Sheets Connection Button */}
            {googleUser ? (
              <div className="relative group">
                <button
                  id="btn-google-sheets-connected"
                  onClick={onGoogleSignOut}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition"
                  title="Google Sheets connected. Click to disconnect."
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden xl:inline">Sheets Sync</span>
                </button>
              </div>
            ) : (
              <button
                id="btn-connect-google-sheets"
                onClick={onGoogleSignIn}
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition"
                title="Connect Google Sheets"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-500" />
                <span>Connect Sheets</span>
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button
              id="btn-toggle-dark-mode"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode (Low Light)'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-600" />}
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex lg:hidden overflow-x-auto py-2 gap-1 border-t border-neutral-200 dark:border-neutral-800 scrollbar-none">
          <button
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'register'
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Register
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Orders {pendingOrdersCount > 0 && `(${pendingOrdersCount})`}
          </button>
          <button
            onClick={() => setActiveTab('live_radar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'live_radar'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            Live Radar
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Inventory
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <ReceiptText className="w-3.5 h-3.5" />
            Receipts
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Admin
          </button>
        </div>
      </div>
    </header>
  );
};

