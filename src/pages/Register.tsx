import { useState } from 'react';
import { Link } from 'react-router';
import { Eye, EyeOff, Loader2, User, Store, Mail, Lock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth, getFirebaseErrorMessage } from '../context/AuthContext';
import { AuthError } from 'firebase/auth';
import { AuthIllustration } from '../components/AuthIllustration';
import '../styles/Auth.css'; // Import file CSS manual

interface RegisterForm {
  name: string;
  email: string;
  storeName: string;
  password: string;
  confirmPassword: string;
}

export function Register() {
  const { registerWithEmail, loginWithGoogle } = useAuth();
  const [formData, setFormData] = useState<RegisterForm>({
    name: '',
    email: '',
    storeName: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<RegisterForm>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: Partial<RegisterForm> = {};
    
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.storeName) newErrors.storeName = 'Store name is required';
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setAuthError(null);

    try {
      await registerWithEmail(formData.email, formData.password);
    } catch (error) {
      setAuthError(getFirebaseErrorMessage(error as AuthError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      await loginWithGoogle();
    } catch (error) {
      setAuthError(getFirebaseErrorMessage(error as AuthError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left Column - Form Section */}
      <div className="auth-left">
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-title">Create Account</h1>
            <p className="auth-subtitle">Start your journey with SIPREMS today.</p>
          </div>

          {authError && (
             <div className="auth-error">
              <div style={{ marginTop: '2px' }}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
              </div>
              <p>{authError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <User size={20} />
                </div>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`auth-input ${errors.name ? 'error' : ''}`}
                  placeholder="Enter your full name"
                />
              </div>
              {errors.name && <p className="input-error-msg">{errors.name}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                 <div className="input-icon">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`auth-input ${errors.email ? 'error' : ''}`}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && <p className="input-error-msg">{errors.email}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Store Name</label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <Store size={20} />
                </div>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className={`auth-input ${errors.storeName ? 'error' : ''}`}
                  placeholder="Enter your store name"
                />
              </div>
              {errors.storeName && <p className="input-error-msg">{errors.storeName}</p>}
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-wrapper">
                   <div className="input-icon">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`auth-input ${errors.password ? 'error' : ''}`}
                    placeholder="Create password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="input-error-msg">{errors.password}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Confirm</label>
                <div className="input-wrapper">
                   <div className="input-icon">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={`auth-input ${errors.confirmPassword ? 'error' : ''}`}
                    placeholder="Confirm"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="input-error-msg">{errors.confirmPassword}</p>}
              </div>
            </div>

            <Button 
              type="submit" 
              className="btn-primary" 
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
            </Button>
          </form>

          <div className="auth-divider">
            <div className="divider-line"></div>
            <span className="divider-text">or continue with</span>
          </div>

          <Button
            variant="outline"
            type="button"
            className="btn-google"
            onClick={handleGoogleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with Google
              </>
            )}
          </Button>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/" className="footer-link">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Column - Illustration Section */}
      <div className="auth-right">
        <AuthIllustration />
      </div>
    </div>
  );
}