require('dotenv').config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const cors = require("cors");

const CrmAgente = require('./models/crm_agente');
const Facturacion = require('./models/Facturacion');
const User = require('./models/user');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Configuración básica de CORS para desarrollo
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

const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) throw new Error("La variable de entorno MONGO_URL no está definida.");

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

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
          const expectsJson =
            req.headers['x-requested-with'] === 'XMLHttpRequest' ||
            (req.headers.accept && req.headers.accept.includes('application/json')) ||
            (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) ||
            (req.headers['sec-fetch-mode'] && req.headers['sec-fetch-mode'] === 'cors') ||
            (req.headers['fetch-site']) ||
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
    (req.headers['fetch-site']) ||
    (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
    req.path.startsWith('/api/');

  if (expectsJson) {
    return res.status(401).json({ success: false, error: "No autorizado" });
  }
  return res.redirect("/login.html");
}

function protegerAgente(req, res, next) {
  return next();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Rutas HTML protegidas
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

// API básica sin rutas complejas
app.get('/api/test', (req, res) => {
  res.json({ ok: true, message: "Servidor funcionando correctamente" });
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
      "Cada gestión es un paso hacia la excelencia.",
      "La confianza y la transparencia son nuestro mejor activo.",
      "¡Gracias por ser parte de nuestro crecimiento diario!",
      "El profesionalismo conecta sueños con resultados.",
      "Alcanzar la luna comienza con un primer paso, ¡gracias por darlo cada día!"
    ];
    const frase = frases[Math.floor(Math.random() * frases.length)];
    res.json({ nombre, frase });
  } catch (err) {
    res.status(500).json({ nombre: "Equipo administrativo", frase: "Bienvenido", error: err.message });
  }
});

// Login simple
app.post("/login", async (req, res) => {
  const { usuario, contrasena } = req.body;
  try {
    if (usuario === "admin" && contrasena === "1234") {
      req.session.usuario = usuario;
      req.session.ultimoLead = Date.now();
      return res.json({ success: true, destino: "/inicio.html" });
    }

    const usuarioDB = await User.findOne({ usuario });
    if (!usuarioDB || !bcrypt.compareSync(contrasena, usuarioDB.contrasena)) {
      return res.json({ success: false, error: "Usuario o contraseña incorrectos" });
    }

    req.session.usuario = usuarioDB.usuario;
    req.session.ultimoLead = Date.now();
    return res.json({ success: true, destino: "/inicio.html" });
  } catch (err) {
    return res.json({ success: false, error: "Error interno" });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
