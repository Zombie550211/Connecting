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

// ================== LEADS =========================
// ... LOS ENDPOINTS DE LEADS QUEDAN IGUAL ...

// ====================== COSTUMER ENDPOINTS GLOBALES =========================
app.post("/api/costumer", protegerRuta, async (req, res) => {
  try {
    // Orden y campos exactamente como tu requeriste
    const {
      agente,
      nombre_cliente,
      telefono,
      telefono_alterno,
      numero_de_cuenta,
      autopaquete,
      direccion,
      tipo_de_serv,
      sistema,
      riesgo,
      dia_venta_a_instalacion,
      estado,
      servicios,
      mercado,
      supervisor,
      comentario,
      motivo_llamada,
      zip,
      puntaje
    } = req.body;

    if (!agente || !nombre_cliente || !telefono) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }

    const nuevoCostumer = {
      agente: nombreFinalAgente(agente),
      nombre_cliente,
      telefono,
      telefono_alterno,
      numero_de_cuenta,
      autopaquete,
      direccion,
      tipo_de_serv,
      sistema,
      riesgo,
      dia_venta_a_instalacion,
      estado: estado || "Pending",
      servicios,
      mercado,
      supervisor,
      comentario,
      motivo_llamada,
      zip,
      puntaje: Number(puntaje) || 0,
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
    // Puedes filtrar por lo que gustes, aquí básico:
    let costumers = await Costumer.find({}).sort({ _id: -1 }).lean();

    // Unifica alias antes de enviar la respuesta
    costumers = costumers.map(c => ({
      ...c,
      agente: nombreFinalAgente(c.agente)
    }));

    res.json({ costumers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Actualizar costumer por ID (todos los campos son editables)
app.put("/api/costumer/:id", protegerRuta, async (req, res) => {
  try {
    const { id } = req.params;
    // Todos los campos recibidos
    const updateData = { ...req.body };
    if (updateData.puntaje) updateData.puntaje = Number(updateData.puntaje);
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

// ==================== EXPORTAR COSTUMERS EN EL ORDEN Y NOMBRES DEL EXCEL ====================
app.get('/descargar/costumers', protegerRuta, async (req, res) => {
  try {
    let costumers = await Costumer.find({}).lean();

    // Unifica alias antes de enviar el Excel
    costumers = costumers.map(c => ({
      ...c,
      agente: nombreFinalAgente(c.agente)
    }));

    const excelData = costumers.map(c => ({
      "Agente": c.agente || "",
      "Nombre cliente": c.nombre_cliente || "",
      "Teléfono principal": c.telefono || "",
      "Teléfono Alterno": c.telefono_alterno || "",
      "Numero de cuenta": c.numero_de_cuenta || "",
      "Autopaquete": c.autopaquete || "",
      "Dirección": c.direccion || "",
      "Tipo de serv": c.tipo_de_serv || "",
      "Sistema": c.sistema || "",
      "Riesgo": c.riesgo || "",
      "Día de venta a de instalaci": c.dia_venta_a_instalacion || "",
      "Status": c.estado || "",
      "Servicios": c.servicios || "",
      "Mercado": c.mercado || "",
      "Supervisor": c.supervisor || "",
      "Comentario": c.comentario || "",
      "¿Por que llamo el cliente?": c.motivo_llamada || "",
      "ZIP CODE": c.zip || "",
      "PUNTAJE": c.puntaje || "",
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

// ==================== KPI Y DASHBOARD ENDPOINTS ====================
// ... LOS ENDPOINTS DE KPI Y DASHBOARD QUEDAN IGUAL ...

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});