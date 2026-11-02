import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Eye, EyeOff, ShieldCheck, UserCheck, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated on load, redirect straight to user's portal
  useEffect(() => {
    if (user && !loading) {
      navigate(user.role === 'admin' ? '/admin' : '/employee', { replace: true });
    }
  }, [user, loading, navigate]);

  const doLogin = async (targetEmail: string, targetPass: string) => {
    setError(null);
    try {
      setLoading(true);
      const loggedIn = await login(targetEmail, targetPass);
      navigate(loggedIn.role === 'admin' ? '/admin' : '/employee', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both corporate email and password.');
      return;
    }
    await doLogin(email, password);
  };

  const fillAdminCredentials = () => {
    setEmail('admin@company.com');
    setPassword('Admin@2024!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#3157A4] flex items-center justify-center text-white shadow-md">
            <Briefcase size={22} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#172033]">TaskFlow</h2>
        </div>
        <p className="text-center text-xs font-medium text-[#667085] tracking-wide uppercase">
          Enterprise Task Management & Status Tracking
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-[#E4E8EF] rounded-2xl">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 text-xs bg-[#FFF0F0] border border-[#F5B8B8] text-[#D64545] rounded-lg">
                {error}
              </div>
            )}

            <div>
              <Input
                label="Corporate Email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#172033] block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 text-sm text-[#172033] bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4] focus:border-[#3157A4] transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#667085] hover:text-[#172033] cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              loading={loading}
            >
              Sign In to Platform
              <ArrowRight size={16} />
            </Button>
          </form>

          {/* Authoritative Single Administrator Credentials Box */}
          <div className="mt-8 pt-6 border-t border-[#E4E8EF] space-y-3">
            <div className="p-3.5 rounded-xl border border-[#B8D0F5] bg-[#F4F8FF]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#3157A4]">
                  <ShieldCheck size={16} />
                  System Administrator Login
                </span>
                <button
                  type="button"
                  onClick={fillAdminCredentials}
                  className="text-[11px] font-semibold text-[#3157A4] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <KeyRound size={12} />
                  Fill Credentials
                </button>
              </div>
              <div className="text-xs text-[#172033] space-y-0.5">
                <p>
                  <span className="text-[#667085]">Email:</span>{' '}
                  <span className="font-mono font-medium">admin@company.com</span>
                </p>
                <p>
                  <span className="text-[#667085]">Password:</span>{' '}
                  <span className="font-mono font-medium">Admin@2024!</span>
                </p>
              </div>
            </div>

            {/* Employee Login Information */}
            <div className="p-3 rounded-xl border border-[#E4E8EF] bg-[#F9FAFB] flex items-start gap-2.5">
              <UserCheck size={16} className="text-[#667085] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#667085] leading-relaxed">
                <span className="font-semibold text-[#172033]">Employee Accounts:</span> Created dynamically by the Administrator in the Admin Dashboard. Employees sign in using the email and password assigned to their account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
