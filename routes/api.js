const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Quote = require('../models/Quote');
const Contact = require('../models/Contact');
const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const bcrypt = require('bcryptjs');
const UserVerification = require('../models/UserVerification');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { sendOTP, sendResetLink } = require('../utils/mailer');
const Counter = require('../models/Counter');
const mongoose = require('mongoose');

// Configure Multer - use memoryStorage for Vercel compatibility
// Vercel has a read-only filesystem so diskStorage is not supported
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper to check auth
const ensureAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ success: false, message: 'Not authenticated' });
  }
};

// Helper to check admin
const ensureAdmin = async (req, res, next) => {
  if (req.session.userId) {
    const user = await User.findById(req.session.userId);
    if (user && user.role === 'admin') {
      return next();
    }
  }
  res.status(403).json({ success: false, message: 'Access denied: Admin only' });
};

// --- Inventory Routes ---

// GET /api/inventory - View own inventory
router.get('/inventory', ensureAuth, async (req, res) => {
  try {
    const inventory = await Inventory.find({ user: req.session.userId });
    res.json({ success: true, inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/inventory - List all inventory for admin
router.get('/admin/inventory', ensureAdmin, async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = userId ? { user: userId } : {};
    const inventory = await Inventory.find(filter).populate('user', 'name email businessName');
    res.json({ success: true, inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/inventory - Create or update inventory
router.post('/admin/inventory', ensureAdmin, async (req, res) => {
  try {
    const { userId, productName, sku, quantity } = req.body;
    if (!userId || !productName) {
      return res.status(400).json({ success: false, message: 'User ID and Product Name are required' });
    }

    // Upsert inventory item
    const inventory = await Inventory.findOneAndUpdate(
      { user: userId, productName: productName },
      { sku, $set: { quantity: quantity }, updatedAt: Date.now() },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Inventory updated successfully', inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/admin/inventory/:id - Delete inventory item
router.delete('/admin/inventory/:id', ensureAdmin, async (req, res) => {
  try {
    await Inventory.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Inventory item removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/shipment-details
router.get('/shipment-details', ensureAuth, async (req, res) => {
  console.log('API HIT: /api/shipment-details', req.query);
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ success: false, message: 'ID required' });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid format' });
    }

    let order;
    const user = await User.findById(req.session.userId);
    if (user && user.role === 'admin') {
      order = await Order.findById(id).populate('user', 'name email businessName');
    } else {
      order = await Order.findOne({ _id: id, user: req.session.userId });
    }
    if (!order) return res.status(404).json({ success: false, message: 'Shipment not found' });
    res.json({ success: true, order });
  } catch (error) {
    console.error('Shipment detail error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ... (rest of search/replace will handle the position)

// POST /api/orders
router.post('/orders', ensureAuth, upload.fields([
  { name: 'productImages', maxCount: 10 },
  { name: 'commercialInvoices', maxCount: 5 },
  { name: 'packingListPDFs', maxCount: 5 },
  { name: 'documents' }
]), async (req, res) => {
  try {
    const {
      shipmentName, supplierName, trackingNumber, carrier,
      estimatedArrival, skuList, productQuantities, packingDetails,
      notes, googleDriveDocs, type, products,
      channel, fulfilmentType, prepInstructions, shippingLabelsRequired
    } = req.body;

    // Auto-generate orderId
    let counter = await Counter.findOne({ id: 'orderId' });
    if (!counter) {
      counter = await Counter.create({ id: 'orderId', seq: 1000 });
    }
    counter.seq += 1;
    await counter.save();
    const isOutbound = type === 'outbound';
    const generatedId = isOutbound ? `OUT-${counter.seq}` : `INB-${counter.seq}`;

    // Handle files
    const productImages = req.files['productImages'] ? req.files['productImages'].map(f => f.originalname) : [];
    const commercialInvoices = req.files['commercialInvoices'] ? req.files['commercialInvoices'].map(f => f.originalname) : [];
    const packingListPDFs = req.files['packingListPDFs'] ? req.files['packingListPDFs'].map(f => f.originalname) : [];
    const documents = req.files['documents'] ? req.files['documents'].map(f => f.originalname) : [];

    const finalShipmentName = isOutbound ? `Outbound Order ${generatedId}` : shipmentName;

    const newOrder = await Order.create({
      user: req.session.userId,
      orderId: generatedId,
      shipmentName: finalShipmentName,
      supplierName: isOutbound ? 'N/A' : supplierName,
      trackingNumber: isOutbound ? 'N/A' : trackingNumber,
      carrier: isOutbound ? 'N/A' : carrier,
      estimatedArrival: isOutbound ? new Date() : estimatedArrival,
      skuList,
      productQuantities,
      productImages,
      packingDetails,
      notes,
      googleDriveDocs,
      commercialInvoices,
      packingListPDFs,
      documents,
      channel,
      fulfilmentType,
      prepInstructions,
      shippingLabelsRequired: shippingLabelsRequired === 'true',
      type: type || 'inbound',
      products: products ? JSON.parse(products) : [],
      status: isOutbound ? 'Processing' : 'Pending Arrival'
    });

    res.status(201).json({
      success: true,
      message: `Order ${generatedId} submitted successfully!`,
      order: newOrder
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/orders/:id/shipping-labels
router.post('/orders/:id/shipping-labels', ensureAuth, upload.fields([
  { name: 'shippingLabels' }
]), async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findOne({ _id: orderId, user: req.session.userId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    
    if (order.status !== 'Awaiting Shipping Labels') {
      return res.status(400).json({ success: false, message: 'Cannot upload labels at this stage' });
    }

    const shippingLabels = req.files['shippingLabels'] ? req.files['shippingLabels'].map(f => f.originalname) : [];
    
    if (shippingLabels.length === 0) {
      return res.status(400).json({ success: false, message: 'No labels uploaded' });
    }

    order.shippingLabels = [...(order.shippingLabels || []), ...shippingLabels];
    order.status = 'Shipment labels uploaded';
    await order.save();

    res.json({ success: true, message: 'Shipping labels uploaded successfully', order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/orders
router.get('/orders', ensureAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, type } = req.query;
    const skip = (page - 1) * limit;

    const filter = { user: req.session.userId };
    if (type) filter.type = type;
    if (status && status !== 'All') {
      const statusList = status.split(',');
      if (statusList.length > 1) {
        filter.status = { $in: statusList };
      } else {
        filter.status = status;
      }
    }
    if (search) {
      filter.$or = [
        { shipmentName: { $regex: search, $options: 'i' } },
        { orderId: { $regex: search, $options: 'i' } }
      ];
    }

    const totalOrders = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      orders,
      pagination: {
        totalOrders,
        totalPages: Math.ceil(totalOrders / limit),
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/stats
router.get('/stats', ensureAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const totalOrders = await Order.countDocuments({ user: userId });
    const activeOrders = await Order.countDocuments({
      user: userId,
      status: { $in: ['Pending Arrival', 'Received', 'In Inspection', 'Stored', 'Processing', 'Shipped'] }
    });

    // For now, pending invoices is static $0.00 as per design, 
    // but we can return it here if we had an Invoice model.
    res.json({
      success: true,
      stats: {
        totalOrders,
        activeOrders,
        pendingInvoices: "$0.00"
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const newContact = await Contact.create({ name, email, subject, message });
    res.status(201).json({ success: true, data: newContact, message: 'Message sent successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// POST /api/quote
router.post('/quote', async (req, res) => {
  try {
    const { name, email, company, service, monthlyVolume, details } = req.body;
    const newQuote = await Quote.create({ name, email, company, service, monthlyVolume, details });
    res.status(201).json({ success: true, data: newQuote, message: 'Quote requested successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// POST /api/signup/initiate
router.post('/signup/initiate', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // BYPASS OTP CHECK
    if (process.env.BYPASS_OTP === 'true') {
      const user = await User.create({
        name,
        email,
        password: hashedPassword
      });
      return res.status(201).json({
        success: true,
        message: 'Signup successful! (OTP Bypassed)',
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
      });
    }

    // Save temporary verification record
    await UserVerification.deleteMany({ email }); // Clear previous attempts
    await UserVerification.create({
      email,
      otp,
      name,
      password: hashedPassword,
      type: 'signup'
    });

    // Send email
    const emailSent = await sendOTP(email, otp);
    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Failed to send verification email' });
    }

    res.json({
      success: true,
      message: 'OTP sent to your email. Please verify to complete signup.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/signup/verify
router.post('/signup/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const verificationRecord = await UserVerification.findOne({ email, otp });
    if (!verificationRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Strict time check (redundant to DB TTL to prevent race conditions)
    const expiryTime = 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(verificationRecord.createdAt).getTime() > expiryTime) {
      await UserVerification.deleteOne({ _id: verificationRecord._id });
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    // Create actual user
    const user = await User.create({
      name: verificationRecord.name,
      email: verificationRecord.email,
      password: verificationRecord.password
    });

    // Delete verification record
    await UserVerification.deleteOne({ _id: verificationRecord._id });

    res.status(201).json({
      success: true,
      message: 'Account verified and created successfully! You can now login.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/login/initiate
router.post('/login/initiate', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      // If Admin, log in directly
      if (user.role === 'admin') {
        req.session.userId = user._id;
        req.session.userName = user.name;
        req.session.role = user.role;
        // Apply Admin Timeout
        req.session.cookie.maxAge = parseInt(process.env.SESSION_TIMEOUT_ADMIN) || 7200000;

        return res.json({
          success: true,
          message: 'Admin login successful',
          user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
      }

      // BYPASS OTP CHECK for Customers
      if (process.env.BYPASS_OTP === 'true') {
        req.session.userId = user._id;
        req.session.userName = user.name;
        req.session.role = user.role;
        // Apply Customer Timeout
        req.session.cookie.maxAge = parseInt(process.env.SESSION_TIMEOUT_CUSTOMER) || 86400000;

        return res.json({
          success: true,
          message: 'Login successful (OTP Bypassed)',
          user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
      }

      // If Customer, initiate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await UserVerification.deleteMany({ email });
      await UserVerification.create({ email, otp, type: 'login' });

      const emailSent = await sendOTP(email, otp);
      if (!emailSent) {
        return res.status(500).json({ success: false, message: 'Failed to send OTP email' });
      }

      res.json({
        success: true,
        needsOTP: true,
        message: 'OTP sent to your email. Please verify to log in.'
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/login/verify
router.post('/login/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const verificationRecord = await UserVerification.findOne({ email, otp, type: 'login' });

    if (!verificationRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Strict time check
    const expiryTime = 120 * 100000;
    if (Date.now() - new Date(verificationRecord.createdAt).getTime() > expiryTime) {
      await UserVerification.deleteOne({ _id: verificationRecord._id });
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Set session
    req.session.userId = user._id;
    req.session.userName = user.name;
    req.session.role = user.role;

    // Apply Role-Based Timeout
    if (user.role === 'admin') {
      req.session.cookie.maxAge = parseInt(process.env.SESSION_TIMEOUT_ADMIN) || 7200000;
    } else {
      req.session.cookie.maxAge = parseInt(process.env.SESSION_TIMEOUT_CUSTOMER) || 86400000;
    }

    // Clear verification
    await UserVerification.deleteOne({ _id: verificationRecord._id });

    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/otp/resend
router.post('/otp/resend', async (req, res) => {
  try {
    const { email, type } = req.body; // type: 'signup' or 'login'

    // Check if we already have a record (active or expired)
    // For simplicity, we just check if the user exists for login, 
    // or if we had a signup record. Actually, let's just generate a new one.

    if (type === 'login') {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Update or Create new record
    const existing = await UserVerification.findOne({ email, type });
    if (existing) {
      existing.otp = otp;
      existing.createdAt = Date.now();
      await existing.save();
    } else {
      // If expired completely, we might need more info for signup.
      // But for login, we can just create it.
      if (type === 'login') {
        await UserVerification.create({ email, otp, type });
      } else {
        return res.status(400).json({ success: false, message: 'Verification session expired. Please start over.' });
      }
    }

    const emailSent = await sendOTP(email, otp);
    if (!emailSent) return res.status(500).json({ success: false, message: 'Failed to resend email' });

    res.json({ success: true, message: 'New OTP sent to your email' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // We always respond with success to prevent email enumeration, 
    // but only send email if user exists.
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await UserVerification.deleteMany({ email, type: 'reset' });
      await UserVerification.create({ email, token, type: 'reset' });

      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
      await sendResetLink(email, resetUrl);
    }

    res.json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const verificationRecord = await UserVerification.findOne({ token, type: 'reset' });

    if (!verificationRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const user = await User.findOne({ email: verificationRecord.email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    // Delete token
    await UserVerification.deleteOne({ _id: verificationRecord._id });

    res.json({ success: true, message: 'Password has been reset successfully. Please login.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/me
router.get('/me', async (req, res) => {
  if (req.session.userId) {
    const user = await User.findById(req.session.userId).select('-password');
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } else {
    res.status(401).json({ success: false, message: 'Not authenticated' });
  }
});

// PUT /api/me
router.put('/me', ensureAuth, async (req, res) => {
  try {
    const { businessName, contactName, businessEmail, phoneNumber, businessWebsite } = req.body;

    const user = await User.findByIdAndUpdate(
      req.session.userId,
      { businessName, contactName, businessEmail, phoneNumber, businessWebsite },
      { new: true }
    ).select('-password');

    res.json({ success: true, message: 'Profile updated successfully!', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================= ADMIN ROUTES =================

// GET /api/admin/stats
router.get('/admin/stats', ensureAdmin, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'Pending Arrival' });
    const totalUsers = await User.countDocuments({ role: 'user' });
    const processingOrders = await Order.countDocuments({ status: 'Processing' });

    res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        totalUsers,
        activeOrders: processingOrders
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/orders
router.get('/admin/orders', ensureAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, type, search } = req.query;

    const filter = {};
    if (status && status !== 'All') {
      const statusList = status.split(',');
      if (statusList.length > 1) {
        filter.status = { $in: statusList };
      } else {
        filter.status = status;
      }
    }
    
    if (type) {
      filter.type = type;
    }

    if (search) {
      filter.$or = [
        { shipmentName: { $regex: search, $options: 'i' } },
        { orderId: { $regex: search, $options: 'i' } }
      ];
    }

    const totalOrders = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate('user', 'name email businessName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      orders,
      pagination: {
        totalOrders,
        totalPages: Math.ceil(totalOrders / limit),
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/admin/orders/:id/status
router.put('/admin/orders/:id/status', ensureAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Status required' });

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (status === 'Stored' && order.type === 'inbound') {
      for (const product of order.products) {
        if (product.productName && product.quantity) {
          await Inventory.findOneAndUpdate(
            { user: order.user, productName: product.productName },
            { 
              sku: product.sku || '', 
              packDetails: product.packDetails,
              $inc: { quantity: product.quantity }, 
              updatedAt: Date.now() 
            },
            { upsert: true, new: true }
          );
        }
      }
    }

    if (status === 'Shipped' && order.type === 'outbound') {
      for (const product of order.products) {
        if (product.sku && product.quantity) {
          await Inventory.findOneAndUpdate(
            { user: order.user, sku: product.sku },
            { $inc: { quantity: -product.quantity }, updatedAt: Date.now() }
          );
        }
      }
    }

    res.json({ success: true, message: `Shipment status updated to ${status}`, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/admin/orders/:id/carton-details
router.put('/admin/orders/:id/carton-details', ensureAdmin, async (req, res) => {
  try {
    const { cartonDetailsList } = req.body; // Array of { sku, cartonDetails }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.type !== 'outbound') {
      return res.status(400).json({ success: false, message: 'Only outbound orders can have carton details added this way' });
    }

    if (order.status !== 'Processing') {
      return res.status(400).json({ success: false, message: 'Order must be Processing to add carton details' });
    }

    // Update inventory
    if (Array.isArray(cartonDetailsList)) {
      for (const item of cartonDetailsList) {
        await Inventory.findOneAndUpdate(
          { user: order.user, sku: item.sku },
          { cartonDetails: item.cartonDetails }
        );
      }
    }

    order.status = 'Awaiting Shipping Labels';
    await order.save();

    res.json({ success: true, message: 'Carton details added and status updated', order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/admin/orders/:id
router.delete('/admin/orders/:id', ensureAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Shipment not found' });

    // Restriction: Cannot delete if processing, shipped or completed
    const restrictedStatuses = ['Processing', 'Shipped', 'Completed'];
    if (restrictedStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Shipments with status "${order.status}" cannot be deleted for safety.`
      });
    }

    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Shipment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/users
router.get('/admin/users', ensureAdmin, async (req, res) => {
  try {
    const { role, search, page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const currentLimit = parseInt(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    const filter = {};
    if (role && role !== 'all') {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }

    const totalUsers = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(currentLimit);

    res.json({
      success: true,
      users,
      pagination: {
        totalUsers,
        totalPages: Math.ceil(totalUsers / currentLimit),
        currentPage: currentPage,
        limit: currentLimit
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/create-admin
router.post('/admin/create-admin', ensureAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Admin already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'admin'
    });

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully!',
      user: { id: newAdmin._id, name: newAdmin.name, email: newAdmin.email }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/messages
router.get('/admin/messages', ensureAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const totalMessages = await Contact.countDocuments(filter);
    const messages = await Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      messages,
      pagination: {
        totalMessages,
        totalPages: Math.ceil(totalMessages / limit),
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /admin/users/:id
router.delete('/admin/users/:id', ensureAdmin, async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ success: false, message: 'User not found' });

    // Safety: Don't allow deleting self
    if (userToDelete._id.toString() === req.session.userId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logout successful' });
  });
});


module.exports = router;
