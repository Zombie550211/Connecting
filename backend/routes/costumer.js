const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Conexión a la colección costumers en la base de datos crmagente
const getCostumersCollection = () => {
  return mongoose.connection.db.collection('costumers');
};

// Ventas Hoy
router.get('/ventas/hoy', async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    
    const ventasHoy = await getCostumersCollection().countDocuments({
      fecha: { $gte: hoy, $lt: manana }
    });
    
    res.json({ total: ventasHoy });
  } catch (error) {
    console.error('Error al obtener ventas de hoy:', error);
    res.status(500).json({ error: 'Error al obtener ventas de hoy' });
  }
});

// Leads Pendientes
router.get('/leads/pendientes', async (req, res) => {
  try {
    const pendientes = await getCostumersCollection().countDocuments({
      estado: 'Pending'
    });
    
    res.json({ total: pendientes });
  } catch (error) {
    console.error('Error al obtener leads pendientes:', error);
    res.status(500).json({ error: 'Error al obtener leads pendientes' });
  }
});

// Total Clientes
router.get('/clientes', async (req, res) => {
  try {
    const total = await getCostumersCollection().countDocuments({});
    res.json({ total });
  } catch (error) {
    console.error('Error al contar clientes:', error);
    res.status(500).json({ error: 'Error al contar clientes' });
  }
});

// Ventas este mes
router.get('/ventas/mes', async (req, res) => {
  try {
    const ahora = new Date();
    const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    
    const ventasMes = await getCostumersCollection().countDocuments({
      fecha: { $gte: primerDiaMes }
    });
    
    res.json({ total: ventasMes });
  } catch (error) {
    console.error('Error al obtener ventas del mes:', error);
    res.status(500).json({ error: 'Error al obtener ventas del mes' });
  }
});

// Obtener lista de clientes con filtros
router.get('/clientes/lista', async (req, res) => {
  try {
    console.log('🔍 [BACKEND] Solicitando lista de clientes con filtros:', req.query);
    const { desde, hasta, mes, anio } = req.query;
    let query = {};
    
    // Construir el query según los filtros
    if (desde && hasta) {
      query.fecha = {
        $gte: new Date(desde),
        $lte: new Date(hasta)
      };
    } else if (mes && anio) {
      const mesNum = parseInt(mes, 10) - 1; // Los meses en JS van de 0 a 11
      const fechaInicio = new Date(anio, mesNum, 1);
      const fechaFin = new Date(anio, mesNum + 1, 0);
      
      query.fecha = {
        $gte: fechaInicio,
        $lte: fechaFin
      };
    }
    
    console.log('🔍 [BACKEND] Consulta a la base de datos:', JSON.stringify(query));
    
    // Obtener los clientes con los filtros aplicados
    const clientes = await getCostumersCollection().find(query).toArray();
    console.log(`🔍 [BACKEND] Número de clientes encontrados: ${clientes.length}`);
    
    if (clientes.length > 0) {
      console.log('🔍 [BACKEND] Primer cliente encontrado:', JSON.stringify(clientes[0]));
    }
    
    // Mapear los campos al formato esperado por el frontend
    const clientesMapeados = clientes.map(cliente => ({
      _id: cliente._id,
      fecha: cliente.fecha ? new Date(cliente.fecha).toISOString() : null,
      team: cliente.team || '',
      agente: cliente.agente || '',
      servicio: cliente.servicio || '',
      fechaInstalacion: cliente.fechaInstalacion ? new Date(cliente.fechaInstalacion).toISOString() : null,
      estado: cliente.estado || 'Pending',
      puntaje: cliente.puntaje || 0,
      cuenta: cliente.cuenta || 'Elige',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      codigoPostal: cliente.codigoPostal || ''
    }));
    
    res.json({ clientes: clientesMapeados });
  } catch (error) {
    console.error('Error al obtener lista de clientes:', error);
    res.status(500).json({ error: 'Error al obtener la lista de clientes' });
  }
});

module.exports = router;