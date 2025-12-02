import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatIDR } from '../utils/currency';

const API_BASE_URL = 'http://localhost:8000/api';

interface Transaction {
  id: string;
  date: string;
  total_amount: number;
  payment_method: string;
  customer_segment: string;
  items_count: number;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    fetchTransactions();
  }, [page]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/transactions?page=${page}&limit=${limit}`);
      const data: PaginatedResponse<Transaction> = await response.json();
      setTransactions(data.data);
      setTotalPages(data.total_pages);
      setTotalItems(data.total);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-1">Transaction History</h1>
          <p className="text-slate-500">View all past transactions</p>
        </div>
      </div>

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
                transactions.map((t) => (
                  <tr key={t.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-600">{formatDate(t.date)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.id.slice(0, 8)}...</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 rounded-md text-xs text-slate-600 border border-slate-200">
                        {t.customer_segment || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{t.payment_method || 'Cash'}</td>
                    <td className="px-6 py-4 text-slate-600">{t.items_count}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{formatIDR(t.total_amount)}</td>
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
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="text-sm text-slate-600">
                    Page {page} of {totalPages || 1}
                </span>
                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
