require('dotenv').config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const Lead = require('./models/lead');
const Costumer = require('./models/costumer');
const Facturacion = require('./models/Facturacion');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
  throw new Error("La variable de entorno MONGO_URL no está definida.");
}

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

// ==== FUNCIÓN PARA FECHA LOCAL YYYY-MM-DD ====
function getFechaLocalHoy() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, '0');
  const day = String(hoy.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Middleware robusto para proteger rutas, cerrar sesión si no se ha enviado un lead en 30 minutos
function protegerRuta(req, res, next) {
  const MAX_INACTIVIDAD = 30 * 60 * 1000; // 30 minutos en milisegundos
  const ahora = Date.now();

  if (req.session.usuario) {
    if (req.session.ultimoLead) {
      if (ahora - req.session.ultimoLead > MAX_INACTIVIDAD) {
        req.session.destroy(() => {
          const expectsJson =
            req.headers['x-requested-with'] === 'XMLHttpRequest' ||
            (req.headers.accept && req.headers.accept.includes('application/json')) ||
            (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) ||
            (req.headers['sec-fetch-mode'] && req.headers['sec-fetch-mode'] === 'cors') ||
            req.headers['fetch-site'] ||
            (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
            req.path.startsWith('/api/');

          if (expectsJson) {
            return res.status(401).json({ success: false, error: "Sesión expirada por inactividad (más de 30 minutos sin enviar lead)" });
          }
          return res.redirect("/login.html");
        });
        return;
      }
    }
    return next();
  }
  const expectsJson =
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    (req.headers.accept && req.headers.accept.includes('application/json')) ||
    (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) ||
    (req.headers['sec-fetch-mode'] && req.headers['sec-fetch-mode'] === 'cors') ||
    req.headers['fetch-site'] ||
    (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
    req.path.startsWith('/api/');

  if (expectsJson) {
    return res.status(401).json({ success: false, error: "Sesión expirada o no autenticado" });
  }
  return res.redirect("/login.html");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "secreto_crm_conectado",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URL })
}));

app.use(express.static(path.join(__dirname, 'public')));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { user, pass } = req.body;
  if (user === "admin" && pass === "1234") {
    req.session.usuario = user;
    req.session.ultimoLead = Date.now();
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.get("/lead.html", protegerRuta, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "lead.html"));
});

app.get("/costumer.html", protegerRuta, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "costumer.html"));
});

app.get("/Facturacion.html", protegerRuta, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "Facturacion.html"));
});


// ================== LEADS =========================

