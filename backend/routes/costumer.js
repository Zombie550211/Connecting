const express = require('express');
const router = express.Router();

// Ventas Hoy - Respuesta simulada
router.get('/ventas/hoy', (req, res) => {
  res.json({ total: 0 });
});

// Leads Pendientes - Respuesta simulada
router.get('/leads/pendientes', (req, res) => {
  res.json({ total: 0 });
});

// Total Clientes - Respuesta simulada
router.get('/clientes', (req, res) => {
  res.json({ total: 0 });
});

// Ventas este mes - Respuesta simulada
router.get('/ventas/mes', (req, res) => {
  res.json({ total: 0 });
});

// Obtener lista de clientes con filtros - Respuesta vacía
router.get('/clientes/lista', (req, res) => {
  res.json({ clientes: [] });
});

module.exports = router;