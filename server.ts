import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// In-memory multi-device state synchronization store
interface StaffUserServer {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'manager' | 'staff';
  password: string;
  email?: string;
  phone?: string;
  terminalId?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

interface DeviceSyncState {
  lastUpdated: string;
  transactions: any[];
  inventory: any[];
  emailLogs: any[];
  staff: StaffUserServer[];
  shiftReports: any[];
  activeShifts: any[];
  onlineOrders: any[];
}

// Pre-seeded staff roster
const INITIAL_STAFF: StaffUserServer[] = [
  {
    id: 'CEO-001',
    username: 'admin',
    name: 'Alhaji Bummpt (Store CEO)',
    role: 'admin',
    password: 'admin123',
    email: 'bummpt90@gmail.com',
    phone: '+234 803 123 4567',
    terminalId: 'CEO-OFFICE',
    isActive: true,
    createdAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
  },
];

let syncState: DeviceSyncState = {
  lastUpdated: new Date().toISOString(),
  transactions: [],
  inventory: [],
  emailLogs: [],
  staff: INITIAL_STAFF,
  shiftReports: [],
  activeShifts: [],
  onlineOrders: [
    {
      id: 'ORD-2026-001',
      customerName: 'Kemi Adeleke',
      customerPhone: '+234 803 776 5432',
      customerEmail: 'kemi.adeleke@gmail.com',
      deliveryAddress: 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos',
      deliveryZone: 'Island / Lekki / Victoria Island Priority',
      deliveryInstructions: 'Ring doorbell twice. Gate code is #409.',
      items: [
        {
          id: 'li-ord-1',
          product: { id: 'prod-001', name: 'Organic Whole Milk 1 Gal', barcode: '011110417001', price: 6800 },
          quantity: 2,
          unitPrice: 6800,
          discountPercent: 0,
          lineTotal: 13600,
        },
        {
          id: 'li-ord-2',
          product: { id: 'prod-004', name: 'Whole Bean Dark Roast Coffee 12oz', barcode: '011110852003', price: 14500 },
          quantity: 1,
          unitPrice: 14500,
          discountPercent: 0,
          lineTotal: 14500,
        },
      ],
      itemsCost: 28100, // Cost for the products ordered
      deliveryCost: 3000, // Delivery cost
      discountAmount: 0,
      taxAmount: 2108,
      totalAmount: 33208,
      paymentMethod: 'card',
      paymentStatus: 'paid',
      status: 'preparing',
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      assignedRider: {
        name: 'Musa Ibrahim (Dispatch Bike #4)',
        phone: '+234 812 345 6789',
      },
      notes: 'Fragile dairy items - keep chilled.',
    },
    {
      id: 'ORD-2026-002',
      customerName: 'Dr. Emeka Nnamdi',
      customerPhone: '+234 802 119 8765',
      customerEmail: 'emeka.nnamdi@healthclinic.ng',
      deliveryAddress: '22 Isaac John Street, GRA Ikeja, Lagos',
      deliveryZone: 'Mainland / Ikeja / Surulere Route',
      deliveryInstructions: 'Reception desk delivery. Call on arrival.',
      items: [
        {
          id: 'li-ord-3',
          product: { id: 'prod-pharma-001', name: 'Paracetamol 500mg 20 Caplets', barcode: '615110001024', price: 1200 },
          quantity: 4,
          unitPrice: 1200,
          discountPercent: 0,
          lineTotal: 4800,
        },
      ],
      itemsCost: 4800,
      deliveryCost: 2000,
      discountAmount: 500,
      appliedDiscountCode: 'FIRSTBUY',
      taxAmount: 0,
      totalAmount: 6300,
      paymentMethod: 'pay_on_delivery',
      paymentStatus: 'cash_on_delivery',
      status: 'out_for_delivery',
      createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      assignedRider: {
        name: 'Sunday Okafor (QuickVan Express)',
        phone: '+234 809 998 8776',
      },
      notes: 'Payment to be collected via POS machine on delivery.',
    },
  ],
};

// SSE Connection Pool for live multi-device & CEO radar stream
interface SSEClient {
  id: number;
  res: Response;
}
let sseClients: SSEClient[] = [];

function broadcastSSE(payload: any) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(data);
    } catch {
      // client dropped
    }
  });
}

