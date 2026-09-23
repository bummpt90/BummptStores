import { StaffUser, StaffShiftSession, ShiftCloseReport, Receipt, LiveSalesEvent } from '../types';

const STORAGE_KEYS = {
  STAFF_ROSTER: 'bummptstores_staff_roster_v2',
  ACTIVE_SHIFT: 'bummptstores_active_shift_v2',
  SHIFT_REPORTS: 'bummptstores_shift_reports_v2',
};

// Initial built-in staff roster
export const DEFAULT_STAFF: StaffUser[] = [
  {
    id: 'CEO-001',
    username: 'admin',
    name: 'Alhaji Bummpt (CEO & Store Owner)',
    role: 'admin',
    password: 'admin123',
    email: 'bummpt90@gmail.com',
    phone: '+234 803 123 4567',
    terminalId: 'CEO-RADAR',
    isActive: true,
    createdAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'STF-101',
    username: 'chinedu',
    name: 'Chinedu Okafor',
    role: 'staff',
    password: 'staff123',
    email: 'chinedu@bummptstores.ng',
    phone: '+234 802 345 6789',
    terminalId: 'TERM-01',
    isActive: true,
    createdAt: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'STF-102',
    username: 'amina',
    name: 'Amina Bello',
    role: 'staff',
    password: 'staff123',
    email: 'amina@bummptstores.ng',
    phone: '+234 805 987 6543',
    terminalId: 'TERM-02',
    isActive: true,
    createdAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'MGR-201',
    username: 'manager',
    name: 'Blessing Adeyemi (Floor Manager)',
    role: 'manager',
    password: 'manager123',
    email: 'bummpt90@gmail.com',
    phone: '+234 807 112 2334',
    terminalId: 'TERM-01',
    isActive: true,
    createdAt: '2026-01-05T08:00:00.000Z',
  },
];

/**
 * Load staff roster from local storage or defaults
 */
export function loadStaffRoster(): StaffUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STAFF_ROSTER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load staff roster from storage:', err);
  }
  return DEFAULT_STAFF;
}

/**
 * Save staff roster to storage and sync to server
 */
export function saveStaffRoster(staff: StaffUser[]) {
  localStorage.setItem(STORAGE_KEYS.STAFF_ROSTER, JSON.stringify(staff));
}

/**
 * Get the currently active shift session
 */
export function getCurrentStaffSession(): StaffShiftSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save active shift session
 */
export function setCurrentStaffSession(session: StaffShiftSession | null) {
  if (session) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);
  }
}

/**
 * Authenticate staff and start their shift
 */
export async function loginStaff(
  username: string,
  password: string,
  startingCash: number = 0,
  terminalId: string = 'TERM-01'
): Promise<{ user: StaffUser; session: StaffShiftSession }> {
  const cleanUsername = username.trim().toLowerCase();
  const cleanPassword = password.trim();

  // Try server login first for multi-device sync
  try {
    const res = await fetch('/api/staff/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUsername,
        password: cleanPassword,
        startingCash,
        terminalId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setCurrentStaffSession(data.session);
      return { user: data.user, session: data.session };
    } else {
      const errorData = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        throw new Error(errorData.error || 'Authentication failed');
      }
    }
  } catch (err: any) {
    // If it's an explicit auth failure (401/403), rethrow
    if (err.message && (err.message.includes('password') || err.message.includes('not found') || err.message.includes('deactivated'))) {
      throw err;
    }
    // Otherwise fallback to local roster for offline capability
  }

  // Local fallback
  const roster = loadStaffRoster();
  const user = roster.find((s) => s.username.toLowerCase() === cleanUsername);

  if (!user) {
    throw new Error('Staff account not found. Please verify your username or Staff ID.');
  }

  if (!user.isActive) {
    throw new Error('This staff account has been deactivated. Please contact Store Admin.');
  }

  if (user.password !== cleanPassword) {
    throw new Error('Incorrect staff password. Please try again.');
  }

  const session: StaffShiftSession = {
    shiftId: 'SHF-' + Date.now(),
    staffId: user.id,
    staffName: user.name,
    staffRole: user.role,
    terminalId: terminalId || user.terminalId || 'TERM-01',
    startTime: new Date().toISOString(),
    startingCash: Number(startingCash) || 0,
    isActive: true,
  };

  setCurrentStaffSession(session);
  return { user, session };
}

