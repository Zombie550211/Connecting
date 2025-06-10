require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/lead');

const MONGO_URL = process.env.MONGO_URL || "PON_AQUI_TU_CONEXION_MONGODB";

async function fixFechaToString() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("Conectado a MongoDB");

    const docs = await Lead.find({ fecha: { $type: "date" } });
    console.log(`Documentos a modificar: ${docs.length}`);

    for (let doc of docs) {
      const fechaDate = doc.fecha;
      if (fechaDate && fechaDate instanceof Date) {
        const fechaString = fechaDate.toISOString().slice(0, 10);
        await Lead.updateOne(
          { _id: doc._id },
          { $set: { fecha: fechaString } }
        );
        console.log(`Actualizado _id: ${doc._id} | fecha: ${fechaString}`);
      }
    }

    console.log("Conversión completa.");
    process.exit(0);
  } catch (err) {
    console.error("Error en la conversión:", err);
    process.exit(1);
  }
}

fixFechaToString();