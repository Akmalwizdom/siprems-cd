import { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, Loader2, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Product, CartItem } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

interface Transaction {
  id: string;
  date: string;
  total_amount: number;
  payment_method: string;
  order_types: string;
  items_count: number;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export function Transaction() {
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

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchTransactions();
    }
  }, [activeTab, page]);

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
      const response = await fetch(`${API_BASE_URL}/transactions?page=${page}&limit=${limit}`);
      const data: PaginatedResponse<Transaction> = await response.json();
      setTransactions(data.data);
      setTotalPages(data.total_pages);
      setTotalItems(data.total);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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
      alert(`Transaction completed successfully! Total: $${total.toFixed(2)}\nTransaction ID: ${result.transaction_id?.slice(0, 8)}...`);
      setCart([]);
      setPaymentMethod('Cash');
      setOrderType('dine-in');
      
      // Refresh products to update stock
      await fetchProducts();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert(`Failed to save transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div>
        <h1 className="text-slate-900 mb-4">Transaction Management</h1>
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === 'pos'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Point of Sale
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === 'history'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Transaction History
            </div>
          </button>
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
        />
      )}
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
          <p className="text-slate-500">Select products to create a transaction</p>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedCategory === category
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-8 text-slate-500">
              No products found
            </div>
          ) : (
            filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white rounded-xl p-4 border border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all text-left"
            >
              <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg mb-3 flex items-center justify-center">
                <Package className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-slate-900 mb-1 line-clamp-1">{product.name}</h3>
              <p className="text-xs text-slate-500 mb-2">{product.category}</p>
              <div className="flex items-center justify-between">
                <span className="text-indigo-600">${product.sellingPrice}</span>
                <span className="text-xs text-slate-500">Stock: {product.stock}</span>
              </div>
            </button>
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
              <h2 className="text-slate-900">Current Order</h2>
            </div>
            <p className="text-slate-500">{cart.length} item(s)</p>
          </div>

          <div className="p-6 max-h-96 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Cart is empty</p>
                <p className="text-xs text-slate-400 mt-1">Add products to start</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex gap-3">
                    <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-slate-900 truncate">{item.product.name}</h4>
                      <p className="text-slate-600">${item.product.sellingPrice}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="p-1 hover:bg-slate-100 rounded"
                        >
                          <Minus className="w-4 h-4 text-slate-600" />
                        </button>
                        <span className="text-slate-900 w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="p-1 hover:bg-slate-100 rounded"
                        >
                          <Plus className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="ml-auto p-1 hover:bg-red-50 rounded text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax (10%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-900 pt-3 border-t border-slate-200">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            
            {/* Payment Method Selection */}
            <div className="pt-3 border-t border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Cash">Cash</option>
                <option value="QRIS">QRIS</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Credit Card">Credit Card</option>
                <option value="E-Wallet">E-Wallet</option>
              </select>
            </div>

            {/* Order Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Order Type
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="dine-in">Dine In</option>
                <option value="takeaway">Takeaway</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              Checkout
            </button>
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
  formatDate
}: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left text-slate-700">Date</th>
              <th className="px-6 py-4 text-left text-slate-700">Transaction ID</th>
              <th className="px-6 py-4 text-left text-slate-700">Customer</th>
              <th className="px-6 py-4 text-left text-slate-700">Payment</th>
              <th className="px-6 py-4 text-left text-slate-700">Items</th>
              <th className="px-6 py-4 text-left text-slate-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center">
                  <div className="flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  </div>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  No transactions found
                </td>
              </tr>
            ) : (
              transactions.map((t: Transaction) => (
                <tr key={t.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-600">{formatDate(t.date)}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.id.slice(0, 8)}...</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 rounded-md text-xs text-slate-600 border border-slate-200">
                      {t.order_types || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{t.payment_method || 'Cash'}</td>
                  <td className="px-6 py-4 text-slate-600">{t.items_count}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">${t.total_amount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          Showing {transactions.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, totalItems)} of {totalItems} entries
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages || 1}
          </span>
          <button
            onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
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
