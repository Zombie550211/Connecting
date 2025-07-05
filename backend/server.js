require('dotenv').config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const multer = require('multer');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const upload = multer({ dest: 'uploads/' });
const cors = require("cors");

const Lead = require('./models/lead');
const Costumer = require('./models/costumer');
const Facturacion = require('./models/Facturacion');
const User = require('./models/user');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) throw new Error("La variable de entorno MONGO_URL no está definida.");

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

  // --- Endpoint público para consultar leads (SOLO LECTURA) ---
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await Lead.find().lean();
    res.json(leads);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5500",
    "https://crm-dashboard-1234.netlify.app",
    "https://crm-dashboard-xyz.vercel.app"
  ],
  credentials: true
}));

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
app.use(session({
  secret: "secreto_crm_conectado",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URL })
}));
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

// ====================== LEAD =========================
app.post('/api/leads/import', protegerRuta, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No se subió ningún archivo." });
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const mapped = rows.filter(row =>
      row.equipo || row.team || row.agente || row.agent || row.producto || row.puntaje || row.cuenta || row.direccion || row.telefono || row.zip
    ).map(row => ({
      fecha: row.fecha ? row.fecha.toString().slice(0, 10) : getFechaLocalHoy(),
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
    if (err.code === 11000) {
      res.status(400).json({ success: false, error: "Ya existe un registro idéntico. No se puede duplicar." });
    } else {
      res.status(500).json({ success: false, error: "Error al guardar el lead/costumer: " + err.message });
    }
  }
});
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

// ====================== COSTUMER =========================
app.post("/api/costumer", protegerRuta, async (req, res) => {
  try {
    const { fecha, team, agent, producto, puntaje, cuenta, telefono, direccion, zip, estado } = req.body;
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
      estado: estado || "Pending",
      puntaje: Number(puntaje) || 0,
      cuenta: cuenta || '',
      direccion: direccion || '',
      zip: zip || ''
    };
    await Costumer.create(nuevoCostumer);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ success: false, error: "Ya existe un costumer idéntico. No se puede duplicar." });
    } else {
      res.status(500).json({ success: false, error: err.message });
    }
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
app.put("/api/costumer/:id", protegerRuta, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!estado) return res.status(400).json({ success: false, error: "El campo 'estado' es requerido." });
    const updated = await Costumer.findByIdAndUpdate(id, { estado }, { new: true });
    if (!updated) return res.status(404).json({ success: false, error: "Costumer no encontrado." });
    res.json({ success: true, costumer: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete("/api/costumer/:id", protegerRuta, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Costumer.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, error: "Costumer no encontrado." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------- KPIs ---------
app.get('/api/ventas/hoy', protegerRuta, async (req, res) => {
  try {
    const hoy = new Date();
    const [month, day, year] = hoy.toLocaleDateString('es-SV', { timeZone: 'America/El_Salvador' }).split('/');
    const fechaHoy = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const total = await Costumer.countDocuments({ fecha: fechaHoy });
    res.json({ total });
  } catch (err) {
    res.status(500).json({ total: 0, error: err.message });
  }
});
app.get('/api/leads/pendientes', protegerRuta, async (req, res) => {
  try {
    const total = await Costumer.countDocuments({ estado: 'Pending' });
    res.json({ total });
  } catch (err) {
    res.status(500).json({ total: 0, error: err.message });
  }
});
app.get('/api/clientes', protegerRuta, async (req, res) => {
  try {
    const total = await Costumer.countDocuments();
    res.json({ total });
  } catch (err) {
    res.status(500).json({ total: 0, error: err.message });
  }
});
app.get('/api/ventas/mes', protegerRuta, async (req, res) => {
  try {
    const hoy = new Date();
    const [month, day, year] = hoy.toLocaleDateString('es-SV', { timeZone: 'America/El_Salvador' }).split('/');
    const inicioMes = `${year}-${month.padStart(2, '0')}-01`;
    const finMesDate = new Date(year, parseInt(month), 0);
    const finMes = `${year}-${month.padStart(2, '0')}-${String(finMesDate.getDate()).padStart(2, '0')}`;
    const total = await Costumer.countDocuments({
      fecha: { $gte: inicioMes, $lte: finMes }
    });
    res.json({ total });
  } catch (err) {
    res.status(500).json({ total: 0, error: err.message });
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

    data.forEach(doc => {
      let mes = null;
      if (doc.fecha) {
        // dd/mm/yyyy o dd-mm-yyyy
        let match = doc.fecha.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
        if (match) mes = parseInt(match[2], 10);
        // yyyy-mm-dd o yyyy/mm/dd
        match = doc.fecha.match(/^(\d{4})[\/-](\d{2})[\/-](\d{2})$/);
        if (match) mes = parseInt(match[2], 10);
        // mm/dd/yyyy o mm-dd-yyyy
        match = doc.fecha.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
        if (match && mes === null) mes = parseInt(match[1], 10);
      }
      if (!isNaN(mes) && mes >= 1 && mes <= 12) {
        // Asegura número (aunque el campo sea string)
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


// --------- DASHBOARD, RANKINGS ---------
function aliasAgente(nombre) {
  const n = (nombre || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["estefany garcia", "evelyn garcia"].includes(n)) return "Evelyn/Estefany Garcia";
  return nombre;
}

app.get('/api/ranking-equipos', protegerRuta, async (req, res) => {
  try {
    const { mes, anio } = req.query;
    let matchStage = {};
    if (mes !== undefined && anio !== undefined) {
      const filtroFecha = getRangoMes(Number(mes), Number(anio));
      if (filtroFecha) matchStage.fecha = filtroFecha;
    }
    const equipos = await Costumer.aggregate([
      { $match: matchStage },
      { $group: { _id: "$equipo", ventas: { $sum: 1 } } },
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
    const docs = await Costumer.find(match, { agente: 1 }).lean();
    const ranking = {};
    for (const venta of docs) {
      const nombreAgente = aliasAgente(venta.agente || "Sin nombre");
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
    const docs = await Costumer.find(match, { agente: 1, puntaje: 1 }).lean();
    const ranking = {};
    for (const venta of docs) {
      const nombreAgente = aliasAgente(venta.agente || "Sin nombre");
      if (!ranking[nombreAgente]) ranking[nombreAgente] = { nombre: nombreAgente, puntos: 0 };
      ranking[nombreAgente].puntos += Number(venta.puntaje) || 0;
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

// --------- COSTUMER EXPORT/IMPORT ---------
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
      Estado: c.estado || '',
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

// =================== AGENTE ===================
app.post('/agente/login', async (req, res) => {
  const { user, pass } = req.body;
  const usuarioDB = await User.findOne({ usuario: user });
  if (!usuarioDB) return res.json({ success: false });
  const match = await bcrypt.compare(pass, usuarioDB.password);
  if (!match) return res.json({ success: false });
  req.session.agente = usuarioDB.usuario;
  req.session.nombreAgente = `${usuarioDB.nombre} ${usuarioDB.apellido}`;
  res.json({ success: true });
});
app.get('/agente/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/agente/login.html'));
});
app.get('/api/agente/info', protegerAgente, (req, res) => {
  res.json({ nombre: req.session.agente, nombreCompleto: req.session.nombreAgente });
});
app.post('/api/agente/leads', protegerAgente, async (req, res) => {
  try {
    const { fecha, team, producto, puntaje, telefono, direccion, zip } = req.body;
    const agente = req.session.nombreAgente || req.session.agente;
    if (!producto || !agente) return res.json({ success: false, error: "Faltan datos" });
    const nuevoLead = {
      fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : getFechaLocalHoy(),
      equipo: team || '',
      agente: agente,
      producto,
      puntaje: Number(puntaje) || 0,
      telefono: telefono || '',
      direccion: direccion || '',
      zip: zip || ''
    };
    await Lead.create(nuevoLead);
    await Costumer.create(nuevoLead);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: "Error al guardar: "+err.message });
  }
});
app.get('/api/agente/estadisticas-mes', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    const year = new Date().getFullYear();
    const docs = await Costumer.find({
      agente,
      fecha: { $gte: `${year}-01-01`, $lte: `${year}-12-31` }
    }).lean();
    const ventasPorMes = Array(12).fill(0), puntajePorMes = Array(12).fill(0);
    docs.forEach(doc => {
      const [yyyy, mm] = doc.fecha.split('-');
      const idx = parseInt(mm, 10) - 1;
      ventasPorMes[idx]++;
      puntajePorMes[idx] += Number(doc.puntaje) || 0;
    });
    res.json({ ventasPorMes, puntajePorMes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/agente/ventas-producto', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    const docs = await Costumer.find({ agente }).lean();
    const ventasPorProducto = {};
    docs.forEach(row => {
      const producto = row.producto || "";
      if (!producto) return;
      ventasPorProducto[producto] = (ventasPorProducto[producto] || 0) + 1;
    });
    const labels = Object.keys(ventasPorProducto);
    const dataArr = labels.map(k => ventasPorProducto[k]);
    res.json({ labels, data: dataArr });
  } catch (err) {
    res.status(500).json({ labels:[], data:[] });
  }
});
app.get('/api/agente/costumer-metricas', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    const hoy = getFechaLocalHoy();
    const [yyyy, mm] = hoy.split('-');
    const inicioMes = `${yyyy}-${mm}-01`;
    const finMes = `${yyyy}-${mm}-31`;
    const filtros = { agente };
    if (req.query.fechaDesde) filtros.fecha = { ...filtros.fecha, $gte: req.query.fechaDesde };
    if (req.query.fechaHasta) filtros.fecha = { ...filtros.fecha, $lte: req.query.fechaHasta };
    if (req.query.team) filtros.equipo = req.query.team;
    if (req.query.numero) filtros.telefono = new RegExp(req.query.numero, "i");
    if (req.query.direccion) filtros.direccion = new RegExp(req.query.direccion, "i");
    if (req.query.zip) filtros.zip = new RegExp(req.query.zip, "i");

    const [ventasHoy, leadsPendientes, clientes, ventasMes] = await Promise.all([
      Costumer.countDocuments({ ...filtros, fecha: hoy }),
      Costumer.countDocuments({ ...filtros, estado: 'Pending' }),
      Costumer.countDocuments(filtros),
      Costumer.countDocuments({ ...filtros, fecha: { $gte: inicioMes, $lte: finMes } }),
    ]);
    res.json({ ventasHoy, leadsPendientes, clientes, ventasMes });
  } catch (err) {
    res.status(500).json({ ventasHoy:0, leadsPendientes:0, clientes:0, ventasMes:0, error:err.message });
  }
});
app.get('/api/agente/costumer', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    const filtros = { agente };
    if (req.query.fechaDesde) filtros.fecha = { ...filtros.fecha, $gte: req.query.fechaDesde };
    if (req.query.fechaHasta) filtros.fecha = { ...filtros.fecha, $lte: req.query.fechaHasta };
    if (req.query.team) filtros.equipo = req.query.team;
    if (req.query.numero) filtros.telefono = new RegExp(req.query.numero, "i");
    if (req.query.direccion) filtros.direccion = new RegExp(req.query.direccion, "i");
    if (req.query.zip) filtros.zip = new RegExp(req.query.zip, "i");

    const costumers = await Costumer.find(filtros).sort({ fecha: -1 }).lean();
    res.json({ costumers });
  } catch (err) {
    res.status(500).json({ costumers: [], error: err.message });
  }
});
app.get('/api/agente/costumer/:id', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    const costumer = await Costumer.findOne({ _id: req.params.id, agente }).lean();
    if (!costumer) return res.status(404).json({ error: "No encontrado" });
    res.json(costumer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put('/api/agente/costumer/:id', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    const update = { ...req.body };
    delete update._id;
    const updated = await Costumer.findOneAndUpdate(
      { _id: req.params.id, agente },
      update,
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: "No encontrado" });
    res.json({ success: true, costumer: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/agente/costumer/:id', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    const deleted = await Costumer.findOneAndDelete({ _id: req.params.id, agente });
    if (!deleted) return res.status(404).json({ success: false, error: "No encontrado" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/agente/costumer-eliminar-todo', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    await Costumer.deleteMany({ agente });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/agente/teams', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    const teams = await Costumer.distinct('equipo', { agente });
    res.json(teams.filter(Boolean));
  } catch (err) {
    res.status(500).json([]);
  }
});
app.get('/api/agente/costumer-excel', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    const filtros = { agente };
    if (req.query.fechaDesde) filtros.fecha = { ...filtros.fecha, $gte: req.query.fechaDesde };
    if (req.query.fechaHasta) filtros.fecha = { ...filtros.fecha, $lte: req.query.fechaHasta };
    if (req.query.team) filtros.equipo = req.query.team;
    if (req.query.numero) filtros.telefono = new RegExp(req.query.numero, "i");
    if (req.query.direccion) filtros.direccion = new RegExp(req.query.direccion, "i");
    if (req.query.zip) filtros.zip = new RegExp(req.query.zip, "i");

    const costumers = await Costumer.find(filtros).lean();
    const excelData = costumers.map(c => ({
      Fecha: c.fecha || '',
      Team: c.equipo || '',
      Agente: c.agente || '',
      Producto: c.producto || '',
      Estado: c.estado || '',
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
app.post('/api/agente/costumer-import', protegerAgente, upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No se subió ningún archivo." });
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const agente = req.session.nombreAgente || req.session.agente;
    const mapped = rows.filter(row =>
      row.equipo || row.team || row.agente || row.producto || row.puntaje || row.cuenta || row.direccion || row.telefono || row.zip
    ).map(row => ({
      fecha: row.fecha ? row.fecha.toString().slice(0, 10) : getFechaLocalHoy(),
      equipo: row.equipo || row.team || "",
      agente: agente,
      producto: row.producto || "",
      estado: row.estado || "Pending",
      puntaje: Number(row.puntaje) || 0,
      cuenta: row.cuenta || "",
      telefono: row.telefono || "",
      direccion: row.direccion || "",
      zip: row.zip || ""
    }));

    if (mapped.length) await Costumer.insertMany(mapped);
    fs.unlinkSync(filePath);
    res.json({ success: true, count: mapped.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------- LISTEN ---------
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});