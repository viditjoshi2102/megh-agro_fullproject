import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import Spinner from '../components/common/Spinner';

export default function Login() {
  const [form, setForm]       = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [show, setShow]       = useState(false);
  const { setAuth }  = useAuthStore();
  const navigate     = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.login(form);
      setAuth(data.data.user, data.data.accessToken, data.data.refreshToken, data.data.permissions || []);
      toast.success(`Welcome, ${data.data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        {/* Logo + branding */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img
            src="/megh-logo.jpg"
            alt="Megh Agro Equipment"
            className="w-14 h-14 rounded-xl object-contain bg-white p-1 shadow"
          />
          <div>
            <p className="font-bold text-gray-900 text-lg leading-tight">Megh Agro Equipment</p>
            <p className="text-xs text-gray-500">Nashik, Maharashtra</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                autoComplete="username"
                placeholder="Enter your username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-16"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                  style={{ color: '#163082' }}
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-base"
            >
              {loading && <Spinner size="sm" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Megh Agro Equipment, Nashik. All rights reserved.
        </p>
      </div>
    </div>
  );
}
