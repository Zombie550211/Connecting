const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Obtener equipos únicos
router.get('/equipos', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const equipos = await db.collection('crm_agente').distinct('team');
    
    // Contar miembros por equipo
    const equiposConMiembros = await Promise.all(
      equipos.map(async (equipo) => {
        const count = await db.collection('crm_agente').countDocuments({ team: equipo });
        return {
          nombre: equipo,
          miembros: count
        };
      })
    );
    
    // Ordenar por cantidad de miembros (de mayor a menor)
    equiposConMiembros.sort((a, b) => b.miembros - a.miembros);
    
    res.json({ equipos: equiposConMiembros });
  } catch (error) {
    console.error('Error al obtener equipos:', error);
    res.status(500).json({ error: 'Error al obtener los equipos' });
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
