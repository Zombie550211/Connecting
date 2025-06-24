const express = require('express');
const router = express.Router();
const Costumer = require('../models/costumer');

function getFechaLocalHoy() {
  const hoy = new Date();
  const [month, day, year] = hoy.toLocaleDateString('es-SV', { timeZone: 'America/El_Salvador' }).split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    let filtroFechas = {};
    let fechaHoy = getFechaLocalHoy();

    if (from && to) {
      filtroFechas = { fecha: { $gte: from, $lte: to } };
    } else if (from) {
      filtroFechas = { fecha: { $gte: from } };
    } else if (to) {
      filtroFechas = { fecha: { $lte: to } };
    }

    // Ventas Hoy: si hay filtro y equivale a un solo día, toma ese día, si no, usa hoy
    let fechaParaVentasHoy = from && to && from === to ? from : fechaHoy;

    // Ventas Mes: si hay filtro, calcula el mes de "from" (o de hoy si no hay)
    let inicioMes, finMes;
    if (from) {
      const [yyyy, mm] = from.split('-');
      inicioMes = `${yyyy}-${mm}-01`;
      const finMesDate = new Date(yyyy, parseInt(mm), 0);
      finMes = `${yyyy}-${mm}-${String(finMesDate.getDate()).padStart(2, '0')}`;
    } else {
      const hoy = fechaHoy;
      const [yyyy, mm] = hoy.split('-');
      inicioMes = `${yyyy}-${mm}-01`;
      const finMesDate = new Date(yyyy, parseInt(mm), 0);
      finMes = `${yyyy}-${mm}-${String(finMesDate.getDate()).padStart(2, '0')}`;
    }

    const [ventasHoy, leadsPendientes, clientes, ventasMes] = await Promise.all([
      Costumer.countDocuments({ fecha: fechaParaVentasHoy }),
      Costumer.countDocuments({ ...filtroFechas, estado: 'Pending' }),
      Costumer.countDocuments(filtroFechas),
      Costumer.countDocuments({ fecha: { $gte: inicioMes, $lte: finMes } })
    ]);
    res.json({ ventasHoy, leadsPendientes, clientes, ventasMes });
  } catch (err) {
    res.status(500).json({ ventasHoy: 0, leadsPendientes: 0, clientes: 0, ventasMes: 0, error: err.message });
  }
});

module.exports = router;