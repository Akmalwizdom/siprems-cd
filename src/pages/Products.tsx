import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Upload, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import { formatIDR } from '../utils/currency';
import { Button } from '../components/ui/button';
import { API_BASE_URL } from '../config';
import { AdminOnly } from '../components/auth/RoleGuard';
import { ConfirmDialog } from '../components/ui/confirm-dialog';

export function Products() {
  // All products from API (cached for client-side filtering)
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: '',
    costPrice: 0,
    sellingPrice: 0,
    stock: 0,
    description: '',
  });

  // Delete confirmation dialog state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Load all products once on mount
  useEffect(() => {
    fetchCategories();
    fetchAllProducts();
  }, []);

  // Reset to page 1 when search or category changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory]);

  // ============================================
  // CLIENT-SIDE FILTERING - INSTANT SEARCH
  // ============================================
  // Filter products locally based on search term and category
  // This provides INSTANT results without any API calls or loading
  const filteredProducts = useMemo(() => {
    let result = allProducts;

    // Filter by category
    if (selectedCategory && selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Filter by search term (case-insensitive)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.category.toLowerCase().includes(searchLower) ||
        (p.description && p.description.toLowerCase().includes(searchLower))
      );
    }

    return result;
  }, [allProducts, searchTerm, selectedCategory]);

  // Calculate pagination on filtered results
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const paginatedProducts = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredProducts.slice(startIndex, startIndex + limit);
  }, [filteredProducts, page, limit]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/categories`);
      const data = await response.json();
      setCategories(['All', ...data.categories]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Fetch ALL products once for client-side filtering
  const fetchAllProducts = async () => {
    try {
      // Fetch with a high limit to get all products
      const response = await fetch(`${API_BASE_URL}/products?limit=1000`);
      const data = await response.json();
      
      const products = data.data.map((p: any) => ({
        id: p.id.toString(),
        name: p.name,
        category: p.category,
        costPrice: parseFloat(p.cost_price),
        sellingPrice: parseFloat(p.selling_price),
        stock: p.stock,
        description: p.description || ''
      }));
      
      setAllProducts(products);
      setIsInitialLoad(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setIsInitialLoad(false);
    }
  };


  const getStockStatus = (stock: number): 'critical' | 'low' | 'good' => {
    if (stock < 5) return 'critical';
    if (stock < 20) return 'low';
    return 'good';
  };

  const getStockColor = (stock: number): string => {
    const status = getStockStatus(stock);
    return {
      critical: 'text-red-600 bg-red-50',
      low: 'text-yellow-600 bg-yellow-50',
      good: 'text-green-600 bg-green-50',
    }[status];
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        category: '',
        costPrice: 0,
        sellingPrice: 0,
        stock: 0,
        description: '',
      });
      setSelectedFile(null);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      category: '',
      costPrice: 0,
      sellingPrice: 0,
      stock: 0,
      description: '',
    });
    setSelectedFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProduct) {
      setAllProducts(
        allProducts.map((p) =>
          p.id === editingProduct.id ? { ...formData as Product, id: editingProduct.id } : p
        )
      );
    } else {
      const newProduct: Product = {
        ...formData as Product,
        id: Date.now().toString(),
      };
      setAllProducts([...allProducts, newProduct]);
    }
    
    closeModal();
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
  };

  const handleDeleteConfirm = () => {
    if (productToDelete) {
      setAllProducts(allProducts.filter((p) => p.id !== productToDelete.id));
      setProductToDelete(null);
    }
  };

  // Only show full-page loading on initial load
  if (isInitialLoad && allProducts.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-1">Produk</h1>
          <p className="text-slate-500">Kelola inventaris Anda</p>
        </div>
        <AdminOnly>
          <Button onClick={() => openModal()}>
            <Plus className="w-5 h-5" />
            Tambah Produk
          </Button>
        </AdminOnly>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari produk..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  setPage(1);
                }}
                variant={selectedCategory === category ? 'default' : 'secondary'}
                size="sm"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-slate-700">Nama Produk</th>
                <th className="px-6 py-4 text-left text-slate-700">Kategori</th>
                <th className="px-6 py-4 text-left text-slate-700">Harga Modal</th>
                <th className="px-6 py-4 text-left text-slate-700">Harga Jual</th>
                <th className="px-6 py-4 text-left text-slate-700">Stok</th>
                <th className="px-6 py-4 text-left text-slate-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Produk tidak ditemukan
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                <tr key={product.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-slate-900">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-slate-500 mt-1">{product.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-900">{formatIDR(product.costPrice)}</td>
                  <td className="px-6 py-4 text-slate-900">{formatIDR(product.sellingPrice)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full ${getStockColor(product.stock)}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <AdminOnly>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openModal(product)}
                          className="text-slate-600 hover:text-indigo-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteClick(product)}
                          className="text-slate-600 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </AdminOnly>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Menampilkan {paginatedProducts.length > 0 ? (page - 1) * limit + 1 : 0} sampai {Math.min(page * limit, totalItems)} dari {totalItems} produk
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </Button>
              <span className="text-sm text-slate-600">
                Halaman {page} dari {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-slate-900">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h2>
              <Button variant="ghost" size="icon-sm" onClick={closeModal}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-700 mb-2">Nama Produk *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Masukkan nama produk"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-2">Kategori *</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Pilih kategori</option>
                  <option value="Coffee">Coffee</option>
                  <option value="Tea">Tea</option>
                  <option value="Non-Coffee">Non-Coffee</option>
                  <option value="Pastry">Pastry</option>
                  <option value="Light Meals">Light Meals</option>
                  <option value="Seasonal">Seasonal</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 mb-2">Harga Modal *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, costPrice: parseFloat(e.target.value) })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-2">Harga Jual *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-2">Jumlah Stok *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-2">Gambar Produk</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-indigo-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <Upload className="w-12 h-12 text-slate-400 mb-3" />
                    {selectedFile ? (
                      <div className="text-center">
                        <p className="text-slate-900">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-slate-700">Klik untuk unggah atau seret file</p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG maksimal 5MB</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-2">Deskripsi</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3}
                  placeholder="Masukkan deskripsi produk"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button type="submit" className="flex-1">
                  {editingProduct ? 'Perbarui Produk' : 'Tambah Produk'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!productToDelete}
        onOpenChange={(open) => !open && setProductToDelete(null)}
        title="Hapus Produk?"
        description={`Apakah Anda yakin ingin menghapus produk "${productToDelete?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  );
}
