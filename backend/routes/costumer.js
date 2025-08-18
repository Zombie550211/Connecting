const express = require('express');
const router = express.Router();
const Costumer = require('../models/Costumer');

// Obtener todos los clientes con filtros
router.get('/clientes/lista', async (req, res) => {
  try {
    console.log('🔍 [BACKEND] Solicitando lista de clientes');
    
    const { 
      desde, 
      hasta, 
      mes, 
      anio, 
      equipo, 
      agente, 
      estado,
      telefono,
      direccion,
      zip
    } = req.query;

    // Construir el filtro con los campos reales de Mongo
    const filtro = {};

    // Rango de fechas (dia_venta en formato YYYY-MM-DD)
    if (desde && hasta) {
      filtro.dia_venta = { $gte: desde, $lte: hasta };
    }

    // Filtrar por mes y año (calculamos primer y último día del mes)
    if (mes && anio) {
      const m = String(mes).padStart(2, '0');
      const inicio = `${anio}-${m}-01`;
      const finDate = new Date(anio, Number(mes), 0); // último día del mes
      const fin = finDate.toISOString().split('T')[0];
      filtro.dia_venta = { $gte: inicio, $lte: fin };
    }

    // Otros filtros
    if (equipo) filtro.team = equipo;
    if (agente) filtro.agenteNombre = agente;
    if (estado) filtro.status = estado;
    if (telefono) filtro.telefono = { $regex: telefono, $options: 'i' };
    if (direccion) filtro.direccion = { $regex: direccion, $options: 'i' };
    if (zip) filtro.$or = [{ ZIP: zip }, { zip }];

    // Proyección de campos necesarios para el frontend
    const projection = {
      dia_venta: 1,
      team: 1,
      agenteNombre: 1,
      tipo_servicios: 1,
      status: 1,
      puntaje: 1,
      cuenta: 1,
      telefono: 1,
      direccion: 1,
      ZIP: 1,
      zip: 1
    };

    // Obtener los clientes con los filtros aplicados
    const clientes = await Costumer.find(filtro, projection)
      .sort({ dia_venta: -1 });
    
    res.json({
      success: true,
      count: clientes.length,
      clientes,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error al obtener clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los clientes',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Actualizar cuenta de un cliente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { numero_de_cuenta } = req.body;
    
    const clienteActualizado = await Costumer.findByIdAndUpdate(
      id,
      { 
        CUENTA: numero_de_cuenta,
        actualizado_el: new Date()
      },
      { new: true }
    );
    
    if (!clienteActualizado) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    
    res.json({
      success: true,
      cliente: clienteActualizado
    });
    
  } catch (error) {
    console.error('❌ Error al actualizar cuenta:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar la cuenta',
      message: error.message
    });
  }
});

// Eliminar un cliente
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const clienteEliminado = await Costumer.findByIdAndDelete(id);
    
    if (!clienteEliminado) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Cliente eliminado correctamente'
    });
    
  } catch (error) {
    console.error('❌ Error al eliminar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar el cliente',
      message: error.message
    });
  }
});

// Ruta de depuración: devuelve un documento de muestra y claves detectadas
router.get('/debug/sample', async (req, res) => {
  try {
    const total = await Costumer.estimatedDocumentCount();
    const sample = await Costumer.findOne({}, null, { sort: { _id: 1 } });
    const keys = sample ? Object.keys(sample.toObject()) : [];
    res.json({
      success: true,
      total,
      keys,
      sample,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(' Error en debug/sample:', error);
    res.status(500).json({
      success: false,
      error: 'Error en ruta de depuración',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;