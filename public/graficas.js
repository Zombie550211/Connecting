const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuración Multer para subir archivos Excel ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Solo archivos Excel permitidos'));
    }
  }
});

// --- Conexión a MongoDB ---
const mongoUrl = 'mongodb://localhost:27017/crm';
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB conectado'))
  .catch(e => console.error('Error conexión MongoDB:', e));

// --- Schema y Modelo para Leads ---
const leadSchema = new mongoose.Schema({
  nombre: String,
  producto: String,
  equipo: String,
  puntos: Number,
  fecha: Date
});

const Lead = mongoose.model('Lead', leadSchema);

// --- Middlewares ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'secreto_superseguro',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl })
}));

// --- Middleware de autenticación ---
function authMiddleware(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ success: false, msg: 'No autorizado' });
  }
}

// --- Rutas ---

// Login sencillo
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === '1234') {
    req.session.user = username;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, msg: 'Usuario o contraseña inválidos' });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// API: Cargar leads desde Excel
app.post('/api/cargar-leads', authMiddleware, upload.single('archivoExcel'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, msg: 'Archivo no recibido' });

    // Leer Excel desde buffer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convertir a JSON
    const datos = XLSX.utils.sheet_to_json(sheet);

    // Validar y mapear datos (esperamos columnas: nombre, producto, equipo, puntos, fecha)
    const leadsNuevos = datos.map(row => ({
      nombre: row.nombre || '',
      producto: row.producto || '',
      equipo: row.equipo || '',
      puntos: Number(row.puntos) || 0,
      fecha: row.fecha ? new Date(row.fecha) : new Date()
    }));

    // Insertar en DB (podrías borrar antes si quieres reemplazar todo)
    await Lead.insertMany(leadsNuevos);

    res.json({ success: true, msg: `${leadsNuevos.length} leads cargados` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, msg: 'Error al procesar archivo' });
  }
});

// API: Obtener todos los leads
app.get('/api/leads', authMiddleware, async (req, res) => {
  try {
    const leads = await Lead.find().sort({ fecha: -1 });
    res.json({ success: true, leads });
  } catch (error) {
    res.status(500).json({ success: false, msg: 'Error al obtener leads' });
  }
});

// API: Datos para gráficas (filtrado por fecha)
app.get('/api/graficas-leads', authMiddleware, async (req, res) => {
  try {
    const fechaStr = req.query.fecha;
    if (!fechaStr) return res.status(400).json({ success: false, msg: 'Falta fecha' });

    const fechaInicio = new Date(fechaStr);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = new Date(fechaStr);
    fechaFin.setHours(23, 59, 59, 999);

    const leads = await Lead.find({ fecha: { $gte: fechaInicio, $lte: fechaFin } });

    const ventasPorEquipo = {};
    const puntosPorEquipo = {};
    const ventasPorProducto = {};

    leads.forEach(lead => {
      ventasPorEquipo[lead.equipo] = (ventasPorEquipo[lead.equipo] || 0) + 1;
      puntosPorEquipo[lead.equipo] = (puntosPorEquipo[lead.equipo] || 0) + (lead.puntos || 0);
      ventasPorProducto[lead.producto] = (ventasPorProducto[lead.producto] || 0) + 1;
    });

    res.json({
      success: true,
      ventasPorEquipo,
      puntosPorEquipo,
      ventasPorProducto
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, msg: 'Error en servidor' });
  }
});

// Servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
