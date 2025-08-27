const express = require('express');
const router = express.Router();
const CrmAgente = require('../models/CrmAgente');
const Costumer = require('../models/Costumer');

// Obtener ventas y puntaje por equipo desde la colección Costumer
// Soporta filtro opcional ?fecha=YYYY-MM-DD usando rango del día sobre campo FECHA (Date)
router.get('/ventas', async (req, res) => {
  try {
    const { fecha } = req.query;
    const match = {};
    if (fecha) {
      // Construye el rango usando HORARIO LOCAL del servidor
      // Esto evita desfases cuando los documentos fueron guardados con hora local
      const startLocal = new Date(`${fecha}T00:00:00`); // local time
      const endLocal = new Date(`${fecha}T23:59:59.999`); // local time
      match.FECHA = { $gte: startLocal, $lte: endLocal };
    }

    const ventasPorEquipo = await Costumer.aggregate([
      { $match: match },
      { $group: { _id: '$TEAM', ventas: { $sum: 1 }, puntaje: { $sum: { $ifNull: ['$PUNTAJE', 0] } } } },
      { $project: { _id: 0, equipo: '$_id', ventas: 1, puntaje: 1 } },
      { $sort: { equipo: 1 } }
    ]);

    res.json(ventasPorEquipo);
  } catch (error) {
    console.error('Error al obtener ventas por equipo:', error);
    res.status(500).json({ message: 'Error al obtener datos de ventas' });
  }
});

// Obtener ventas por producto (opcionalmente filtrado por fecha)
router.get('/productos', async (req, res) => {
  try {
    const { fecha } = req.query;
    const match = {};
    if (fecha) match.dia_venta = fecha;

    // Lista fija de productos (alineada con backend/public/lead.html e /api/productos de server.js)
    const listaProductos = [
      '225 AT&T AIR',
      '100 MBPS AT&T',
      '18 MBPS AT&T',
      '1G AT&T',
      '25 MBPS AT&T',
      '300 MBPS AT&T',
      '50 MBPS AT&T',
      '500 MBPS AT&T',
      '5G AT&T',
      '75 MBPS AT&T',
      'ALTAFIBER',
      'FRONTIER',
      'HUGHESNET',
      'MAS LATINO',
      'MAS ULTRA',
      'OPTIMO MAS',
      'OPTIMUM',
      'SPECTRUM',
      'VIASAT',
      'WINDSTREAM',
      'WOW',
      'LINEA + CELULAR',
      'VIVINT',
      'KINETIC',
      'SPECTRUM BUSINESS',
      'AT&T BUSINESS',
      'DIRECTV BUSINESS',
      'CONSOLIDATE COMMUNICATION',
      'ZYPYLFIBER',
      'SPECTRUM 500',
      'SPECTRUM 50',
      'FRONTIER 200',
      'FRONTIER 500',
      'SPECTRUM 100',
      'FRONTIER 100',
      'FRONTIER 1G',
      'SPECTRUM 1G',
      'FRONTIER 2G',
      'SPECTRUM DOUBLE PLAY PREMIER',
      'SPECTRUM DOUBLE PLAY ADVANTAGE',
      'FRONTIER 5G',
      'EARTHLINK',
      'BRIGHTSPEED',
      '2G AT&T',
      '2G SPECTRUM'
    ];

    const agregados = await CrmAgente.aggregate([
      { $match: match },
      { $group: { _id: '$producto', ventas: { $sum: 1 } } }
    ]);

    const ventasMap = new Map();
    agregados.forEach(item => {
      ventasMap.set(item._id, item.ventas);
    });

    const resultado = listaProductos.map(producto => ({
      producto,
      ventas: ventasMap.get(producto) || 0
    }));

    res.json(resultado);
  } catch (error) {
    console.error('Error al obtener ventas por producto:', error);
    res.status(500).json({ message: 'Error al obtener datos de productos' });
  }
});

module.exports = router;
