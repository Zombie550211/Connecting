require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  try {
    const uri = process.env.MONGO_URI;
    console.log("Mongo URI:", uri);  // Para depurar

    if (!uri) {
      throw new Error("La variable de entorno MONGO_URI no está definida");
    }

    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Conexión exitosa a MongoDB");
  } catch (error) {
    console.error("Error en la prueba:", error);
  } finally {
    mongoose.connection.close();
    console.log("Conexión cerrada.");
  }
}

test();
