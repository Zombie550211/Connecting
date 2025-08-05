const express = require('express');
const router = express.Router();

// Ventas Hoy
router.get('/ventas/hoy', (req, res) => {
  // Placeholder response since MongoDB was removed
  res.json({ total: 0 });
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

// Obtener lista de clientes con filtros
router.get('/clientes/lista', async (req, res) => {
  try {
    const { desde, hasta, mes, anio } = req.query;
    let query = {};

    // Construir el query según los filtros proporcionados
    if (desde && hasta) {
      query.fecha = { $gte: new Date(desde), $lte: new Date(hasta) };
    } else if (mes && anio) {
      const primerDia = new Date(anio, mes - 1, 1);
      const ultimoDia = new Date(anio, mes, 0);
      query.fecha = { $gte: primerDia, $lte: ultimoDia };
    }

    const clientes = await Costumer.find(query)
      .sort({ fecha: -1 }) // Ordenar por fecha descendente
      .lean();

    res.json({ clientes });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener la lista de clientes' });
  }
});

module.exports = router;