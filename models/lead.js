const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
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

// YA NO hay índice único: se permiten duplicados
// (Si tienes la línea LeadSchema.index(..., {unique:true}) bórrala o coméntala)

module.exports = mongoose.model('Lead', LeadSchema);