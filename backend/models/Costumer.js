const mongoose = require('mongoose');

const costumerSchema = new mongoose.Schema({
  FECHA: { type: Date, default: Date.now },
  TEAM: { type: String, required: true },
  AGENTE: { type: String, required: true },
  PRODUCTO: { type: String, required: true },
  ESTADO: { 
    type: String, 
    enum: ['Pending', 'Complete', 'Rescheduled', 'Cancelled', 'Pending Chargeback'],
    required: true 
  },
  PUNTAJE: { type: Number, default: 0 },
  CUENTA: { 
    type: String, 
    enum: ['Cuenta Alexis', 'Cuenta Eduardo', 'Cuenta Israel', 'Cuenta Lineas', 'Elige'],
    default: 'Elige'
  },
  'TELÉFONO': { type: String },
  'DIRECCIÓN': { type: String },
  ZIP: { type: String },
  creado_el: { type: Date, default: Date.now },
  actualizado_el: { type: Date, default: Date.now }
});

// Actualizar la fecha de modificación antes de guardar
costumerSchema.pre('save', function(next) {
  this.actualizado_el = new Date();
  next();
});

const Costumer = mongoose.model('Costumer', costumerSchema, 'costumers');

module.exports = Costumer;
