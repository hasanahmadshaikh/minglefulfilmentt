const mongoose = require('mongoose');
require('dotenv').config();

async function checkOrders() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/warehouse');
  const Order = require('../models/Order');
  const orders = await Order.find({}).limit(10);
  console.log('Found orders:', orders.length);
  orders.forEach(o => {
    console.log({
      id: o.orderId,
      documents: o.documents,
      productImages: o.productImages,
      commercialInvoices: o.commercialInvoices,
      packingListPDFs: o.packingListPDFs,
      shippingLabels: o.shippingLabels
    });
  });
  process.exit(0);
}

checkOrders().catch(err => {
  console.error(err);
  process.exit(1);
});
