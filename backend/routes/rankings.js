const express = require('express');
const router = express.Router();
const CrmAgente = require('../models/crm_agente'); // Usando el modelo correcto para los nuevos datos


// Obtener ranking de equipos
router.get('/equipos', async (req, res) => {
  try {
    const { mes, anio, dia } = req.query;
    
    if ((!mes || !anio) && !dia) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren los parámetros mes y año, o el parámetro dia' 
      });
    }

    let matchStage;
    if (dia) {
      // Filtro exacto por día (YYYY-MM-DD)
      matchStage = {
        $expr: {
          $eq: [
            {
              $dateToString: {
                format: "%Y-%m-%d",
                date: {
                  $cond: [
                    { $eq: [ { $type: "$dia_venta" }, "date" ] },
                    "$dia_venta",
                    { $dateFromString: { dateString: "$dia_venta" } }
                  ]
                }
              }
            },
            dia
          ]
        }
      };
    } else {
      const mesNum = parseInt(mes) + 1;
      const anioNum = parseInt(anio);
      matchStage = {
        $expr: {
          $and: [
            { $eq: [{$month: {
              $cond: [
                { $eq: [ { $type: "$dia_venta" }, "date" ] },
                "$dia_venta",
                { $dateFromString: { dateString: "$dia_venta" } }
              ]
            }}, mesNum] },
            { $eq: [{$year: {
              $cond: [
                { $eq: [ { $type: "$dia_venta" }, "date" ] },
                "$dia_venta",
                { $dateFromString: { dateString: "$dia_venta" } }
              ]
            }}, anioNum] }
          ]
        }
      };
    }

    const equiposRanking = await CrmAgente.aggregate([
      {
        $addFields: {
          dia_venta_date: {
            $cond: [
              { $eq: [ { $type: "$dia_venta" }, "date" ] },
              "$dia_venta",
              { $dateFromString: { dateString: "$dia_venta" } }
            ]
          }
        }
      },
      { $match: matchStage },
      {
        $group: {
          _id: '$team',
          ventas: { $sum: 1 },
          puntaje: { $sum: '$puntaje' }
        }
      },
      {
        $project: {
          _id: 0,
          team: '$_id',
          ventas: 1,
          puntaje: 1
        }
      },
      { $sort: { team: 1 } }
    ]);

    res.json({ success: true, data: equiposRanking });
  } catch (error) {
    console.error('Error al obtener ranking de equipos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener ranking de equipos',
      details: error.message 
    });
  }
});

// Obtener ranking por producto
router.get('/productos', async (req, res) => {
  const { mes, anio } = req.query;
  if (!mes || !anio) {
    return res.status(400).json({ success: false, message: 'Mes y año son requeridos' });
  }

  try {
    const mesNum = parseInt(mes) + 1; // Mes en JS es 0-11, en Mongo es 1-12
    const anioNum = parseInt(anio);

    // Ranking de productos: agrupa por 'producto' y suma las ventas.
    const { mes, anio, dia } = req.query;
    let matchStage;
    if (dia) {
      matchStage = {
        $expr: {
          $eq: [
            {
              $dateToString: {
                format: "%Y-%m-%d",
                date: {
                  $cond: [
                    { $eq: [ { $type: "$dia_venta" }, "date" ] },
                    "$dia_venta",
                    { $dateFromString: { dateString: "$dia_venta" } }
                  ]
                }
              }
            },
            dia
          ]
        }
      };
    } else {
      const mesNum = parseInt(mes) + 1;
      const anioNum = parseInt(anio);
      matchStage = {
        $expr: {
          $and: [
            { $eq: [{$month: {
              $cond: [
                { $eq: [ { $type: "$dia_venta" }, "date" ] },
                "$dia_venta",
                { $dateFromString: { dateString: "$dia_venta" } }
              ]
            }}, mesNum] },
            { $eq: [{$year: {
              $cond: [
                { $eq: [ { $type: "$dia_venta" }, "date" ] },
                "$dia_venta",
                { $dateFromString: { dateString: "$dia_venta" } }
              ]
            }}, anioNum] }
          ]
        }
      };
    }
    const productosRanking = await CrmAgente.aggregate([
      {
        $addFields: {
          dia_venta_date: {
            $cond: [
              { $eq: [ { $type: "$dia_venta" }, "date" ] },
              "$dia_venta",
              { $dateFromString: { dateString: "$dia_venta" } }
            ]
          }
        }
      },
      { $match: matchStage },
      {
        $group: {
          _id: '$producto',
          ventas: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          producto: '$_id',
          ventas: 1
        }
      },
      { $sort: { ventas: -1 } }
    ]);

    res.json({ success: true, data: productosRanking });
  } catch (error) {
    console.error("Error en ranking de productos:", error);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

// Obtener ranking de agentes (por ventas) - ESTA RUTA YA NO SE USA EN LAS GRÁFICAS NUEVAS
router.get('/agentes', async (req, res) => {
  try {
    const { mes, anio } = req.query;
    
    // Validar mes y año
    if (!mes || !anio) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren los parámetros mes y año' 
      });
    }

    const mesNum = parseInt(mes) + 1; // Se suma 1 porque JS usa meses 0-11 y Mongo 1-12
    const anioNum = parseInt(anio);
    
    // Agrupar por agente y sumar ventas
    const agentesRanking = await CrmAgente.aggregate([
      {
        $match: {
          $expr: {
            $and: [
              { $eq: [{ $month: '$dia_venta' }, mesNum] },
              { $eq: [{ $year: '$dia_venta' }, anioNum] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$agente',
          ventas: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          agente: '$_id',
          ventas: 1
        }
      },
      { $sort: { ventas: -1 } },
      { $limit: 3 }
    ]);

    res.json({ success: true, data: agentesRanking });
  } catch (error) {
    console.error('Error al obtener ranking de agentes:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener ranking de agentes',
      details: error.message 
    });
  }
});

// Obtener ranking de agentes (por puntos) - ESTA RUTA YA NO SE USA EN LAS GRÁFICAS NUEVAS
router.get('/puntos', async (req, res) => {
  try {
    const { mes, anio } = req.query;
    
    // Validar mes y año
    if (!mes || !anio) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren los parámetros mes y año' 
      });
    }

    const mesNum = parseInt(mes) + 1; // Se suma 1 porque JS usa meses 0-11 y Mongo 1-12
    const anioNum = parseInt(anio);
    
    // Agrupar por agente y sumar puntos
    const puntosRanking = await Costumer.aggregate([
      {
        $addFields: {
          fecha_convertida: { $dateFromString: { dateString: '$fecha', format: '%Y-%m-%d', onError: new Date(0) } }
        }
      },
      {
        $match: {
          puntaje: { $exists: true, $ne: null },
          $expr: {
            $and: [
              { $eq: [{ $month: '$fecha_convertida' }, mesNum] },
              { $eq: [{ $year: '$fecha_convertida' }, anioNum] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$agente',
          totalPuntos: { $sum: '$puntaje' }
        }
      },
      {
        $project: {
          _id: 0,
          agente: '$_id',
          totalPuntos: 1
        }
      },
      { $sort: { totalPuntos: -1 } },
      { $limit: 3 }
    ]);

    res.json({ success: true, data: puntosRanking });
  } catch (error) {
    console.error('Error al obtener ranking de puntos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener ranking de puntos',
      details: error.message 
    });
  }
});

module.exports = router;