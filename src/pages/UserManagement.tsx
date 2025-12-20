import { useState, useEffect, useMemo } from 'react';
import { Users, Search, Shield, UserCheck, Loader2, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth, UserRole } from '../context/AuthContext';
import { useToast } from '../components/ui/toast';
import { API_BASE_URL } from '../config';
import { ConfirmDialog } from '../components/ui/confirm-dialog';

interface User {
  id: string;
  firebase_uid: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export function UserManagement() {
  const { getAuthToken } = useAuth();
  const { showToast } = useToast();
  
  // All users from API (cached for client-side filtering)
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Delete confirmation state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Load all users once on mount
  useEffect(() => {
    fetchAllUsers();
  }, []);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  // ============================================
  // CLIENT-SIDE FILTERING - INSTANT SEARCH
  // ============================================
  // Filter users locally based on search term
  // This provides INSTANT results without any API calls or loading
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) {
      return allUsers;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    return allUsers.filter(user => 
      user.email.toLowerCase().includes(searchLower) ||
      (user.display_name && user.display_name.toLowerCase().includes(searchLower))
    );
  }, [allUsers, searchTerm]);

  // Calculate pagination on filtered results
  const total = filteredUsers.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginatedUsers = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredUsers.slice(startIndex, startIndex + limit);
  }, [filteredUsers, page, limit]);

  const fetchAllUsers = async () => {
    try {
      const token = await getAuthToken();
      
      // Fetch all users with high limit for client-side filtering
      const response = await fetch(`${API_BASE_URL}/users?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setAllUsers(data.data);
      setIsInitialLoad(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast('Failed to fetch users', 'error');
      setIsInitialLoad(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const token = await getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update role');
      }

      showToast(`Role updated to ${newRole}`, 'success');
      fetchAllUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      showToast(error.message || 'Failed to update role', 'error');
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      const token = await getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      showToast('User deleted successfully', 'success');
      setUserToDelete(null);
      fetchAllUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      showToast(error.message || 'Failed to delete user', 'error');
      setUserToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola Pengguna</h1>
          <p className="text-slate-500 mt-1">
            Kelola pengguna dan hak akses mereka
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-600">{total} pengguna</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Cari berdasarkan email atau nama..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Tidak ada pengguna ditemukan</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Pengguna</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Role</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Bergabung</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-slate-500">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt={user.display_name || user.email}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-indigo-600 font-medium">
                            {(user.display_name || user.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-900">
                          {user.display_name || 'Unnamed User'}
                        </p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                      className={`px-3 py-1.5 rounded-lg border font-medium text-sm ${
                        user.role === 'admin'
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <option value="user">User (Kasir)</option>
                      <option value="admin">Admin (Pemilik)</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(user)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, total)} dari {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-slate-600">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-slate-50 rounded-lg p-4">
        <h3 className="font-medium text-slate-700 mb-2">Keterangan Role</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Admin (Pemilik)</p>
              <p className="text-sm text-slate-500">
                Akses penuh: kelola produk, laporan, prediksi, event, dan pengguna
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <UserCheck className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">User (Kasir)</p>
              <p className="text-sm text-slate-500">
                Akses terbatas: transaksi, lihat produk, dan profil pribadi
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
        title="Hapus Pengguna?"
        description={`Apakah Anda yakin ingin menghapus pengguna "${userToDelete?.email}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  );
}
