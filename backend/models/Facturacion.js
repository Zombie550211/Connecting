const mongoose = require('mongoose');

const FacturacionSchema = new mongoose.Schema({
  fecha:   { type: String, required: true },    // "DD/MM/YYYY"
  campos:  { type: [String], required: true },  // Array de 14 columnas (puede ser [Number] si siempre son números)
});

module.exports = mongoose.model('Facturacion', FacturacionSchema);