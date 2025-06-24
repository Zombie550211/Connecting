const mongoose = require('mongoose');

const costumerSchema = new mongoose.Schema({
  fecha:    { type: String, required: true },
  equipo:   { type: String, default: '' },
  agente:   { type: String, required: true },
  telefono: { type: String, default: '' },
  producto: { type: String, required: true },
  puntaje:  { type: Number,  default: 0 },
  cuenta:   { type: String, default: '' },
  direccion:{ type: String, default: '' },
  zip:      { type: String, default: '' },
  estado:   { type: String, default: 'Pending' } // <---- Añade este campo
});

module.exports = mongoose.model('Costumer', costumerSchema, 'costumers');