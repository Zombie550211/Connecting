const express = require('express');
const router = express.Router();
const CrmAgente = require('./crm_agente');

// Obtener ventas por equipo
router.get('/ventas', async (req, res) => {
  try {
    const ventasPorEquipo = await CrmAgente.aggregate([
      { $group: { _id: '$team', ventas: { $sum: 1 }, puntaje: { $sum: '$puntaje' } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(ventasPorEquipo);
  } catch (error) {
    console.error('Error al obtener ventas por equipo:', error);
    res.status(500).json({ message: 'Error al obtener datos de ventas' });
  }
});

// Obtener ventas por producto
router.get('/productos', async (req, res) => {
  try {
    const listaProductos = [
      '100 MBPS AT&T', '300 MBPS AT&T', '500 MBPS AT&T', '1G AT&T', 
      'SPECTRUM 100', 'SPECTRUM 300', 'SPECTRUM 500', 'SPECTRUM 1G',
      'FRONTIER 100', 'FRONTIER 300', 'FRONTIER 500', 'FRONTIER 1G',
      '100 MBPS HUGGIES', '300 MBPS HUGGIES', '500 MBPS HUGGIES', '1G HUGGIES',
      '100 MBPS T-MOBILE', '300 MBPS T-MOBILE', '500 MBPS T-MOBILE', '1G T-MOBILE',
      '100 MBPS VERIZON', '300 MBPS VERIZON', '500 MBPS VERIZON', '1G VERIZON'
    ];

    const ventasPorProducto = await CrmAgente.aggregate([
      { $group: { _id: '$producto', ventas: { $sum: 1 } } }
    ]);

    // Crear un mapa de productos con sus ventas
    const ventasMap = new Map();
    ventasPorProducto.forEach(item => {
      ventasMap.set(item._id, item.ventas);
    });

    // Combinar con la lista fija de productos
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
