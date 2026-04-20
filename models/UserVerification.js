const mongoose = require('mongoose');

const userVerificationSchema = mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String }, // Used for signup/login
  token: { type: String }, // Used for password reset Link
  name: { type: String }, 
  password: { type: String }, 
  type: { type: String, enum: ['signup', 'login', 'reset'], required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 } // Extended to 1 hour to support reset links
});

const UserVerification = mongoose.model('UserVerification', userVerificationSchema);
module.exports = UserVerification;
