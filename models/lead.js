const mongoose = require('mongoose');

const CostumerSchema = new mongoose.Schema({
  fecha: { type: Date, required: true },  // <-- cambiar a Date
  equipo: String,
  agente: String,
  telefono: String,
  producto: String,
  puntaje: Number,
  cuenta: String,
  direccion: String,
  zip: String,
});

module.exports = mongoose.model('Costumer', CostumerSchema);
