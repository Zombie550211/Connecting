const express = require('express');
const router = express.Router();
const CrmAgente = require('../models/crmAgente'); // Cambiado de Costumer a CrmAgente


// Obtener ranking de equipos
router.get('/equipos', async (req, res) => {
  try {
    const { mes, anio } = req.query;
    
    // Validar mes y año
    if (!mes || !anio) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren los parámetros mes y año' 
      });
    }

    const mesNum = parseInt(mes) + 1; // Se suma 1 porque JS usa meses 0-11 y Mongo 1-12
    const anioNum = parseInt(anio);
    
    // Agrupar por equipo y sumar ventas
    const equiposRanking = await CrmAgente.aggregate([
      {
        $match: {
          $expr: {
            $and: [
              { $eq: [{ $month: '$dia_venta' }, mesNum] },
              { $eq: [{ $year: '$dia_venta' }, anioNum] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$team', // Cambiado de 'equipo' a 'team'
          ventas: { $sum: 1 },
          totalPuntos: { $sum: '$puntaje' }
        }
      },
      {
        $project: {
          _id: 0,
          equipo: '$_id', // Se mantiene 'equipo' para el frontend
          ventas: 1,
          totalPuntos: 1,
          promedioPuntos: { $divide: ['$totalPuntos', '$ventas'] }
        }
      },
      { $sort: { ventas: -1 } },
      { $limit: 3 }
    ]);

    res.json({ success: true, data: equiposRanking });
  } catch (error) {
    console.error('Error al obtener ranking de equipos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener ranking de equipos',
      details: error.message 
    });
  }
});

// Obtener ranking de agentes
router.get('/agentes', async (req, res) => {
  try {
    const { mes, anio } = req.query;
    
    // Validar mes y año
    if (!mes || !anio) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren los parámetros mes y año' 
      });
    }

    const mesNum = parseInt(mes) + 1; // Se suma 1 porque JS usa meses 0-11 y Mongo 1-12
    const anioNum = parseInt(anio);
    
    // Agrupar por agente y sumar ventas
    const agentesRanking = await CrmAgente.aggregate([
      {
        $match: {
          $expr: {
            $and: [
              { $eq: [{ $month: '$dia_venta' }, mesNum] },
              { $eq: [{ $year: '$dia_venta' }, anioNum] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$agente',
          ventas: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          agente: '$_id',
          ventas: 1
        }
      },
      { $sort: { ventas: -1 } },
      { $limit: 3 }
    ]);

    res.json({ success: true, data: agentesRanking });
  } catch (error) {
    console.error('Error al obtener ranking de agentes:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener ranking de agentes',
      details: error.message 
    });
  }
});

// Obtener ranking por puntos
router.get('/puntos', async (req, res) => {
  try {
    const { mes, anio } = req.query;
    
    // Validar mes y año
    if (!mes || !anio) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren los parámetros mes y año' 
      });
    }

    const mesNum = parseInt(mes) + 1; // Se suma 1 porque JS usa meses 0-11 y Mongo 1-12
    const anioNum = parseInt(anio);
    
    // Agrupar por agente y sumar puntos
    const puntosRanking = await CrmAgente.aggregate([
      {
        $match: {
          puntaje: { $exists: true, $ne: null },
          $expr: {
            $and: [
              { $eq: [{ $month: '$dia_venta' }, mesNum] },
              { $eq: [{ $year: '$dia_venta' }, anioNum] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$agente',
          totalPuntos: { $sum: '$puntaje' }
        }
      },
      {
        $project: {
          _id: 0,
          agente: '$_id',
          totalPuntos: 1
        }
      },
      { $sort: { totalPuntos: -1 } },
      { $limit: 3 }
    ]);

    res.json({ success: true, data: puntosRanking });
  } catch (error) {
    console.error('Error al obtener ranking de puntos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener ranking de puntos',
      details: error.message 
    });
  }
});

module.exports = router;