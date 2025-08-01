const express = require('express');
const router = express.Router();
const Costumer = require('../models/costumer');
// Nota: El middleware 'protect' ya se aplica en server.js
// No necesitamos importar verifyToken aquí para evitar doble autenticación

// Obtener clientes para la tabla costumer desde crm agente
router.get('/clientes', async (req, res) => {
  try {
    const clientes = await Costumer.find({}, {
      dia_venta: 1,
      team: 1,
      agente: 1,
      servicios: 1,
      dia_instalacion: 1,
      status: 1,
      puntaje: 1,
      numero_de_cuenta: 1,
      telefono_principal: 1,
      direccion: 1,
      zip_code: 1,
      _id: 1
    });
    // Mapear los campos al formato esperado por el frontend
    const clientesMapeados = clientes.map(c => ({
      FECHA_VENTA: c.fecha || '',
      TEAM: c.equipo || '',
      AGENTE: c.agente || '',
      PRODUCTO: c.servicios || c.producto || '',
      FECHA_DE_INSTALACION: c.dia_venta_a_instalacion || '',
      ESTADO: c.estado || '',
      PUNTAJE: c.puntaje || 0,
      CUENTA: c.numero_de_cuenta || c.cuenta || '',
      TELEFONO: c.telefono || '',
      DIRECCION: c.direccion || '',
      ZIP: c.zip || '',
      _id: c._id
    }));
    res.json({ clientes: clientesMapeados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para métricas de ventas
// Nota: No usamos verifyToken aquí porque ya se aplica 'protect' en server.js
router.get('/metricas-ventas', async (req, res) => {
  try {
    const { mes, anio } = req.query;
    
    // Validar parámetros
    if (!mes || !anio) {
      return res.status(400).json({ error: 'Se requieren los parámetros mes y año' });
    }
    
    // Crear fechas para el rango del mes
    const fechaInicio = new Date(anio, mes - 1, 1);
    const fechaFin = new Date(anio, mes, 0, 23, 59, 59);
    
    // Consulta para contar clientes en el mes
    const totalClientes = await Costumer.countDocuments({
      fecha: { $gte: fechaInicio.toISOString().split('T')[0], $lte: fechaFin.toISOString().split('T')[0] }
    });
    
    // Consulta para sumar los puntajes (ventas) del mes
    const resultadoVentas = await Costumer.aggregate([
      {
        $match: {
          fecha: { $gte: fechaInicio.toISOString().split('T')[0], $lte: fechaFin.toISOString().split('T')[0] },
          // Asegurarse de que puntaje es un número
          puntaje: { $type: 'number' }
        }
      },
      {
        $group: {
          _id: null,
          totalVentas: { $sum: '$puntaje' }
        }
      }
    ]);
    
    const totalVentas = resultadoVentas[0]?.totalVentas || 0;
    
    return res.json({
      totalClientes,
      totalVentas
    });
    
  } catch (error) {
    console.error('Error al obtener métricas de ventas:', error);
    return res.status(500).json({ error: 'Error al obtener las métricas de ventas' });
  }
});

module.exports = router;
