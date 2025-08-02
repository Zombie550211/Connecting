const mongoose = require('mongoose');
const Costumer = require('./models/costumer');
require('dotenv').config();

async function checkData() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Conectado a MongoDB');

    // Fecha a consultar
    const fecha = '2025-08-02';
    
    // Consultar documentos para la fecha específica
    const query = {
      $or: [
        { 'fecha': fecha },
        { 'dia_venta_a_instalacion': { $regex: `^${fecha}` } }
      ]
    };

    // Contar documentos
    const count = await Costumer.countDocuments(query);
    console.log(`📊 Total de documentos para ${fecha}:`, count);

    // Si hay documentos, mostrar un ejemplo
    if (count > 0) {
      const sample = await Costumer.findOne(query);
      console.log('📝 Muestra de documento:', JSON.stringify(sample, null, 2));
      
      // Verificar la estructura del documento
      console.log('🔍 Estructura del documento:');
      console.log('- equipo:', sample.equipo);
      console.log('- servicios:', sample.servicios);
      console.log('- puntaje:', sample.puntaje);
      console.log('- fecha:', sample.fecha);
      console.log('- dia_venta_a_instalacion:', sample.dia_venta_a_instalacion);
    } else {
      console.log('ℹ️ No se encontraron documentos para la fecha especificada');
      
      // Mostrar fechas disponibles en la colección
      const fechas = await Costumer.aggregate([
        { $match: { $or: [{ fecha: { $exists: true } }, { dia_venta_a_instalacion: { $exists: true } }] } },
        { $project: { 
          fecha: 1, 
          dia_venta: { $substr: ['$dia_venta_a_instalacion', 0, 10] } 
        } },
        { $group: { _id: null, fechas: { $addToSet: '$fecha' }, dias: { $addToSet: '$dia_venta' } } }
      ]);
      
      if (fechas.length > 0) {
        console.log('📅 Fechas disponibles en la colección:');
        const fechasUnicas = [...new Set([...fechas[0].fechas, ...fechas[0].dias])].filter(Boolean);
        console.log(fechasUnicas);
      }
    }

    // Desconectar
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkData();
