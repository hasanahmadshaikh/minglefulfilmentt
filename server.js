require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err.message);
});

const app = express();

// Trust proxy for Vercel
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: parseInt(process.env.SESSION_TIMEOUT_CUSTOMER) / 1000 || 24 * 60 * 60 // session TTL in seconds
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Set to true if using HTTPS
    sameSite: 'lax',
    maxAge: parseInt(process.env.SESSION_TIMEOUT_CUSTOMER) || 24 * 60 * 60 * 1000 
  }
}));

// --- Dynamic Environment Config & Portal Web Helper ---
let lastEnvMtime = 0;
let cachedEnv = {};

function getLiveEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const stat = fs.statSync(envPath);
      if (stat.mtimeMs > lastEnvMtime) {
        lastEnvMtime = stat.mtimeMs;
        const content = fs.readFileSync(envPath, 'utf8');
        const dotenv = require('dotenv');
        cachedEnv = dotenv.parse(content);
      }
    }
  } catch (e) {
    // Ignore error, fallback to process.env
  }
  return { ...process.env, ...cachedEnv };
}

function isPortalWebEnabled() {
  const env = getLiveEnv();
  const val = env.portal_web !== undefined ? env.portal_web : env.PORTAL_WEB;
  if (val === undefined || val === null) return true;
  const normalized = String(val).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function getSitename() {
  const env = getLiveEnv();
  return (env.SITENAME || 'ABC WAREHOUSE').replace(/^["']|["']$/g, '');
}

function getToastDuration() {
  const env = getLiveEnv();
  return parseInt(env.TOAST_DURATION) || 10000;
}

// Clean Routes Mapping
const cleanRoutesMap = {
  '/home': 'index.html',
  '/about': 'about.html',
  '/services': 'services.html',
  '/pricing': 'pricing.html',
  '/contact': 'contact.html',
  '/getquote': 'getQuote.html',
  '/get-quote': 'getQuote.html',
  '/quote': 'getQuote.html',
  '/login': 'login.html',
  '/dashboard': 'dashboard.html',
  '/admin': 'admin.html',
  '/reset-password': 'reset-password.html'
};

const marketingCleanRoutes = new Set([
  '/',
  '/home',
  '/about',
  '/services',
  '/pricing',
  '/contact',
  '/getquote',
  '/get-quote',
  '/quote'
]);

// 1. Clean URL Enforcer: Redirect any direct *.html request to clean URL
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }
  if (req.path.endsWith('.html')) {
    const baseName = path.basename(req.path, '.html').toLowerCase();
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    let target = `/${baseName}`;
    if (baseName === 'index') {
      target = '/home';
    } else if (baseName === 'getquote') {
      target = '/getQuote';
    }
    return res.redirect(301, target + query);
  }
  next();
});

// 2. Route root "/" cleanly
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path === '/') {
    if (!isPortalWebEnabled()) {
      return res.redirect('/login');
    }
    return res.redirect('/home');
  }
  next();
});

// 3. Portal Web Access Control: Block marketing routes if portal_web is FALSE
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (!isPortalWebEnabled()) {
    const cleanPath = req.path.toLowerCase().replace(/\/+$/, '') || '/';
    if (marketingCleanRoutes.has(cleanPath)) {
      return res.redirect('/login');
    }
  }
  next();
});

// 4. Clean Route Renderer with Dynamic HTML Injection
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();

  const cleanPath = req.path.toLowerCase().replace(/\/+$/, '');
  const mappedHtmlFile = cleanRoutesMap[cleanPath];

  if (mappedHtmlFile) {
    const filePath = path.join(__dirname, 'public', mappedHtmlFile);
    if (fs.existsSync(filePath)) {
      return fs.readFile(filePath, 'utf8', (err, html) => {
        if (err) return next();

        const sitename = getSitename();
        const toastDuration = getToastDuration();
        const portalWeb = isPortalWebEnabled();

        const envScript = `
  <script>
    window.ENV = {
      SITENAME: ${JSON.stringify(sitename)},
      TOAST_DURATION: ${toastDuration},
      PORTAL_WEB: ${portalWeb}
    };
  </script>`;

        let modifiedHtml = html;
        if (modifiedHtml.includes('<head>')) {
          modifiedHtml = modifiedHtml.replace('<head>', `<head>${envScript}`);
        } else if (modifiedHtml.includes('<HEAD>')) {
          modifiedHtml = modifiedHtml.replace('<HEAD>', `<HEAD>${envScript}`);
        }

        modifiedHtml = modifiedHtml.replace(/Mingle\s*Fulfilment/gi, sitename);

        res.setHeader('Content-Type', 'text/html');
        return res.send(modifiedHtml);
      });
    }
  }

  next();
});

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads directory:', uploadDir);
  }
} catch (e) {
  console.error('Error with uploads directory:', e.message);
}

// Serve uploaded files with proper MIME types and headers
app.use('/uploads', (req, res, next) => {
  // Set cache control and other headers for files
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Serve the file
  express.static(uploadDir)(req, res, next);
});

// API Routes
app.use('/api', apiRoutes);

// Fallback route
app.use((req, res) => {
  // If it's an API request, return JSON 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `API Route ${req.path} not found` });
  }
  // If portal_web is disabled, fallback to login
  if (!isPortalWebEnabled()) {
    return res.redirect('/login');
  }
  // Otherwise fallback to home
  return res.redirect('/home');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
