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

const app = express();
const PORT = process.env.PORT || 3000;

const EXCEL_FILE_PATH = path.join(__dirname, "leads.xlsx");
const COSTUMER_FILE_PATH = path.join(__dirname, "Costumer.xlsx");

const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
  throw new Error("La variable de entorno MONGO_URL no está definida.");
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

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

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

// ENDPOINT PARA IMPORTAR EXCEL DE LEADS Y ACTUALIZAR LA BASE DE DATOS
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
      fecha: row.fecha ? row.fecha.toString().slice(0, 10) : new Date().toISOString().slice(0, 10),
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// ENDPOINT PARA DESCARGAR EL EXCEL DE LEADS (ARCHIVO ESTATICO)
app.get('/descargar/leads', protegerRuta, (req, res) => {
  const filePath = path.join(__dirname, 'leads.xlsx');
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'leads.xlsx');
  } else {
    res.status(404).send('No existe el archivo de leads.');
  }
});

// ENDPOINT PARA DESCARGAR EL EXCEL DE COSTUMERS (DINÁMICO DESDE MONGO, CON FILTRO DE FECHA)
app.get('/descargar/costumers', protegerRuta, async (req, res) => {
  try {
    // Filtrar por fecha (YYYY-MM-DD)
    const { desde, hasta } = req.query;
    let query = {};
    if (desde && hasta) {
  const desdeISO = desde + "T00:00:00.000Z";
  const hastaISO = hasta + "T23:59:59.999Z";
  query.fecha = { $gte: desdeISO, $lte: hastaISO };
} else if (desde) {
  const desdeISO = desde + "T00:00:00.000Z";
  query.fecha = { $gte: desdeISO };
} else if (hasta) {
  const hastaISO = hasta + "T23:59:59.999Z";
  query.fecha = { $lte: hastaISO };
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

// ENDPOINTS CRUD Y GRAFICAS DE LEADS
app.post("/api/leads", protegerRuta, async (req, res) => {
  try {
    const { fecha, team, agent, telefono, producto, puntaje, cuenta, direccion, zip } = req.body;

    if (!agent || !producto) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }

    const fechaLead = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : new Date().toISOString().slice(0, 10);

    const nuevoLead = {
      fecha: fechaLead,
      equipo: team || '',
      agente: agent,
      teléfono: telefono || '',
      producto,
      puntaje: puntaje || 0,
      cuenta: cuenta || '',
      direccion: direccion || '',
      zip: zip || ''
    };

    await Lead.create(nuevoLead);

    const nuevoCostumer = {
      fecha: nuevoLead.fecha,
      equipo: nuevoLead.equipo,
      agente: nuevoLead.agente,
      telefono: nuevoLead.teléfono,
      producto: nuevoLead.producto,
      puntaje: nuevoLead.puntaje,
      cuenta: nuevoLead.cuenta,
      direccion: nuevoLead.direccion,
      zip: nuevoLead.zip
    };
    await Costumer.create(nuevoCostumer);

    req.session.ultimoLead = Date.now();

    let workbook;
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      workbook = XLSX.readFile(EXCEL_FILE_PATH);
    } else {
      workbook = XLSX.utils.book_new();
    }

    const nombreHoja = fechaLead;
    let datos = [];
    if (workbook.Sheets[nombreHoja]) {
      datos = XLSX.utils.sheet_to_json(workbook.Sheets[nombreHoja], { defval: "" });
    }
    datos.push(nuevoLead);

    const encabezados = [
      "fecha",
      "equipo",
      "agente",
      "teléfono",
      "producto",
      "puntaje",
      "cuenta",
      "direccion",
      "zip"
    ];

    const nuevaHoja = XLSX.utils.json_to_sheet(datos, { header: encabezados });
    workbook.Sheets[nombreHoja] = nuevaHoja;
    if (!workbook.SheetNames.includes(nombreHoja)) {
      workbook.SheetNames.push(nombreHoja);
    }

    try {
      XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    } catch (err) {
      console.error("Error al escribir el archivo Excel:", err);
      return res.status(500).json({ success: false, error: "No se pudo escribir en el archivo Excel: " + err.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error real al guardar lead/costumer:", err);
    res.status(500).json({ success: false, error: "Error al guardar el lead/costumer: " + err.message });
  }
});

// ENDPOINT GRAFICAS PARA LEADS (por fecha)
app.get("/api/graficas", protegerRuta, async (req, res) => {
  try {
    const fechaFiltro = req.query.fecha;
    const query = {};

  if (fechaFiltro && /^\d{4}-\d{2}-\d{2}$/.test(fechaFiltro)) {
  const desde = fechaFiltro + "T00:00:00.000Z";
  const hasta = fechaFiltro + "T23:59:59.999Z";
  query.fecha = { $gte: desde, $lte: hasta };
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
    console.error("Error en /api/graficas:", error.stack || error);
    res.status(500).json({ error: "No se pudieron cargar los datos para gráficas." });
  }
});

// ====================== COSTUMER ENDPOINTS =========================
app.post("/api/costumer", protegerRuta, async (req, res) => {
  try {
    const { fecha, team, agent, producto, puntaje, cuenta, telefono, direccion, zip } = req.body;
    if (!agent || !producto) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }
    const fechaCostumer = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : new Date().toISOString().slice(0, 10);
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
   if (fechaFiltro && /^\d{4}-\d{2}-\d{2}$/.test(fechaFiltro)) {
  const desde = fechaFiltro + "T00:00:00.000Z";
  const hasta = fechaFiltro + "T23:59:59.999Z";
  query.fecha = { $gte: desde, $lte: hasta };
}

    const costumers = await Costumer.find(query).sort({ fecha: -1 }).lean();
    res.json({ costumers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/costumer/import', protegerRuta, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No se subió ningún archivo." });
    }
    const filePath = req.file.path;
    let mapped = [];
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      mapped = rows
        .filter(row =>
          (row.equipo || row.team || row.agente || row.agent || row.producto || row.puntaje || row.cuenta || row.direccion || row.telefono || row.zip)
        )
        .map(row => ({
          fecha: row.fecha ? row.fecha.toString().slice(0, 10) : new Date().toISOString().slice(0, 10),
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
        await Costumer.insertMany(mapped);
      }
      fs.unlinkSync(filePath);
      return res.json({ success: true, count: mapped.length });
    } catch (error) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, error: "Archivo inválido o corrupto." });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/graficas-costumer", protegerRuta, async (req, res) => {
  try {
    const fechaFiltro = req.query.fecha;
    const query = {};
    if (fechaFiltro && /^\d{4}-\d{2}-\d{2}$/.test(fechaFiltro)) {
      query.fecha = { $regex: `^${fechaFiltro}` };
    }
    const costumers = await Costumer.find(query).lean();

    const ventasPorEquipo = {};
    const puntosPorEquipo = {};
    const ventasPorProducto = {};

    costumers.forEach(row => {
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

// ELIMINAR TODOS LOS COSTUMERS
app.delete('/api/costumer/all', protegerRuta, async (req, res) => {
  try {
    await Costumer.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ELIMINAR UN COSTUMER POR ID
app.delete('/api/costumer/:id', protegerRuta, async (req, res) => {
  try {
    const { id } = req.params;
    await Costumer.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// EDITAR/ACTUALIZAR UN COSTUMER POR ID
app.put('/api/costumer/:id', protegerRuta, async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    await Costumer.findByIdAndUpdate(id, update);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});