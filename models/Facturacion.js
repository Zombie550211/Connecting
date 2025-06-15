const mongoose = require('mongoose');

const FacturacionSchema = new mongoose.Schema({
  fecha: { type: String, required: true }, // formato: DD/MM/YYYY
  campos: [String], // 14 columnas de datos editables
}, { versionKey: false });

FacturacionSchema.index({ fecha: 1 }, { unique: true });

module.exports = mongoose.model('Facturacion', FacturacionSchema);