import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, User, ArrowRight, CheckCircle2 } from 'lucide-react';

// --- KOMPONEN UI (Agar mandiri dan tidak error import) ---

const Button = ({ children, variant = 'primary', className = '', isLoading, ...props }: any) => {
  const baseStyle = "w-full py-3.5 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 focus:ring-4 focus:ring-indigo-100 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98]";
  
  const variants: any = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40",
    outline: "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300",
    ghost: "bg-transparent text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700",
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </button>
  );
};

const InputField = ({ label, icon: Icon, error, ...props }: any) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-semibold text-slate-700 ml-1">{label}</label>
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <input
        className={`w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
          error 
            ? 'border-red-300 focus:border-red-500 focus:ring-red-100' 
            : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-100'
        }`}
        {...props}
      />
    </div>
    {error && <p className="text-red-500 text-xs ml-1 font-medium flex items-center gap-1">
      <span className="w-1 h-1 rounded-full bg-red-500 inline-block" /> {error}
    </p>}
  </div>
);

// --- FORM COMPONENTS ---

const LoginFormInner = ({ onToggleMode }: { onToggleMode: () => void }) => {
  // Ganti dengan useAuth() asli Anda nanti
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulasi login
    setTimeout(() => {
      setIsLoading(false);
      if (!formData.email) setErrors({ email: 'Email wajib diisi' });
    }, 1500);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Selamat Datang</h2>
        <p className="text-slate-500">Masuk untuk mengakses akun Anda.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <InputField
          label="Email"
          type="email"
          icon={Mail}
          placeholder="masukkan@email.com"
          value={formData.email}
          onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700 ml-1">Password</label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all duration-200"
              placeholder="Masukkan password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 transition-colors cursor-pointer" />
            <span className="text-slate-600 group-hover:text-slate-800 transition-colors">Ingat saya</span>
          </label>
          <a href="#" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">Lupa password?</a>
        </div>

        <Button type="submit" isLoading={isLoading}>
          Masuk Sekarang
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 text-slate-500">atau lanjutkan dengan</span>
        </div>
      </div>

      <Button variant="outline" className="w-full" type="button">
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google
      </Button>

      <p className="text-center text-sm text-slate-600">
        Belum punya akun?{' '}
        <button onClick={onToggleMode} className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-all">
          Daftar gratis
        </button>
      </p>
    </div>
  );
};

const RegisterForm = ({ onToggleMode }: { onToggleMode: () => void }) => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1500);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Buat Akun Baru</h2>
        <p className="text-slate-500">Mulai percobaan gratis 30 hari Anda.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <InputField
          label="Nama Lengkap"
          type="text"
          icon={User}
          placeholder="Contoh: Budi Santoso"
          value={formData.name}
          onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
        />

        <InputField
          label="Email"
          type="email"
          icon={Mail}
          placeholder="masukkan@email.com"
          value={formData.email}
          onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700 ml-1">Password</label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all duration-200"
              placeholder="Buat password kuat"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {['Min 8 kar', '1 angka', '1 simbol'].map((req, i) => (
              <span key={i} className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                {req}
              </span>
            ))}
          </div>
        </div>

        <Button type="submit" isLoading={isLoading}>
          Buat Akun <ArrowRight className="w-4 h-4" />
        </Button>
      </form>

      <p className="text-center text-sm text-slate-600 mt-6">
        Sudah punya akun?{' '}
        <button onClick={onToggleMode} className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-all">
          Masuk
        </button>
      </p>
    </div>
  );
};

// --- MAIN COMPONENT EXPORTED AS 'Login' ---

export function Login() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-indigo-100 selection:text-indigo-700">
      
      {/* Kolom Kiri - Form Section */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24 w-full max-w-[100vw] lg:max-w-[50vw] z-10 bg-white">
        <div className="w-full max-w-sm mx-auto">
          {/* Logo */}
          <div className="mb-10 flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">BoltForce</span>
          </div>

          {isLogin ? (
            <LoginFormInner onToggleMode={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onToggleMode={() => setIsLogin(true)} />
          )}

          <div className="mt-10 text-center">
            <p className="text-xs text-slate-400">
              &copy; 2024 BoltForce Inc. All rights reserved. <br/>
              <a href="#" className="hover:text-slate-600">Privasi</a> · <a href="#" className="hover:text-slate-600">Syarat & Ketentuan</a>
            </p>
          </div>
        </div>
      </div>

      {/* Kolom Kanan - Ilustrasi */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-700 to-fuchsia-700 opacity-90"></div>
        
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] rounded-full bg-purple-500 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] rounded-full bg-indigo-500 opacity-20 blur-3xl"></div>
        
        <div className="relative z-10 w-full h-full flex flex-col justify-center px-16 text-white">
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-3xl shadow-2xl max-w-md animate-in fade-in slide-in-from-right-8 duration-700">
            <div className="flex gap-1 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              ))}
            </div>
            <p className="text-xl font-medium leading-relaxed mb-6">
              "Platform ini mengubah cara kami bekerja. Antarmuka sangat intuitif dan kecepatannya luar biasa. Sangat direkomendasikan!"
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-300 to-purple-300 p-0.5">
                <img 
                   src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
                   alt="User" 
                   className="w-full h-full rounded-full bg-slate-800 object-cover"
                />
              </div>
              <div>
                <h4 className="font-bold">Alex Morgan</h4>
                <p className="text-sm text-indigo-200">Product Designer di TechFlow</p>
              </div>
            </div>
          </div>

          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-4 text-indigo-100">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Keamanan Enterprise</h3>
                <p className="text-sm opacity-80">Enkripsi tingkat bank untuk data Anda.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export default juga disertakan untuk keamanan
export default Login;