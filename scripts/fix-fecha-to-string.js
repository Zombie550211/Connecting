require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/lead');
const Costumer = require('../models/costumer');

const MONGO_URL = process.env.MONGO_URL || "TU_STRING_DE_CONEXION_MONGODB";

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("Conectado a MongoDB");

  // Procesa Leads
  const leadDocs = await Lead.find({ fecha: { $type: "date" } });
  for (const doc of leadDocs) {
    const fechaString = doc.fecha.toISOString().slice(0, 10);
    await Lead.updateOne({ _id: doc._id }, { $set: { fecha: fechaString } });
    console.log(`Lead actualizado: ${doc._id}`);
  }

  // Procesa Costumer
  const costumerDocs = await Costumer.find({ fecha: { $type: "date" } });
  for (const doc of costumerDocs) {
    const fechaString = doc.fecha.toISOString().slice(0, 10);
    await Costumer.updateOne({ _id: doc._id }, { $set: { fecha: fechaString } });
    console.log(`Costumer actualizado: ${doc._id}`);
  }

  console.log("Conversión completa. Ya puedes usar $regex sin errores.");
  process.exit(0);
}

main().catch(err => { console.error("Error:", err); process.exit(1); });