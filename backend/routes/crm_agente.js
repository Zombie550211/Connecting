const express = require('express');
const router = express.Router();
const CrmAgente = require('../models/crm_agente');
const { verifyToken } = require('../middleware/auth');

// Obtener clientes para la tabla costumer desde crm agente
router.get('/clientes', async (req, res) => {
  try {
    const clientes = await CrmAgente.find({}, {
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
      FECHA_VENTA: c.dia_venta || '',
      TEAM: c.team || '',
      AGENTE: c.agente || '',
      PRODUCTO: c.servicios || '',
      FECHA_DE_INSTALACION: c.dia_instalacion || '',
      ESTADO: c.status || '',
      PUNTAJE: c.puntaje || 0,
      CUENTA: c.numero_de_cuenta || '',
      TELEFONO: c.telefono_principal || '',
      DIRECCION: c.direccion || '',
      ZIP: c.zip_code || '',
      _id: c._id
    }));
    res.json({ clientes: clientesMapeados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener métricas de ventas mensuales
const getMetricasVentas = async (req, res) => {
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
    const totalClientes = await CrmAgente.countDocuments({
      dia_venta: { $gte: fechaInicio, $lte: fechaFin }
    });
    
    // Consulta para sumar los puntajes (ventas) del mes
    const resultadoVentas = await CrmAgente.aggregate([
      {
        $match: {
          dia_venta: { $gte: fechaInicio, $lte: fechaFin },
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
    
    res.json({
      totalClientes,
      totalVentas
    });
    
  } catch (error) {
    console.error('Error al obtener métricas de ventas:', error);
    res.status(500).json({ error: 'Error al obtener las métricas de ventas' });
  }
};

// Ruta protegida con JWT
router.get('/metricas-ventas', verifyToken, getMetricasVentas);

module.exports = router;
