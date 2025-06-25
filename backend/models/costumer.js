const mongoose = require('mongoose');

const costumerSchema = new mongoose.Schema({
  // 1
  agente:   { type: String, required: true },
  // 2
  nombre_cliente: { type: String, default: '' },        // Nombre cliente
  // 3
  telefono: { type: String, default: '' },              // Teléfono principal
  // 4
  telefono_alterno: { type: String, default: '' },      // Teléfono alterno
  // 5
  numero_de_cuenta: { type: String, default: '' },      // Numero de cuenta
  // 6
  autopaquete: { type: String, default: '' },           // Autopaquete
  // 7
  direccion: { type: String, default: '' },             // Dirección
  // 8
  tipo_de_serv: { type: String, default: '' },          // Tipo de serv
  // 9
  sistema: { type: String, default: '' },               // Sistema
  // 10
  riesgo: { type: String, default: '' },                // Riesgo
  // 11
  dia_venta_a_instalacion: { type: String, default: '' }, // Día de venta a de instalaci
  // 12
  estado: { type: String, default: 'Pending' },         // Status
  // 13
  servicios: { type: String, default: '' },             // Servicios
  // 14
  mercado: { type: String, default: '' },               // Mercado
  // 15
  supervisor: { type: String, default: '' },            // Supervisor
  // 16
  comentario: { type: String, default: '' },            // Comentario
  // 17
  motivo_llamada: { type: String, default: '' },        // ¿Por que llamo el cliente?
  // 18
  zip: { type: String, default: '' },                   // ZIP CODE
  // 19
  puntaje:  { type: Number,  default: 0 },              // PUNTAJE

  // Campos extra para compatibilidad (puedes eliminarlos si lo deseas)
  fecha:    { type: String, default: '' },
  equipo:   { type: String, default: '' },
  producto: { type: String, default: '' },
  cuenta:   { type: String, default: '' }
});

module.exports = mongoose.model('Costumer', costumerSchema, 'costumers');