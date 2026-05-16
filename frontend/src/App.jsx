import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/common/Layout';
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Orders       from './pages/Orders';
import CreateOrder  from './pages/CreateOrder';
import OrderDetail  from './pages/OrderDetail';
import Invoices     from './pages/Invoices';
import Estimates    from './pages/Estimates';
import Dealers      from './pages/Dealers';
import Products     from './pages/Products';
import Users        from './pages/Users';
import HSNReference from './pages/HSNReference';
import Roles        from './pages/Roles';
import EditOrder    from './pages/EditOrder';

function RequireAuth({ children }) {
  const { accessToken } = useAuthStore();
  return accessToken ? children : <Navigate to="/login" replace />;
}

function RequirePermission({ permission, children }) {
  const { hasPermission } = useAuthStore();
  const [m, a] = permission.split(':');
  return hasPermission(m, a) ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"   element={<Dashboard />} />
          <Route path="orders"      element={<RequirePermission permission="orders:view"><Orders /></RequirePermission>} />
          <Route path="orders/new"  element={<RequirePermission permission="orders:create"><CreateOrder /></RequirePermission>} />
          <Route path="orders/:id"      element={<RequirePermission permission="orders:view"><OrderDetail /></RequirePermission>} />
          <Route path="orders/:id/edit" element={<RequirePermission permission="orders:create"><EditOrder /></RequirePermission>} />
          <Route path="invoices"    element={<RequirePermission permission="invoices:view"><Invoices /></RequirePermission>} />
          <Route path="estimates"   element={<RequirePermission permission="estimates:view"><Estimates /></RequirePermission>} />
          <Route path="dealers"     element={<RequirePermission permission="dealers:view"><Dealers /></RequirePermission>} />
          <Route path="products"    element={<RequirePermission permission="products:view"><Products /></RequirePermission>} />
          <Route path="users"       element={<RequirePermission permission="users:view"><Users /></RequirePermission>} />
          <Route path="hsn"         element={<RequirePermission permission="hsn:view"><HSNReference /></RequirePermission>} />
          <Route path="roles"       element={<RequirePermission permission="roles:view"><Roles /></RequirePermission>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