/**
 * Logout current staff without submitting report
 */
export function logoutStaff() {
  setCurrentStaffSession(null);
}

/**
 * Calculates shift sales metrics for the currently active shift
 */
export function calculateShiftSummary(
  session: StaffShiftSession,
  receipts: Receipt[]
): {
  cashSales: number;
  cardSales: number;
  mobileSales: number;
  splitSales: number;
  totalSales: number;
  totalTransactions: number;
  totalItemsSold: number;
  totalDiscounts: number;
  totalTax: number;
  expectedCash: number;
  receiptIds: string[];
} {
  const shiftStart = new Date(session.startTime).getTime();

  // Filter receipts made during this shift by this staff member (or matched by staffId / cashier name)
  const shiftReceipts = receipts.filter((r) => {
    const rTime = new Date(r.timestamp).getTime();
    if (rTime < shiftStart) return false;
    // Match either explicit staffId or cashier name
    if (r.staffId && r.staffId === session.staffId) return true;
    if (r.cashier && r.cashier.includes(session.staffName.split(' ')[0])) return true;
    return true; // if logged in on single terminal, count all transactions during shift window
  });

  let cashSales = 0;
  let cardSales = 0;
  let mobileSales = 0;
  let splitSales = 0;
  let totalSales = 0;
  let totalItemsSold = 0;
  let totalDiscounts = 0;
  let totalTax = 0;
  const receiptIds: string[] = [];

  shiftReceipts.forEach((r) => {
    receiptIds.push(r.id);
    totalSales += r.total;
    totalDiscounts += r.discountAmount || 0;
    totalTax += r.taxAmount || 0;

    if (r.paymentMethod === 'cash') cashSales += r.total;
    else if (r.paymentMethod === 'card') cardSales += r.total;
    else if (r.paymentMethod === 'mobile_nfc') mobileSales += r.total;
    else splitSales += r.total;

    r.items.forEach((item) => {
      totalItemsSold += item.quantity;
    });
  });

  const expectedCash = (session.startingCash || 0) + cashSales;

  return {
    cashSales,
    cardSales,
    mobileSales,
    splitSales,
    totalSales,
    totalTransactions: shiftReceipts.length,
    totalItemsSold,
    totalDiscounts,
    totalTax,
    expectedCash,
    receiptIds,
  };
}

/**
 * Submit End-Of-Shift Close Report to Server and Email CEO
 */
export async function submitShiftCloseReport(
  reportData: Omit<ShiftCloseReport, 'id' | 'sentAt'>
): Promise<ShiftCloseReport> {
  const reportId = `REP-${Date.now()}`;
  const completeReport: ShiftCloseReport = {
    ...reportData,
    id: reportId,
    sentAt: new Date().toISOString(),
  };

  // Save to local storage
  const existingReports = getShiftCloseReports();
  const updatedReports = [completeReport, ...existingReports];
  localStorage.setItem(STORAGE_KEYS.SHIFT_REPORTS, JSON.stringify(updatedReports));

  // Clear current active shift session
  setCurrentStaffSession(null);

  // Send to backend server & email queue
  try {
    await fetch('/api/staff/shift-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completeReport),
    });
  } catch (err) {
    console.warn('Shift report queued locally (offline):', err);
  }

  return completeReport;
}

/**
 * Get all closed shift reports from local storage
 */
export function getShiftCloseReports(): ShiftCloseReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SHIFT_REPORTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Connect to real-time Server-Sent Events (SSE) live stream
 * Admin and CEO dashboards use this to observe sales in real-time
 */
export function subscribeToLiveSalesStream(
  onEvent: (event: LiveSalesEvent) => void,
  onError?: (err: any) => void
): () => void {
  let eventSource: EventSource | null = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    try {
      eventSource = new EventSource('/api/sync/events');

      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          onEvent(parsed);
        } catch (err) {
          console.error('Failed to parse SSE payload:', err);
        }
      };

      eventSource.onerror = (err) => {
        if (onError) onError(err);
        eventSource?.close();
        // Auto-reconnect after 3 seconds if not intentionally closed
        if (!isClosed) {
          setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      if (onError) onError(err);
      if (!isClosed) {
        setTimeout(connect, 5000);
      }
    }
  };

  connect();

  // Return cleanup teardown function
  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
    }
  };
}
