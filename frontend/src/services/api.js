import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({ baseURL: '/api', timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = false;
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry && !refreshing) {
      orig._retry = true;
      refreshing  = true;
      try {
        const { refreshToken } = useAuthStore.getState();
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        useAuthStore.getState().setToken(data.data.accessToken, data.data.refreshToken);
        orig.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(orig);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
      } finally { refreshing = false; }
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login:          (d) => api.post('/auth/login', d),
  logout:         ()  => api.post('/auth/logout'),
  me:             ()  => api.get('/auth/me'),
  changePassword: (d) => api.post('/auth/change-password', d),
};

// ─── Dealers ─────────────────────────────────────────────────────────────────
export const dealerApi = {
  list:         (p)     => api.get('/dealers',           { params: p }),
  dropdown:     (p)     => api.get('/dealers/dropdown',  { params: p }),
  get:          (id)    => api.get(`/dealers/${id}`),
  create:       (d)     => api.post('/dealers', d),
  update:       (id, d) => api.put(`/dealers/${id}`, d),
  remove:       (id)    => api.delete(`/dealers/${id}`),
  bulkTemplate: ()      => api.get('/dealers/bulk-template', { responseType: 'blob' }),
  bulkUpload:   (file)  => { const fd = new FormData(); fd.append('file', file); return api.post('/dealers/bulk-upload', fd); },
};

// ─── Products ────────────────────────────────────────────────────────────────
export const productApi = {
  list:           (p)    => api.get('/products',            { params: p }),
  dropdown:       (p)    => api.get('/products/dropdown',   { params: p }),
  categories:     ()     => api.get('/products/categories'),
  createCategory: (d)    => api.post('/products/categories', d),
  get:            (id)   => api.get(`/products/${id}`),
  create:         (d)    => api.post('/products', d),
  update:         (id,d) => api.put(`/products/${id}`, d),
  remove:         (id)   => api.delete(`/products/${id}`),
  bulkTemplate:   ()     => api.get('/products/bulk-template', { responseType: 'blob' }),
  bulkUpload:     (file) => { const fd = new FormData(); fd.append('file', file); return api.post('/products/bulk-upload', fd); },
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const orderApi = {
  list:             (p)    => api.get('/orders',                   { params: p }),
  get:              (id)   => api.get(`/orders/${id}`),
  create:           (d)    => api.post('/orders', d),
  update:           (id,d) => api.put(`/orders/${id}`, d),
  updateStatus:     (id,d) => api.patch(`/orders/${id}/status`, d),
  generatePI:       (id)   => api.post(`/orders/${id}/generate-pi`),
  generateEstimate: (id)   => api.post(`/orders/${id}/generate-estimate`),
};

// ─── Invoices / Estimates ─────────────────────────────────────────────────────
export const invoiceApi = {
  list:     (p)  => api.get('/invoices',              { params: p }),
  download: (id) => api.get(`/invoices/${id}/download`, { responseType: 'blob' }),
};
export const estimateApi = {
  list:     (p)  => api.get('/estimates',               { params: p }),
  download: (id) => api.get(`/estimates/${id}/download`, { responseType: 'blob' }),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const userApi = {
  list:          (p)    => api.get('/users',                   { params: p }),
  dropdown:      ()     => api.get('/users/dropdown'),
  get:           (id)   => api.get(`/users/${id}`),
  create:        (d)    => api.post('/users', d),
  update:        (id,d) => api.put(`/users/${id}`, d),
  resetPassword: (id,d) => api.post(`/users/${id}/reset-password`, d),
};

// ─── HSN ─────────────────────────────────────────────────────────────────────
export const hsnApi = {
  list:         (p)    => api.get('/hsn',        { params: p }),
  byCode:       (code) => api.get(`/hsn/code/${code}`),
  create:       (d)    => api.post('/hsn', d),
  update:       (id,d) => api.put(`/hsn/${id}`, d),
  remove:       (id)   => api.delete(`/hsn/${id}`),
  bulkTemplate: ()     => api.get('/hsn/bulk-template', { responseType: 'blob' }),
  bulkUpload:   (file) => { const fd = new FormData(); fd.append('file', file); return api.post('/hsn/bulk-upload', fd); },
};

// ─── Roles ───────────────────────────────────────────────────────────────────
export const roleApi = {
  list:           ()       => api.get('/roles'),
  get:            (id)     => api.get(`/roles/${id}`),
  allPermissions: ()       => api.get('/roles/permissions'),
  create:         (d)      => api.post('/roles', d),
  update:         (id, d)  => api.put(`/roles/${id}`, d),
  remove:         (id)     => api.delete(`/roles/${id}`),
  setPermissions: (id, d)  => api.put(`/roles/${id}/permissions`, d),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardApi = {
  owner:       ()  => api.get('/dashboard/owner'),
  admin:       ()  => api.get('/dashboard/admin'),
  salesperson: ()  => api.get('/dashboard/salesperson'),
  auditLogs:   (p) => api.get('/dashboard/audit-logs', { params: p }),
};

export default api;
