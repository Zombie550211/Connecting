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

const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) throw new Error("La variable de entorno MONGO_URL no está definida.");

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

// Elimina el índice único en user_id de la colección de sesiones si existe
mongoose.connection.once('open', async () => {
  try {
    await mongoose.connection.db.collection('sessions').dropIndex('user_id_1');
    console.log('Índice único user_id_1 eliminado de la colección sessions');
  } catch (err) {
    if (err.codeName === 'IndexNotFound') {
      console.log('El índice user_id_1 no existe en sessions, no es necesario eliminarlo.');
    } else {
      console.log('Error al eliminar el índice user_id_1:', err.message);
    }
  }
});

// --- Endpoint temporal para pruebas sin autenticación ---
app.get('/api/test-graficas', async (req, res) => {
  try {
    const registros = await CrmAgente.find({}).limit(5).lean();
    console.log(`📊 Total de registros en crm_agente: ${await CrmAgente.countDocuments()}`);
    res.json({
      ok: true,
      totalRegistros: await CrmAgente.countDocuments(),
      ejemploRegistro: registros[0] || {},
      colecciones: await mongoose.connection.db.listCollections().toArray()
    });
  } catch (error) {
    console.error('Error en /api/test-graficas:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// --- Endpoint público para consultar leads (SOLO LECTURA) ---

// Configuración de CORS simplificada para producción

// Configuración básica de CORS para desarrollo
const corsOptions = {
  origin: isProduction ? 'https://crm-connecting.onrender.com' : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['set-cookie'],
  maxAge: 600 // Tiempo de caché para las respuestas preflight
};

// Aplicar CORS con las opciones configuradas
app.use(cors(corsOptions));

// Manejar preflight OPTIONS para todas las rutas
app.options('*', cors(corsOptions));

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
    return res.status(401).json({ success: false, error: "Sesión expirada o no autenticado" });
  }
  return res.redirect("/login.html");
}
function protegerAgente(req, res, next) {
  if (req.session && req.session.agente) return next();
  return res.redirect('/agente/login.html');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Configuración mejorada de la sesión
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "secreto_crm_conectado_seguro_123",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URL,
    ttl: 24 * 60 * 60, // 1 día de duración de la sesión
    autoRemove: 'native',
    touchAfter: 24 * 3600,
    collectionName: 'sessions',
    stringify: false,
    autoRemove: 'interval',
    autoRemoveInterval: 60 // Eliminar sesiones expiradas cada hora
  }),
  name: 'crm.session',
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 día
    httpOnly: true,
    secure: isProduction, // true en producción para HTTPS
    sameSite: isProduction ? 'none' : 'lax',
    domain: isProduction ? '.crm-connecting.onrender.com' : undefined,
    path: '/',
    // Para desarrollo, permitir el acceso desde localhost
    ...(!isProduction && {
      domain: 'localhost',
      sameSite: 'lax',
      secure: false
    })
  },
  rolling: true,
  proxy: isProduction, // Importante para confiar en proxies en producción (como Render, Heroku, etc.)
  unset: 'destroy' // Destruir la sesión cuando se cierra el navegador
};

app.use(session(sessionConfig));
app.use(express.static(path.join(__dirname, 'public')));

// ------------- Rutas HTML protegidas ----------------
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

// ------------ LOGIN / REGISTER / LOGOUT -------------
app.post("/login", async (req, res) => {
  const { usuario, contrasena } = req.body;
  try {
    if (usuario === "admin" && contrasena === "1234") {
      req.session.usuario = usuario;
      req.session.ultimoLead = Date.now();
      return res.json({ success: true, destino: "/inicio.html" });
    }
    const usuarioDB = await User.findOne({ usuario });
    if (!usuarioDB) return res.json({ success: false });

    const match = await bcrypt.compare(contrasena, usuarioDB.password);
    if (!match) return res.json({ success: false });

    req.session.usuario = usuarioDB.usuario;
    req.session.ultimoLead = Date.now();
    return res.json({ success: true, destino: "/inicio.html" });
  } catch (err) {
    return res.json({ success: false, error: "Error interno" });
  }
});
app.post('/register', async (req, res) => {
  try {
    const { usuario, email, contrasena, nombre, apellido } = req.body;
    if (!usuario || !email || !contrasena || !nombre || !apellido)
      return res.json({ success: false, message: "Todos los campos son obligatorios." });

    const existe = await User.findOne({ $or: [ { usuario }, { correo: email } ] });
    if (existe) return res.json({ success: false, message: "Usuario o correo ya registrado." });

    const hash = await bcrypt.hash(contrasena, 10);
    const nuevoUsuario = await User.create({
      usuario,
      correo: email,
      password: hash,
      nombre,
      apellido
    });

    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.CRM_GMAIL_USER,
        pass: process.env.CRM_GMAIL_PASS
      }
    });
    let mailOptions = {
      from: '"CRM Agentes" <' + process.env.CRM_GMAIL_USER + '>',
      to: email,
      subject: 'Bienvenido a CRM Agentes',
      html: `<h2>Bienvenido ${nombre} ${apellido}, estas son tus credenciales para tu crm-personal.</h2>
             <p><b>Usuario:</b> ${usuario}</p>
             <p><b>Contraseña:</b> ${contrasena}</p>
             <p>Ingresa a tu crm y navega dentro de tu perfil personal de ventas! Que tengas un excelente día.</p>
             <br>
             <p style="color:gray;font-size:13px;">No respondas a este correo. Si no solicitaste esta cuenta, ignora este mensaje.</p>`
    };
    try { await transporter.sendMail(mailOptions); }
    catch (e) { return res.json({ success: true, message: "Usuario creado, pero no se pudo enviar el correo." }); }

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

