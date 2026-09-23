# BummptStores 🛒⚡
### High-Performance Point of Sale (POS), Live CEO Sales Radar & Online Ordering Hub

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-Backend-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SSE](https://img.shields.io/badge/Realtime-SSE-00C7B7)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
[![ZXing](https://img.shields.io/badge/Scanner-ZXing_Camera-FF6F00)](https://github.com/zxing-js/library)

**BummptStores** is a modern, enterprise-ready Point of Sale (POS) and retail management system engineered for high-throughput retail stores, supermarkets, pharmacies, and omnichannel commerce. Built with React 19, TypeScript, Tailwind CSS v4, and an Express backend with Server-Sent Events (SSE), BummptStores unifies in-store checkout, live multi-terminal telemetry, shift cash-drawer security, online order fulfillment, and automated anti-stockout triggers.

---

## 🌟 Key Features

### 1. ⚡ High-Speed Register & Barcode Checkout
- **Omni-Scanner Support**: Hardware laser scanner detection + high-accuracy live camera scanning powered by `@zxing/library`.
- **Dynamic Calculator Register**: Quick numeric entry, keyboard shortcuts, fast catalog search, and category filtering.
- **Flexible Payments**: Cash, Card (POS Terminal), Bank Transfer, and Pay-on-Delivery with integrated change calculations.
- **Delivery Integration at Checkout**: Cashiers taking phone or dispatch orders can toggle delivery directly on the register, assign zones, and track delivery fees.
- **Instant Digital Receipts**: Cryptographically signed receipts with SHA-256 integrity hashes, QR code verification, 80mm thermal print layouts, and email forwarding.

### 2. 🚚 Online Ordering & Courier Dispatch Hub
- **Cost Separation**: Strictly itemizes:
  - **Cost for Products Ordered** (individual line items, unit prices, and quantities)
  - **Delivery Cost / Courier Dispatch Fee** (zone-based: Local Standard, Island Express, Priority Courier, or Custom Rate)
  - **Total Order Value** (`Products + Delivery + VAT - Discounts`)
- **Fulfillment Pipeline**: Real-time status tracking from `Pending` $\rightarrow$ `Preparing` $\rightarrow$ `Out for Delivery` $\rightarrow$ `Delivered` (or `Cancelled`).
- **Dispatch Waybill & Packing Slips**: 1-click printable delivery waybills with customer destination, rider details, and payment collection terms (Prepaid vs. Cash on Delivery).
- **Excel Export**: Export orders and dispatch manifests directly into `.xlsx` spreadsheets for logistics auditing.

### 3. 🚨 Anti-Stockout Radar & Automated Low-Stock Alert Triggers
- **Automated Threshold Triggers**: Alerts trigger whenever product inventory drops to or below the safety threshold (`minStockAlert` or global minimum).
- **Multi-Level Visual & Audio Alerts**: Top-bar pulsing indicator, register warning banners, and audible warning chimes.
- **Replenishment Radar Modal**: Instant view of depleted (0 stock) and critical ($\le 3$ units) items with recommended reorder calculations.
- **Automated Supplier Dispatch**:
  - **WhatsApp Purchase Orders**: 1-click generation of formatted restock purchase orders directly to supplier phone numbers.
  - **Urgent CEO / Manager Email Alerts**: Transmits urgent stock requisition emails to store management.
- **1-Touch Restock**: Fast modal to log incoming stock batches, cost prices, suppliers, and batch numbers.

### 4. 🔒 Staff Shift Security & Anti-Manipulation Cash Reconciliation
- **Staff Authentication**: PIN and role-based staff login (Cashier, Supervisor, Store Manager, Admin).
- **Shift Opening & Float Logging**: Log starting cash float before sales begin.
- **Anti-Manipulation Close-of-Sales**:
  - Compares expected cash in drawer (starting float + cash sales - cash refunds) against blind physical cash count.
  - Automatically computes variances (balanced, cash shortage, or surplus).
  - Generates immutable shift audit reports and sends email notifications to the CEO/Owner.

### 5. 📡 Real-Time CEO Sales Radar & Multi-Terminal Sync
- **Server-Sent Events (SSE)**: Synchronizes transactions, inventory adjustments, and online orders across multiple cashier counters in real time.
- **Live CEO Dashboard**: Live sales ticker, revenue metrics, average basket size, top-selling items, and audio notifications as sales close on any counter.
- **Offline-First Resilience**: Automatic queueing of transactions in `localStorage` when network connection drops, with auto-sync when online.

### 6. 📊 Analytics, Auditing & Cloud Integrations
- **Sales Analytics**: Revenue graphs, payment method distributions, hourly peak sales volume, and profit margins.
- **Google Sheets Cloud Backup**: Direct export and live synchronization of transactions to Google Workspace Spreadsheets.
- **Inventory Management**: CSV / Excel import and export, barcode label generation, profit margin analysis, and category management.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide React, Motion |
| **Barcode Scanner** | `@zxing/library` (Camera QR / Code-128 / EAN-13 decoding) |
| **Backend** | Express 4, Node.js, Server-Sent Events (SSE), tsx, esbuild |
| **Data & Storage** | LocalStorage (Offline queue), In-Memory Server Sync, SheetJS (`xlsx`) |
| **Integrations** | Google Workspace (OAuth), Email Reporting API, WhatsApp API |
| **Security** | SHA-256 Digital Receipt Signatures, Web Crypto API |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **yarn** or **pnpm**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/bummptstores.git
   cd bummptstores
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables (optional)**:
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   VITE_STORE_NAME=BummptStores
   VITE_STORE_EMAIL=bummpt90@gmail.com
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   The application will start on `http://localhost:3000`.

---

## 📦 Available Scripts

- `npm run dev`: Starts the full-stack server (Express backend + Vite middleware) using `tsx`.
- `npm run build`: Bundles the client with Vite and the server with `esbuild` into `dist/`.
- `npm run start`: Runs the bundled production server (`dist/server.cjs`).
- `npm run lint`: Runs TypeScript validation (`tsc --noEmit`).
- `npm run clean`: Cleans build artifacts and distribution folders.

---

## 📁 Project Architecture

```
bummptstores/
├── server.ts                       # Express backend, SSE hub & sync endpoints
├── index.html                      # App entry point with PWA metadata
├── metadata.json                   # App capabilities and permissions
├── src/
│   ├── App.tsx                     # Top-level state orchestrator & SSE listener
│   ├── main.tsx                    # React DOM root entry
│   ├── types.ts                    # TypeScript types (Receipt, Order, Product, Shift)
│   ├── components/
│   │   ├── Navbar.tsx              # Top navigation, status ticker & alert triggers
│   │   ├── CalculatorRegister.tsx  # POS register, scanner & delivery dispatcher
│   │   ├── OnlineOrderingHub.tsx   # Delivery order management & waybill printer
│   │   ├── LowStockAlertTriggerModal.tsx # Anti-stockout replenishment radar
│   │   ├── LiveSalesTracker.tsx    # Real-time CEO sales radar
│   │   ├── InventoryManager.tsx    # Stock management, CSV import/export
│   │   ├── CloseSalesModal.tsx     # Cash drawer reconciliation & shift reports
│   │   ├── StaffLoginModal.tsx     # Cashier PIN login & shift float tracker
│   │   ├── ReceiptModal.tsx        # Printable 80mm thermal receipt & QR verification
│   │   ├── RestockModal.tsx        # Supplier batch restock dialog
│   │   ├── SalesHistory.tsx        # Past sales history, search, & refunds
│   │   ├── AnalyticsView.tsx       # Profit, revenue & payment analytics
│   │   └── SettingsModal.tsx       # Store info, tax rates, delivery zones & thresholds
│   └── services/
│       ├── storage.ts              # Local database, sync queue, default catalog
│       ├── auth.ts                 # Google Workspace OAuth authentication
│       ├── crypto.ts               # Cryptographic signing & receipt hashing
│       └── sheets.ts               # Google Sheets sync integration
└── package.json
```

---

## 🌐 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/events` | Server-Sent Events (SSE) stream for live sales & order updates |
| `GET` | `/api/orders` | Retrieve all online delivery orders |
| `POST` | `/api/orders` | Create an online order and deplete product inventory |
| `PUT` | `/api/orders/:id/status` | Update delivery order status (`preparing`, `out_for_delivery`, `delivered`) |
| `POST` | `/api/sync/transaction` | Sync committed POS transaction across all connected terminals |
| `GET` | `/api/sync/state` | Fetch consolidated transactions, inventory, and online orders |
| `POST` | `/api/sync/shift-close` | Submit cashier close-of-sales report and cash reconciliation |
| `POST` | `/api/email-report` | Send automated email shift reports or low-stock alerts |

---

## 🔒 Security & Data Integrity

- **Cryptographic Receipt Verification**: Every receipt generated calculates an immutable SHA-256 digest of items, prices, timestamp, and cashier ID.
- **Blind Cash Drawer Count**: Cashiers submit physical counts without seeing expected values, preventing manipulation of shortages.
- **Offline Data Encryption**: Local audit trails are encrypted to protect sensitive customer and transaction records.

---

## 📄 License

This project is licensed under the **MIT License**. Feel free to use, modify, and distribute for personal and commercial retail operations.
