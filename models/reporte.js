const mongoose = require('mongoose');

const ReporteSchema = new mongoose.Schema({
  ano: Number,
  mes: Number,
  datos: [Object]
});

module.exports = mongoose.model('Reporte', ReporteSchema);