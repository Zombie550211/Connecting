const express = require('express');
const router = express.Router();

// Obtener clientes - Respuesta vacía ya que se eliminó MongoDB
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
