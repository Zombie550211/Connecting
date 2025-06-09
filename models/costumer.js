const mongoose = require('mongoose');

const costumerSchema = new mongoose.Schema({
  fecha: { type: String, required: true },
  equipo: { type: String },
  agente: { type: String },
  teléfono: { type: String },
  producto: { type: String },
  puntaje: { type: Number },
  cuenta: { type: String },
  direccion: { type: String },
  zip: { type: String }
}, { collection: 'costumers' });

module.exports = mongoose.model('Costumer', costumerSchema);