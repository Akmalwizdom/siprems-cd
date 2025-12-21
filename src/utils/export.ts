// Export utilities for transactions
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatIDR } from './currency';

export interface TransactionExport {
  id: string;
  date: string;
  total_amount: number;
  payment_method: string;
  order_types: string;
  items_count: number;
}

export interface TransactionDetail {
  id: string;
  date: string;
  total_amount: number;
  payment_method: string;
  order_types: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
}

/**
 * Export transactions to Excel file
 */
export function exportToExcel(transactions: TransactionExport[], filename: string = 'transaksi') {
  // Prepare data for Excel
  const excelData = transactions.map((t, index) => ({
    'No': index + 1,
    'ID Transaksi': t.id,
    'Tanggal': new Date(t.date).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    'Total': t.total_amount,
    'Metode Pembayaran': t.payment_method,
    'Tipe Order': t.order_types,
    'Jumlah Item': t.items_count
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 },   // No
    { wch: 15 },  // ID
    { wch: 30 },  // Tanggal
    { wch: 15 },  // Total
    { wch: 20 },  // Metode
    { wch: 15 },  // Tipe
    { wch: 12 }   // Jumlah Item
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transaksi');

  // Generate filename with date
  const date = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${date}.xlsx`;

  // Download file
  XLSX.writeFile(workbook, fullFilename);
}

/**
 * Export transactions to PDF file
 */
export function exportToPDF(transactions: TransactionExport[], filename: string = 'laporan_transaksi') {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.text('Laporan Transaksi', 14, 22);

  // Add date range info
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, 14, 30);

  // Add summary stats
  const totalRevenue = transactions.reduce((sum, t) => sum + t.total_amount, 0);
  const totalTransactions = transactions.length;

  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(`Total Transaksi: ${totalTransactions}`, 14, 40);
  doc.text(`Total Pendapatan: ${formatIDR(totalRevenue)}`, 14, 47);

  // Prepare table data
  const tableData = transactions.map((t, index) => [
    index + 1,
    t.id.substring(0, 8) + '...',
    new Date(t.date).toLocaleDateString('id-ID'),
    formatIDR(t.total_amount),
    t.payment_method,
    t.order_types,
    t.items_count
  ]);

  // Add table
  autoTable(doc, {
    startY: 55,
    head: [['No', 'ID', 'Tanggal', 'Total', 'Pembayaran', 'Tipe', 'Item']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 30 },
      4: { cellWidth: 25 },
      5: { cellWidth: 20 },
      6: { cellWidth: 15 }
    }
  });

  // Generate filename with date
  const date = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${date}.pdf`;

  // Download file
  doc.save(fullFilename);
}

/**
 * Print receipt for a transaction
 */
export interface StoreProfile {
  name: string;
  address: string;
  phone: string;
  logo_url: string;
}

export function printReceipt(transaction: TransactionDetail, storeProfile?: StoreProfile) {
  const storeName = storeProfile?.name || 'SIPREMS Store';
  const storeAddress = storeProfile?.address || '';
  const storePhone = storeProfile?.phone || '';
  const storeLogo = storeProfile?.logo_url || '';

  // Create a new window for printing
  const printWindow = window.open('', '_blank', 'width=500,height=600');
  if (!printWindow) {
    alert('Popup blocked! Mohon izinkan popup untuk mencetak struk.');
    return;
  }

  const logoHTML = storeLogo ? `
    <div class="logo-container">
      <img src="${storeLogo}" alt="${storeName}" class="store-logo" onerror="this.style.display='none'" />
    </div>
  ` : '';

  const addressHTML = storeAddress ? `<div class="store-address">${storeAddress}</div>` : '';
  const phoneHTML = storePhone ? `<div class="store-phone">Telp: ${storePhone}</div>` : '';

  const receiptHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Struk Transaksi</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          line-height: 1.2;
          background-color: #f5f5f5;
          padding: 20px;
          display: flex;
          justify-content: center;
        }
        .receipt {
          width: 80mm;
          background-color: #fff;
          padding: 5mm;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          position: relative;
        }
        
        .receipt-title {
          position: absolute;
          top: 5mm;
          right: 5mm;
          font-size: 10px;
          color: #666;
        }
        
        .header { text-align: center; margin-bottom: 5px; margin-top: 15px; }
        .logo-container { margin-bottom: 8px; }
        .store-logo { max-width: 60px; max-height: 60px; object-fit: contain; margin: 0 auto; display: block; }
        .store-name { font-size: 18px; font-weight: bold; text-transform: uppercase; margin-bottom: 3px; }
        .store-address { font-size: 10px; color: #000; margin-bottom: 2px; white-space: pre-line; }
        .store-phone { font-size: 10px; color: #000; margin-bottom: 2px; }
        
        .divider { 
            border-top: 1px dashed #000; 
            margin: 10px 0; 
            width: 100%;
        }
        
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
        .label { color: #000; }
        .value { text-align: right; }
        
        .usage-section { margin-top: 10px; }
        
        .items-header { 
            margin-bottom: 5px; 
            font-weight: bold; 
            text-transform: uppercase; 
            font-size: 11px;
        }

        .item-row { 
            margin-bottom: 6px; 
            padding-bottom: 2px;
        }
        .item-name { 
            font-weight: bold; 
            margin-bottom: 2px;
            display: block;
        }
        .item-details { 
            display: flex; 
            justify-content: space-between; 
            font-size: 11px;
            padding-left: 0;
        }
        
        .total-section { margin-top: 5px; }
        .total-row { 
            display: flex; 
            justify-content: space-between; 
            margin: 8px 0; 
            font-size: 14px; 
            font-weight: bold; 
        }
        
        .footer { 
            text-align: center; 
            margin-top: 20px; 
            font-size: 10px; 
            color: #000;
        }
        
        @media print {
          body { 
            background-color: #fff;
            padding: 0;
            display: block;
          }
          .receipt {
            box-shadow: none;
            width: 100%;
            padding: 0;
            margin: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="receipt-title">Struk Transaksi</div>
        <div class="header">
          ${logoHTML}
          <div class="store-name">${storeName}</div>
          ${addressHTML}
          ${phoneHTML}
        </div>
        
        <div class="divider"></div>
        
        <div class="row">
          <span class="label">Tanggal</span>
          <span class="value">${new Date(transaction.date).toLocaleDateString('id-ID')}</span>
        </div>
        <div class="row">
          <span class="label">Waktu</span>
          <span class="value">${new Date(transaction.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="row">
          <span class="label">ID</span>
          <span class="value">#${transaction.id.substring(0, 8)}</span>
        </div>
        <div class="row">
          <span class="label">Tipe</span>
          <span class="value" style="text-transform: capitalize;">${transaction.order_types}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="items-section">
          ${transaction.items.map(item => `
            <div class="item-row">
              <span class="item-name">${item.name}</span>
              <div class="item-details">
                <span>${item.quantity} x ${formatIDR(item.price)}</span>
                <span>${formatIDR(item.subtotal)}</span>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="divider"></div>
        
        <div class="total-section">
          <div class="total-row">
            <span>TOTAL</span>
            <span>${formatIDR(transaction.total_amount)}</span>
          </div>
          <div class="row">
            <span class="label">Metode Pembayaran</span>
            <span class="value">${transaction.payment_method}</span>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="footer">
          <p>Terima kasih atas kunjungan Anda!</p>
          <p style="margin-top: 4px;">~ Simpan struk ini sebagai bukti pembayaran ~</p>
        </div>
      </div>
      
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            // Optional: window.close() after print if needed, but many users prefer to keep it open to verify
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(receiptHTML);
  printWindow.document.close();
}
