import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/dashboard',  label: 'Dashboard',  icon: '📊', permission: 'dashboard:view' },
  { to: '/orders',     label: 'Orders',     icon: '📋', permission: 'orders:view'    },
  { to: '/orders/new', label: 'New Order',  icon: '➕', permission: 'orders:create'  },
  { to: '/invoices',   label: 'Invoices',   icon: '🧾', permission: 'invoices:view'  },
  { to: '/estimates',  label: 'Estimates',  icon: '📄', permission: 'estimates:view' },
  { to: '/dealers',    label: 'Dealers',    icon: '🏪', permission: 'dealers:view'   },
  { to: '/products',   label: 'Products',   icon: '📦', permission: 'products:view'  },
  { to: '/users',      label: 'Users',      icon: '👥', permission: 'users:view'     },
  { to: '/hsn',        label: 'HSN-GST',    icon: '🔢', permission: 'hsn:view'       },
  { to: '/roles',      label: 'Roles',      icon: '🛡️', permission: 'roles:view'     },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, clearAuth, hasPermission } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    try { await authApi.logout(); } catch {}
    clearAuth();
    navigate('/login');
    toast.success('Logged out');
  }

  const links = NAV.filter(n => {
    const [m, a] = n.permission.split(':');
    return hasPermission(m, a);
  });

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 flex flex-col
        bg-brand-900 text-white
        transition-transform duration-200
        lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* Logo block */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-brand-800 bg-brand-950">
          <img
            src="/megh-logo.jpg"
            alt="Megh Agro Equipment"
            className="w-10 h-10 rounded-lg object-contain bg-white p-0.5 flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight text-white truncate">Megh Agro Equipment</p>
            <p className="text-xs text-brand-300 truncate">Nashik, India</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {links.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/orders'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive
                   ? 'bg-accent-500 text-white shadow-sm'
                   : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                 }`
              }
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-brand-800 bg-brand-950">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-brand-300 truncate">{user?.role_label}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-brand-400 hover:text-accent-400 transition-colors py-1 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="bg-brand-900 text-white px-4 py-3 flex items-center gap-3 lg:hidden sticky top-0 z-10 shadow-md">
          <button onClick={() => setSidebarOpen(true)} className="text-brand-200 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="/megh-logo.jpg" alt="logo" className="w-7 h-7 rounded object-contain bg-white p-0.5" />
          <span className="font-semibold text-sm">Megh Agro Equipment</span>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
