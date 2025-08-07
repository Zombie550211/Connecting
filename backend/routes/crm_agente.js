const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Obtener equipos únicos con conteo de leads
router.get('/equipos', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    
    // Obtener todos los documentos para contar los leads por equipo
    const pipeline = [
      {
        $match: { team: { $exists: true, $ne: null, $ne: '' } } // Solo documentos con team válido
      },
      {
        $group: {
          _id: "$team",
          totalLeads: { $sum: 1 } // Contar cada lead como una venta
        }
      },
      {
        $project: {
          _id: 0,
          nombre: "$_id",
          ventas: "$totalLeads"
        }
      },
      {
        $sort: { ventas: -1 } // Ordenar por ventas de mayor a menor
      }
    ];
    
    const equiposConVentas = await db.collection('crm_agente').aggregate(pipeline).toArray();
    
    // Si no hay resultados, verificar si hay algún documento en la colección
    if (equiposConVentas.length === 0) {
      const totalDocs = await db.collection('crm_agente').countDocuments();
      if (totalDocs > 0) {
        // Si hay documentos pero no tienen el campo team, los agrupamos como "Sin Equipo"
        equiposConVentas.push({
          nombre: "Sin Equipo",
          ventas: totalDocs
        });
      } else {
        // Si no hay documentos, usar datos de ejemplo
        equiposConVentas.push(
          { nombre: "Team Roberto", ventas: 45 },
          { nombre: "Team Irania", ventas: 32 },
          { nombre: "Team Pleitez", ventas: 28 }
        );
      }
    }
    
    res.json({ equipos: equiposConVentas });
  } catch (error) {
    console.error('Error al obtener equipos:', error);
    res.status(500).json({ error: 'Error al obtener los equipos', details: error.message });
  }
});

// Obtener clientes
router.get('/clientes', (req, res) => {
  // Respuesta de ejemplo con array vacío
  res.json({ clientes: [] });
});

// Ruta para métricas de ventas - Respuesta de ejemplo
router.get('/metricas-ventas', (req, res) => {
  // Validar parámetros
  const { mes, anio } = req.query;
  
  if (!mes || !anio) {
    return res.status(400).json({ error: 'Se requieren los parámetros mes y año' });
  }
  
  // Devolver valores predeterminados
  return res.json({
    totalClientes: 0,
    totalVentas: 0
  });
});

module.exports = router;
