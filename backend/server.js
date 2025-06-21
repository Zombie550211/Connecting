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
if (!MONGO_URL) {
  throw new Error("La variable de entorno MONGO_URL no está definida.");
}

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

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

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// LOGIN: ahora acepta admin fijo o usuarios registrados en modelo User
app.post("/login", async (req, res) => {
  const { usuario, contrasena } = req.body;
  try {
    if (usuario === "admin" && contrasena === "1234") {
      req.session.usuario = usuario;
      req.session.ultimoLead = Date.now();
      return res.json({ success: true });
    }
    const usuarioDB = await User.findOne({ usuario });
    if (!usuarioDB) return res.json({ success: false });

    const match = await bcrypt.compare(contrasena, usuarioDB.password);
    if (!match) return res.json({ success: false });

    req.session.usuario = usuarioDB.usuario;
    req.session.ultimoLead = Date.now();
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: false, error: "Error interno" });
  }
});

// REGISTRO DE USUARIO NUEVO CON nombre, apellido, correo, usuario, password y correo de bienvenida
app.post('/register', async (req, res) => {
  try {
    const { usuario, email, contrasena, nombre, apellido } = req.body;
    if (!usuario || !email || !contrasena || !nombre || !apellido)
      return res.json({ success: false, message: "Todos los campos son obligatorios." });

    // Evita duplicados
    const existe = await User.findOne({ $or: [ { usuario }, { correo: email } ] });
    if (existe) return res.json({ success: false, message: "Usuario o correo ya registrado." });

    const hash = await bcrypt.hash(contrasena, 10);

    // Guarda en la BD
    const nuevoUsuario = await User.create({
      usuario,
      correo: email,
      password: hash,
      nombre,
      apellido
    });

    // ENVÍO DE CORREO DE BIENVENIDA
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

    try {
      await transporter.sendMail(mailOptions);
    } catch (e) {
      return res.json({ success: true, message: "Usuario creado, pero no se pudo enviar el correo." });
    }

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
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

// ------------------ Continúa en la PARTE 2 ------------------// ================== LEADS =========================

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
    if (err.code === 11000) {
      res.status(400).json({ success: false, error: "Ya existe un registro idéntico. No se puede duplicar." });
    } else {
      res.status(500).json({ success: false, error: "Error al guardar el lead/costumer: " + err.message });
    }
  }
});

// Gráficas leads global
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

// Descargar Excel de Costumers global
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

// ====================== COSTUMER ENDPOINTS GLOBALES =========================
// ...continúa PARTE 3...// ====================== COSTUMER ENDPOINTS GLOBALES =========================
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

// Actualizar solo el estado del costumer por ID
app.put("/api/costumer/:id", protegerRuta, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!estado) {
      return res.status(400).json({ success: false, error: "El campo 'estado' es requerido." });
    }
    const updated = await Costumer.findByIdAndUpdate(id, { estado }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: "Costumer no encontrado." });
    }
    res.json({ success: true, costumer: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Eliminar costumer global por ID
app.delete("/api/costumer/:id", protegerRuta, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Costumer.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Costumer no encontrado." });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== ENDPOINTS KPI PARA COSTUMER GLOBAL ====================
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
});// ==================== FACTURACIÓN ====================
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

app.get('/api/facturacion/estadistica/:ano/:mes', protegerRuta, async (req, res) => {
  const { ano, mes } = req.params;
  const regex = new RegExp(`^\\d{2}\\/${mes.padStart(2,'0')}\\/${ano}$`);
  const data = await Facturacion.find({ fecha: { $regex: regex } }).lean();
  const diasEnMes = new Date(parseInt(ano), parseInt(mes), 0).getDate();
  const totalesPorDia = Array(diasEnMes).fill(0);

  data.forEach(fila => {
    const dia = parseInt(fila.fecha.split('/')[0], 10) - 1;
    const totalDia = Number(fila.campos[9]) || 0;
    if (!isNaN(dia) && dia >= 0 && dia < totalesPorDia.length) {
      totalesPorDia[dia] = totalDia;
    }
  });

  res.json({ ok: true, totalesPorDia });
});

// === NUEVO ENDPOINT ANUAL PARA LA GRAFICA DE 12 BARRAS ===
app.get('/api/facturacion/anual/:ano', protegerRuta, async (req, res) => {
  const { ano } = req.params;
  const regex = new RegExp(`^\\d{2}/\\d{2}/${ano}$`);
  try {
    const data = await Facturacion.find({ fecha: { $regex: regex } }).lean();
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
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
});// --- ENDPOINTS DE AGENTE PARA COSTUMER Y LISTEN FINAL ---

// =================== INICIO ENDPOINTS DE AGENTE ===================

// Login de agente
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

// Logout de agente
app.get('/agente/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/agente/login.html'));
});

// Info del agente actual
app.get('/api/agente/info', protegerAgente, (req, res) => {
  res.json({ nombre: req.session.agente, nombreCompleto: req.session.nombreAgente });
});

// Guardar lead del agente (y costumer)
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

// Gráficas personales del agente
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

// ==================== COSTUMER AGENTE: KPIs, FILTROS, CRUD, EXCEL ====================

// KPIs/métricas de costumer del agente
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
});// Tabla con filtros (costumers del agente)
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

// Obtener costumer por ID (del agente)
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

// Editar costumer del agente
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

// Eliminar costumer por ID (solo del agente)
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

// Eliminar todos los costumers del agente
app.delete('/api/agente/costumer-eliminar-todo', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    await Costumer.deleteMany({ agente });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Exportar Excel de costumers del agente
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

// Importar costumers desde Excel (solo para el agente)
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

// Listar teams del agente
app.get('/api/agente/teams', protegerAgente, async (req, res) => {
  try {
    const agente = req.session.nombreAgente || req.session.agente;
    const teams = await Costumer.distinct('equipo', { agente });
    res.json(teams.filter(Boolean));
  } catch (err) {
    res.status(500).json([]);
  }
});

// =================== FIN ENDPOINTS DE AGENTE ===================

// LISTEN FINAL
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});