const express = require('express');
const router = express.Router();
const Costumer = require('../models/costumer');

// Obtener ventas por equipo
router.get('/ventas', async (req, res) => {
  try {
    const { fecha } = req.query;
    
    // Construir el filtro de fecha si se proporciona
    const filtro = {};
    if (fecha) {
      // Usamos el campo 'fecha' o 'dia_venta' según corresponda
      filtro.$or = [
        { 'fecha': fecha },
        { 'dia_venta_a_instalacion': { $regex: `^${fecha}` } }
      ];
    }
    
    // Agrupar por equipo y contar ventas, sumar puntajes
    const ventasPorEquipo = await Costumer.aggregate([
      { 
        $match: {
          ...filtro,
          // Asegurarse de que el equipo no esté vacío
          equipo: { $exists: true, $ne: '' }
        } 
      },
      { 
        $group: {
          _id: "$equipo",
          ventas: { $sum: 1 },  // Contar documentos como ventas
          puntaje: { $sum: "$puntaje" }  // Sumar los puntajes
        }
      },
      { $sort: { ventas: -1 } } // Ordenar por cantidad de ventas descendente
    ]);
    
    res.json(ventasPorEquipo);
  } catch (error) {
    console.error('Error al obtener ventas por equipo:', error);
    res.status(500).json({ error: 'Error al obtener los datos de ventas' });
  }
});

// Obtener ventas por producto
router.get('/productos', async (req, res) => {
  try {
    const { fecha } = req.query;
    
    // Construir el filtro de fecha si se proporciona
    const filtro = {};
    if (fecha) {
      // Usamos el campo 'fecha' o 'dia_venta' según corresponda
      filtro.$or = [
        { 'fecha': fecha },
        { 'dia_venta_a_instalacion': { $regex: `^${fecha}` } }
      ];
    }
    
    // Lista fija de productos (la misma que está en el frontend)
    const listaProductos = [
      '225 AT&T AIR', '100 MBPS AT&T', '18 MBPS AT&T', '1G AT&T', '25 MBPS AT&T',
      '300 MBPS AT&T', '50 MBPS AT&T', '500 MBPS AT&T', '5G AT&T', '75 MBPS AT&T',
      'ALTAFIBER', 'FRONTIER', 'HUGHESNET', 'MAS LATINO', 'MAS ULTRA',
      'OPTIMO MAS', 'OPTIMUM', 'SPECTRUM', 'VIASAT', 'WINDSTREAM',
      'WOW', 'LINEA + CELULAR', 'VIVINT', 'KINETIC', 'SPECTRUM BUSINESS',
      'AT&T BUSINESS', 'DIRECTV BUSINESS', 'CONSOLIDATE COMMUNICATION', 'ZYPYLFIBER', 'SPECTRUM 500',
      'SPECTRUM 50', 'FRONTIER 200', 'FRONTIER 500', 'SPECTRUM 100', 'FRONTIER 100',
      'FRONTIER 1G', 'SPECTRUM 1G', 'FRONTIER 2G', 'SPECTRUM DOUBLE PLAY PREMIER', 'SPECTRUM DOUBLE PLAY ADVANTAGE',
      'FRONTIER 5G', 'EARTHLINK', 'BRIGHTSPEED', '2G AT&T', '2G SPECTRUM'
    ];
    
    // Obtener conteo de ventas por producto
    const ventasPorProducto = await Costumer.aggregate([
      { 
        $match: {
          ...filtro,
          // Asegurarse de que el servicio no esté vacío
          servicios: { $exists: true, $ne: '' }
        } 
      },
      { 
        $group: {
          _id: "$servicios",
          ventas: { $sum: 1 }  // Contar documentos como ventas
        }
      }
    ]);
    
    // Crear un mapa de productos con sus ventas
    const ventasMap = new Map();
    ventasPorProducto.forEach(item => {
      ventasMap.set(item._id, item.ventas);
    });
    
    // Crear el resultado final con todos los productos de la lista fija
    const resultado = listaProductos.map(producto => ({
      producto,
      ventas: ventasMap.get(producto) || 0
    }));
    
    res.json(resultado);
  } catch (error) {
    console.error('Error al obtener ventas por producto:', error);
    res.status(500).json({ error: 'Error al obtener los datos de productos' });
  }
});

module.exports = router;
