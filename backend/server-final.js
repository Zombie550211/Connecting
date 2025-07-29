require('dotenv').config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const cors = require("cors");

// Importar modelos
const CrmAgente = require('./models/crm_agente');
const Facturacion = require('./models/Facturacion');
const User = require('./models/user');
const Costumer = require('./models/costumer');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// CORS configuration
const corsOptions = {
  origin: isProduction ? 'https://crm-connecting.onrender.com' : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['set-cookie'],
  maxAge: 600
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// MongoDB connection
const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) throw new Error("La variable de entorno MONGO_URL no está definida.");

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

// Utility functions
function getFechaLocalHoy() {
  const hoy = new Date();
  const [month, day, year] = hoy.toLocaleDateString('es-SV', { timeZone: 'America/El_Salvador' }).split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function protegerRuta(req, res, next) {
  const MAX_INACTIVIDAD = 30 * 60 * 1000;
  const ahora = Date.now();

  if (req.session.usuario) {
    if (req.session.ultimoLead) {
      if (ahora - req.session.ultimoLead > MAX_INACTIVIDAD) {
        req.session.destroy(() => {
          const expectsJson = req.headers.accept && req.headers.accept.includes('application/json');
          if (expectsJson) {
            return res.status(401).json({ success: false, error: "Sesión expirada" });
          }
          return res.redirect("/login.html");
        });
        return;
      }
    }
    return next();
  }

  const expectsJson = req.headers.accept && req.headers.accept.includes('application/json');
  if (expectsJson) {
    return res.status(401).json({ success: false, error: "No autorizado" });
  }
  return res.redirect("/login.html");
}

function protegerAgente(req, res, next) {
  return next();
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "secreto_crm_conectado_seguro_123",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URL,
    collectionName: 'sessions',
    ttl: 30 * 60
  }),
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 30 * 60 * 1000,
    sameSite: isProduction ? 'none' : 'lax'
  },
  rolling: true,
  unset: 'destroy'
};

app.use(session(sessionConfig));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== HTML ROUTES ====================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/inicio.html", protegerRuta, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "inicio.html"));
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

app.get("/graficas.html", protegerRuta, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "graficas.html"));
});

// ==================== AUTH ROUTES ====================
app.post("/login", async (req, res) => {
  const { usuario, contrasena } = req.body;
  try {
    if (usuario === "admin" && contrasena === "1234") {
      req.session.usuario = usuario;
      req.session.ultimoLead = Date.now();
      return res.json({ success: true, destino: "/inicio.html" });
    }

    const usuarioDB = await User.findOne({ usuario });
    if (!usuarioDB) return res.json({ success: false, error: "Usuario no encontrado" });

    const match = await bcrypt.compare(contrasena, usuarioDB.password);
    if (!match) return res.json({ success: false, error: "Contraseña incorrecta" });

    req.session.usuario = usuarioDB.usuario;
    req.session.ultimoLead = Date.now();
    return res.json({ success: true, destino: "/inicio.html" });
  } catch (err) {
    console.error('Error en login:', err);
    return res.json({ success: false, error: "Error interno" });
  }
});

