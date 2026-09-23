import React, { useState } from 'react';
import {
  Lock,
  User,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  Store,
  DollarSign,
  Monitor,
  Eye,
  EyeOff,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { StaffUser, StaffShiftSession, StoreSettings } from '../types';
import { loginStaff, loadStaffRoster } from '../services/staffAuth';

interface StaffLoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: StaffUser, session: StaffShiftSession) => void;
  settings: StoreSettings;
  canDismiss?: boolean;
}

export const StaffLoginModal: React.FC<StaffLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  settings,
  canDismiss = false,
}) => {
  if (!isOpen) return null;

  const sym = settings.currencySymbol || '₦';
  const staffRoster = loadStaffRoster();

  const [username, setUsername] = useState<string>('chinedu');
  const [password, setPassword] = useState<string>('staff123');
  const [startingCash, setStartingCash] = useState<string>('10000');
  const [terminalId, setTerminalId] = useState<string>('TERM-01');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both your staff username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const floatVal = parseFloat(startingCash) || 0;
      const result = await loginStaff(username, password, floatVal, terminalId);
      onLoginSuccess(result.user, result.session);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (user: StaffUser) => {
    setUsername(user.username);
    setPassword(user.password);
    setTerminalId(user.terminalId || 'TERM-01');
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-6">
        
        {/* Header Branding */}
        <div className="bg-neutral-900 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/90 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-600/30">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black tracking-tight">{settings.storeName}</h2>
          <p className="text-xs text-neutral-400 mt-1 font-medium">
            Staff Authentication & Shift Register Gate
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 text-xs flex items-center gap-2 animate-shake">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Username / Staff ID */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Staff Username or ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. chinedu or admin"
                autoComplete="username"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Secret Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Shift Parameters: Opening Cash Float & Terminal */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Opening Float ({sym})
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400 text-xs font-bold">
                  {sym}
                </div>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={startingCash}
                  onChange={(e) => setStartingCash(e.target.value)}
                  placeholder="10000"
                  className="w-full pl-7 pr-2 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-mono font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                POS Terminal
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400">
                  <Monitor className="w-3.5 h-3.5" />
                </div>
                <select
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  className="w-full pl-7 pr-2 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-medium"
                >
                  <option value="TERM-01">TERM-01 (Main Register)</option>
                  <option value="TERM-02">TERM-02 (Express Checkout)</option>
                  <option value="CEO-OFFICE">CEO-RADAR (Surveillance)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying Staff Credentials...
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                Start Sales Shift & Open Register
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Quick Select Staff Demo Chips */}
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-2">
              <span className="font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Quick-Switch Accounts (Testing)
              </span>
              <span className="text-[10px]">Click to auto-fill</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {staffRoster.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleQuickFill(st)}
                  className={`p-2 rounded-lg text-left text-xs transition border flex flex-col justify-between ${
                    username === st.username
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                      : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <div className="font-bold truncate text-[11px]">{st.name}</div>
                  <div className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center justify-between mt-0.5">
                    <span>{st.role}</span>
                    <span className="font-mono text-[9px] bg-neutral-200 dark:bg-neutral-700 px-1 rounded">
                      {st.password}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {canDismiss && onClose && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
              >
                Dismiss / Continue as Guest Cashier
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
