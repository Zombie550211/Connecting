const express = require('express');
const router = express.Router();

// Datos de ejemplo
const equiposEjemplo = [
  { nombre: "Team Roberto", ventas: 45 },
  { nombre: "Team Irania", ventas: 32 },
  { nombre: "Team Pleitez", ventas: 28 }
];

// Obtener equipos
router.get('/equipos', async (req, res) => {
  try {
    res.json({
      success: true,
      equipos: equiposEjemplo,
      message: 'Datos de equipos cargados correctamente'
    });
  } catch (error) {
    console.error('Error al obtener equipos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener los equipos',
      message: error.message
    });
  }
});

// Obtener clientes
router.get('/clientes', (req, res) => {
  res.json({ clientes: [] });
});

// Ruta para métricas de ventas
router.get('/metricas-ventas', (req, res) => {
  const { fechaInicio, fechaFin } = req.query;
  
  if (!fechaInicio || !fechaFin) {
    return res.status(400).json({ 
      success: false, 
      error: 'Se requieren las fechas de inicio y fin' 
    });
  }
  
  res.json({
    success: true,
    metricas: {
      totalVentas: 0,
      ventasPorDia: [],
      ventasPorAgente: []
    },
    message: 'Datos de métricas cargados correctamente'
  });
});

// Obtener ranking de agentes por ventas
router.get('/ranking/ventas', async (req, res) => {
  try {
    const rankingVentas = [
      { nombre: "Daniela Bonilla", ventas: 28 },
      { nombre: "Josue Renderos", ventas: 22 },
      { nombre: "Luis Chavarría", ventas: 19 }
    ];
    
    res.json({
      success: true,
      ranking: rankingVentas,
      message: 'Ranking de ventas cargado correctamente'
    });
  } catch (error) {
    console.error('Error al obtener ranking de ventas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener el ranking de ventas', 
      message: error.message 
    });
  }
});

// Obtener ranking de agentes por puntaje
router.get('/ranking/puntos', async (req, res) => {
  try {
    const rankingPuntos = [
      { nombre: "Daniela Bonilla", puntos: 420 },
      { nombre: "Josue Renderos", puntos: 380 },
      { nombre: "Luis Chavarría", puntos: 350 }
    ];
    
    res.json({
      success: true,
      ranking: rankingPuntos,
      message: 'Ranking de puntos cargado correctamente'
    });
  } catch (error) {
    console.error('Error al obtener ranking de puntos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener el ranking de puntos', 
      message: error.message 
    });
  }
});

module.exports = router;
