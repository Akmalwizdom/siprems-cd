import { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, Loader2, ChevronLeft, ChevronRight, History, FileSpreadsheet, FileText, Calendar, Printer, Coffee } from 'lucide-react';
import { Product, CartItem } from '../types';
import { formatIDR } from '../utils/currency';
import { Button } from '../components/ui/button';
import { API_BASE_URL } from '../config';
import { exportToExcel, exportToPDF, printReceipt, type TransactionExport, type TransactionDetail, type StoreProfile } from '../utils/export';
import { useToast } from '../components/ui/toast';
import { useAuth } from '../context/AuthContext';
import { AdminOnly } from '../components/auth/RoleGuard';
import { ConfirmDialog } from '../components/ui/confirm-dialog';

interface TransactionItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Transaction {
  id: string;
  date: string;
  total_amount: number;
  payment_method: string;
  order_types: string;
  items_count: number;
  items: TransactionItem[];
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export function Transaction() {
  const { showToast } = useToast();
  const { getAuthToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Payment and Order Type state
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [orderType, setOrderType] = useState<string>('dine-in');
  
  // Transaction History state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Date filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Print receipt dialog state
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [pendingReceiptData, setPendingReceiptData] = useState<TransactionDetail | null>(null);

  // Store profile for receipt
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);

  // Fetch store profile on mount
  useEffect(() => {
    const fetchStoreProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/settings/store`);
        if (response.ok) {
          const result = await response.json();
          if (result.status === 'success' && result.data) {
            setStoreProfile(result.data);
          }
        }
      } catch (error) {
        console.error('Error fetching store profile:', error);
      }
    };
    fetchStoreProfile();
  }, []);

  // Export handlers
  const handleExportExcel = () => {
    if (transactions.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'warning');
      return;
    }
    try {
      exportToExcel(transactions as TransactionExport[]);
      showToast('Data berhasil diekspor ke Excel', 'success');
    } catch (error) {
      console.error('Export Excel error:', error);
      showToast('Gagal mengekspor ke Excel', 'error');
    }
  };

  const handleExportPDF = () => {
    if (transactions.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'warning');
      return;
    }
    try {
      exportToPDF(transactions as TransactionExport[]);
      showToast('Laporan PDF berhasil dibuat', 'success');
    } catch (error) {
      console.error('Export PDF error:', error);
      showToast('Gagal membuat laporan PDF', 'error');
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchTransactions();
    }
  }, [activeTab, page, startDate, endDate]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/categories`);
      const data = await response.json();
      setCategories(['All', ...data.categories]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/products?limit=100`);
      const data = await response.json();
      const productData = data.data || data;
      setProducts(productData.map((p: any) => ({
        id: p.id.toString(),
        name: p.name,
        category: p.category,
        costPrice: parseFloat(p.cost_price),
        sellingPrice: parseFloat(p.selling_price),
        stock: p.stock,
        imageUrl: p.image_url || '',
        description: p.description || ''
      })));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setHistoryLoading(true);
    try {
      // Get auth token for authenticated API call
      const token = await getAuthToken();
      
      let url = `${API_BASE_URL}/transactions?page=${page}&limit=${limit}`;
      if (startDate) {
        url += `&startDate=${startDate}`;
      }
      if (endDate) {
        url += `&endDate=${endDate}`;
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, { headers });
      const data: PaginatedResponse<Transaction> = await response.json();
      setTransactions(data.data || []);
      setTotalPages(data.total_pages);
      setTotalItems(data.total);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.sellingPrice * item.quantity,
    0
  );
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    setLoading(true);
    try {
      const transactionData = {
        date: new Date().toISOString(),
        total_amount: total,
        payment_method: paymentMethod,
        order_types: orderType,
        items_count: cart.reduce((sum, item) => sum + item.quantity, 0),
        items: cart.map(item => ({
          product_id: parseInt(item.product.id),
          quantity: item.quantity,
          unit_price: item.product.sellingPrice,
          subtotal: item.product.sellingPrice * item.quantity
        }))
      };
      
      const response = await fetch(`${API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save transaction');
      }
      
      const result = await response.json();
      showToast(`Transaksi berhasil! Total: ${formatIDR(total)}`, 'success');
      
      // Prepare receipt data and show print confirmation dialog
      const receiptData: TransactionDetail = {
        id: result.transaction_id || 'TRX-TEMP',
        date: transactionData.date,
        total_amount: total,
        payment_method: paymentMethod,
        order_types: orderType,
        items: cart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.sellingPrice,
          subtotal: item.product.sellingPrice * item.quantity
        }))
      };
      setPendingReceiptData(receiptData);
      setShowPrintDialog(true);
      
