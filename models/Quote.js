const mongoose = require('mongoose');

const quoteSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    company: {
      type: String,
    },
    service: {
      type: String,
      required: true,
    },
    monthlyVolume: {
      type: String,
    },
    details: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Quote = mongoose.model('Quote', quoteSchema);
module.exports = Quote;
