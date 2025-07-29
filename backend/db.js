const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB Atlas conectado');
  } catch (err) {
    console.error('Error de conexión a MongoDB', err);
    process.exit(1);
  }
};

module.exports = connectDB;