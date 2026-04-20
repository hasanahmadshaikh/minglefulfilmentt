const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['FBA', 'FBM'],
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  bundles: {
    type: String
  },
  attachments: {
    type: [String] // Array of file paths/names
  },
  filesLink: {
    type: String // FNSKU or Order files link
  },
  notes: {
    type: String
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', OrderSchema);
