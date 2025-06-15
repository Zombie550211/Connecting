const mongoose = require('mongoose');

const FacturacionSchema = new mongoose.Schema({
  fecha: { type: String, required: true },
  campos: { type: [String], required: true } // 14 campos
});

module.exports = mongoose.model('Facturacion', FacturacionSchema);