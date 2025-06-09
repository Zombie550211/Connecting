require('dotenv').config();

console.log("DEBUG MONGO_URL:", process.env.MONGO_URL);
const Lead = require('./models/lead');

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;

const EXCEL_FILE_PATH = path.join(__dirname, "leads.xlsx");

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

function obtenerNombreHoja() {
  return new Date().toISOString().split("T")[0];
}

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

// ENDPOINT PARA GUARDAR LEAD
app.post("/api/leads", async (req, res) => {
  try {
    console.log("BODY RECIBIDO:", req.body);

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

    // Guardar en MongoDB
    await Lead.create(nuevoLead);

    // Guardar en Excel
    let workbook;
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      workbook = XLSX.readFile(EXCEL_FILE_PATH);
    } else {
      workbook = XLSX.utils.book_new();
    }

    // Leer datos previos o inicializar array
    let datos = [];
    if (workbook.Sheets[nombreHoja]) {
      datos = XLSX.utils.sheet_to_json(workbook.Sheets[nombreHoja], { defval: "" });
    }
    datos.push(nuevoLead);

    const encabezados = [
      "fecha",
      "team",
      "agent",
      "telefono",
      "producto",
      "puntaje",
      "cuenta",
      "direccion",
      "zip"
    ];

    // Escribe la hoja con encabezados siempre
    const nuevaHoja = XLSX.utils.json_to_sheet(datos, { header: encabezados });
    workbook.Sheets[nombreHoja] = nuevaHoja;
    if (!workbook.SheetNames.includes(nombreHoja)) {
      workbook.SheetNames.push(nombreHoja);
    }
    XLSX.writeFile(workbook, EXCEL_FILE_PATH);

    // LOG extra para ver si se escribió bien
    console.log(`Lead guardado. Total filas en hoja ${nombreHoja}:`, datos.length);

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
        const datos = XLSX.utils.sheet_to_json(hoja, { defval: "" });
        // Logs de depuración
        console.log("Nombre de la hoja:", nombreHoja);
        console.log("Filas leídas:", datos.length);
        console.log("Primeras filas:", datos.slice(0, 5)); // Muestra las primeras 5 filas

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
// ENDPOINT GRAFICAS: AHORA FILTRA POR FECHA SI SE LE PASA ?fecha=YYYY-MM-DD
app.get("/api/graficas", (req, res) => {
  try {
    const fechaFiltro = req.query.fecha; // Ejemplo: "2025-06-08"
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

      // Logs para depuración de gráficas
      console.log("Procesando hoja para gráficas:", nombreHoja);
      console.log("Filas leídas para gráficas:", datos.length);

      // Normaliza claves de cada fila
      datos.forEach(row => {
        const normalized = {};
        Object.keys(row).forEach(key => {
          normalized[key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] = row[key];
        });

        const team = normalized.team || "";
        const producto = normalized.producto || normalized.servicio || "";
        const puntaje = normalized.puntaje || normalized.puntos || 0;

        if (!team || !producto) return;

        ventasPorEquipo[team] = (ventasPorEquipo[team] || 0) + 1;
        puntosPorEquipo[team] = Math.round(((puntosPorEquipo[team] || 0) + parseFloat(puntaje || 0)) * 100) / 100;
        ventasPorProducto[producto] = (ventasPorProducto[producto] || 0) + 1;
      });
    });

    res.json({ ventasPorEquipo, puntosPorEquipo, ventasPorProducto });
  } catch (error) {
    console.error("Error al obtener datos para gráficas:", error);
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

  // Eliminar en MongoDB
  try {
    const resultado = await Lead.deleteOne({
      fecha: { $regex: `^${fecha}` }, // Por si hay hora en fecha
      telefono: numero,
      agent: agente
    });
    eliminadoMongo = resultado.deletedCount > 0;
  } catch (err) {
    errores.push("Error MongoDB: " + err.message);
  }

  // Eliminar en Excel
  try {
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      const workbook = XLSX.readFile(EXCEL_FILE_PATH);
      let cambiado = false;
      workbook.SheetNames.forEach(nombreHoja => {
        let datos = XLSX.utils.sheet_to_json(workbook.Sheets[nombreHoja], { defval: "" });
        const antes = datos.length;
        datos = datos.filter(row =>
          !(row.fecha && row.fecha.startsWith(fecha) && row.telefono === numero && row.agent === agente)
        );
        if (datos.length !== antes) {
          cambiado = true;
          const nuevaHoja = XLSX.utils.json_to_sheet(datos, {
            header: [
              "fecha",
              "team",
              "agent",
              "telefono",
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

  // Actualizar en MongoDB
  try {
    const resultado = await Lead.updateOne(
      {
        fecha: { $regex: `^${fecha}` },
        telefono: numero,
        agent: agente
      },
      {
        $set: {
          fecha: cambios["FECHA"] || fecha,
          team: cambios["TEAM"] || "",
          agent: cambios["AGENTE"] || "",
          telefono: cambios["NÚMERO"] || "",
          producto: cambios["SERVICIO"] || "",
          puntaje: cambios["PUNTOS"] || 0,
          cuenta: cambios["CUENTA"] || "",
          direccion: cambios["DIRECCIÓN"] || "",
          zip: cambios["ZIP CODE"] || ""
        }
      }
    );
    actualizadoMongo = resultado.modifiedCount > 0;
  } catch (err) {
    errores.push("Error MongoDB: " + err.message);
  }

  // Actualizar en Excel
  try {
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      const workbook = XLSX.readFile(EXCEL_FILE_PATH);
      let cambiado = false;
      workbook.SheetNames.forEach(nombreHoja => {
        let datos = XLSX.utils.sheet_to_json(workbook.Sheets[nombreHoja], { defval: "" });
        let modificado = false;
        datos = datos.map(row => {
          if (row.fecha && row.fecha.startsWith(fecha) && row.telefono === numero && row.agent === agente) {
            modificado = true;
            return {
              ...row,
              fecha: cambios["FECHA"] || row.fecha,
              team: cambios["TEAM"] || row.team,
              agent: cambios["AGENTE"] || row.agent,
              telefono: cambios["NÚMERO"] || row.telefono,
              producto: cambios["SERVICIO"] || row.producto,
              puntaje: cambios["PUNTOS"] || row.puntaje,
              cuenta: cambios["CUENTA"] || row.cuenta,
              direccion: cambios["DIRECCIÓN"] || row.direccion,
              zip: cambios["ZIP CODE"] || row.zip
            };
          }
          return row;
        });
        if (modificado) {
          cambiado = true;
          // Asegura encabezados
          const encabezados = [
            "fecha",
            "team",
            "agent",
            "telefono",
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

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});