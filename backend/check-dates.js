const mongoose = require('mongoose');
const Costumer = require('./models/Costumer');
require('dotenv').config();

async function checkDates() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Conectado a MongoDB');

    // Consultar un documento para ver su estructura
    const sample = await Costumer.findOne();
    
    if (sample) {
      console.log('📝 Muestra de documento:');
      console.log({
        _id: sample._id,
        equipo: sample.equipo,
        servicios: sample.servicios,
        puntaje: sample.puntaje,
        fecha: sample.fecha,
        dia_venta_a_instalacion: sample.dia_venta_a_instalacion,
        createdAt: sample.createdAt
      });
      
      // Verificar fechas únicas
      const fechas = await Costumer.distinct('fecha');
      const diasVenta = await Costumer.distinct('dia_venta_a_instalacion');
      
      console.log('\n📅 Fechas únicas en el campo "fecha":', fechas);
      console.log('📅 Valores únicos en "dia_venta_a_instalacion":', diasVenta);
      
      // Contar documentos totales
      const total = await Costumer.countDocuments();
      console.log('\n📊 Total de documentos en la colección:', total);
    } else {
      console.log('ℹ️ No se encontraron documentos en la colección');
    }
    
    // Desconectar
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkDates();
