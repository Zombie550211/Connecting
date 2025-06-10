const mongoose = require("mongoose");

const costumerSchema = new mongoose.Schema({
  fecha: { type: String, required: true },
  equipo: String,
  agente: String,
  telefono: String,
  producto: String,
  puntaje: Number,
  cuenta: String,
  direccion: String,
  zip: String
});

module.exports = mongoose.model("Costumer", costumerSchema);