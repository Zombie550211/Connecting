const express = require('express');
const router = express.Router();

// Ventas Hoy - Respuesta vacía
router.get('/ventas/hoy', (req, res) => {
  res.json({ total: 0 });
});

// Leads Pendientes - Respuesta vacía
router.get('/leads/pendientes', (req, res) => {
  res.json({ total: 0 });
});

// Total Clientes - Respuesta vacía
router.get('/clientes', (req, res) => {
  res.json({ total: 0 });
});

// Ventas este mes - Respuesta vacía
router.get('/ventas/mes', (req, res) => {
  res.json({ total: 0 });
});

// Obtener lista de clientes - Respuesta vacía
router.get('/clientes/lista', (req, res) => {
  res.json({ clientes: [] });
});

module.exports = router;