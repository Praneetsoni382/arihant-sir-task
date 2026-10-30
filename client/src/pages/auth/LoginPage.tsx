import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      // Determine redirection based on email prefix or session role
      if (email.toLowerCase().includes('admin')) {
        navigate('/admin');
      } else {
        navigate('/employee');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid credentials';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const devAccounts = [
    { role: 'Administrator', name: 'Arihant Sharma', email: 'admin@company.com', pass: 'Admin@2024!' },
    { role: 'Employee', name: 'Priya Mehta (Engineering)', email: 'priya.mehta@company.com', pass: 'Emp@56789' },
    { role: 'Employee', name: 'Rahul Gupta (Engineering)', email: 'rahul.gupta@company.com', pass: 'Emp@34512' },
    { role: 'Employee', name: 'Sneha Patel (Sales)', email: 'sneha.patel@company.com', pass: 'Emp@78234' },
    { role: 'Employee', name: 'Vikram Nair (Operations)', email: 'vikram.nair@company.com', pass: 'Emp@91823' },
  ];

  const fillAccount = (accEmail: string, accPass: string) => {
    setEmail(accEmail);
    setPassword(accPass);
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
                  placeholder="Enter your password"
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

          {/* Test Accounts Quick Select */}
          <div className="mt-8 pt-6 border-t border-[#E4E8EF]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#172033]">Development Test Accounts</span>
              <span className="text-[10px] text-[#667085] bg-[#F5F7FA] px-2 py-0.5 rounded border border-[#E4E8EF]">
                Click to Auto-fill
              </span>
            </div>

            <div className="space-y-2">
              {devAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillAccount(acc.email, acc.pass)}
                  className="w-full text-left p-2.5 rounded-lg border border-[#E4E8EF] hover:border-[#3157A4] hover:bg-[#F9FBFF] transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-[#172033] group-hover:text-[#3157A4] truncate">
                      {acc.name}
                    </p>
                    <p className="text-[11px] text-[#667085] truncate">{acc.email}</p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      acc.role === 'Administrator'
                        ? 'bg-[#EBF3FF] text-[#3157A4] border border-[#B8D0F5]'
                        : 'bg-[#F5F7FA] text-[#667085] border border-[#E4E8EF]'
                    }`}
                  >
                    {acc.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