app.post('/register', async (req, res) => {
  try {
    const { usuario, email, contrasena, nombre, apellido } = req.body;
    if (!usuario || !email || !contrasena || !nombre || !apellido) {
      return res.json({ success: false, message: "Todos los campos son obligatorios." });
    }

    const existe = await User.findOne({ $or: [{ usuario }, { correo: email }] });
    if (existe) {
      return res.json({ success: false, message: "Usuario o correo ya registrado." });
    }

    const hash = await bcrypt.hash(contrasena, 10);
    await User.create({
      usuario,
      correo: email,
      password: hash,
      nombre,
      apellido
    });

    res.json({ success: true, message: "Usuario registrado exitosamente" });
  } catch (err) {
    console.error('Error en register:', err);
    res.json({ success: false, message: "Error al registrar usuario" });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

// ==================== API ROUTES ====================
app.get('/api/test', (req, res) => {
  res.json({ 
    ok: true, 
    message: "Servidor funcionando correctamente",
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});

app.get('/api/welcome', protegerRuta, async (req, res) => {
  try {
    let nombre = "Equipo administrativo";
    if (req.session && req.session.usuario) {
      const user = await User.findOne({ usuario: req.session.usuario });
      if (user && user.nombre) nombre = user.nombre;
      else nombre = req.session.usuario;
    }
    const frases = [
      "Liderar con integridad y visión: eso es Connecting.",
      "El éxito administrativo se construye con disciplina y pasión.",
      "Cada gestión es un paso hacia la excelencia."
    ];
    const frase = frases[Math.floor(Math.random() * frases.length)];
    res.json({ nombre, frase });
  } catch (err) {
    res.status(500).json({ nombre: "Equipo administrativo", frase: "Bienvenido" });
  }
});

// COSTUMER API
app.get("/api/costumer", protegerRuta, async (req, res) => {
  try {
    const costumers = await Costumer.find({}).sort({ fecha: -1 }).lean();
    const costumersMapeados = costumers.map(costumer => ({
      _id: costumer._id,
      FECHA: costumer.fecha || '',
      TEAM: costumer.equipo || '',
      AGENTE: costumer.agente || '',
      PRODUCTO: costumer.tipo_de_serv || '',
      FECHA_INSTALACION: costumer.dia_venta_a_instalacion || '',
      ESTADO: costumer.estado || 'Pending',
      PUNTAJE: costumer.puntaje || 0,
      CUENTA: costumer.numero_de_cuenta || '',
      TELEFONO: costumer.telefono || '',
      DIRECCION: costumer.direccion || '',
      ZIP: costumer.zip || ''
    }));
    
    res.json({ 
      success: true,
      costumers: costumersMapeados,
      message: "Datos de colección costumers"
    });
  } catch (err) {
    console.error('Error en API costumer:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      costumers: []
    });
  }
});

// FACTURACION API - SIN PARÁMETROS PROBLEMÁTICOS
function normalizeFacturacionDoc(doc) {
  if (Array.isArray(doc.campos) && doc.campos.length === 15) return doc;
  const campos = Array(15).fill("");
  campos[0] = doc.fecha || "";
  campos[1] = doc.alexis || "";
  campos[10] = doc.totalDelDia || "";
  campos[13] = doc.puntos || "";
  return { ...doc, campos };
}

app.get('/api/facturacion/mes', protegerRuta, async (req, res) => {
  const { ano, mes } = req.query;
  try {
    if (!ano || !mes) {
      return res.status(400).json({ ok: false, error: "Año y mes son requeridos" });
    }
    
    const regexes = [
      new RegExp(`^\\d{2}[/-]${mes}[/-]${ano}$`),
      new RegExp(`^${ano}[/-]${mes}[/-]\\d{2}$`),
      new RegExp(`^${mes}[/-]\\d{2}[/-]${ano}$`)
    ];
    
    let data = await Facturacion.find({
      $or: regexes.map(r => ({ fecha: { $regex: r } }))
    }).lean();
    
    data = data.map(doc => normalizeFacturacionDoc(doc));
    res.json({ ok: true, data });
  } catch (err) {
    console.error('Error en facturación mes:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/facturacion/anual', protegerRuta, async (req, res) => {
  const { ano } = req.query;
  try {
    if (!ano) {
      return res.status(400).json({ ok: false, error: "Año es requerido" });
    }
    
    let data = await Facturacion.find({
      fecha: { $regex: new RegExp(`${ano}`) }
    }).lean();
    
    data = data.map(doc => normalizeFacturacionDoc(doc));
    const totalesPorMes = Array(12).fill(0);
    
    data.forEach(doc => {
      let mes = null;
      if (doc.fecha) {
        const f = doc.fecha.trim();
        let match = f.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
        if (match) mes = parseInt(match[2], 10);
        if (!mes) {
          match = f.match(/^(\d{4})[\/-](\d{2})[\/-](\d{2})$/);
          if (match) mes = parseInt(match[2], 10);
        }
      }
      if (!isNaN(mes) && mes >= 1 && mes <= 12) {
        const totalDia = Number(doc.campos[10]) || 0;
        totalesPorMes[mes - 1] += totalDia;
      }
    });
    
    for (let i = 0; i < totalesPorMes.length; i++) {
      totalesPorMes[i] = Number(totalesPorMes[i]) || 0;
    }
    
    res.json({ ok: true, totalesPorMes, data });
  } catch (err) {
    console.error('Error en facturación anual:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/facturacion', protegerRuta, async (req, res) => {
  try {
    const { fecha, campos } = req.body;
    if (!fecha || !Array.isArray(campos) || campos.length !== 15) {
      return res.status(400).json({ ok: false, error: "Datos inválidos" });
    }
    
    const result = await Facturacion.findOneAndUpdate(
      { fecha },
      { fecha, campos },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    res.json({ ok: true, data: result });
  } catch (err) {
    console.error('Error guardando facturación:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GRAFICAS API
app.get('/api/graficas', protegerRuta, async (req, res) => {
  try {
    const { fecha } = req.query;
    let fechaFiltro = {};
    
    if (fecha) {
      const fechaObj = new Date(fecha);
      if (!isNaN(fechaObj.getTime())) {
        const dia = String(fechaObj.getDate()).padStart(2, '0');
        const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
        const anio = fechaObj.getFullYear();
        
        fechaFiltro = {
          $or: [
            { dia_venta: { $regex: `${dia}/${mes}/${anio}$` } },
            { dia_venta: { $regex: `${anio}-${mes}-${dia}` } },
            { dia_venta: { $regex: `${mes}/${dia}/${anio}` } }
          ]
        };
      }
    }

    const registros = await CrmAgente.find(fechaFiltro).lean();
    const ventasPorEquipo = {};
    const puntosPorEquipo = {};
    const ventasPorProducto = {};

    registros.forEach(registro => {
      const { team, tipo_servicios, puntaje } = registro;
      
      if (team && team.trim()) {
        if (!ventasPorEquipo[team]) ventasPorEquipo[team] = 0;
        if (!puntosPorEquipo[team]) puntosPorEquipo[team] = 0;
        
        ventasPorEquipo[team]++;
        if (typeof puntaje === 'number' && !isNaN(puntaje)) {
          puntosPorEquipo[team] += puntaje;
        }
      }

      if (tipo_servicios && tipo_servicios.trim()) {
        const producto = tipo_servicios.trim();
        if (!ventasPorProducto[producto]) {
          ventasPorProducto[producto] = 0;
        }
        ventasPorProducto[producto]++;
      }
    });

    res.json({
      ok: true,
      ventasPorEquipo,
      puntosPorEquipo,
      ventasPorProducto
    });
  } catch (error) {
    console.error('Error en graficas:', error);
    res.status(500).json({ ok: false, error: 'Error al obtener datos' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Catch-all route
app.get('*', (req, res) => {
  res.redirect('/login.html');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor funcionando en puerto ${PORT}`);
  console.log(`🔧 Node.js version: ${process.version}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
