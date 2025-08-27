const mongoose = require('mongoose');

const CrmAgenteSchema = new mongoose.Schema({
  dia_venta: { type: String, required: true }, // formato esperado YYYY-MM-DD
  equipo: { type: String, required: true },
  agent: { type: String },
  agente: { type: String },
  producto: { type: String, required: true },
  fecha_instalacion: { type: String },
  estado: { type: String, default: 'Pendiente' },
  puntaje: { type: Number, default: 0 },
  cuenta: { type: String },
  telefono: { type: String },
  direccion: { type: String },
  zip: { type: String },
}, { timestamps: true });

module.exports = mongoose.models.CrmAgente || mongoose.model('CrmAgente', CrmAgenteSchema);
