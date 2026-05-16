require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const { testConnection } = require('./config/database');
const { errorHandler }   = require('./middleware/errorHandler');

const app = express();

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // CSP handled by frontend (Vite)
}));

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // allow server-to-server / curl (no Origin header) only in dev
    if (!origin) return cb(null, process.env.NODE_ENV !== 'production');
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: 'Too many login attempts, try again later' } }));
app.use('/api/',           rateLimit({ windowMs: 60 * 1000, max: 300 }));

// ─── STATIC PDF FILES ─────────────────────────────────────────────────────────
app.use('/storage', express.static(path.join(__dirname, '../storage')));

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/dealers',   require('./routes/dealers'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/invoices',  require('./routes/invoices'));
app.use('/api/estimates', require('./routes/estimates'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/hsn',       require('./routes/hsn'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/roles',    require('./routes/roles'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
testConnection().then(() => {
  app.listen(PORT, () => {
    process.stdout.write(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]\n`);
  });
});

module.exports = app;
