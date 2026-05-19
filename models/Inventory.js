const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  sku: {
    type: String
  },
  quantity: {
    type: Number,
    default: 0
  },
  packDetails: {
    type: String,
    enum: ['Cases', 'Units']
  },
  cartonDetails: {
    type: String
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure uniqueness per user per product
InventorySchema.index({ user: 1, productName: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', InventorySchema);
