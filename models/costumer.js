const mongoose = require('mongoose');

const costumerSchema = new mongoose.Schema({
  // tu esquema aquí...
  fecha: Date,
  equipo: String,
  agente: String,
  telefono: String,
  producto: String,
  puntaje: Number,
  cuenta: String,
  direccion: String,
  zip: String,
});

// Esta línea protege para que el modelo no se redefina si ya existe
module.exports = mongoose.models.Costumer || mongoose.model('Costumer', costumerSchema);
