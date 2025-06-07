require('dotenv').config();

console.log("DEBUG MONGO_URL:", process.env.MONGO_URL);
const lead = require('./models/lead'); // <-- todo en minúsculas

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;

// Usa tu URL real de MongoDB Atlas en el archivo .env
const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
  throw new Error("La variable de entorno MONGO_URL no está definida. ¡Configúrala en Render!");
}
// Conexión a MongoDB Atlas
mongoose.connect(MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
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

app.use(express.static(__dirname + '/public'));

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

const protegerRuta = (req, res, next) => {
  if (!req.session.usuario) return res.redirect("/login.html");
  next();
};

app.get("/lead.html", protegerRuta, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "lead.html"));
});

app.get("/costumer.html", protegerRuta, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "costumer.html"));
});

// Archivo Excel
const EXCEL_FILE_PATH = path.join(__dirname, "leads.xlsx");

// Obtener nombre de la hoja (fecha actual)
function obtenerNombreHoja() {
  return new Date().toISOString().split("T")[0];
}

// Función para leer o crear el archivo Excel
function obtenerWorkbook() {
  if (fs.existsSync(EXCEL_FILE_PATH)) {
    return XLSX.readFile(EXCEL_FILE_PATH);
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.writeFile(wb, EXCEL_FILE_PATH);
    return wb;
  }
}

// Crear el archivo Excel y hoja del día automáticamente al iniciar el servidor
function inicializarExcelConHojaDelDia() {
  const nombreHoja = obtenerNombreHoja();

  let workbook;
  if (fs.existsSync(EXCEL_FILE_PATH)) {
    workbook = XLSX.readFile(EXCEL_FILE_PATH);
  } else {
    workbook = XLSX.utils.book_new();
  }

  if (!workbook.Sheets[nombreHoja]) {
    const hojaVacia = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, hojaVacia, nombreHoja);
    XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    console.log(`✔️ Hoja creada para el día: ${nombreHoja}`);
  } else {
    console.log(`ℹ️ Hoja del día ${nombreHoja} ya existe`);
  }
}

inicializarExcelConHojaDelDia();

app.post("/api/leads", async (req, res) => {
  try {
    const { team, agent, telefono, producto, puntaje, cuenta, direccion, zip } = req.body;
    if (!agent || !producto) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }

    const nombreHoja = obtenerNombreHoja();
    const nuevoLead = {
      fecha: new Date().toISOString(),
      team: team || '',
      agent,
      telefono: telefono || '',
      producto,
      puntaje: puntaje || 0,
      cuenta: cuenta || '',
      direccion: direccion || '',
      zip: zip || ''
    };

    // Guardar en Excel
    const workbook = obtenerWorkbook();
    let datos = [];
    if (workbook.Sheets[nombreHoja]) {
      datos = XLSX.utils.sheet_to_json(workbook.Sheets[nombreHoja]);
    }
    datos.push(nuevoLead);
    const nuevaHoja = XLSX.utils.json_to_sheet(datos);
    if (workbook.SheetNames.includes(nombreHoja)) {
      const idx = workbook.SheetNames.indexOf(nombreHoja);
      workbook.SheetNames.splice(idx, 1);
    }
    XLSX.utils.book_append_sheet(workbook, nuevaHoja, nombreHoja);
    XLSX.writeFile(workbook, EXCEL_FILE_PATH);

    // Guardar en MongoDB
    await Lead.create(nuevoLead);

    res.json({ success: true });
  } catch (err) {
    console.error("Error al guardar lead:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET leads: Lee leads de Excel y MongoDB, y los regresa en dos arreglos
app.get("/api/leads", async (req, res) => {
  try {
    // 1. Leads desde Excel
    let leadsExcel = [];
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      const workbook = XLSX.readFile(EXCEL_FILE_PATH);
      workbook.SheetNames.forEach(nombreHoja => {
        const hoja = workbook.Sheets[nombreHoja];
        const datos = XLSX.utils.sheet_to_json(hoja);
        leadsExcel = leadsExcel.concat(datos);
      });
      leadsExcel.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }

    // 2. Leads desde MongoDB
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
    console.error("Error al leer leads:", error);
    res.status(500).json({ error: "No se pudieron cargar los leads." });
  }
});

app.get("/api/graficas", (req, res) => {
  try {
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      return res.json({
        ventasPorEquipo: {},
        puntosPorEquipo: {},
        ventasPorProducto: {}
      });
    }
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);

    const ventasPorEquipo = {};
    const puntosPorEquipo = {};
    const ventasPorProducto = {};

    workbook.SheetNames.forEach(nombreHoja => {
      const hoja = workbook.Sheets[nombreHoja];
      const datos = XLSX.utils.sheet_to_json(hoja);

      datos.forEach(row => {
        if (!row.team || !row.producto) return;

        ventasPorEquipo[row.team] = (ventasPorEquipo[row.team] || 0) + 1;
        puntosPorEquipo[row.team] = Math.round(((puntosPorEquipo[row.team] || 0) + parseFloat(row.puntaje || 0)) * 100) / 100;
        ventasPorProducto[row.producto] = (ventasPorProducto[row.producto] || 0) + 1;
      });
    });

    res.json({ ventasPorEquipo, puntosPorEquipo, ventasPorProducto });
  } catch (error) {
    console.error("Error al obtener datos para gráficas:", error);
    res.status(500).json({ error: "No se pudieron cargar los datos para gráficas." });
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