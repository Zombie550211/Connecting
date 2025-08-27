const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const envUri = process.env.MONGO_URI 
      || process.env.MONGODB_URI 
      || process.env.MONGO_URL 
      || process.env.DATABASE_URL;
    const dbName = process.env.MONGO_DB || 'crmagente';

    if (!envUri) {
      console.error('⚠️  No se encontró MONGO_URI, MONGODB_URI, MONGO_URL ni DATABASE_URL en variables de entorno.');
      console.error('    Asegúrate de tener un archivo .env en la raíz con alguna de esas variables definida.');
      throw new Error('Variables de conexión a MongoDB no definidas');
    }

    const chosenVar = process.env.MONGO_URI
      ? 'MONGO_URI'
      : process.env.MONGODB_URI
      ? 'MONGODB_URI'
      : process.env.MONGO_URL
      ? 'MONGO_URL'
      : 'DATABASE_URL';
    console.log(`🔧 Intentando conectar a MongoDB usando ${chosenVar} (dbName=${dbName})`);

    const conn = await mongoose.connect(envUri, { dbName });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${dbName}`);
  } catch (error) {
    console.error(`❌ Error conectando a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
