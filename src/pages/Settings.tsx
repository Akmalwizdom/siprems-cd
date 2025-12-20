import { useState, useEffect } from 'react';
import { User, Camera, Lock, LogOut, Loader2, Check, X, Mail, Building, Phone, MapPin, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth, getFirebaseErrorMessage } from '../context/AuthContext';
import { useToast } from '../components/ui/toast';
import { AuthError } from 'firebase/auth';
import { AdminOnly } from '../components/auth/RoleGuard';

interface StoreProfile {
  name: string;
  address: string;
  phone: string;
  logo: string;
}

export function Settings() {
  const { user, updateDisplayName, updatePhotoURL, updateUserPassword, logout } = useAuth();
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

  // Load user data
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
    }
  }, [user]);

  // Load store profile from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('siprems_store_profile');
      if (saved) {
        setStoreProfile(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading store profile:', error);
    }
  }, []);

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

  // Handle photo URL update
  const handleUpdatePhoto = async () => {
    setPhotoLoading(true);
    try {
      await updatePhotoURL(photoURL.trim());
      showToast('Foto profil berhasil diubah', 'success');
      setIsEditingPhoto(false);
    } catch (error) {
      showToast(getFirebaseErrorMessage(error as AuthError), 'error');
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
  const handleSaveStoreProfile = () => {
    setStoreLoading(true);
    try {
      localStorage.setItem('siprems_store_profile', JSON.stringify(storeProfile));
      showToast('Profil toko berhasil disimpan', 'success');
    } catch (error) {
      showToast('Gagal menyimpan profil toko', 'error');
    } finally {
      setStoreLoading(false);
    }
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
                  className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 rounded-full text-white hover:bg-indigo-700 transition-colors"
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
                <label className="block text-xs text-slate-700 mb-1">URL Foto Profil</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg settings-input text-sm"
                  />
                  <Button size="sm" onClick={handleUpdatePhoto} disabled={photoLoading}>
                    {photoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingPhoto(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
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
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 min-w-[350px] w-full">
            {/* Store Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-green-600" />
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
                <div className="relative">
                  {storeProfile.logo ? (
                    <img 
                      src={storeProfile.logo} 
                      alt="Store Logo" 
                      className="w-16 h-16 rounded-lg object-cover border-2 border-slate-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center border-2 border-dashed border-slate-300">
                      <Building className="w-8 h-8 text-green-600" />
                    </div>
                  )}
                  <button 
                    onClick={() => setIsEditingLogo(!isEditingLogo)}
                    className="absolute bottom-0 right-0 p-1.5 bg-green-600 rounded-full text-white hover:bg-green-700 transition-colors"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{storeProfile.name || 'Nama Toko'}</p>
                  <p className="text-sm text-slate-500">Logo untuk struk & laporan</p>
                </div>
              </div>
              
              {isEditingLogo && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                  <label className="block text-xs text-slate-700 mb-1">URL Logo Toko</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={storeProfile.logo}
                      onChange={(e) => setStoreProfile({ ...storeProfile, logo: e.target.value })}
                      placeholder="https://example.com/logo.jpg"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg settings-input text-sm"
                    />
                    <Button size="sm" variant="outline" onClick={() => setIsEditingLogo(false)}>
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
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