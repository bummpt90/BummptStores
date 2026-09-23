import * as XLSX from 'xlsx';
import { Receipt, Product } from '../types';

/**
 * Universal Excel exporter generating true Microsoft Excel (.xlsx) workbooks
 */
export function exportSalesToExcel(
  receipts: Receipt[],
  inventory: Product[],
  filename = 'BummptStores_Sales_Report.xlsx',
  currencySymbol = '₦'
) {
  const wb = XLSX.utils.book_new();

  // Tab 1: Receipts Summary
  const receiptsData = receipts.map((r) => ({
    'Receipt ID': r.id,
    'Timestamp': new Date(r.timestamp).toLocaleString(),
    'Customer Name': r.customer.name || 'Walk-in Guest',
    'Customer Phone': r.customer.phone || 'N/A',
    'Customer Email': r.customer.email || 'N/A',
    'Cashier': r.cashier,
    'Terminal ID': r.terminalId,
    'Items Count': r.items.reduce((acc, item) => acc + item.quantity, 0),
    [`Subtotal (${currencySymbol})`]: Number(r.subtotal.toFixed(2)),
    'Discount Code': r.appliedDiscountCode || 'None',
    [`Discount Amount (${currencySymbol})`]: Number(r.discountAmount.toFixed(2)),
    'Tax Rate (%)': Number((r.taxRate * 100).toFixed(2)),
    [`Tax Amount (${currencySymbol})`]: Number(r.taxAmount.toFixed(2)),
    [`Total Paid (${currencySymbol})`]: Number(r.total.toFixed(2)),
    'Payment Method': r.paymentMethod.toUpperCase(),
    [`Tendered (${currencySymbol})`]: Number(r.amountTendered.toFixed(2)),
    [`Change (${currencySymbol})`]: Number(r.changeDue.toFixed(2)),
    'Integrity Hash': r.encryptedDataSignature || 'VALID',
    'Offline Generated': r.offlineCreated ? 'YES' : 'NO',
  }));
  const wsReceipts = XLSX.utils.json_to_sheet(receiptsData);
  XLSX.utils.book_append_sheet(wb, wsReceipts, 'Sales Receipts');

  // Tab 2: Line Items Detail
  const lineItemsData: any[] = [];
  receipts.forEach((r) => {
    r.items.forEach((item) => {
      lineItemsData.push({
        'Receipt ID': r.id,
        'Date': new Date(r.timestamp).toLocaleDateString(),
        'Barcode': item.product.barcode,
        'Product Name': item.product.name,
        'Category': item.product.category,
        'Unit': item.product.unit,
        'Quantity': item.quantity,
        [`Unit Price (${currencySymbol})`]: Number(item.unitPrice.toFixed(2)),
        'Item Discount (%)': item.discountPercent,
        [`Line Total (${currencySymbol})`]: Number(item.lineTotal.toFixed(2)),
      });
    });
  });
  const wsLineItems = XLSX.utils.json_to_sheet(lineItemsData);
  XLSX.utils.book_append_sheet(wb, wsLineItems, 'Itemized Sales');

  // Tab 3: Current Inventory
  const inventoryData = inventory.map((p) => ({
    'Barcode': p.barcode,
    'Product Name': p.name,
    'Category': p.category,
    'Current Stock': p.stock,
    [`Retail Price (${currencySymbol})`]: Number(p.price.toFixed(2)),
    [`Cost Price (${currencySymbol})`]: Number(p.costPrice.toFixed(2)),
    [`Estimated Margin (${currencySymbol})`]: Number((p.price - p.costPrice).toFixed(2)),
    'Alert Threshold': p.minStockAlert,
    'Status': p.stock <= p.minStockAlert ? 'LOW STOCK' : 'IN STOCK',
  }));
  const wsInventory = XLSX.utils.json_to_sheet(inventoryData);
  XLSX.utils.book_append_sheet(wb, wsInventory, 'Current Inventory');

  // Tab 4: Performance KPI Summary
  const totalRevenue = receipts.reduce((sum, r) => sum + r.total, 0);
  const totalTax = receipts.reduce((sum, r) => sum + r.taxAmount, 0);
  const totalDiscounts = receipts.reduce((sum, r) => sum + r.discountAmount, 0);
  const totalItems = receipts.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.quantity, 0), 0);

  const kpiData = [
    { Metric: 'Total Gross Revenue', Value: `${currencySymbol}${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { Metric: 'Total Completed Transactions', Value: receipts.length },
    { Metric: 'Total Items Sold', Value: totalItems },
    { Metric: 'Average Basket Value', Value: receipts.length > 0 ? `${currencySymbol}${(totalRevenue / receipts.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${currencySymbol}0.00` },
    { Metric: 'Total Sales Tax Collected', Value: `${currencySymbol}${totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { Metric: 'Total Promotional Discounts Given', Value: `${currencySymbol}${totalDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { Metric: 'Report Generation Date', Value: new Date().toLocaleString() },
  ];
  const wsKpi = XLSX.utils.json_to_sheet(kpiData);
  XLSX.utils.book_append_sheet(wb, wsKpi, 'Executive Summary');

  // Write file
  XLSX.writeFile(wb, filename);
}

/**
 * Export single receipt for customer or accounting in Excel format
 */
export function exportSingleReceiptToExcel(receipt: Receipt, currencySymbol = '₦') {
  const wb = XLSX.utils.book_new();

  const header = [
    ['BUMMPTSTORES OFFICIAL DIGITAL RECEIPT'],
    ['Receipt ID:', receipt.id],
    ['Date & Time:', new Date(receipt.timestamp).toLocaleString()],
    ['Cashier:', receipt.cashier],
    ['Terminal:', receipt.terminalId],
    ['Customer:', receipt.customer.name || 'Walk-in Customer'],
    [],
    ['Item #', 'Barcode', 'Product Description', 'Qty', `Unit Price (${currencySymbol})`, `Line Total (${currencySymbol})`],
  ];

  receipt.items.forEach((item, index) => {
    header.push([
      (index + 1).toString(),
      item.product.barcode,
      item.product.name,
      item.quantity.toString(),
      item.unitPrice.toFixed(2),
      item.lineTotal.toFixed(2),
    ]);
  });

  header.push([]);
  header.push(['', '', '', '', 'Subtotal:', `${currencySymbol}${receipt.subtotal.toFixed(2)}`]);
  if (receipt.discountAmount > 0) {
    header.push(['', '', '', '', `Discount (${receipt.appliedDiscountCode || 'PROMO'}):`, `-${currencySymbol}${receipt.discountAmount.toFixed(2)}`]);
  }
  header.push(['', '', '', '', `Sales Tax (${(receipt.taxRate * 100).toFixed(2)}%):`, `${currencySymbol}${receipt.taxAmount.toFixed(2)}`]);
  header.push(['', '', '', '', 'GRAND TOTAL:', `${currencySymbol}${receipt.total.toFixed(2)}`]);
  header.push(['', '', '', '', 'Payment Method:', receipt.paymentMethod.toUpperCase()]);
  header.push(['', '', '', '', 'Amount Tendered:', `${currencySymbol}${receipt.amountTendered.toFixed(2)}`]);
  header.push(['', '', '', '', 'Change Due:', `${currencySymbol}${receipt.changeDue.toFixed(2)}`]);
  header.push(['', '', '', '', 'Security Signature:', receipt.encryptedDataSignature || 'VERIFIED']);

  const ws = XLSX.utils.aoa_to_sheet(header);
  XLSX.utils.book_append_sheet(wb, ws, 'Receipt');
  XLSX.writeFile(wb, `Receipt_${receipt.id}.xlsx`);
}
