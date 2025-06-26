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
exports.app = app;
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

// ========== ALIAS DE AGENTES ===============
const ALIAS_AGENTES = {
  "Evelyn Garcia": ["Evelyn Garcia", "Estefany Garcia"],
  // Agrega más alias aquí si es necesario
};
function nombreFinalAgente(nombre) {
  for (const [final, aliasArr] of Object.entries(ALIAS_AGENTES)) {
    if (aliasArr.map(a => a.toLowerCase().trim()).includes((nombre||"").toLowerCase().trim())) {
      return final;
    }
  }
  return nombre;
}
exports.nombreFinalAgente = nombreFinalAgente;
// ========== FIN ALIAS DE AGENTES ===========

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
exports.protegerRuta = protegerRuta;

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

// LOGIN: acepta admin fijo o usuarios de la base de datos
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
// ===================== PARTE 2/4 =====================
// Endpoints principales LEADS y COSTUMER, Importación y headers

// ================== DEFINICIÓN DE ENCABEZADOS COSTUMER =========================
const COSTUMER_HEADER = [
  "agente", "nombre_cliente", "telefono", "telefono_alterno", "numero_de_cuenta", "autopago",
  "direccion", "tipo_de_servicio","sistema","riesgo","dia_de_venta","dia_de_instalacion", "estado",
  "servicios", "mercado","Team","supervisor", "comentario", "motivo_de_llamada", "zip", "puntaje"
];
exports.COSTUMER_HEADER = COSTUMER_HEADER;