// ====================== COSTUMER =========================
// ✨ API COSTUMER - CONECTADA A COLECCIÓN COSTUMERS ✨
const Costumer = require('./models/costumer');

app.get("/api/costumer", protegerRuta, async (req, res) => {
  try {
    console.log('🚀 API COSTUMER - Conectando a colección costumers...');
    console.log('🔍 Usuario autenticado:', req.session.usuario ? 'SÍ' : 'NO');
    
    // Consulta a la colección costumers
    console.log('📊 Consultando colección costumers...');
    const costumers = await Costumer.find({}).sort({ fecha: -1 }).lean();
    console.log('📋 Registros encontrados en costumers:', costumers.length);
    
    // Mapear los costumers al formato esperado por el frontend
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
    console.error('❌ Error en API costumer:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      costumers: []
    });
  }
});

// ======================= FACTURACION =======================
// Normaliza los documentos para que siempre tengan el campo 'campos' (array de 15)
function normalizeFacturacionDoc(doc) {
  if (Array.isArray(doc.campos) && doc.campos.length === 15) return doc;
  const campos = [];
  campos[0]  = doc.fecha || ""; // FECHA lo ponemos por compatibilidad
  campos[1]  = doc.alexis || "";
  campos[2]  = doc.ventasPorDia || "";
  campos[3]  = doc.valorDeVenta || "";
  campos[4]  = doc.cuentaAlterna || "";
  campos[5]  = doc.ventasPorDiaAlterna || "";
  campos[6]  = doc.valorDeVentaAlterna || "";
  campos[7]  = doc.lineas || "";
  campos[8]  = doc.ventasPorDiaLineas || "";
  campos[9]  = doc.valorDeVentaLineas || "";
  campos[10] = doc.totalDelDia || "";
  campos[11] = doc.totalVentas || "";
  campos[12] = doc.valorVenta || "";
  campos[13] = doc.puntos || "";
  campos[14] = doc.cpaPuntos || "";
  return { ...doc, campos };
}

