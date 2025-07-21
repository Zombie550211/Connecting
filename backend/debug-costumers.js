const mongoose = require('mongoose');
const Costumer = require('./models/costumer');
require('dotenv').config();

// Conectar a MongoDB usando la configuración del .env
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://Zombie550211:fDJneHzSCsiU5mdy@cluster0.ywxaotz.mongodb.net/sample_mflix?retryWrites=true&w=majority&appName=Cluster0';
console.log('🔗 Conectando a:', mongoUrl.replace(/:[^:@]*@/, ':***@'));
mongoose.connect(mongoUrl)
  .then(() => {
    console.log('✅ Conectado a MongoDB para diagnóstico');
    return diagnosticarDatos();
  })
  .catch(err => {
    console.error('❌ Error conectando a MongoDB:', err);
    process.exit(1);
  });

async function diagnosticarDatos() {
  try {
    console.log('\n=== DIAGNÓSTICO DE DATOS ===');
    
    // 1. Contar total de documentos
    const totalDocs = await Costumer.countDocuments();
    console.log(`📊 Total de documentos en la colección: ${totalDocs}`);
    
    if (totalDocs === 0) {
      console.log('⚠️  No hay datos en la base de datos');
      process.exit(0);
    }
    
    // 2. Obtener algunos documentos de muestra
    const muestras = await Costumer.find().limit(3).lean();
    console.log('\n📋 Muestra de documentos:');
    muestras.forEach((doc, index) => {
      console.log(`\nDocumento ${index + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(`  agente: ${doc.agente || 'NO DEFINIDO'}`);
      console.log(`  supervisor: ${doc.supervisor || 'NO DEFINIDO'}`);
      console.log(`  fecha: ${doc.fecha || 'NO DEFINIDO'}`);
      console.log(`  estado: ${doc.estado || 'NO DEFINIDO'}`);
      console.log(`  telefono: ${doc.telefono || 'NO DEFINIDO'}`);
      console.log(`  direccion: ${doc.direccion || 'NO DEFINIDO'}`);
      console.log(`  tipo_de_serv: ${doc.tipo_de_serv || 'NO DEFINIDO'}`);
    });
    
    // 3. Verificar campos específicos
    console.log('\n🔍 Análisis de campos:');
    const conAgente = await Costumer.countDocuments({ agente: { $exists: true, $ne: '' } });
    const conSupervisor = await Costumer.countDocuments({ supervisor: { $exists: true, $ne: '' } });
    const conFecha = await Costumer.countDocuments({ fecha: { $exists: true, $ne: '' } });
    const conEstado = await Costumer.countDocuments({ estado: { $exists: true, $ne: '' } });
    
    console.log(`  Documentos con agente: ${conAgente}`);
    console.log(`  Documentos con supervisor: ${conSupervisor}`);
    console.log(`  Documentos con fecha: ${conFecha}`);
    console.log(`  Documentos con estado: ${conEstado}`);
    
    // 4. Probar la query que usa la API
    console.log('\n🔧 Probando query de la API:');
    const hoy = new Date();
    const mes = hoy.getMonth();
    const anio = hoy.getFullYear();
    const primerDia = new Date(anio, mes, 1).toISOString().split('T')[0];
    const ultimoDia = new Date(anio, mes + 1, 0).toISOString().split('T')[0];
    
    console.log(`  Buscando entre: ${primerDia} y ${ultimoDia}`);
    const resultadosAPI = await Costumer.find({
      fecha: { $gte: primerDia, $lte: ultimoDia }
    }).lean();
    
    console.log(`  Resultados encontrados: ${resultadosAPI.length}`);
    
    // 5. Mostrar todos los valores únicos de fecha para entender el formato
    const fechasUnicas = await Costumer.distinct('fecha');
    console.log('\n📅 Fechas únicas en la base de datos (primeras 10):');
    fechasUnicas.slice(0, 10).forEach(fecha => {
      console.log(`  ${fecha}`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    process.exit(1);
  }
}
