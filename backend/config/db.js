const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017';
    const dbName = process.env.MONGO_DB || 'crmagente';

    const conn = await mongoose.connect(uri, { dbName });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${dbName}`);
  } catch (error) {
    console.error(`❌ Error conectando a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
