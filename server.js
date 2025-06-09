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

// Middleware mejorado para autenticación y AJAX/fetch
function protegerRuta(req, res, next) {
  if (!req.session.usuario) {
    // Detecta peticiones AJAX, fetch, o JSON y responde JSON
    if (
      req.headers['x-requested-with'] === 'XMLHttpRequest' ||
      (req.headers.accept && req.headers.accept.indexOf('application/json') > -1) ||
      (req.headers['content-type'] && req.headers['content-type'].indexOf('application/json') > -1)
    ) {
      return res.status(401).json({ success: false, error: "Sesión expirada o no autenticado" });
    }
    // Si es navegador, redirige a login
    return res.redirect("/login.html");
  }
  next();
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

// === ENDPOINT PARA IMPORTAR EXCEL DE LEADS Y ACTUALIZAR LA BASE DE DATOS ===
app.post('/api/leads/import', protegerRuta, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No se subió ningún archivo." });
    }
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    // Filtra filas vacías
    const mapped = rows.filter(row =>
      row.equipo || row.team || row.agente || row.agent || row.producto || row.puntaje || row.cuenta || row.direccion || row.telefono || row.zip
    ).map(row => ({
      fecha: row.fecha || new Date().toISOString(),
      equipo: row.equipo || row.team || "",
      agente: row.agente || row.agent || "",
      teléfono: row.telefono || "",
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

// === ENDPOINT PARA DESCARGAR EL EXCEL DE LEADS ===
app.get('/descargar/leads', protegerRuta, (req, res) => {
  const filePath = path.join(__dirname, 'leads.xlsx');
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'leads.xlsx');
  } else {
    res.status(404).send('No existe el archivo de leads.');
  }
});

// --- ENDPOINTS CRUD Y GRAFICAS DE LEADS ---
app.post("/api/leads", protegerRuta, async (req, res) => {
  try {
    const { team, agent, telefono, producto, puntaje, cuenta, direccion, zip } = req.body;

    if (!agent || !producto) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }

    const nuevoLead = {
      fecha: new Date().toISOString(),
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

    let workbook;
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      workbook = XLSX.readFile(EXCEL_FILE_PATH);
    } else {
      workbook = XLSX.utils.book_new();
    }

    const nombreHoja = new Date().toISOString().split("T")[0];
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
      return res.status(500).json({ success: false, error: "No se pudo escribir en el archivo Excel." });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/leads", protegerRuta, async (req, res) => {
  try {
    let leadsExcel = [];
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      const workbook = XLSX.readFile(EXCEL_FILE_PATH);
      workbook.SheetNames.forEach(nombreHoja => {
        const hoja = workbook.Sheets[nombreHoja];
        const datos = XLSX.utils.sheet_to_json(hoja, { defval: "" });
        leadsExcel = leadsExcel.concat(datos);
      });
      leadsExcel.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }

    let leadsMongo = [];
    try {
      leadsMongo = await Lead.find().sort({ fecha: -1 }).lean();
    } catch (errorMongo) {
      console.error("Error al leer leads de MongoDB:", errorMongo);
    }

    res.json({
      leadsExcel,
      leadsMongo
    });
  } catch (error) {
    res.status(500).json({ error: "No se pudieron cargar los leads." });
  }
});

// ENDPOINT GRAFICAS PARA LEADS (por fecha)
app.get("/api/graficas", protegerRuta, async (req, res) => {
  try {
    const fechaFiltro = req.query.fecha;
    const query = {};

    if (fechaFiltro) {
      query.fecha = { $regex: `^${fechaFiltro}` };
    }

    const leads = await Lead.find(query).lean();

    const ventasPorEquipo = {};
    const puntosPorEquipo = {};
    const ventasPorProducto = {};

    leads.forEach(row => {
      const equipo = row.equipo || row.team || "";
      const producto = row.producto || "";
      const puntaje = parseFloat(row.puntaje || 0);

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

// ====================== COSTUMER ENDPOINTS =========================
app.post("/api/costumer", protegerRuta, async (req, res) => {
  try {
    const { team, agent, producto, puntaje, cuenta, telefono, direccion, zip } = req.body;
    if (!agent || !producto) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }
    const nuevoCostumer = {
      fecha: new Date().toISOString().slice(0, 10),
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
    if (fecha) query.fecha = { $regex: `^${fecha}` };
    const costumers = await Costumer.find(query).sort({ fecha: -1 }).lean();
    res.json({ costumers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === IMPORTAR COSTUMERS - SIEMPRE RESPONDER JSON, MANEJO DE ERRORES ===
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
          fecha: row.fecha || new Date().toISOString().slice(0, 10),
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
    if (fechaFiltro) {
      query.fecha = { $regex: `^${fechaFiltro}` };
    }
    const costumers = await Costumer.find(query).lean();

    const ventasPorEquipo = {};
    const puntosPorEquipo = {};
    const ventasPorProducto = {};

    costumers.forEach(row => {
      const equipo = row.equipo || row.team || "";
      const producto = row.producto || "";
      const puntaje = parseFloat(row.puntaje || 0);

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

// Descargar el excel de costumers
app.get('/descargar/costumers', protegerRuta, (req, res) => {
  const filePath = path.join(__dirname, 'Costumer.xlsx');
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'Costumer.xlsx');
  } else {
    res.status(404).send('No existe el archivo de costumers.');
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

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});