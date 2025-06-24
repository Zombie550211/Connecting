const express = require('express');
const router = express.Router();
const Costumer = require('../models/costumer');

// Ventas Hoy
router.get('/ventas/hoy', async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // 00:00:00 de hoy
    const mañana = new Date(hoy);
    mañana.setDate(hoy.getDate() + 1);
    const total = await Costumer.countDocuments({
      fecha: { $gte: hoy.toISOString().slice(0, 10), $lt: mañana.toISOString().slice(0, 10) }
    });
    res.json({ total });
  } catch (error) {
    res.status(500).json({ total: 0, error: error.message });
  }
});

// Leads Pendientes (requiere campo estado en el modelo)
router.get('/leads/pendientes', async (req, res) => {
  try {
    const total = await Costumer.countDocuments({ estado: 'Pending' });
    res.json({ total });
  } catch (error) {
    res.status(500).json({ total: 0, error: error.message });
  }
});

// Total Clientes
router.get('/clientes', async (req, res) => {
  try {
    const total = await Costumer.countDocuments();
    res.json({ total });
  } catch (error) {
    res.status(500).json({ total: 0, error: error.message });
  }
});

// Ventas este mes
router.get('/ventas/mes', async (req, res) => {
  try {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = (hoy.getMonth() + 1).toString().padStart(2, '0');
    const desde = `${año}-${mes}-01`;
    const hasta = hoy.toISOString().slice(0, 10);
    const total = await Costumer.countDocuments({
      fecha: { $gte: desde, $lte: hasta }
    });
    res.json({ total });
  } catch (error) {
    res.status(500).json({ total: 0, error: error.message });
  }
});

module.exports = router;