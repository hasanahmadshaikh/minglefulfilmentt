require('dotenv').config();
const express = require('express');
const path = require('path');
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


// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploads folder
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
} catch (e) {
  // Vercel has a read-only filesystem - uploads dir may not be writable
  console.warn('Could not create uploads directory (expected in serverless):', e.message);
}
app.use('/uploads', express.static(uploadDir));

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
