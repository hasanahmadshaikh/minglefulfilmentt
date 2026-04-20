const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      const msg = 'Error: MONGODB_URI environment variable is not defined. Add it to your Vercel environment variables.';
      console.error(msg);
      throw new Error(msg);
    }

    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`DB Connection Error: ${error.message}`);
    // Do NOT call process.exit(1) on Vercel - it kills the serverless worker
    throw error;
  }
};

module.exports = connectDB;
