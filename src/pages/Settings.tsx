import { useState, useEffect } from 'react';
import { User, Camera, Lock, LogOut, Loader2, Check, X, Mail, Building, Phone, MapPin, Save, Brain, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth, getFirebaseErrorMessage } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { AuthError } from 'firebase/auth';
import { AdminOnly } from '../components/auth/RoleGuard';
import { API_BASE_URL } from '../config';

interface StoreProfile {
  name: string;
  address: string;
  phone: string;
  logo: string;
}

export function Settings() {
  const { user, updateDisplayName, updatePhotoURL, updateUserPassword, logout, getAuthToken } = useAuth();
  const { showToast } = useToast();
  
  // Display name state
  const [displayName, setDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  
  // Photo URL state
  const [photoURL, setPhotoURL] = useState('');
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  
  // Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  // Logout state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Store Profile state
  const [storeProfile, setStoreProfile] = useState<StoreProfile>({
    name: '',
    address: '',
    phone: '',
    logo: ''
  });
  const [storeLoading, setStoreLoading] = useState(false);
  const [isEditingLogo, setIsEditingLogo] = useState(false);

  // ML Model state
  const [modelStatus, setModelStatus] = useState<{
    exists: boolean;
    accuracy: number | null;
    lastTrained: string | null;
    dataPoints: number | null;
  } | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [retrainLoading, setRetrainLoading] = useState(false);

  // Load user data
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
    }
  }, [user]);

  // Load store profile from API
  useEffect(() => {
    const fetchStoreProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/settings/store`);
        if (response.ok) {
          const result = await response.json();
          if (result.status === 'success' && result.data) {
            setStoreProfile({
              name: result.data.name || '',
              address: result.data.address || '',
              phone: result.data.phone || '',
              logo: result.data.logo_url || ''
            });
          }
        }
      } catch (error) {
        console.error('Error fetching store profile:', error);
      }
    };
    fetchStoreProfile();
  }, []);

  // Load ML model status
  useEffect(() => {
    const fetchModelStatus = async () => {
      setModelLoading(true);
      try {
        const token = await getAuthToken();
        const response = await fetch(`${API_BASE_URL}/forecast/model/store_1/status`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const result = await response.json();
          if (result.status === 'success' && result.model) {
            setModelStatus({
              exists: result.model.exists || false,
              accuracy: result.model.accuracy || null,
              lastTrained: result.model.last_trained || null,
              dataPoints: result.model.data_points || null,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching model status:', error);
      } finally {
        setModelLoading(false);
      }
    };
    fetchModelStatus();
  }, [getAuthToken]);

  // Handle model retrain
  const handleRetrainModel = async () => {
    setRetrainLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        showToast('Anda harus login untuk melatih ulang model', 'error');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forecast/train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ store_id: 'store_1', force_retrain: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Training failed');
      }

      showToast('Model berhasil dilatih ulang!', 'success');
      
      // Refresh model status
      setModelStatus({
        exists: true,
        accuracy: result.metadata?.accuracy || null,
        lastTrained: new Date().toISOString(),
        dataPoints: result.metadata?.data_points || null,
      });
    } catch (error: any) {
      console.error('Error retraining model:', error);
      showToast(error.message || 'Gagal melatih ulang model', 'error');
    } finally {
      setRetrainLoading(false);
    }
  };

  // Handle display name update
  const handleUpdateName = async () => {
    if (!displayName.trim()) {
      showToast('Nama tidak boleh kosong', 'error');
      return;
    }
    
    setNameLoading(true);
    try {
      await updateDisplayName(displayName.trim());
      showToast('Nama berhasil diubah', 'success');
      setIsEditingName(false);
    } catch (error) {
      showToast(getFirebaseErrorMessage(error as AuthError), 'error');
    } finally {
      setNameLoading(false);
    }
  };

  // Handle photo file upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran file maksimal 5MB', 'error');
      return;
    }

    setPhotoLoading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        const token = await getAuthToken();
        const response = await fetch(`${API_BASE_URL}/users/avatar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ image: base64 }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        const result = await response.json();
        setPhotoURL(result.avatar_url);
        await updatePhotoURL(result.avatar_url);
        showToast('Foto profil berhasil diubah', 'success');
        setIsEditingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      showToast(error.message || 'Gagal mengunggah foto', 'error');
    } finally {
      setPhotoLoading(false);
    }
  };

  // Handle password update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    if (newPassword.length < 6) {
      setPasswordError('Password baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Password baru tidak cocok');
      return;
    }
    
    setPasswordLoading(true);
    try {
      await updateUserPassword(currentPassword, newPassword);
      showToast('Password berhasil diubah', 'success');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(getFirebaseErrorMessage(error as AuthError));
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      showToast('Berhasil logout', 'success');
    } catch (error) {
      showToast('Gagal logout', 'error');
    } finally {
      setLogoutLoading(false);
    }
  };

  // Handle store profile save
  const handleSaveStoreProfile = async () => {
    setStoreLoading(true);
    try {
      // Get auth token with validation
      let token: string | null = null;
      try {
        token = await getAuthToken();
      } catch (authError) {
        console.error('Auth token error:', authError);
        showToast('Sesi Anda telah berakhir. Silakan login ulang.', 'error');
        setStoreLoading(false);
        return;
      }

      if (!token) {
        showToast('Anda harus login untuk menyimpan pengaturan', 'error');
        setStoreLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/settings/store`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: storeProfile.name,
          address: storeProfile.address,
          phone: storeProfile.phone,
          logo_url: storeProfile.logo
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to save store profile');
      }

      // Success - always show toast
      showToast('Profil toko berhasil disimpan', 'success');
    } catch (error: any) {
      console.error('Error saving store profile:', error);
      // Provide more specific error messages
      let errorMessage = 'Gagal menyimpan profil toko';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.name === 'TypeError' && error.message?.includes('fetch')) {
        errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
      }
      showToast(errorMessage, 'error');
    } finally {
      setStoreLoading(false);
    }
  };

  // Handle store logo file upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran file maksimal 5MB', 'error');
      return;
    }

    setStoreLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        
        const token = await getAuthToken();
        const response = await fetch(`${API_BASE_URL}/settings/store/logo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ image: base64 }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();
        setStoreProfile({ ...storeProfile, logo: result.logo_url });
        showToast('Logo toko berhasil diunggah', 'success');
        setIsEditingLogo(false);
      } catch (error: any) {
        console.error('Error uploading logo:', error);
        showToast(error.message || 'Gagal mengunggah logo', 'error');
      } finally {
        setStoreLoading(false);
      }
    };
    reader.onerror = () => {
      showToast('Gagal membaca file', 'error');
      setStoreLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Check if user logged in with Google
  const isGoogleUser = user?.providerData?.[0]?.providerId === 'google.com';

  return (
    <div className="space-y-6">
      <style>{`
        .settings-input {
          transition: all 0.2s ease-in-out !important;
          outline: none !important;
        }
        .settings-input:hover {
          border-color: #4f46e5 !important; /* indigo-600 */
        }
        .settings-input:focus {
          border-color: #4f46e5 !important;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1) !important;
          background-color: #ffffff !important;
        }
      `}</style>
      
      {/* Header */}
      <div>
        <h1 className="text-slate-900 mb-1">Pengaturan</h1>
        <p className="text-slate-500">Kelola profil akun dan toko Anda</p>
      </div>

      {/* Two Column Layout - Auto-wrapping for reliable side-by-side */}
      <div className="flex flex-wrap gap-6">
        
        {/* LEFT: Profile Account */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 min-w-[350px] w-full">
          {/* Profile Header */}
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              Profil Akun
            </h2>
          </div>

          {/* Profile Photo */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="relative">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Profile" 
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-slate-200">
                    <User className="w-8 h-8 text-indigo-600" />
                  </div>
                )}
                <button 
                  onClick={() => setIsEditingPhoto(!isEditingPhoto)}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-indigo-600 rounded-full text-white hover:bg-indigo-700 transition-colors shadow-md border-2 border-white"
                >
                  <Camera className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{user?.displayName || 'Pengguna'}</p>
                <p className="text-sm text-slate-500 flex items-center gap-1 truncate">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  {user?.email}
                </p>
              </div>
            </div>
            
            {isEditingPhoto && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                <label className="block text-xs text-slate-700 mb-2">Upload Foto Profil</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 transition-colors">
                      <Camera className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-600">Pilih Gambar</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {photoLoading && <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />}
                  <Button size="sm" variant="outline" onClick={() => setIsEditingPhoto(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">Format: JPG, PNG. Maksimal 5MB</p>
              </div>
            )}
          </div>

          {/* Display Name */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-500 mb-1">Nama Tampilan</p>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg settings-input text-sm"
                      placeholder="Masukkan nama"
                    />
                    <Button size="sm" onClick={handleUpdateName} disabled={nameLoading}>
                      {nameLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditingName(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="font-medium text-slate-900 truncate">{user?.displayName || 'Belum diatur'}</p>
                )}
              </div>
              {!isEditingName && (
                <Button variant="outline" size="sm" onClick={() => setIsEditingName(true)}>
                  Ubah
                </Button>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-500 mb-1">Email</p>
                <p className="font-medium text-slate-900 truncate">{user?.email}</p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded flex-shrink-0">Tidak dapat diubah</span>
            </div>
          </div>

          {/* Password */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg flex-shrink-0">
                  <Lock className="w-4 h-4 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 text-sm">Password</p>
                  <p className="text-xs text-slate-500 truncate">
                    {isGoogleUser ? 'Login menggunakan Google' : 'Ubah password akun'}
                  </p>
                </div>
              </div>
              {!isGoogleUser && (
                <Button variant="outline" size="sm" onClick={() => setShowPasswordModal(true)}>
                  Ubah
                </Button>
              )}
            </div>
          </div>

          {/* Logout */}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                  <LogOut className="w-4 h-4 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 text-sm">Logout</p>
                  <p className="text-xs text-slate-500">Keluar dari akun</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowLogoutConfirm(true)}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT: Store Profile - Admin Only */}
        <AdminOnly>
          <div className="bg-white rounded-xl border border-slate-200 flex-1 min-w-[350px] w-full">
            {/* Store Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-600" />
                Profil Toko
              </h2>
              <Button size="sm" onClick={handleSaveStoreProfile} disabled={storeLoading}>
                {storeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="ml-1">Simpan</span>
              </Button>
            </div>

            {/* Store Logo */}
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16" style={{ zIndex: 1 }}>
                  {storeProfile.logo ? (
                    <img 
                      src={storeProfile.logo} 
                      alt="Store Logo" 
                      className="w-16 h-16 rounded-lg object-cover border-2 border-slate-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-indigo-100 flex items-center justify-center border-2 border-dashed border-slate-300">
                      <Building className="w-8 h-8 text-indigo-600" />
                    </div>
                  )}
                  <button 
                    onClick={() => setIsEditingLogo(!isEditingLogo)}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-indigo-600 rounded-full text-white hover:bg-indigo-700 transition-colors shadow-md border-2 border-white"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{storeProfile.name || 'Nama Toko'}</p>
                  <p className="text-sm text-slate-500 mt-1">Logo untuk struk & laporan</p>
                </div>
              </div>
              
              {isEditingLogo && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                  <label className="block text-xs text-slate-700 mb-2">Upload Logo Toko</label>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 transition-colors">
                        <Camera className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600">Pilih Logo</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                    {storeLoading && <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />}
                    <Button size="sm" variant="outline" onClick={() => setIsEditingLogo(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Format: JPG, PNG. Maksimal 5MB. Akan tampil di struk.</p>
                </div>
              )}
            </div>

            {/* Store Name */}
            <div className="p-6 border-b border-slate-100">
              <label className="block text-sm text-slate-500 mb-2 flex items-center gap-1">
                <Building className="w-4 h-4" />
                Nama Toko
              </label>
              <input
                type="text"
                value={storeProfile.name}
                onChange={(e) => setStoreProfile({ ...storeProfile, name: e.target.value })}
                placeholder="Masukkan nama toko"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg settings-input"
              />
            </div>

            {/* Store Phone */}
            <div className="p-6 border-b border-slate-100">
              <label className="block text-sm text-slate-500 mb-2 flex items-center gap-1">
                <Phone className="w-4 h-4" />
                No. Telepon
              </label>
              <input
                type="tel"
                value={storeProfile.phone}
                onChange={(e) => setStoreProfile({ ...storeProfile, phone: e.target.value })}
                placeholder="+62 812 3456 7890"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg settings-input"
              />
            </div>

            {/* Store Address */}
            <div className="p-6">
              <label className="block text-sm text-slate-500 mb-2 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Alamat Toko
              </label>
              <textarea
                value={storeProfile.address}
                onChange={(e) => setStoreProfile({ ...storeProfile, address: e.target.value })}
                placeholder="Masukkan alamat lengkap toko"
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg settings-input resize-none"
              />
            </div>
          </div>
        </AdminOnly>

      </div>

      {/* ML Model Management - Admin Only */}
      <AdminOnly>
          <div className="bg-white rounded-xl border border-slate-200 w-full">
            {/* ML Model Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                Model Prediksi
              </h2>
              <Button 
                size="sm" 
                onClick={handleRetrainModel} 
                disabled={retrainLoading}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {retrainLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-1">{retrainLoading ? 'Melatih...' : 'Latih Ulang'}</span>
              </Button>
            </div>

            {/* Model Status */}
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${modelStatus?.exists ? 'bg-green-100' : 'bg-amber-100'}`}>
                  {modelStatus?.exists ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">
                    {modelLoading ? 'Memuat status...' : modelStatus?.exists ? 'Model Aktif' : 'Model Belum Dilatih'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {modelStatus?.exists 
                      ? 'Model Prophet siap digunakan untuk prediksi'
                      : 'Latih model untuk mengaktifkan fitur prediksi'}
                  </p>
                </div>
              </div>
            </div>

            {/* Model Details */}
            {modelStatus?.exists && (
              <>
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Akurasi Model</p>
                      <p className="text-2xl font-semibold text-slate-900">
                        {modelStatus.accuracy ? `${modelStatus.accuracy}%` : 'N/A'}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      modelStatus.accuracy && modelStatus.accuracy >= 85 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {modelStatus.accuracy && modelStatus.accuracy >= 85 ? 'Baik' : 'Cukup'}
                    </div>
                  </div>
                </div>

                <div className="p-6 border-b border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">Terakhir Dilatih</p>
                  <p className="font-medium text-slate-900">
                    {modelStatus.lastTrained 
                      ? new Date(modelStatus.lastTrained).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })
                      : 'Belum pernah dilatih'}
                  </p>
                </div>

                <div className="p-6">
                  <p className="text-sm text-slate-500 mb-1">Data Training</p>
                  <p className="font-medium text-slate-900">
                    {modelStatus.dataPoints ? `${modelStatus.dataPoints} data poin` : 'N/A'}
                  </p>
                </div>
              </>
            )}

            {/* Info Box */}
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                💡 Latih ulang model secara berkala untuk memasukkan data transaksi terbaru dan meningkatkan akurasi prediksi.
              </p>
            </div>
          </div>
        </AdminOnly>


      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Ubah Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {passwordError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg mb-4 text-sm">
                {passwordError}
              </div>
            )}
            
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1">Password Saat Ini</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg settings-input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg settings-input"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg settings-input"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPasswordModal(false)}>
                  Batal
                </Button>
                <Button type="submit" className="flex-1" disabled={passwordLoading}>
                  {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Konfirmasi Logout</h3>
            <p className="text-slate-500 mb-6">
              Apakah Anda yakin ingin logout dari akun ini?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowLogoutConfirm(false)}>
                Batal
              </Button>
              <Button 
                className="flex-1 bg-red-600 hover:bg-red-700" 
                onClick={handleLogout}
                disabled={logoutLoading}
              >
                {logoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Logout'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