// ============ IMPORTAR COSTUMERS DESDE EXCEL ===============
app.post('/api/leads/import', protegerRuta, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No se subió ningún archivo." });
    }
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    // Validar encabezados mínimos
    const excelHeaders = Object.keys(rows[0] || {});
    const faltantes = COSTUMER_HEADER.filter(h => !excelHeaders.includes(h));
    if (faltantes.length) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, error: "El archivo Excel NO tiene todos los encabezados requeridos.", faltan: faltantes });
    }

    // Mapea todos los encabezados (los que falten quedan en "")
    const mapped = rows.map(row => {
      const obj = {};
      COSTUMER_HEADER.forEach(k => obj[k] = row[k] !== undefined ? row[k] : "");
      // Unificar nombre de agente si aplica
      obj.agente = nombreFinalAgente(obj.agente);
      return obj;
    });

    if (mapped.length) {
      await Costumer.insertMany(mapped);
    }
    fs.unlinkSync(filePath);
    res.json({ success: true, count: mapped.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================== CRUD COSTUMER =========================
app.post("/api/costumer", protegerRuta, async (req, res) => {
  try {
    const data = {};
    COSTUMER_HEADER.forEach(k => data[k] = req.body[k] || "");
    data.agente = nombreFinalAgente(data.agente);
    await Costumer.create(data);
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
    let costumers = await Costumer.find({}).sort({ _id: -1 }).lean();
    costumers = costumers.map(c => {
      let obj = {};
      COSTUMER_HEADER.forEach(k => obj[k] = c[k] || "");
      obj._id = c._id;
      return obj;
    });
    res.json({ costumers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/costumer/:id", protegerRuta, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {};
    COSTUMER_HEADER.forEach(k => {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) updateData[k] = req.body[k];
    });
    if (updateData.agente) updateData.agente = nombreFinalAgente(updateData.agente);

    const updated = await Costumer.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: "Costumer no encontrado." });
    }
    res.json({ success: true, costumer: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
// ===================== PARTE 3/4 =====================
// Descarga de Excel, endpoints KPI, summary y dashboard dinámico

// =============== DESCARGAR COSTUMERS A EXCEL ==================
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

    let costumers = await Costumer.find(query).lean();

    // Unifica alias antes de enviar el Excel
    costumers = costumers.map(c => ({
      ...c,
      agente: nombreFinalAgente(c.agente)
    }));

    const excelData = costumers.map(c => {
      let out = {};
      COSTUMER_HEADER.forEach(k => out[k] = c[k] || '');
      return out;
    });

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

// ==================== ENDPOINTS KPI PARA COSTUMER GLOBAL ====================
// KPI: Ventas Hoy
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

// KPI: Leads Pendientes
app.get('/api/leads/pendientes', protegerRuta, async (req, res) => {
  try {
    const total = await Costumer.countDocuments({ estado: 'Pending' });
    res.json({ total });
  } catch (err) {
    res.status(500).json({ total: 0, error: err.message });
  }
});

// KPI: Total Clientes
app.get('/api/clientes', protegerRuta, async (req, res) => {
  try {
    const total = await Costumer.countDocuments();
    res.json({ total });
  } catch (err) {
    res.status(500).json({ total: 0, error: err.message });
  }
});

// KPI: Ventas del Mes
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

// ===== NUEVO ENDPOINT SUMMARY PARA LOS 4 RECUADROS (FILTRABLE) =====
app.get('/api/costumer/summary', protegerRuta, async (req, res) => {
  try {
    const { from, to } = req.query;
    let filtroFechas = {};
    let fechaHoy = getFechaLocalHoy();

    if (from && to) {
      filtroFechas = { fecha: { $gte: from, $lte: to } };
    } else if (from) {
      filtroFechas = { fecha: { $gte: from } };
    } else if (to) {
      filtroFechas = { fecha: { $lte: to } };
    }

    // Ventas Hoy: si hay filtro de un solo día, toma ese día, si no, usa hoy
    let fechaParaVentasHoy = (from && to && from === to) ? from : fechaHoy;

    // Ventas Mes: si hay filtro, calcula el mes de "from" (o de hoy si no hay)
    let inicioMes, finMes;
    if (from) {
      const [yyyy, mm] = from.split('-');
      inicioMes = `${yyyy}-${mm}-01`;
      const finMesDate = new Date(yyyy, parseInt(mm), 0);
      finMes = `${yyyy}-${mm}-${String(finMesDate.getDate()).padStart(2, '0')}`;
    } else {
      const hoy = fechaHoy;
      const [yyyy, mm] = hoy.split('-');
      inicioMes = `${yyyy}-${mm}-01`;
      const finMesDate = new Date(yyyy, parseInt(mm), 0);
      finMes = `${yyyy}-${mm}-${String(finMesDate.getDate()).padStart(2, '0')}`;
    }

    const [ventasHoy, leadsPendientes, clientes, ventasMes] = await Promise.all([
      Costumer.countDocuments({ fecha: fechaParaVentasHoy }),
      Costumer.countDocuments({ ...filtroFechas, estado: 'Pending' }),
      Costumer.countDocuments(filtroFechas),
      Costumer.countDocuments({ fecha: { $gte: inicioMes, $lte: finMes } })
    ]);
    res.json({ ventasHoy, leadsPendientes, clientes, ventasMes });
  } catch (err) {
    res.status(500).json({ ventasHoy: 0, leadsPendientes: 0, clientes: 0, ventasMes: 0, error: err.message });
  }
});

// =============== ENDPOINTS DASHBOARD DINÁMICOS PARA ADMIN ===================

// PANEL DE BIENVENIDA (nombre y frase inspiradora)
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

// RANKING POR EQUIPO
app.get('/api/ranking-equipos', protegerRuta, async (req, res) => {
  try {
    const pipeline = [
      { $group: { _id: "$equipo", ventas: { $sum: 1 } } },
      { $sort: { ventas: -1 } }
    ];
    const equipos = await Costumer.aggregate(pipeline);
    const ventasTop = equipos.length ? equipos[0].ventas : 1;
    const resultado = equipos.map((eq, idx) => ({
      nombre: eq._id || "Sin equipo",
      ventas: eq.ventas,
      porc: Math.round((eq.ventas * 100) / ventasTop)
    }));
    res.json(resultado);
  } catch (err) {
    res.status(500).json([]);
  }
});

// RANKING POR AGENTE
app.get('/api/ranking-agentes', protegerRuta, async (req, res) => {
  try {
    const docs = await Costumer.find({}, { agente: 1, equipo: 1 }).lean();
    const ranking = {};
    for (const venta of docs) {
      const nombreAgente = nombreFinalAgente(venta.agente || "Sin nombre");
      const equipo = venta.equipo || "Sin equipo";
      if (!ranking[nombreAgente]) {
        ranking[nombreAgente] = { nombre: nombreAgente, equipo, ventas: 0, avatar: "" };
      }
      ranking[nombreAgente].ventas += 1;
    }
    const avatarPorNombre = nombre => {
      let base = nombre ? nombre.charCodeAt(0) + nombre.length : Math.floor(Math.random()*100);
      let url = base % 2 === 0
        ? `https://randomuser.me/api/portraits/men/${base % 100}.jpg`
        : `https://randomuser.me/api/portraits/women/${base % 100}.jpg`;
      return url;
    };
    const resultado = Object.values(ranking)
      .sort((a, b) => b.ventas - a.ventas)
      .map(r => ({
        ...r,
        avatar: avatarPorNombre(r.nombre)
      }));
    res.json(resultado);
  } catch (err) {
    res.status(500).json([]);
  }
});

// RANKING POR PUNTOS
app.get('/api/ranking-puntos', protegerRuta, async (req, res) => {
  try {
    const docs = await Costumer.find({}, { agente: 1, equipo: 1, puntaje: 1 }).lean();
    const ranking = {};
    for (const venta of docs) {
      const nombreAgente = nombreFinalAgente(venta.agente || "Sin nombre");
      const equipo = venta.equipo || "Sin equipo";
      if (!ranking[nombreAgente]) {
        ranking[nombreAgente] = { nombre: nombreAgente, equipo, puntos: 0 };
      }
      ranking[nombreAgente].puntos += Number(venta.puntaje) || 0;
    }
    const resultado = Object.values(ranking)
      .sort((a, b) => b.puntos - a.puntos)
      .map((r, idx) => ({
        ...r,
        puntos: Number(r.puntos.toFixed(2))
      }));
    res.json(resultado);
  } catch (err) {
    res.status(500).json([]);
  }
});

// ===================== PARTE 4/4 =====================
// Facturación, endpoints extra, cierre de servidor

// ==================== FACTURACIÓN ====================
// Aquí puedes mantener todos tus endpoints de facturación igual...
app.get('/api/facturacion', protegerRuta, async (req, res) => {
  try {
    const facturas = await Facturacion.find({}).lean();
    res.json({ facturas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Si tienes otros endpoints de facturación, agrégalos aquí:

// ==================== ENDPOINTS PARA GRÁFICAS DE LEADS ====================
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

// ==================== CRUD DE LEADS (OPCIONAL/LEGADO) ====================
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

// ==================== CIERRE DEL SERVIDOR ====================
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});