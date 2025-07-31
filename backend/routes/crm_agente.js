const express = require('express');
const router = express.Router();
const CrmAgente = require('../models/crm_agente');

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

module.exports = router;
