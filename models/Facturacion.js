const mongoose = require('mongoose');

const FacturacionSchema = new mongoose.Schema({
  fecha: String,          // "DD/MM/YYYY"
  campos: [String],       // Array de 14 columnas (puedes usar [Number] si siempre son números)
});

module.exports = mongoose.model('Facturacion', FacturacionSchema);