const mongoose = require('mongoose');

const crmAgenteSchema = new mongoose.Schema({
  // Campos principales
  agente: { type: String, required: true },
  team: { type: String, required: true },
  numero_cliente: { type: String },
  telefono_principal: { type: String },
  direccion: { type: String },
  zip: { type: String },
  
  // Campos de servicio
  tipo_servicios: { type: String },
  servicios: { type: String },
  mercado: { type: String },
  comentario: { type: String },
  
  // Fechas
  dia_venta: { type: String },
  dia_instalacion: { type: String },
  
  // Otros campos
  motivo_llamada: { type: String },
  puntaje: { type: Number, default: 0 },
  
  // Campos adicionales que puedan existir
  autopaquete: { type: String },
  riesgo: { type: String },
  estatus: { type: String },
  numero_de_cuenta: { type: String }
}, {
  collection: 'crm agente', // Nombre exacto según MongoDB Compass (con espacio)
  timestamps: false // No agregar createdAt/updatedAt automáticamente
});

module.exports = mongoose.model('CrmAgente', crmAgenteSchema);
