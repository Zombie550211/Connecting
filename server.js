require('dotenv').config();

const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const Lead = require('./models/lead');       // Ajusta ruta si es necesario
const Costumer = require('./models/costumer'); // Ajusta ruta si es necesario

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON y sesiones (ejemplo básico)
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto',
  resave: false,
  saveUninitialized: false,
}));

function protegerRuta(req, res, next) {
  if (req.session && req.session.usuario) {
    return next();
  }
  res.status(401).json({ success: false, error: 'No autorizado' });
}

// Función para convertir 'YYYY-MM-DD' a rango Date para MongoDB
function getDateRange(fechaStr) {
  if (!fechaStr) return null;
  const start = new Date(fechaStr + "T00:00:00.000Z");
  const end = new Date(fechaStr + "T23:59:59.999Z");
  return { start, end };
}

// Función para construir filtro de fechas según query (fecha, desde, hasta)
function construirFiltroFecha(query) {
  const { fecha, desde, hasta } = query;
  let filtro = {};

  if (fecha) {
    const rango = getDateRange(fecha);
    filtro.fecha = { $gte: rango.start, $lte: rango.end };
  } else if (desde && hasta) {
    const desdeDate = new Date(desde + "T00:00:00.000Z");
    const hastaDate = new Date(hasta + "T23:59:59.999Z");
    filtro.fecha = { $gte: desdeDate, $lte: hastaDate };
  } else if (desde) {
    filtro.fecha = { $gte: new Date(desde + "T00:00:00.000Z") };
  } else if (hasta) {
    filtro.fecha = { $lte: new Date(hasta + "T23:59:59.999Z") };
  }

  return filtro;
}

// --- ENDPOINTS ---

// Datos para graficas de Costumers con filtro fecha
app.get("/api/graficas-costumer", protegerRuta, async (req, res) => {
  try {
    const filtroFecha = construirFiltroFecha(req.query);
    const costumers = await Costumer.find(filtroFecha).lean();

    const ventasPorEquipo = {};
    const puntosPorEquipo = {};
    const ventasPorProducto = {};

    costumers.forEach(({ equipo, producto, puntaje }) => {
      ventasPorEquipo[equipo] = (ventasPorEquipo[equipo] || 0) + 1;
      puntosPorEquipo[equipo] = (puntosPorEquipo[equipo] || 0) + (puntaje || 0);
      ventasPorProducto[producto] = (ventasPorProducto[producto] || 0) + 1;
    });

    res.json({ success: true, ventasPorEquipo, puntosPorEquipo, ventasPorProducto });
  } catch (err) {
    console.error("Error en /api/graficas-costumer:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Importar Excel Leads
app.post('/api/leads/import', protegerRuta, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No se subió ningún archivo." });
    }
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const mapped = rows.filter(row =>
      row.equipo || row.team || row.agente || row.agent || row.producto || row.puntaje || row.cuenta || row.direccion || row.telefono || row.zip
    ).map(row => ({
      fecha: row.fecha ? new Date(row.fecha.toString().slice(0, 10) + "T00:00:00.000Z") : new Date(),
      equipo: row.equipo || row.team || "",
      agente: row.agente || row.agent || "",
      telefono: row.telefono || "",
      producto: row.producto || "",
      puntaje: Number(row.puntaje) || 0,
      cuenta: row.cuenta || "",
      direccion: row.direccion || "",
      zip: row.zip || ""
    }));

    if (mapped.length) {
      await Lead.insertMany(mapped);
    }
    fs.unlinkSync(filePath);
    res.json({ success: true, count: mapped.length });
  } catch (err) {
    console.error("Error importando leads:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Descargar Excel Leads estático
app.get('/descargar/leads', protegerRuta, (req, res) => {
  const filePath = path.join(__dirname, 'leads.xlsx');
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'leads.xlsx');
  } else {
    res.status(404).send('No existe el archivo de leads.');
  }
});

// Descargar Excel Costumers dinámico con filtro fecha
app.get('/descargar/costumers', protegerRuta, async (req, res) => {
  try {
    const filtroFecha = construirFiltroFecha(req.query);
    const costumers = await Costumer.find(filtroFecha).lean();

    const excelData = costumers.map(c => ({
      Fecha: c.fecha ? c.fecha.toISOString().slice(0,10) : '',
      Equipo: c.equipo,
      Agente: c.agente,
      Telefono: c.telefono,
      Producto: c.producto,
      Puntaje: c.puntaje,
      Cuenta: c.cuenta,
      Direccion: c.direccion,
      Zip: c.zip
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Costumers");

    const filename = 'costumers_export.xlsx';
    const tempFilePath = path.join(__dirname, filename);
    XLSX.writeFile(workbook, tempFilePath);

    res.download(tempFilePath, filename, err => {
      if (err) {
        console.error('Error al descargar:', err);
      }
      fs.unlinkSync(tempFilePath);
    });
  } catch (err) {
    console.error("Error en /descargar/costumers:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Graficas Leads (agregación por producto)
app.get('/api/graficas-leads', protegerRuta, async (req, res) => {
  try {
    const filtroFecha = construirFiltroFecha(req.query);

    const resultados = await Lead.aggregate([
      { $match: filtroFecha },
      {
        $group: {
          _id: "$producto",
          puntajeTotal: { $sum: "$puntaje" }
        }
      },
      {
        $project: {
          producto: "$_id",
          puntajeTotal: 1,
          _id: 0
        }
      }
    ]);

    res.json(resultados);
  } catch (err) {
    console.error("Error en /api/graficas-leads:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Graficas Costumers (agregación por equipo)
app.get('/api/graficas-costumer', protegerRuta, async (req, res) => {
  try {
    const filtroFecha = construirFiltroFecha(req.query);

    const resultados = await Costumer.aggregate([
      { $match: filtroFecha },
      {
        $group: {
          _id: "$equipo",
          puntajeTotal: { $sum: "$puntaje" }
        }
      },
      {
        $project: {
          equipo: "$_id",
          puntajeTotal: 1,
          _id: 0
        }
      }
    ]);

    res.json(resultados);
  } catch (err) {
    console.error("Error en /api/graficas-costumer:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint combinado para graficas leads + costumers
app.get('/api/graficas', protegerRuta, async (req, res) => {
  try {
    const filtroFecha = construirFiltroFecha(req.query);

    const leadsData = await Lead.aggregate([
      { $match: filtroFecha },
      {
        $group: {
          _id: "$producto",
          puntajeTotal: { $sum: "$puntaje" }
        }
      },
      {
        $project: {
          producto: "$_id",
          puntajeTotal: 1,
          _id: 0
        }
      }
    ]);

    const costumersData = await Costumer.aggregate([
      { $match: filtroFecha },
      {
        $group: {
          _id: "$equipo",
          puntajeTotal: { $sum: "$puntaje" }
        }
      },
      {
        $project: {
          equipo: "$_id",
          puntajeTotal: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      leads: leadsData,
      costumers: costumersData
    });
  } catch (err) {
    console.error("Error en /api/graficas combinado:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
