require('dotenv').config();

console.log("DEBUG MONGO_URL:", process.env.MONGO_URL);
const Lead = require('./models/lead');
const Costumer = require('./models/costumer');

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const app = express();
const PORT = process.env.PORT || 3000;

const EXCEL_FILE_PATH = path.join(__dirname, "leads.xlsx");
const COSTUMER_FILE_PATH = path.join(__dirname, "Costumer.xlsx");

const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
  throw new Error("La variable de entorno MONGO_URL no está definida. ¡Configúrala en Render!");
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

// === BLOQUE COSTUMER (100% MongoDB) ===

// Crear costumer
app.post("/api/costumer", async (req, res) => {
  try {
    const { team, agent, producto, puntaje, cuenta, telefono, direccion, zip } = req.body;
    if (!agent || !producto) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }
    const nuevoCostumer = {
      fecha: new Date().toISOString().slice(0, 10),
      equipo: team || '',
      agente: agent,
      telefono: telefono || '',
      producto,
      puntaje: Number(puntaje) || 0,
      cuenta: cuenta || '',
      direccion: direccion || '',
      zip: zip || ''
    };
    await Costumer.create(nuevoCostumer);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener todos los costumers
app.get("/api/costumer", async (req, res) => {
  try {
    const { fecha } = req.query;
    const query = {};
    if (fecha) query.fecha = { $regex: `^${fecha}` };
    const costumers = await Costumer.find(query).sort({ fecha: -1 }).lean();
    res.json({ costumers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Editar costumer (por _id)
app.put("/api/costumer/:id", async (req, res) => {
  try {
    const costumerId = req.params.id;
    const cambios = req.body;
    const resultado = await Costumer.findByIdAndUpdate(costumerId, cambios, { new: true });
    if (resultado) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: "No se encontró el costumer para editar" });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Eliminar costumer (por _id)
app.delete("/api/costumer/:id", async (req, res) => {
  try {
    const costumerId = req.params.id;
    const resultado = await Costumer.findByIdAndDelete(costumerId);
    if (resultado) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: "No se encontró el costumer para eliminar" });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Eliminar varios costumers por IDs
app.post('/api/costumer/delete-multiple', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "No se recibieron IDs." });
    }
    await Costumer.deleteMany({ _id: { $in: ids } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Importar costumer desde Excel con filtro de filas vacías
app.post('/api/costumer/import', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No se subió ningún archivo." });
    }
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // FILTRO de filas vacías: solo importa filas con algún dato relevante
    const mapped = rows
      .filter(row =>
        (row.equipo || row.team || row.agente || row.agent || row.producto || row.puntaje || row.cuenta || row.direccion || row.telefono || row.zip)
      )
      .map(row => ({
        fecha: row.fecha || new Date().toISOString().slice(0, 10),
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
    fs.unlinkSync(filePath); // Borra archivo temporal
    res.json({ success: true, count: mapped.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// == RESTO DE ENDPOINTS LEADS, GRÁFICAS, ETC. ==

// ENDPOINT PARA GUARDAR LEAD
app.post("/api/leads", async (req, res) => {
  try {
    const { team, agent, telefono, producto, puntaje, cuenta, direccion, zip } = req.body;

    if (!agent || !producto) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }

    const nuevoLead = {
      fecha: new Date().toISOString(),
      equipo: team || '',
      agente: agent,
      teléfono: telefono || '',
      producto,
      puntaje: puntaje || 0,
      cuenta: cuenta || '',
      direccion: direccion || '',
      zip: zip || ''
    };

    await Lead.create(nuevoLead);

    // Excel guardado si lo necesitas
    let workbook;
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      workbook = XLSX.readFile(EXCEL_FILE_PATH);
    } else {
      workbook = XLSX.utils.book_new();
    }

    const nombreHoja = new Date().toISOString().split("T")[0];
    let datos = [];
    if (workbook.Sheets[nombreHoja]) {
      datos = XLSX.utils.sheet_to_json(workbook.Sheets[nombreHoja], { defval: "" });
    }
    datos.push(nuevoLead);

    const encabezados = [
      "fecha",
      "equipo",
      "agente",
      "teléfono",
      "producto",
      "puntaje",
      "cuenta",
      "direccion",
      "zip"
    ];

    const nuevaHoja = XLSX.utils.json_to_sheet(datos, { header: encabezados });
    workbook.Sheets[nombreHoja] = nuevaHoja;
    if (!workbook.SheetNames.includes(nombreHoja)) {
      workbook.SheetNames.push(nombreHoja);
    }

    try {
      XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    } catch (err) {
      return res.status(500).json({ success: false, error: "No se pudo escribir en el archivo Excel." });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET leads
app.get("/api/leads", async (req, res) => {
  try {
    let leadsExcel = [];
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      const workbook = XLSX.readFile(EXCEL_FILE_PATH);
      workbook.SheetNames.forEach(nombreHoja => {
        const hoja = workbook.Sheets[nombreHoja];
        const datos = XLSX.utils.sheet_to_json(hoja, { defval: "" });
        leadsExcel = leadsExcel.concat(datos);
      });
      leadsExcel.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }

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
    res.status(500).json({ error: "No se pudieron cargar los leads." });
  }
});

// ENDPOINT GRAFICAS PARA LEADS (por fecha)
app.get("/api/graficas", (req, res) => {
  try {
    const fechaFiltro = req.query.fecha;
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
      if (fechaFiltro && nombreHoja !== fechaFiltro) return;

      const hoja = workbook.Sheets[nombreHoja];
      const datos = XLSX.utils.sheet_to_json(hoja, { defval: "" });

      datos.forEach(row => {
        const equipo = row.equipo || "";
        const producto = row.producto || "";
        const puntaje = row.puntaje || 0;

        if (!equipo || !producto) return;

        ventasPorEquipo[equipo] = (ventasPorEquipo[equipo] || 0) + 1;
        puntosPorEquipo[equipo] = Math.round(((puntosPorEquipo[equipo] || 0) + parseFloat(puntaje || 0)) * 100) / 100;
        ventasPorProducto[producto] = (ventasPorProducto[producto] || 0) + 1;
      });
    });

    res.json({ ventasPorEquipo, puntosPorEquipo, ventasPorProducto });
  } catch (error) {
    res.status(500).json({ error: "No se pudieron cargar los datos para gráficas." });
  }
});

// ELIMINAR LEAD (por fecha, numero y agente)
app.delete("/api/leads", async (req, res) => {
  const { fecha, numero, agente } = req.query;
  if (!fecha || !numero || !agente) {
    return res.status(400).json({ success: false, error: "Faltan parámetros para eliminar." });
  }

  let eliminadoMongo = false;
  let eliminadoExcel = false;
  let errores = [];

  try {
    const resultado = await Lead.deleteOne({
      fecha: { $regex: `^${fecha}` },
      teléfono: numero,
      agente: agente
    });
    eliminadoMongo = resultado.deletedCount > 0;
  } catch (err) {
    errores.push("Error MongoDB: " + err.message);
  }

  try {
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      const workbook = XLSX.readFile(EXCEL_FILE_PATH);
      let cambiado = false;
      workbook.SheetNames.forEach(nombreHoja => {
        let datos = XLSX.utils.sheet_to_json(workbook.Sheets[nombreHoja], { defval: "" });
        const antes = datos.length;
        datos = datos.filter(row =>
          !(row.fecha && row.fecha.startsWith(fecha) && row["teléfono"] === numero && row["agente"] === agente)
        );
        if (datos.length !== antes) {
          cambiado = true;
          const nuevaHoja = XLSX.utils.json_to_sheet(datos, {
            header: [
              "fecha",
              "equipo",
              "agente",
              "teléfono",
              "producto",
              "puntaje",
              "cuenta",
              "direccion",
              "zip"
            ]
          });
          workbook.Sheets[nombreHoja] = nuevaHoja;
        }
      });
      if (cambiado) XLSX.writeFile(workbook, EXCEL_FILE_PATH);
      eliminadoExcel = cambiado;
    }
  } catch (err) {
    errores.push("Error Excel: " + err.message);
  }

  if (eliminadoMongo || eliminadoExcel) {
    return res.json({ success: true });
  } else {
    return res.status(404).json({ success: false, error: errores.join("; ") || "No se encontró el lead" });
  }
});

// EDITAR LEAD (por fecha, numero y agente)
app.put("/api/leads", async (req, res) => {
  const { fecha, numero, agente } = req.query;
  const cambios = req.body;
  if (!fecha || !numero || !agente) {
    return res.status(400).json({ success: false, error: "Faltan parámetros para editar." });
  }

  let actualizadoMongo = false;
  let actualizadoExcel = false;
  let errores = [];

  try {
    const resultado = await Lead.updateOne(
      {
        fecha: { $regex: `^${fecha}` },
        teléfono: numero,
        agente: agente
      },
      {
        $set: {
          fecha: cambios["FECHA"] || fecha,
          equipo: cambios["EQUIPO"] || "",
          agente: cambios["AGENTE"] || "",
          teléfono: cambios["NÚMERO"] || "",
          producto: cambios["PRODUCTO"] || "",
          puntaje: cambios["PUNTAJE"] || 0,
          cuenta: cambios["CUENTA"] || "",
          direccion: cambios["DIRECCION"] || "",
          zip: cambios["ZIP"] || ""
        }
      }
    );
    actualizadoMongo = resultado.modifiedCount > 0;
  } catch (err) {
    errores.push("Error MongoDB: " + err.message);
  }

  try {
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      const workbook = XLSX.readFile(EXCEL_FILE_PATH);
      let cambiado = false;
      workbook.SheetNames.forEach(nombreHoja => {
        let datos = XLSX.utils.sheet_to_json(workbook.Sheets[nombreHoja], { defval: "" });
        let modificado = false;
        datos = datos.map(row => {
          if (row.fecha && row.fecha.startsWith(fecha) && row["teléfono"] === numero && row["agente"] === agente) {
            modificado = true;
            return {
              ...row,
              fecha: cambios["FECHA"] || row.fecha,
              equipo: cambios["EQUIPO"] || row.equipo,
              agente: cambios["AGENTE"] || row.agente,
              teléfono: cambios["NÚMERO"] || row["teléfono"],
              producto: cambios["PRODUCTO"] || row.producto,
              puntaje: cambios["PUNTAJE"] || row.puntaje,
              cuenta: cambios["CUENTA"] || row.cuenta,
              direccion: cambios["DIRECCION"] || row.direccion,
              zip: cambios["ZIP"] || row.zip
            };
          }
          return row;
        });
        if (modificado) {
          cambiado = true;
          const encabezados = [
            "fecha",
            "equipo",
            "agente",
            "teléfono",
            "producto",
            "puntaje",
            "cuenta",
            "direccion",
            "zip"
          ];
          workbook.Sheets[nombreHoja] = XLSX.utils.json_to_sheet(datos, { header: encabezados });
        }
      });
      if (cambiado) XLSX.writeFile(workbook, EXCEL_FILE_PATH);
      actualizadoExcel = cambiado;
    }
  } catch (err) {
    errores.push("Error Excel: " + err.message);
  }

  if (actualizadoMongo || actualizadoExcel) {
    return res.json({ success: true });
  } else {
    return res.status(404).json({ success: false, error: errores.join("; ") || "No se encontró el lead para editar" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});