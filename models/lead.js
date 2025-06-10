const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema({
  fecha: { type: String, required: true }, // ¡Siempre string!
  equipo: String,
  agente: String,
  teléfono: String,
  producto: String,
  puntaje: Number,
  cuenta: String,
  direccion: String,
  zip: String
});

module.exports = mongoose.model("Lead", leadSchema);