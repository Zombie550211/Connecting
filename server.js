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
      // Comparar fechas como strings YYYY-MM-DD sin hora
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
      Telefono: c.telefono || '',
      Producto: c.producto || '',
      Puntaje: c.puntaje || 0,
      Cuenta: c.cuenta || '',
      Direccion: c.direccion || '',
      Zip: c.zip || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Costumers");
    const fileName = "Costumer.xlsx";
    XLSX.writeFile(wb, fileName);

    res.download(fileName, (err) => {
      if (err) {
        console.error("Error al enviar archivo:", err);
        res.status(500).send("Error al descargar archivo.");
      }
      fs.unlinkSync(fileName);
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ENDPOINT PARA OBTENER LEADS CON FILTRO Y PAGINACION
app.get('/api/leads', protegerRuta, async (req, res) => {
  try {
    const { desde, hasta, page = 1, limit = 10 } = req.query;
    let query = {};

    if (desde && hasta) {
      query.fecha = { $gte: desde, $lte: hasta };
    } else if (desde) {
      query.fecha = { $gte: desde };
    } else if (hasta) {
      query.fecha = { $lte: hasta };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Lead.countDocuments(query);
    const leads = await Lead.find(query).sort({ fecha: -1 }).skip(skip).limit(Number(limit)).lean();

    res.json({ success: true, data: leads, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ENDPOINT PARA OBTENER COSTUMERS CON FILTRO Y PAGINACION
app.get('/api/costumer', protegerRuta, async (req, res) => {
  try {
    const { desde, hasta, page = 1, limit = 10 } = req.query;
    let query = {};

    if (desde && hasta) {
      query.fecha = { $gte: desde, $lte: hasta };
    } else if (desde) {
      query.fecha = { $gte: desde };
    } else if (hasta) {
      query.fecha = { $lte: hasta };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Costumer.countDocuments(query);
    const costumers = await Costumer.find(query).sort({ fecha: -1 }).skip(skip).limit(Number(limit)).lean();

    res.json({ success: true, data: costumers, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ENDPOINT PARA SUBIR EXCEL DE COSTUMERS Y ACTUALIZAR BASE DE DATOS
app.post('/api/costumer/import', protegerRuta, upload.single('archivo'), async (req, res) => {
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
      await Costumer.insertMany(mapped);
    }
    fs.unlinkSync(filePath);
    res.json({ success: true, count: mapped.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ENDPOINTS PARA GRAFICAS
app.get("/api/graficas-leads", protegerRuta, async (req, res) => {
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

    const leads = await Lead.find(query).lean();
    const equipos = {};
    const productos = {};

    leads.forEach(({ equipo, producto }) => {
      equipos[equipo] = (equipos[equipo] || 0) + 1;
      productos[producto] = (productos[producto] || 0) + 1;
    });

    res.json({ success: true, equipos, productos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/graficas-costumer", protegerRuta, async (req, res) => {
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
    const equipos = {};
    const productos = {};

    costumers.forEach(({ equipo, producto }) => {
      equipos[equipo] = (equipos[equipo] || 0) + 1;
      productos[producto] = (productos[producto] || 0) + 1;
    });

    res.json({ success: true, equipos, productos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ENDPOINT PARA CERRAR SESION
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});
