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
    type: String
  },
  supplierName: {
    type: String
  },
  trackingNumber: {
    type: String
  },
  carrier: {
    type: String
  },
  estimatedArrival: {
    type: Date
  },
  skuList: {
    type: String
  },
  productQuantities: {
    type: String
  },
  productImages: {
    type: [String] // Array of file names/paths
  },
  packingDetails: {
    type: String
  },
  notes: {
    type: String
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
  documents: {
    type: [String],
    default: []
  },
  channel: {
    type: String
  },
  fulfilmentType: {
    type: String
  },
  prepInstructions: {
    type: String
  },
  shippingLabelsRequired: {
    type: Boolean
  },
  shippingLabels: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: [
      'Pending Arrival', 'Received', 'In Inspection', 'Stored',
      'Processing', 'Awaiting Shipping Labels', 'Shipment labels uploaded', 'Shipped', 'Completed', 'Cancelled'
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
    sku: String,
    packDetails: {
      type: String,
      enum: ['Cases', 'Units']
    }
  }]
});

module.exports = mongoose.model('Order', OrderSchema);