      setCart([]);
      setPaymentMethod('Cash');
      setOrderType('dine-in');
      
      // Refresh products to update stock
      await fetchProducts();
    } catch (error) {
      console.error('Error saving transaction:', error);
      showToast(`Gagal menyimpan transaksi: ${error instanceof Error ? error.message : 'Kesalahan tidak diketahui'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div>
        <h1 className="text-slate-900 mb-4">Manajemen Transaksi</h1>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setActiveTab('pos')}
            className={`px-6 py-3 font-medium rounded-lg relative ${
              activeTab === 'pos'
                ? 'text-indigo-600 bg-indigo-50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Kasir
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium rounded-lg relative ${
              activeTab === 'history'
                ? 'text-indigo-600 bg-indigo-50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4 mr-2" />
            Riwayat Transaksi
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'pos' ? (
        <POSView
          products={products}
          loading={loading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
          cart={cart}
          addToCart={addToCart}
          updateQuantity={updateQuantity}
          removeFromCart={removeFromCart}
          subtotal={subtotal}
          tax={tax}
          total={total}
          handleCheckout={handleCheckout}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          orderType={orderType}
          setOrderType={setOrderType}
        />
      ) : (
        <HistoryView
          transactions={transactions}
          loading={historyLoading}
          page={page}
          setPage={setPage}
          limit={limit}
          totalPages={totalPages}
          totalItems={totalItems}
          formatDate={formatDate}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />
      )}

      {/* Print Receipt Confirmation Dialog */}
      <ConfirmDialog
        open={showPrintDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowPrintDialog(false);
            setPendingReceiptData(null);
          }
        }}
        title="Cetak Struk?"
        description="Transaksi berhasil disimpan. Apakah Anda ingin mencetak struk transaksi?"
        confirmText="Cetak Struk"
        cancelText="Tidak"
        onConfirm={() => {
          if (pendingReceiptData) {
            printReceipt(pendingReceiptData, storeProfile || undefined);
          }
        }}
      />
    </div>
  );
}

