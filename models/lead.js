const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
  fecha: {
    type: Date,
    required: true
  },
  team: {
    type: String,
    trim: true,
    required: [true, 'El equipo es obligatorio']
  },
  agent: {
    type: String,
    trim: true,
    required: [true, 'El agente es obligatorio']
  },
  telefono: {
    type: String,
    trim: true
  },
  producto: {
    type: String,
    trim: true,
    required: [true, 'El producto es obligatorio']
  },
  puntaje: {
    type: Number,
    default: 0
  },
  cuenta: {
    type: String,
    trim: true
  },
  direccion: {
    type: String,
    trim: true
  },
  zip: {
    type: String,
    trim: true
  }
});

module.exports = mongoose.model('Lead', LeadSchema);