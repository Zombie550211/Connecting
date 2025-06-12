const mongoose = require('mongoose');

const CostumerSchema = new mongoose.Schema({
  fecha: { type: String, required: true },
  equipo: { type: String, default: '' },
  agente: { type: String, required: true },
  telefono: { type: String, default: '' },
  producto: { type: String, required: true },
  puntaje: { type: Number, default: 0 },
  cuenta: { type: String, default: '' },
  direccion: { type: String, default: '' },
  zip: { type: String, default: '' }
});

// Índice único para evitar duplicados en Costumer
CostumerSchema.index(
  { fecha: 1, equipo: 1, agente: 1, producto: 1, puntaje: 1, cuenta: 1, telefono: 1, direccion: 1, zip: 1 },
  { unique: true }
);

module.exports = mongoose.model('Costumer', CostumerSchema);