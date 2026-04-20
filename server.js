require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');

// Connect to MongoDB
connectDB();

const app = express();

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
    maxAge: parseInt(process.env.SESSION_TIMEOUT_CUSTOMER) || 24 * 60 * 60 * 1000 
  }
}));


// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploads folder
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api', apiRoutes);

// Fallback to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
