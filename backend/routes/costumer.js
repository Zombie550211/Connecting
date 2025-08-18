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

    // Filtros tolerantes a may/min (construimos un $and de condiciones con $or)
    const condicionesAND = [];

    const agregarRangoFecha = (inicio, fin) => {
      condicionesAND.push({
        $or: [
          { FECHA: { $gte: new Date(inicio), $lte: new Date(fin) } },
          { dia_venta: { $gte: inicio, $lte: fin } }
        ]
      });
    };

    if (desde && hasta) {
      agregarRangoFecha(desde, hasta);
    }

    if (mes && anio) {
      const mesNum = parseInt(mes, 10);
      const anioNum = parseInt(anio, 10);
      if (!isNaN(mesNum) && !isNaN(anioNum)) {
        const fechaInicio = new Date(anioNum, mesNum, 1);
        const fechaFin = new Date(anioNum, mesNum + 1, 0, 23, 59, 59, 999);
        agregarRangoFecha(
          fechaInicio.toISOString().split('T')[0],
          fechaFin.toISOString().split('T')[0]
        );
      }
    }

    if (equipo) condicionesAND.push({ $or: [{ TEAM: equipo }, { team: equipo }] });
    if (agente) condicionesAND.push({ $or: [{ AGENTE: agente }, { agenteNombre: agente }] });
    if (estado) condicionesAND.push({ $or: [{ ESTADO: estado }, { status: estado }] });
    if (telefono) condicionesAND.push({ $or: [{ 'TELÉFONO': { $regex: telefono, $options: 'i' } }, { telefono: { $regex: telefono, $options: 'i' } }] });
    if (direccion) condicionesAND.push({ $or: [{ 'DIRECCIÓN': { $regex: direccion, $options: 'i' } }, { direccion: { $regex: direccion, $options: 'i' } }] });
    if (zip) condicionesAND.push({ $or: [{ ZIP: zip }, { zip: zip }] });

    const filtro = condicionesAND.length ? { $and: condicionesAND } : {};

    // Proyección incluye ambas variantes para poder mapear
    const projection = {
      FECHA: 1, TEAM: 1, AGENTE: 1, PRODUCTO: 1, ESTADO: 1, PUNTAJE: 1, CUENTA: 1, 'TELÉFONO': 1, 'DIRECCIÓN': 1, ZIP: 1,
      // variantes conocidas
      dia_venta: 1, fecha_contratacion: 1,
      team: 1, equipo: 1, supervisor: 1,
      agenteNombre: 1, agente: 1,
      tipo_servicios: 1, tipo_servicio: 1, producto_contratado: 1,
      status: 1, puntaje: 1, Puntaje: 1, score: 1, Score: 1,
      cuenta: 1, numero_cuenta: 1,
      telefono: 1, telefono_principal: 1,
      direccion: 1,
      zip: 1
    };

    // .lean() para obtener objetos planos e incluir campos no definidos en el esquema (e.g., 'puntaje', 'score')
    const docs = await Costumer.find(filtro, projection).lean();

    // Mapear a formato unificado en mayúsculas (soporta múltiples variantes de claves)
    const normalizarEstado = (valor) => {
      if (!valor) return 'Pending';
      const v = String(valor).trim().toLowerCase();
      switch (v) {
        case 'pending':
        case 'pendiente':
          return 'Pending';
        case 'complete':
        case 'completado':
        case 'completada':
          return 'Complete';
        case 'rescheduled':
        case 'reprogramado':
        case 'reprogramada':
          return 'Rescheduled';
        case 'pending chargeback':
        case 'chargeback pendiente':
          return 'Pending Chargeback';
        case 'cancelled':
        case 'cancelado':
        case 'cancelada':
          return 'Cancelled';
        default:
          // Si viene otro estado, devolver tal cual con primera letra mayúscula
          return valor;
      }
    };

    const trimStr = (v) => (typeof v === 'string' ? v.trim() : v);

    // Helper para resolver claves con variaciones menores (espacios, may/min, guiones)
    const resolveFlexibleField = (obj, candidateNames = []) => {
      // 1) Intento directo por nombres exactos
      for (const name of candidateNames) {
        if (Object.prototype.hasOwnProperty.call(obj, name)) return obj[name];
      }
      // 2) Intento por normalización de claves
      const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '');
      const wanted = new Set(candidateNames.map(norm));
      for (const k of Object.keys(obj)) {
        if (wanted.has(norm(k))) return obj[k];
      }
      return undefined;
    };

    const clientes = docs.map(d => {
      const o = d.toObject ? d.toObject() : d;
      const fechaStr = o.FECHA ? new Date(o.FECHA).toISOString() : (o.dia_venta || o.fecha_contratacion || null);

      // Sanear puntaje para evitar NaN/null (ej: "85%", "85 pts")
      let rawPuntaje = (o.PUNTAJE ?? o.Puntaje ?? o.puntaje ?? o.score ?? o.Score);
      if (rawPuntaje === undefined) {
        rawPuntaje = resolveFlexibleField(o, ['PUNTAJE', 'Puntaje', 'puntaje', 'score', 'Score']);
      }
      let puntajeLimpio = 0;
      if (rawPuntaje !== undefined && rawPuntaje !== null && rawPuntaje !== '') {
        const cleaned = String(rawPuntaje).replace(/[^\d.-]/g, '');
        const parsed = Number(cleaned);
        puntajeLimpio = Number.isFinite(parsed) ? parsed : 0;
      }

      return {
        _id: o._id,
        FECHA: fechaStr ? new Date(fechaStr) : null,
        TEAM: trimStr(o.TEAM) || trimStr(o.team) || trimStr(o.equipo) || trimStr(o.supervisor) || '',
        AGENTE: trimStr(o.AGENTE) || trimStr(o.agenteNombre) || trimStr(o.agente) || '',
        PRODUCTO: trimStr(o.PRODUCTO) || trimStr(o.tipo_servicios) || trimStr(o.tipo_servicio) || trimStr(o.producto_contratado) || '',
        ESTADO: normalizarEstado(o.ESTADO || o.status),
        PUNTAJE: puntajeLimpio,
        CUENTA: trimStr(o.CUENTA) || trimStr(o.cuenta) || trimStr(o.numero_cuenta) || 'Elige',
        'TELÉFONO': trimStr(o['TELÉFONO']) || trimStr(o.telefono) || trimStr(o.telefono_principal) || '',
        'DIRECCIÓN': trimStr(o['DIRECCIÓN']) || trimStr(o.direccion) || '',
        ZIP: trimStr(o.ZIP) || trimStr(o.zip) || ''
      };
    })
    // ordenar por fecha descendente
    .sort((a, b) => {
      const da = a.FECHA ? new Date(a.FECHA).getTime() : 0;
      const db = b.FECHA ? new Date(b.FECHA).getTime() : 0;
      return db - da;
    });

    // Si debug=1, incluir información de depuración
    let debugInfo;
    if (req.query.debug === '1') {
      debugInfo = docs.slice(0, 5).map((d) => {
        const o = d.toObject ? d.toObject() : d;
        const direct = {
          PUNTAJE: o.PUNTAJE,
          Puntaje: o.Puntaje,
          puntaje: o.puntaje,
          score: o.score,
          Score: o.Score
        };
        const resolved = resolveFlexibleField(o, ['PUNTAJE', 'Puntaje', 'puntaje', 'score', 'Score']);
        const cleaned = resolved !== undefined && resolved !== null && resolved !== ''
          ? String(resolved).replace(/[^\d.-]/g, '')
          : '';
        const parsed = cleaned ? Number(cleaned) : '';
        return {
          _id: o._id,
          keys: Object.keys(o),
          direct,
          resolved,
          cleaned,
          parsed
        };
      });
    }

    res.json({
      success: true,
      count: clientes.length,
      clientes,
      debug: debugInfo,
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