import { Receipt, Product } from '../types';
import { getAccessToken } from './auth';

export interface GoogleSheetsSyncResult {
  success: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  message?: string;
  error?: string;
}

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Creates a structured Google Sheet for the Superstore if one doesn't exist
 */
export async function createSuperstoreSpreadsheet(token: string): Promise<{ id: string; url: string }> {
  const title = `Superstore Digital Receipts & Inventory - ${new Date().getFullYear()}`;
  const response = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: { title: 'Digital Receipts' },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'Receipt ID' } },
                    { userEnteredValue: { stringValue: 'Date / Time' } },
                    { userEnteredValue: { stringValue: 'Customer' } },
                    { userEnteredValue: { stringValue: 'Cashier' } },
                    { userEnteredValue: { stringValue: 'Terminal' } },
                    { userEnteredValue: { stringValue: 'Items Qty' } },
                    { userEnteredValue: { stringValue: 'Subtotal ($)' } },
                    { userEnteredValue: { stringValue: 'Discount ($)' } },
                    { userEnteredValue: { stringValue: 'Tax ($)' } },
                    { userEnteredValue: { stringValue: 'Total ($)' } },
                    { userEnteredValue: { stringValue: 'Payment Method' } },
                    { userEnteredValue: { stringValue: 'Security Hash' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          properties: { title: 'Line Items' },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'Receipt ID' } },
                    { userEnteredValue: { stringValue: 'Barcode' } },
                    { userEnteredValue: { stringValue: 'Product Name' } },
                    { userEnteredValue: { stringValue: 'Category' } },
                    { userEnteredValue: { stringValue: 'Quantity' } },
                    { userEnteredValue: { stringValue: 'Unit Price ($)' } },
                    { userEnteredValue: { stringValue: 'Line Total ($)' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          properties: { title: 'Real-Time Inventory' },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'Barcode' } },
                    { userEnteredValue: { stringValue: 'Product Name' } },
                    { userEnteredValue: { stringValue: 'Category' } },
                    { userEnteredValue: { stringValue: 'Current Stock' } },
                    { userEnteredValue: { stringValue: 'Unit Price ($)' } },
                    { userEnteredValue: { stringValue: 'Cost Price ($)' } },
                    { userEnteredValue: { stringValue: 'Alert Level' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to create Google Sheet');
  }

  const data = await response.json();
  const id = data.spreadsheetId;
  const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  return { id, url };
}

/**
 * Syncs a digital receipt to Google Sheets
 */
export async function syncReceiptToGoogleSheets(
  receipt: Receipt,
  spreadsheetId?: string
): Promise<GoogleSheetsSyncResult> {
  try {
    const token = await getAccessToken();
    if (!token) {
      return { success: false, error: 'Google Account not signed in' };
    }

    let targetSpreadsheetId = spreadsheetId;
    let spreadsheetUrl = '';

    if (!targetSpreadsheetId) {
      const created = await createSuperstoreSpreadsheet(token);
      targetSpreadsheetId = created.id;
      spreadsheetUrl = created.url;
    } else {
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}/edit`;
    }

    // 1. Append summary row to "Digital Receipts"
    const receiptRow = [
      receipt.id,
      new Date(receipt.timestamp).toLocaleString(),
      receipt.customer.name || 'Walk-in Guest',
      receipt.cashier,
      receipt.terminalId,
      receipt.items.reduce((acc, i) => acc + i.quantity, 0),
      receipt.subtotal.toFixed(2),
      receipt.discountAmount.toFixed(2),
      receipt.taxAmount.toFixed(2),
      receipt.total.toFixed(2),
      receipt.paymentMethod.toUpperCase(),
      receipt.encryptedDataSignature || 'VALIDATED',
    ];

    await fetch(
      `${SHEETS_API_BASE}/${targetSpreadsheetId}/values/Digital Receipts!A:L:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [receiptRow] }),
      }
    );

    // 2. Append individual item lines
    const lineItemRows = receipt.items.map((item) => [
      receipt.id,
      item.product.barcode,
      item.product.name,
      item.product.category,
      item.quantity,
      item.unitPrice.toFixed(2),
      item.lineTotal.toFixed(2),
    ]);

    if (lineItemRows.length > 0) {
      await fetch(
        `${SHEETS_API_BASE}/${targetSpreadsheetId}/values/Line Items!A:G:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: lineItemRows }),
        }
      );
    }

    return {
      success: true,
      spreadsheetId: targetSpreadsheetId,
      spreadsheetUrl,
      message: `Receipt ${receipt.id} synced to Google Sheets`,
    };
  } catch (err: any) {
    console.error('Google Sheets sync failed:', err);
    return { success: false, error: err.message || 'Google Sheets sync failed' };
  }
}

/**
 * Sync entire inventory catalog to Google Sheets
 */
export async function syncInventoryToGoogleSheets(
  inventory: Product[],
  spreadsheetId: string
): Promise<GoogleSheetsSyncResult> {
  try {
    const token = await getAccessToken();
    if (!token) return { success: false, error: 'Google Account not signed in' };

    const rows = inventory.map((p) => [
      p.barcode,
      p.name,
      p.category,
      p.stock,
      p.price.toFixed(2),
      p.costPrice.toFixed(2),
      p.minStockAlert,
    ]);

    // Clear previous inventory values and overwrite
    await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Real-Time Inventory!A2:G1000:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Real-Time Inventory!A2:G:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );

    return {
      success: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      message: `Inventory catalog (${inventory.length} items) updated in Google Sheets`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Inventory sync failed' };
  }
}
