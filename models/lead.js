const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  fecha: { type: String, required: true},
  team: String,
  agent: String,
  telefono: String,
  producto: String,
  puntaje: Number,
  cuenta: String,
  direccion: String,
  zip: String
  // No incluir campo email aquí
});

module.exports = mongoose.model('Lead', leadSchema);