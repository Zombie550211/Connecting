const express = require('express');
const router = express.Router();
const CrmAgente = require('../models/crm_agente'); // Usando el modelo correcto para los equipos
const Costumer = require('../models/costumer'); // Usando el modelo correcto para productos/servicios


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

    // Lista fija de teams (ajusta según tus equipos reales)
    const TEAMS = [
      "TEAM IRANIA", "TEAM PLEITEZ", "TEAM ROBERTO", "TEAM LINEAS", "TEAM RANALD", "TEAM MARISOL"
    ];
    const equiposRankingRaw = await CrmAgente.aggregate([
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
      }
    ]);
    // Mapear a objeto para fácil acceso
    const equiposMap = {};
    equiposRankingRaw.forEach(e => {
      equiposMap[e.team] = e;
    });
    // Construir arreglo final con todos los teams
    const equiposRanking = TEAMS.map(team => ({
      team,
      ventas: equiposMap[team]?.ventas || 0,
      puntaje: equiposMap[team]?.puntaje || 0
    }));
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
  // NUEVO: Ranking de productos por campo 'producto' de CrmAgente
  // Lista fija de productos/servicios
  const PRODUCTOS_FIJOS = [
    "225 AT&T AIR", "100 MBPS AT&T", "18 MBPS AT&T", "1G AT&T", "25 MBPS AT&T",
    "300 MBPS AT&T", "50 MBPS AT&T", "500 MBPS AT&T", "5G AT&T", "75 MBPS AT&T",
    "ALTAFIBER", "FRONTIER", "HUGHESNET", "MAS LATINO", "MAS ULTRA", "OPTIMO MAS",
    "OPTIMUM", "SPECTRUM", "VIASAT", "WINDSTREAM", "WOW", "LINEA + CELULAR",
    "VIVINT", "KINETIC", "SPECTRUM BUSINESS", "AT&T BUSINESS", "DIRECTV BUSINESS",
    "CONSOLIDATE COMMUNICATION", "ZYPYLFIBER", "SPECTRUM 500", "SPECTRUM 50",
    "FRONTIER 200", "FRONTIER 500", "SPECTRUM 100", "FRONTIER 100", "FRONTIER 1G",
    "SPECTRUM 1G", "FRONTIER 2G", "SPECTRUM DOUBLE PLAY PREMIER", "SPECTRUM DOUBLE PLAY ADVANTAGE",
    "FRONTIER 5G", "EARTHLINK", "BRIGHTSPEED", "2G AT&T", "2G SPECTRUM"
  ];
  console.log('--- [API /productos] ---');
  console.log('Query params:', req.query);
  const { mes, anio, dia } = req.query;

  try {
    let matchStage = null;
    if (dia) {
      // Normalizar campo dia_venta a string YYYY-MM-DD
      matchStage = { dia_venta_str: dia };
    } else if (mes && anio) {
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
    // Si no se pasa ningún filtro, no aplicar $match de fecha (traer todo)


    // Agrupar por servicio (servicios) y contar ventas
    const pipeline = [];
    // Si hay filtro por día, primero agregamos campo normalizado
    if (dia) {
      pipeline.unshift({
        $addFields: {
          dia_venta_str: {
            $cond: [
              { $eq: [ { $type: "$dia_venta" }, "date" ] },
              { $dateToString: { format: "%Y-%m-%d", date: "$dia_venta" } },
              "$dia_venta"
            ]
          }
        }
      });
    }
    if (matchStage) pipeline.push({ $match: matchStage });
    pipeline.push(
      { $group: { _id: "$servicios", ventas: { $sum: 1 } } },
      { $project: { _id: 0, producto: "$_id", ventas: 1 } }
    );
    const productosRankingRaw = await CrmAgente.aggregate(pipeline);

    // Mapear a objeto para fácil acceso
    const productosMap = {};
    productosRankingRaw.forEach(p => {
      productosMap[p.producto] = p;
    });
    // Construir arreglo final con todos los productos fijos
    const productosRanking = PRODUCTOS_FIJOS.map(producto => ({
      producto,
      ventas: productosMap[producto]?.ventas || 0
    }));
    res.json({ success: true, data: productosRanking });
  } catch (error) {
    console.error("[API /productos] Error:", error);
    if (error.stack) console.error(error.stack);
    res.status(500).json({ success: false, message: 'Error en el servidor', details: error.message });
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