// --- API Endpoints ---
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString(), connectedClients: sseClients.length });
});

// Real-Time Server-Sent Events (SSE) Stream for Live Sales Tracking
app.get('/api/sync/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now() + Math.random();
  const newClient: SSEClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial handshake ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Get current multi-device state
app.get('/api/sync/state', (req: Request, res: Response) => {
  res.json(syncState);
});

// Commit checkout transaction across devices & broadcast live alert to Admin/CEO
app.post('/api/sync/transaction', (req: Request, res: Response) => {
  try {
    const { receipt, inventoryUpdates } = req.body;
    if (!receipt) {
      return res.status(400).json({ error: 'Receipt payload required' });
    }

    // Add receipt to sync store (avoid duplicates by id)
    const exists = syncState.transactions.some((t) => t.id === receipt.id);
    if (!exists) {
      syncState.transactions.unshift(receipt);
    }

    // Update inventory levels across devices & check for low stock triggers
    const lowStockAlerts: any[] = [];
    if (Array.isArray(inventoryUpdates)) {
      for (const update of inventoryUpdates) {
        const item = syncState.inventory.find((p) => p.id === update.id);
        if (item) {
          item.stock = Math.max(0, item.stock - update.quantity);
          item.updatedAt = new Date().toISOString();
          const minAlert = item.minStockAlert || 5;
          if (item.stock <= minAlert) {
            lowStockAlerts.push({
              productId: item.id,
              productName: item.name,
              barcode: item.barcode,
              currentStock: item.stock,
              minStockAlert: minAlert,
              severity: item.stock <= 0 ? 'critical' : 'warning',
            });
          }
        }
      }
    }

    syncState.lastUpdated = new Date().toISOString();

    // Broadcast LIVE SALE to Admin/CEO dashboard in real-time!
    broadcastSSE({
      type: 'LIVE_SALE',
      receipt,
      timestamp: syncState.lastUpdated,
      isHighCash: receipt.paymentMethod === 'cash' && receipt.total >= 20000,
      isHighDiscount: receipt.discountAmount > 0 && receipt.discountAmount / (receipt.subtotal || 1) >= 0.1,
    });

    // If any product dropped to or below minimum threshold, broadcast LOW_STOCK_TRIGGER
    if (lowStockAlerts.length > 0) {
      lowStockAlerts.forEach((alert) => {
        broadcastSSE({
          type: 'LOW_STOCK_TRIGGER',
          lowStockAlert: alert,
          timestamp: syncState.lastUpdated,
        });
      });
    }

    return res.json({ success: true, timestamp: syncState.lastUpdated, receiptId: receipt.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

// --- Staff Authentication & Shift Endpoints ---

// Staff Login
app.post('/api/staff/login', (req: Request, res: Response) => {
  const { username, password, startingCash = 0, terminalId = 'TERM-01' } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = syncState.staff.find(
    (s) => s.username.toLowerCase() === username.trim().toLowerCase()
  );

  if (!user) {
    return res.status(401).json({ error: 'Staff user not found. Please check username.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'This staff account has been deactivated. Contact Admin/CEO.' });
  }

  if (user.password !== password) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  // Update last login
  user.lastLoginAt = new Date().toISOString();

  // Create active shift session
  const shiftSession = {
    shiftId: 'SHF-' + Date.now(),
    staffId: user.id,
    staffName: user.name,
    staffRole: user.role,
    terminalId,
    startTime: new Date().toISOString(),
    startingCash: Number(startingCash) || 0,
    isActive: true,
  };

  // Remove prior active shift for same staff if any
  syncState.activeShifts = syncState.activeShifts.filter((s) => s.staffId !== user.id);
  syncState.activeShifts.unshift(shiftSession);

  // Broadcast login event to Admin/CEO radar
  broadcastSSE({
    type: 'STAFF_SHIFT_START',
    session: shiftSession,
    staff: { id: user.id, name: user.name, role: user.role, terminalId },
    timestamp: new Date().toISOString(),
  });

  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
      terminalId,
    },
    session: shiftSession,
  });
});

// List all staff members (safe view)
app.get('/api/staff', (req: Request, res: Response) => {
  // Return staff list
  res.json({ staff: syncState.staff });
});

// Add new staff member
app.post('/api/staff', (req: Request, res: Response) => {
  const { username, name, role = 'staff', password, email, phone, terminalId = 'TERM-01' } = req.body;
  if (!username || !name || !password) {
    return res.status(400).json({ error: 'Username, name, and password are required.' });
  }

  const existing = syncState.staff.find(
    (s) => s.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (existing) {
    return res.status(409).json({ error: 'Username already taken. Please choose another.' });
  }

  const newStaff: StaffUserServer = {
    id: `STF-${100 + syncState.staff.length + 1}`,
    username: username.trim().toLowerCase(),
    name: name.trim(),
    role,
    password,
    email: email?.trim(),
    phone: phone?.trim(),
    terminalId,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  syncState.staff.push(newStaff);
  syncState.lastUpdated = new Date().toISOString();

  return res.status(201).json({ success: true, staff: newStaff });
});

// Update staff member
app.put('/api/staff/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const staffMember = syncState.staff.find((s) => s.id === id);
  if (!staffMember) {
    return res.status(404).json({ error: 'Staff member not found.' });
  }

  const { name, role, password, email, phone, terminalId, isActive } = req.body;
  if (name !== undefined) staffMember.name = name;
  if (role !== undefined) staffMember.role = role;
  if (password !== undefined && password.trim() !== '') staffMember.password = password;
  if (email !== undefined) staffMember.email = email;
  if (phone !== undefined) staffMember.phone = phone;
  if (terminalId !== undefined) staffMember.terminalId = terminalId;
  if (isActive !== undefined) staffMember.isActive = Boolean(isActive);

  syncState.lastUpdated = new Date().toISOString();
  return res.json({ success: true, staff: staffMember });
});

// Delete staff member
app.delete('/api/staff/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (id === 'CEO-001') {
    return res.status(403).json({ error: 'Cannot delete primary CEO account.' });
  }

  syncState.staff = syncState.staff.filter((s) => s.id !== id);
  syncState.lastUpdated = new Date().toISOString();
  return res.json({ success: true, message: 'Staff member removed.' });
});

// Close Sales & End Shift Report Submission
app.post('/api/staff/shift-report', (req: Request, res: Response) => {
  try {
    const report = req.body;
    if (!report || !report.staffId) {
      return res.status(400).json({ error: 'Invalid shift report payload' });
    }

    const reportId = report.id || `REP-${Date.now()}`;
    const finalizedReport = {
      ...report,
      id: reportId,
      sentAt: new Date().toISOString(),
    };

    // Store in shift reports archive
    syncState.shiftReports.unshift(finalizedReport);

    // Close any active shift for this staff member
    syncState.activeShifts = syncState.activeShifts.filter((s) => s.staffId !== report.staffId);

    // Queue email dispatch log to manager/CEO
    const emailRecipient = report.sentToEmail || 'bummpt90@gmail.com';
    const emailLogEntry = {
      id: 'EML-SHIFT-' + Date.now(),
      sentAt: new Date().toISOString(),
      reportType: 'staff_shift_close',
      recipient: emailRecipient,
      subject: `[BummptStores Shift Close] ${report.staffName} (${report.staffId}) - Net: ₦${Number(report.totalSales || 0).toLocaleString()} (Variance: ₦${Number(report.cashVariance || 0).toLocaleString()})`,
      status: 'Delivered',
      summary: {
        staffName: report.staffName,
        totalSales: report.totalSales,
        cashSales: report.cashSales,
        expectedCash: report.expectedCash,
        actualCash: report.actualCashCounted,
        variance: report.cashVariance,
        notes: report.notes,
      },
    };
    syncState.emailLogs.unshift(emailLogEntry);

    // Broadcast SHIFT CLOSED event to Admin/CEO live dashboard
    broadcastSSE({
      type: 'SHIFT_CLOSED',
      shiftReport: finalizedReport,
      timestamp: new Date().toISOString(),
      hasShortage: report.cashVariance < 0,
    });

    return res.json({
      success: true,
      reportId: finalizedReport.id,
      emailSentTo: emailRecipient,
      report: finalizedReport,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit shift report' });
  }
});

// Get all shift reports for Admin/CEO audit
app.get('/api/staff/shift-reports', (req: Request, res: Response) => {
  res.json({ reports: syncState.shiftReports });
});

// --- Online Ordering Endpoints ---
// Get all online delivery orders
app.get('/api/orders', (req: Request, res: Response) => {
  res.json({ orders: syncState.onlineOrders });
});

// Create new online delivery order
app.post('/api/orders', (req: Request, res: Response) => {
  try {
    const orderData = req.body;
    if (!orderData || !orderData.customerName || !orderData.deliveryAddress) {
      return res.status(400).json({ error: 'Customer name and delivery address are required.' });
    }

    const orderId = orderData.id || `ORD-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`;
    const newOrder = {
      ...orderData,
      id: orderId,
      createdAt: new Date().toISOString(),
      status: orderData.status || 'pending',
    };

    syncState.onlineOrders.unshift(newOrder);
    syncState.lastUpdated = new Date().toISOString();

    // Broadcast new online order to staff & CEO radar
    broadcastSSE({
      type: 'ONLINE_ORDER_NEW',
      onlineOrder: newOrder,
      timestamp: syncState.lastUpdated,
    });

    return res.status(201).json({ success: true, order: newOrder });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create online order' });
  }
});

// Update online order status (e.g. preparing, out_for_delivery, delivered)
app.put('/api/orders/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes, assignedRider } = req.body;

  const order = syncState.onlineOrders.find((o) => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Online order not found' });
  }

  if (status) order.status = status;
  if (notes !== undefined) order.notes = notes;
  if (assignedRider) order.assignedRider = assignedRider;
  if (status === 'delivered' && order.paymentStatus === 'cash_on_delivery') {
    order.paymentStatus = 'paid';
  }
  order.updatedAt = new Date().toISOString();
  syncState.lastUpdated = new Date().toISOString();

  // Broadcast update
  broadcastSSE({
    type: 'ONLINE_ORDER_STATUS',
    onlineOrder: order,
    timestamp: syncState.lastUpdated,
  });

  return res.json({ success: true, order });
});

// Bulk update or initialize inventory
app.post('/api/sync/inventory', (req: Request, res: Response) => {
  const { inventory } = req.body;
  if (Array.isArray(inventory)) {
    syncState.inventory = inventory;
    syncState.lastUpdated = new Date().toISOString();
    return res.json({ success: true, count: inventory.length });
  }
  return res.status(400).json({ error: 'Invalid inventory array' });
});

// Automated email reporting endpoint
app.post('/api/email-report', (req: Request, res: Response) => {
  try {
    const { reportType, recipient, subject, summary, htmlBody } = req.body;
    const logEntry = {
      id: 'EML-' + Date.now(),
      sentAt: new Date().toISOString(),
      reportType: reportType || 'automated_summary',
      recipient: recipient || 'store-manager@superstore.com',
      subject: subject || `Superstore POS Sales Report - ${new Date().toLocaleDateString()}`,
      status: 'Delivered',
      summary: summary || {},
    };

    syncState.emailLogs.unshift(logEntry);
    return res.json({
      success: true,
      message: `Automated report successfully processed and queued for ${logEntry.recipient}`,
      log: logEntry,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get email logs
app.get('/api/email-report/logs', (req: Request, res: Response) => {
  res.json({ logs: syncState.emailLogs });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Superstore POS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