// Importar leads desde Excel
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
      fecha: row.fecha
        ? row.fecha.toString().slice(0, 10)
        : getFechaLocalHoy(),
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
      await Costumer.insertMany(mapped); // Guardar en costumers también
    }
    fs.unlinkSync(filePath);
    res.json({ success: true, count: mapped.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// CRUD de leads (guardar uno)
app.post("/api/leads", protegerRuta, async (req, res) => {
  try {
    const { fecha, team, agent, telefono, producto, puntaje, cuenta, direccion, zip } = req.body;

    if (!agent || !producto) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }

    const fechaLead = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
      ? fecha
      : getFechaLocalHoy();

    const nuevoLead = {
      fecha: fechaLead,
      equipo: team || '',
      agente: agent,
      telefono: telefono || '',
      producto,
      puntaje: puntaje || 0,
      cuenta: cuenta || '',
      direccion: direccion || '',
      zip: zip || ''
    };

    await Lead.create(nuevoLead);
    await Costumer.create(nuevoLead);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Error al guardar el lead/costumer: " + err.message });
  }
});

// ----------- ENDPOINT GRAFICAS LEADS ----------
app.get("/api/graficas", protegerRuta, async (req, res) => {
  try {
    const fechaFiltro = req.query.fecha;
    const query = {};
    if (fechaFiltro && /^\d{4}-\d{2}-\d{2}$/.test(fechaFiltro)) {
      query.fecha = fechaFiltro;
    }
    const leads = await Lead.find(query).lean();

    const ventasPorEquipo = {};
    const puntosPorEquipo = {};
    const ventasPorProducto = {};

    leads.forEach(row => {
      const equipo = row.equipo || row.team || "";
      const producto = row.producto || "";
      const puntaje = parseFloat(row.puntaje) || 0;

      if (!equipo || !producto) return;

      ventasPorEquipo[equipo] = (ventasPorEquipo[equipo] || 0) + 1;
      puntosPorEquipo[equipo] = Math.round(((puntosPorEquipo[equipo] || 0) + puntaje) * 100) / 100;
      ventasPorProducto[producto] = (ventasPorProducto[producto] || 0) + 1;
    });

    res.json({ ventasPorEquipo, puntosPorEquipo, ventasPorProducto });
  } catch (error) {
    res.status(500).json({ error: "No se pudieron cargar los datos para gráficas." });
  }
});

// Descargar Excel de Costumers
app.get('/descargar/costumers', protegerRuta, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let query = {};
    if (desde && hasta) {
      query.fecha = { $gte: desde, $lte: hasta };
    } else if (desde) {
      query.fecha = { $gte: desde };
    } else if (hasta) {
      query.fecha = { $lte: hasta };
    }

    const costumers = await Costumer.find(query).lean();

    const excelData = costumers.map(c => ({
      Fecha: c.fecha || '',
      Team: c.equipo || '',
      Agente: c.agente || '',
      Producto: c.producto || '',
      Puntaje: c.puntaje || '',
      Cuenta: c.cuenta || '',
      Telefono: c.telefono || '',
      Dirección: c.direccion || '',
      ZIP: c.zip || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Costumers');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="costumers.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).send('Error generando Excel');
  }
});

// ====================== COSTUMER ENDPOINTS =========================
app.post("/api/costumer", protegerRuta, async (req, res) => {
  try {
    const { fecha, team, agent, producto, puntaje, cuenta, telefono, direccion, zip } = req.body;
    if (!agent || !producto) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }
    const fechaCostumer = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : getFechaLocalHoy();

    const nuevoCostumer = {
      fecha: fechaCostumer,
      equipo: team || '',
      agente: agent,
      telefono: telefono || '',
      producto,
      puntaje: Number(puntaje) || 0,
      cuenta: cuenta || '',
      direccion: direccion || '',
      zip: zip || ''
    };
    await Costumer.create(nuevoCostumer);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/costumer", protegerRuta, async (req, res) => {
  try {
    const { fecha } = req.query;
    const query = {};
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      query.fecha = fecha;
    }
    const costumers = await Costumer.find(query).sort({ fecha: -1 }).lean();
    res.json({ costumers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========== INTEGRACIÓN DE FACTURACIÓN (tabla de facturación) ===========

// GUARDAR/ACTUALIZAR UNA FILA DE FACTURACION (por fecha)
app.post('/api/facturacion', protegerRuta, async (req, res) => {
  const { fecha, campos } = req.body;
  if (!fecha || !Array.isArray(campos) || campos.length !== 14) {
    return res.status(400).json({ ok: false, error: "Datos incompletos" });
  }
  try {
    const doc = await Facturacion.findOneAndUpdate(
      { fecha },
      { $set: { campos } },
      { upsert: true, new: true }
    );
    res.json({ ok: true, doc });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// OBTENER TODA LA FACTURACION DE UN MES/AÑO
app.get('/api/facturacion/:ano/:mes', protegerRuta, async (req, res) => {
  const { ano, mes } = req.params;
  const regex = new RegExp(`^\\d{2}\\/${mes.padStart(2,'0')}\\/${ano}$`);
  try {
    const data = await Facturacion.find({ fecha: { $regex: regex } }).lean();
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ENDPOINT PARA LA GRAFICA (totales por día del mes)
app.get('/api/facturacion/estadistica/:ano/:mes', protegerRuta, async (req, res) => {
  const { ano, mes } = req.params;
  const regex = new RegExp(`^\\d{2}\\/${mes.padStart(2,'0')}\\/${ano}$`);
  const data = await Facturacion.find({ fecha: { $regex: regex } }).lean();

  // columna 10 es TOTAL DEL DIA (índice 9)
  const diasEnMes = new Date(parseInt(ano), parseInt(mes), 0).getDate();
  const totalesPorDia = Array(diasEnMes).fill(0);

  data.forEach(fila => {
    const dia = parseInt(fila.fecha.split('/')[0], 10) - 1;
    const totalDia = Number(fila.campos[9]) || 0; // columna 10 (índice 9)
    if (!isNaN(dia) && dia >= 0 && dia < totalesPorDia.length) {
      totalesPorDia[dia] = totalDia;
    }
  });

  res.json({ ok: true, totalesPorDia });
});

// =================== UTILIDADES, LOGOUT Y MIGRACIÓN =======================
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

app.post('/api/migrar-fechas-a-string', async (req, res) => {
  try {
    let leadsModificados = 0;
    let costumersModificados = 0;

    const leads = await Lead.find({ fecha: { $type: 'date' } });
    for (const lead of leads) {
      const nuevaFecha = lead.fecha.toISOString().slice(0, 10);
      lead.fecha = nuevaFecha;
      await lead.save();
      leadsModificados++;
    }
    const costumers = await Costumer.find({ fecha: { $type: 'date' } });
    for (const c of costumers) {
      const nuevaFecha = c.fecha.toISOString().slice(0, 10);
      c.fecha = nuevaFecha;
      await c.save();
      costumersModificados++;
    }
    res.json({ success: true, leadsModificados, costumersModificados });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});