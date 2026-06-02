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

// Middleware to dynamically inject environment configuration and rewrite sitename in HTML files
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }

  const ext = path.extname(req.path);
  if (ext === '' || ext === '.html') {
    const filename = ext === '.html' ? req.path : '/index.html';
    const filePath = path.join(__dirname, 'public', filename);

    // Safeguard against directory traversal
    const publicDir = path.join(__dirname, 'public');
    if (!filePath.startsWith(publicDir)) {
      return next();
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      fs.readFile(filePath, 'utf8', (err, html) => {
        if (err) {
          return next();
        }

        const sitename = (process.env.SITENAME || 'Mingle Fulfilment').replace(/^["']|["']$/g, '');
        const toastDuration = parseInt(process.env.TOAST_DURATION) || 10000;

        const envScript = `
  <script>
    window.ENV = {
      SITENAME: ${JSON.stringify(sitename)},
      TOAST_DURATION: ${toastDuration}
    };
  </script>`;

        let modifiedHtml = html;
        if (modifiedHtml.includes('<head>')) {
          modifiedHtml = modifiedHtml.replace('<head>', `<head>${envScript}`);
        } else if (modifiedHtml.includes('<HEAD>')) {
          modifiedHtml = modifiedHtml.replace('<HEAD>', `<HEAD>${envScript}`);
        }

        // Replace all case-insensitive occurrences of "Mingle Fulfilment" with/without space
        modifiedHtml = modifiedHtml.replace(/Mingle\s*Fulfilment/gi, sitename);

        res.setHeader('Content-Type', 'text/html');
        return res.send(modifiedHtml);
      });
    } else {
      next();
    }
  } else {
    next();
  }
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

// Fallback to index.html
app.use((req, res) => {
  // If it's an API request, return JSON 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `API Route ${req.path} not found` });
  }
  // Otherwise serve index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