// POS View Component
function POSView({
  products,
  loading,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  categories,
  cart,
  addToCart,
  updateQuantity,
  removeFromCart,
  subtotal,
  tax,
  total,
  handleCheckout,
  paymentMethod,
  setPaymentMethod,
  orderType,
  setOrderType
}: any) {
  const filteredProducts = products.filter((product: Product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product Catalog */}
      <div className="lg:col-span-2 space-y-4">
        <div>
          <p className="text-slate-500">Pilih produk untuk membuat transaksi</p>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari produk..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                onClick={() => setSelectedCategory(category)}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500" style={{ width: '100%', gridColumn: '1 / -1', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Package className="w-12 h-12 text-slate-300 mb-2" />
              <p>Produk tidak ditemukan</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
            <Button
              key={product.id}
              variant="outline"
              onClick={() => addToCart(product)}
              className="h-auto bg-white rounded-xl p-4 border border-slate-200 hover:border-indigo-500 hover:shadow-md text-left flex-col items-stretch"
            >
              <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                {product.imageUrl ? (
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Coffee className="w-12 h-12 text-slate-400" />
                )}
              </div>
              <h3 className="text-slate-900 mb-1 line-clamp-1">{product.name}</h3>
              <p className="text-xs text-slate-500 mb-2">{product.category}</p>
              <div className="flex items-center justify-between">
                <span className="text-indigo-600">{formatIDR(product.sellingPrice)}</span>
                <span className="text-xs text-slate-500">Stok: {product.stock}</span>
              </div>
            </Button>
          ))
          )}
        </div>
      </div>

      {/* Shopping Cart */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl border border-slate-200 sticky top-24">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <ShoppingCart className="w-6 h-6 text-indigo-600" />
              <h2 className="text-slate-900">Pesanan Saat Ini</h2>
            </div>
            <p className="text-slate-500">{cart.length} barang</p>
          </div>

          <div className="p-6 max-h-96 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Keranjang kosong</p>
                <p className="text-xs text-slate-400 mt-1">Tambahkan produk untuk memulai</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex gap-3">
                    <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.product.imageUrl ? (
                        <img 
                          src={item.product.imageUrl} 
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Coffee className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-slate-900 truncate">{item.product.name}</h4>
                      <p className="text-slate-600">{formatIDR(item.product.sellingPrice)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => updateQuantity(item.product.id, -1)}
                        >
                          <Minus className="w-4 h-4 text-slate-600" />
                        </Button>
                        <span className="text-slate-900 w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => updateQuantity(item.product.id, 1)}
                        >
                          <Plus className="w-4 h-4 text-slate-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeFromCart(item.product.id)}
                          className="ml-auto text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-200 space-y-3">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatIDR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Pajak (10%)</span>
              <span>{formatIDR(tax)}</span>
            </div>
            <div className="flex justify-between text-slate-900 pt-3 border-t border-slate-200">
              <span>Total</span>
              <span>{formatIDR(total)}</span>
            </div>
            
            {/* Payment Method Selection */}
            <div className="pt-3 border-t border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Cash">Tunai</option>
                <option value="QRIS">QRIS</option>
                <option value="Debit Card">Kartu Debit</option>
                <option value="Credit Card">Kartu Kredit</option>
                <option value="E-Wallet">Dompet Digital</option>
              </select>
            </div>

            {/* Order Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Jenis Pesanan
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="dine-in">Makan di Tempat</option>
                <option value="takeaway">Bawa Pulang</option>
                <option value="delivery">Pesan Antar</option>
              </select>
            </div>

            <Button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full"
            >
              Bayar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// History View Component
function HistoryView({
  transactions,
  loading,
  page,
  setPage,
  limit,
  totalPages,
  totalItems,
  formatDate,
  onExportExcel,
  onExportPDF,
  startDate,
  setStartDate,
  endDate,
  setEndDate
}: any) {
  return (
    <div className="space-y-4">
      {/* Header with Date Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Riwayat Transaksi</h2>
          <p className="text-sm text-slate-500">Total {totalItems} transaksi</p>
        </div>
        
        {/* Date Filter - Admin Only */}
        <AdminOnly>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm text-slate-700 outline-none w-32"
                placeholder="Dari tanggal"
              />
            </div>
            <span className="text-slate-400">-</span>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm text-slate-700 outline-none w-32"
                placeholder="Sampai tanggal"
              />
            </div>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                Reset
              </Button>
            )}
          </div>
        </AdminOnly>
        
        {/* Export Buttons - Admin Only */}
        <AdminOnly>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onExportExcel}
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </Button>
            <Button
              variant="outline"
              onClick={onExportPDF}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        </AdminOnly>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-slate-700">Tanggal</th>
                <th className="px-6 py-4 text-left text-slate-700">ID Transaksi</th>
                <th className="px-6 py-4 text-left text-slate-700">Produk</th>
                <th className="px-6 py-4 text-left text-slate-700">Jenis</th>
                <th className="px-6 py-4 text-left text-slate-700">Pembayaran</th>
                <th className="px-6 py-4 text-left text-slate-700">Jumlah</th>
                <th className="px-6 py-4 text-left text-slate-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                  </td>
                </tr>
              ) : !transactions || transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    Tidak ada transaksi
                  </td>
                </tr>
              ) : (
                transactions.map((t: Transaction) => {
                  // Format product names to display
                  const productNames = t.items?.map(item => `${item.product_name} (${item.quantity}x)`) || [];
                  const displayProducts = productNames.length > 2 
                    ? `${productNames.slice(0, 2).join(', ')} +${productNames.length - 2} lainnya`
                    : productNames.join(', ') || '-';
                  
                  return (
                    <tr key={t.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 text-slate-600">{formatDate(t.date)}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.id.slice(0, 8)}...</td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs">
                        <span className="text-sm" title={productNames.join('\n')}>
                          {displayProducts}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 rounded-md text-xs text-slate-600 border border-slate-200">
                          {t.order_types || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{t.payment_method || 'Tunai'}</td>
                      <td className="px-6 py-4 text-slate-600">{t.items_count}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{formatIDR(t.total_amount)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Menampilkan {transactions && transactions.length > 0 ? (page - 1) * limit + 1 : 0} sampai {Math.min(page * limit, totalItems)} dari {totalItems} data
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p: number) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </Button>
            <span className="text-sm text-slate-600">
              Halaman {page} dari {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Package({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}
