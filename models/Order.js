const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderId: {
    type: String,
    unique: true
  },
  shipmentName: {
    type: String,
    required: true
  },
  supplierName: {
    type: String,
    required: true
  },
  trackingNumber: {
    type: String,
    required: true
  },
  carrier: {
    type: String,
    required: true
  },
  estimatedArrival: {
    type: Date,
    required: true
  },
  skuList: {
    type: String,
    required: true
  },
  productQuantities: {
    type: String,
    required: true
  },
  productImages: {
    type: [String], // Array of file names/paths
    required: true
  },
  packingDetails: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    required: true
  },
  googleDriveDocs: {
    type: String
  },
  commercialInvoices: {
    type: [String]
  },
  packingListPDFs: {
    type: [String]
  },
  status: {
    type: String,
    enum: [
      'Pending Arrival', 'Received', 'In Inspection', 'Stored',
      'Processing', 'Shipped', 'Completed', 'Cancelled'
    ],
    default: 'Pending Arrival'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['inbound', 'outbound'],
    default: 'inbound'
  },
  products: [{
    productName: String,
    quantity: Number,
    sku: String
  }]
});

module.exports = mongoose.model('Order', OrderSchema);