// GET por MES (robusto)
app.get('/api/facturacion/:ano/:mes', protegerRuta, async (req, res) => {
  const { ano, mes } = req.params;
  try {
    const regexes = [
      new RegExp(`^\\d{2}[/-]${mes}[/-]${ano}$`),       // 01/07/2025 o 01-07-2025
      new RegExp(`^${ano}[/-]${mes}[/-]\\d{2}$`),       // 2025-07-01 o 2025/07/01
      new RegExp(`^${mes}[/-]\\d{2}[/-]${ano}$`),       // 07-01-2025 o 07/01/2025
    ];
    let data = await Facturacion.find({
      $or: regexes.map(r => ({ fecha: { $regex: r } }))
    }).lean();
    data = data.map(doc => normalizeFacturacionDoc(doc));
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET ANUAL (robusto, acepta cualquier formato de fecha y asegura tipo número)
app.get('/api/facturacion/anual/:ano', protegerRuta, async (req, res) => {
  const { ano } = req.params;
  try {
    // Obtenemos TODOS los docs de ese año, sin importar el formato
    const regexes = [
      new RegExp(`${ano}`), // cualquier fecha que contenga el año
    ];
    let data = await Facturacion.find({
      fecha: { $regex: regexes[0] }
    }).lean();
    data = data.map(doc => normalizeFacturacionDoc(doc));
    const totalesPorMes = Array(12).fill(0);

    // --------- MODIFICACION ROBUSTA DE EXTRACCION DE MES ---------
    data.forEach(doc => {
      let mes = null;
      if (doc.fecha) {
        let f = doc.fecha.trim();
        // dd/mm/yyyy o dd-mm-yyyy
        let match = f.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
        if (match) mes = parseInt(match[2], 10);
        // yyyy-mm-dd o yyyy/mm/dd
        match = f.match(/^(\d{4})[\/-](\d{2})[\/-](\d{2})$/);
        if (match) mes = parseInt(match[2], 10);
        // mm/dd/yyyy o mm-dd-yyyy (solo si no lo encontró antes)
        if (mes === null) {
          match = f.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
          if (match) mes = parseInt(match[1], 10);
        }
      }
      if (!isNaN(mes) && mes >= 1 && mes <= 12) {
        const totalDia = Number(doc.campos[10]) || 0;
        totalesPorMes[mes - 1] += totalDia;
      }
    });

    // ¡Asegura que el array es solo números!
    for (let i = 0; i < totalesPorMes.length; i++) {
      totalesPorMes[i] = Number(totalesPorMes[i]) || 0;
    }

    res.json({ ok: true, totalesPorMes, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST para GUARDAR/ACTUALIZAR FACTURACION de un día
app.post('/api/facturacion', protegerRuta, async (req, res) => {
  try {
    const { fecha, campos } = req.body;
    if (!fecha || !Array.isArray(campos) || campos.length !== 15) {
      return res.status(400).json({ ok: false, error: "Datos inválidos para facturación." });
    }
    // upsert (update si existe, insert si no)
    const result = await Facturacion.findOneAndUpdate(
      { fecha },
      { fecha, campos },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Utilidad para rango de fechas por mes y año (para el filtro)
function getRangoMes(mes, anio) {
  mes = Number(mes);
  anio = Number(anio);
  if (isNaN(mes) || isNaN(anio)) return null;
  const mesStr = String(mes + 1).padStart(2, '0');
  const inicio = `${anio}-${mesStr}-01`;
  const finDate = new Date(anio, mes + 1, 0);
  const fin = `${anio}-${mesStr}-${String(finDate.getDate()).padStart(2, '0')}`;
  return { $gte: inicio, $lte: fin };
}

// Endpoint para verificar la autenticación desde el frontend
app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ ok: true, user: req.session.user });
  } else {
    res.status(401).json({ ok: false, error: 'No autenticado' });
  }
});

// --------- DASHBOARD, RANKINGS ---------
function aliasAgente(nombre) {
  const n = (nombre || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["estefany garcia", "evelyn garcia"].includes(n)) return "Evelyn/Estefany Garcia";
  return nombre;
}

// Endpoint para obtener datos para las gráficas de la pestaña lead
app.get('/api/graficas', protegerRuta, async (req, res) => {
  try {
    const { fecha } = req.query;
    console.log('🔍 Solicitando datos para gráficas con fecha:', fecha || 'sin fecha (todos los registros)');
    
    // Validar formato de fecha (opcional)
    let fechaFiltro = {};
    if (fecha) {
      // Asumimos que la fecha viene en formato YYYY-MM-DD
      const fechaObj = new Date(fecha);
      if (isNaN(fechaObj.getTime())) {
        console.error('❌ Formato de fecha inválido:', fecha);
        return res.status(400).json({ ok: false, error: 'Formato de fecha inválido. Usar YYYY-MM-DD' });
      }
      const dia = String(fechaObj.getDate()).padStart(2, '0');
      const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const anio = fechaObj.getFullYear();
      
      // Buscar en cualquier formato de fecha que coincida con el día/mes/año
      fechaFiltro = {
        $or: [
          { dia_venta: { $regex: `${dia}/${mes}/${anio}$` } }, // DD/MM/YYYY
          { dia_venta: { $regex: `${anio}-${mes}-${dia}` } }, // YYYY-MM-DD
          { dia_venta: { $regex: `${mes}/${dia}/${anio}` } }  // MM/DD/YYYY
        ]
      };
      console.log('🔍 Filtro de fecha aplicado:', JSON.stringify(fechaFiltro, null, 2));
    }

    // Obtener todos los registros de crm_agente que coincidan con el filtro de fecha
    console.log('🔍 Buscando registros con filtro:', JSON.stringify(fechaFiltro, null, 2));
    const registros = await CrmAgente.find(fechaFiltro).lean();
    console.log(`📊 Total de registros encontrados: ${registros.length}`);
    
    if (registros.length > 0) {
      console.log('📝 Primer registro como ejemplo:', JSON.stringify(registros[0], null, 2));
    } else {
      console.log('⚠️ No se encontraron registros con el filtro aplicado');
    }

    // Inicializar objetos para almacenar los resultados
    const ventasPorEquipo = {};
    const puntosPorEquipo = {};
    const ventasPorProducto = {};

    // Procesar cada registro
    registros.forEach(registro => {
      const { team, tipo_servicios, puntaje } = registro;
      
      // Validar que el equipo exista y tenga un valor
      if (team && team.trim()) {
        // Inicializar contadores para el equipo si no existen
        if (!ventasPorEquipo[team]) ventasPorEquipo[team] = 0;
        if (!puntosPorEquipo[team]) puntosPorEquipo[team] = 0;
        
        // Contar ventas por equipo (cada registro es una venta)
        ventasPorEquipo[team]++;
        
        // Sumar puntaje por equipo
        if (typeof puntaje === 'number' && !isNaN(puntaje)) {
          puntosPorEquipo[team] += puntaje;
        }
      }

      // Procesar tipo de servicio para la gráfica de productos
      if (tipo_servicios && tipo_servicios.trim()) {
        const producto = tipo_servicios.trim();
        if (!ventasPorProducto[producto]) {
          ventasPorProducto[producto] = 0;
        }
        ventasPorProducto[producto]++;
      }
    });

    // Devolver los datos en el formato esperado por el frontend
    res.json({
      ok: true,
      ventasPorEquipo,
      puntosPorEquipo,
      ventasPorProducto
    });

  } catch (error) {
    console.error('Error en /api/graficas:', error);
    res.status(500).json({ ok: false, error: 'Error al obtener datos para las gráficas' });
  }
});

app.get('/api/ranking-equipos', protegerRuta, async (req, res) => {
  try {
    const { mes, anio } = req.query;
    let matchStage = {};
    if (mes !== undefined && anio !== undefined) {
      const filtroFecha = getRangoMes(Number(mes), Number(anio));
      if (filtroFecha) matchStage.fecha = filtroFecha;
    }
    const equipos = await Facturacion.aggregate([
      { $match: matchStage },
      { $group: { _id: "$campos[1]", ventas: { $sum: 1 } } },
      { $sort: { ventas: -1 } }
    ]);
    res.json(equipos.map((e, idx) => ({
      nombre: e._id || "Sin equipo",
      ventas: e.ventas,
      posicion: idx + 1
    })));
  } catch (err) {
    res.status(500).json([]);
  }
});

app.get('/api/ranking-agentes', protegerRuta, async (req, res) => {
  try {
    const { mes, anio } = req.query;
    let match = {};
    if (mes !== undefined && anio !== undefined) {
      const filtroFecha = getRangoMes(Number(mes), Number(anio));
      if (filtroFecha) match.fecha = filtroFecha;
    }
    const docs = await Facturacion.find(match, { campos: 1 }).lean();
    const ranking = {};
    for (const venta of docs) {
      const nombreAgente = aliasAgente(venta.campos[1] || "Sin nombre");
      if (!ranking[nombreAgente]) ranking[nombreAgente] = { nombre: nombreAgente, ventas: 0 };
      ranking[nombreAgente].ventas += 1;
    }
    const resultado = Object.values(ranking).sort((a, b) => b.ventas - a.ventas);
    res.json(resultado);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.get('/api/ranking-puntos', protegerRuta, async (req, res) => {
  try {
    const { mes, anio } = req.query;
    let match = {};
    if (mes !== undefined && anio !== undefined) {
      const filtroFecha = getRangoMes(Number(mes), Number(anio));
      if (filtroFecha) match.fecha = filtroFecha;
    }
    const docs = await Facturacion.find(match, { campos: 1 }).lean();
    const ranking = {};
    for (const venta of docs) {
      const nombreAgente = aliasAgente(venta.campos[1] || "Sin nombre");
      if (!ranking[nombreAgente]) ranking[nombreAgente] = { nombre: nombreAgente, puntos: 0 };
      ranking[nombreAgente].puntos += Number(venta.campos[13]) || 0;
    }
    const resultado = Object.values(ranking)
      .sort((a, b) => b.puntos - a.puntos)
      .map(r => ({
        ...r,
        puntos: Number(r.puntos.toFixed(2))
      }));
    res.json(resultado);
  } catch (err) {
    res.status(500).json([]);
  }
});

// --------- WELCOME ---------
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

// Endpoint para obtener equipos de agentes (solo lectura)
app.get('/api/agente/teams', protegerAgente, async (req, res) => {
  try {
    // Obtener equipos únicos de la colección CrmAgente
    const teams = await CrmAgente.distinct('team', {});
    res.json(teams.filter(team => team)); // Filtra valores nulos o vacíos
  } catch (err) {
    console.error('Error al obtener equipos:', err);
    res.status(500).json([]);
  }
});


// --------- LISTEN ---------
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});