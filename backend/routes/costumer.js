const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Importar el modelo CrmAgente
const CrmAgente = require('../models/CrmAgente');

// Ventas Hoy
router.get('/ventas/hoy', async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    
    const total = await CrmAgente.countDocuments({
      dia_venta: { $gte: hoy, $lt: manana }
    });
    
    res.json({ total });
  } catch (error) {
    console.error('Error al contar ventas de hoy:', error);
    res.status(500).json({ total: 0, error: 'Error al obtener ventas de hoy' });
  }
});

// Leads Pendientes
router.get('/leads/pendientes', async (req, res) => {
  try {
    const total = await CrmAgente.countDocuments({ status: 'Pendiente' });
    res.json({ total });
  } catch (error) {
    console.error('Error al contar leads pendientes:', error);
    res.status(500).json({ total: 0, error: 'Error al obtener leads pendientes' });
  }
});

// Total Clientes
router.get('/clientes', async (req, res) => {
  try {
    const total = await CrmAgente.countDocuments();
    res.json({ total });
  } catch (error) {
    console.error('Error al contar clientes:', error);
    res.status(500).json({ total: 0, error: 'Error al obtener el total de clientes' });
  }
});

// Ventas este mes
router.get('/ventas/mes', async (req, res) => {
  try {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    const total = await CrmAgente.countDocuments({
      dia_venta: { $gte: primerDiaMes, $lte: hoy }
    });
    
    res.json({ total });
  } catch (error) {
    console.error('Error al contar ventas del mes:', error);
    res.status(500).json({ total: 0, error: 'Error al obtener ventas del mes' });
  }
});

// Obtener lista de clientes con filtros
router.get('/clientes/lista', async (req, res) => {
  try {
    const { desde, hasta, mes, anio } = req.query;
    let query = {};

    // Construir el query según los filtros proporcionados
    if (desde && hasta) {
      query.dia_venta = { $gte: new Date(desde), $lte: new Date(hasta) };
    } else if (mes && anio) {
      const primerDia = new Date(anio, mes - 1, 1);
      const ultimoDia = new Date(anio, mes, 0);
      ultimoDia.setHours(23, 59, 59, 999); // Para incluir todo el último día
      query.dia_venta = { $gte: primerDia, $lte: ultimoDia };
    }

    const clientes = await CrmAgente.find(query)
      .select('dia_venta team agent tipo_servicio dia_instalacion status puntaje telefono_principal direccion zip')
      .sort({ dia_venta: -1 })
      .lean();

    // Mapear los campos al formato esperado por el frontend
    const clientesMapeados = clientes.map(cliente => ({
      fecha: cliente.dia_venta,
      equipo: cliente.team,
      agente: cliente.agent,
      producto: cliente.tipo_servicio,
      fecha_instalacion: cliente.dia_instalacion,
      estado: cliente.status,
      puntaje: cliente.puntaje,
      cuenta: cliente.cuenta || '',
      telefono: cliente.telefono_principal,
      direccion: cliente.direccion,
      zip: cliente.zip
    }));

    res.json({ clientes: clientesMapeados });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener la lista de clientes' });
  }
});

module.exports = router;