import React, { useState } from 'react';
import { apiRequest, setAuthToken, setSavedUser } from '../utils/api.js';
import { GraduationCap, Lock, User, Key, Eye, EyeOff, ShieldAlert, Check, Github } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [loginId, setLoginId] = useState(''); // Email or Academic ID
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // First time setup state
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [setupAcademicId, setSetupAcademicId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  React.useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { token, user } = event.data;
        if (token && user) {
          setAuthToken(token);
          setSavedUser(user);
          onLoginSuccess(user);
        } else {
          setError('فشل استلام بيانات المصادقة من GitHub.');
        }
        setLoading(false);
      }
    };
    
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [onLoginSuccess]);

  const handleGithubLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/github/url');
      if (!res.url) {
        throw new Error('فشل جلب رابط مصادقة GitHub.');
      }
      
      const width = 600;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        res.url,
        'github_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );
      
      if (!popup) {
        throw new Error('تم حظر النافذة المنبثقة من قبل المتصفح. يرجى السماح بالنوافذ المنبثقة لإتمام ربط الحساب.');
      }
    } catch (err: any) {
      setError(err.message || 'فشل الاتصال بـ GitHub.');
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiRequest('/api/auth/login', 'POST', {
        loginId,
        password: password || 'placeholder', // Send placeholder to let server identify first login
        role
      });

      if (data.firstTime) {
        setIsFirstTime(true);
        setSetupAcademicId(data.academicId);
        setError(null);
      } else if (data.token) {
        setAuthToken(data.token);
        setSavedUser(data.user);
        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول. يرجى التحقق من البيانات المدخلة.');
    } finally {
      setLoading(false);
    }
  };

  const handleFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('يجب أن تكون كلمة المرور مكونة من 6 أحرف على الأقل.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest('/api/auth/first-time-setup', 'POST', {
        academicId: setupAcademicId,
        password: newPassword
      });

      if (data.success && data.token) {
        setAuthToken(data.token);
        setSavedUser(data.user);
        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'فشل إعداد كلمة المرور الجديدة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101923] flex items-center justify-center p-4 font-sans select-none relative overflow-hidden" dir="rtl">
      {/* Background decorations matching screenshot */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#1e2f42] opacity-30 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#3b82f6] opacity-15 blur-3xl" />

      <div className="w-full max-w-md bg-[#eef2f6] text-[#101923] rounded-2xl shadow-2xl overflow-hidden relative z-10 transition-all duration-300 p-8 border border-white/40">
        
        {/* Header banner */}
        <div className="text-center pb-6">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-[#101923]/5 text-[#101923] mb-3">
            <GraduationCap className="h-9 w-9 text-[#101923]" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#101923] tracking-tight">أكاديمية الأسعد للتعليم عن بعد</h1>
          <p className="text-xs text-[#52647c] mt-1.5 font-medium">بوابة إدارة التعلم والمراقبة الذكية</p>
        </div>

        {/* Outer Tabs (Only if not in first-time password setup) */}
        {!isFirstTime && (
          <div className="flex bg-[#cbd5e1]/40 p-1.5 rounded-xl mb-6">
            <button
              onClick={() => { setRole('student'); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-center text-xs font-bold transition-all ${
                role === 'student'
                  ? 'bg-[#101923] text-white shadow'
                  : 'text-[#52647c] hover:text-[#101923]'
              }`}
            >
              بوابة الطالب
            </button>
            <button
              onClick={() => { setRole('admin'); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-center text-xs font-bold transition-all ${
                role === 'admin'
                  ? 'bg-[#101923] text-white shadow'
                  : 'text-[#52647c] hover:text-[#101923]'
              }`}
            >
              المكتب الإداري الأكاديمي
            </button>
          </div>
        )}

        <div>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isFirstTime ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1.5">
                  {role === 'student' ? 'الرقم الأكاديمي للطالب' : 'البريد الإلكتروني للإدارة'}
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748b]">
                    {role === 'student' ? <GraduationCap className="h-4.5 w-4.5" /> : <User className="h-4.5 w-4.5" />}
                  </span>
                  <input
                    type="text"
                    required
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder={role === 'student' ? 'أدخل الرقم الأكاديمي' : 'أدخل البريد الإلكتروني'}
                    className="w-full bg-white border border-[#cbd5e1] focus:border-[#101923] focus:ring-2 focus:ring-[#101923]/10 rounded-xl pr-11 pl-4 py-3 text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-[#475569]">
                    كلمة المرور
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748b]">
                    <Lock className="h-4.5 w-4.5" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الخاصة بك"
                    className="w-full bg-white border border-[#cbd5e1] focus:border-[#101923] focus:ring-2 focus:ring-[#101923]/10 rounded-xl pr-11 pl-11 py-3 text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#101923] transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot Password */}
              <div className="flex items-center justify-between text-xs font-semibold text-[#475569] pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-[#cbd5e1] text-[#101923] focus:ring-[#101923]"
                  />
                  <span>تذكرني</span>
                </label>
                <button type="button" className="hover:text-[#101923] hover:underline transition-all">
                  نسيت كلمة المرور؟
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#101923] hover:bg-[#1a2c3f] active:scale-[0.99] disabled:bg-[#cbd5e1] text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-[#101923]/10 hover:shadow-[#101923]/20 mt-4 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-[#cbd5e1]/60"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#eef2f6] px-3 text-[#64748b] font-bold">أو الربط الأكاديمي المباشر</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGithubLogin}
                disabled={loading}
                className="w-full bg-[#24292e] hover:bg-[#2f363d] active:scale-[0.99] text-white py-3 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Github className="h-4.5 w-4.5" />
                <span>ربط الحساب وتسجيل الدخول بواسطة GitHub</span>
              </button>
            </form>
          ) : (
            /* FIRST TIME PASSWORD SETUP */
            <form onSubmit={handleFirstTimeSetup} className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs rounded-xl flex items-start gap-2.5 mb-2 leading-relaxed">
                <Key className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-indigo-950">تم اكتشاف تسجيل دخول لأول مرة</h4>
                  <p className="mt-1 font-medium">
                    يرجى تعيين كلمة مرور آمنة للرقم الأكاديمي <strong className="text-indigo-950">{setupAcademicId}</strong> أدناه لاستخدامها في المرات القادمة.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1.5">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748b]">
                    <Lock className="h-4.5 w-4.5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6 أحرف أو أرقام كحد أدنى"
                    className="w-full bg-white border border-[#cbd5e1] focus:border-[#101923] rounded-xl pr-11 pl-4 py-3 text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1.5">
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748b]">
                    <Lock className="h-4.5 w-4.5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور"
                    className="w-full bg-white border border-[#cbd5e1] focus:border-[#101923] rounded-xl pr-11 pl-4 py-3 text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#101923] hover:bg-[#1a2c3f] text-white py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center cursor-pointer"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsFirstTime(false); setError(null); }}
                  className="flex-1 bg-transparent border border-[#cbd5e1] hover:bg-white/40 text-[#475569] py-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer info banner */}
        <div className="mt-6 pt-4 border-t border-[#cbd5e1]/60 text-center">
          <p className="text-[10px] text-[#64748b] font-medium">
            جميع الاتصالات والبيانات مشفرة ومحمية ببروتوكولات الأمان القياسية.
          </p>
        </div>
      </div>
    </div>
  );
}
