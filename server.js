const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "secreto_crm_conectado",
  resave: false,
  saveUninitialized: false,
}));

app.use(express.static(__dirname + '/public'));

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

// Archivo Excel
const EXCEL_FILE_PATH = path.join(__dirname, "leads.xlsx");

// Obtener nombre de la hoja (fecha actual)
function obtenerNombreHoja() {
  return new Date().toISOString().split("T")[0]; // Ej: 2025-06-06
}

// Función para leer o crear el archivo Excel
function obtenerWorkbook() {
  if (fs.existsSync(EXCEL_FILE_PATH)) {
    return XLSX.readFile(EXCEL_FILE_PATH);
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.writeFile(wb, EXCEL_FILE_PATH);
    return wb;
  }
}

// Crear el archivo Excel y hoja del día automáticamente al iniciar el servidor
function inicializarExcelConHojaDelDia() {
  const nombreHoja = obtenerNombreHoja();

  let workbook;
  if (fs.existsSync(EXCEL_FILE_PATH)) {
    workbook = XLSX.readFile(EXCEL_FILE_PATH);
  } else {
    workbook = XLSX.utils.book_new();
  }

  // Si la hoja del día no existe, crearla vacía
  if (!workbook.Sheets[nombreHoja]) {
    const hojaVacia = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, hojaVacia, nombreHoja);
    XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    console.log(`✔️ Hoja creada para el día: ${nombreHoja}`);
  } else {
    console.log(`ℹ️ Hoja del día ${nombreHoja} ya existe`);
  }
}

// Ejecutar al iniciar el servidor
inicializarExcelConHojaDelDia();

// Guardar nuevo lead en la hoja del día
app.post("/api/leads", (req, res) => {
  try {
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

    const workbook = obtenerWorkbook();

    // Leer hoja actual o iniciar vacía
    let datos = [];
    if (workbook.Sheets[nombreHoja]) {
      datos = XLSX.utils.sheet_to_json(workbook.Sheets[nombreHoja]);
    }

    datos.push(nuevoLead);
    const nuevaHoja = XLSX.utils.json_to_sheet(datos);

    // Reemplazar hoja si ya existe
    if (workbook.SheetNames.includes(nombreHoja)) {
      const idx = workbook.SheetNames.indexOf(nombreHoja);
      workbook.SheetNames.splice(idx, 1);
    }

    XLSX.utils.book_append_sheet(workbook, nuevaHoja, nombreHoja);
    XLSX.writeFile(workbook, EXCEL_FILE_PATH);

    res.json({ success: true });
  } catch (err) {
    console.error("Error al guardar lead:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener todos los leads de todas las hojas del Excel
app.get("/api/leads", (req, res) => {
  try {
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      return res.json([]); // No hay archivo, no hay leads
    }
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    let todosLeads = [];

    workbook.SheetNames.forEach(nombreHoja => {
      const hoja = workbook.Sheets[nombreHoja];
      const datos = XLSX.utils.sheet_to_json(hoja);
      todosLeads = todosLeads.concat(datos);
    });

    // Ordenar por fecha descendente
    todosLeads.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(todosLeads);
  } catch (error) {
    console.error("Error al leer leads:", error);
    res.status(500).json({ error: "No se pudieron cargar los leads." });
  }
});

// Obtener datos para gráficas desde el Excel
app.get("/api/graficas", (req, res) => {
  try {
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
      const hoja = workbook.Sheets[nombreHoja];
      const datos = XLSX.utils.sheet_to_json(hoja);

      datos.forEach(row => {
        if (!row.team || !row.producto) return;

        ventasPorEquipo[row.team] = (ventasPorEquipo[row.team] || 0) + 1;
        puntosPorEquipo[row.team] = Math.round(((puntosPorEquipo[row.team] || 0) + parseFloat(row.puntaje || 0)) * 100) / 100;
        ventasPorProducto[row.producto] = (ventasPorProducto[row.producto] || 0) + 1;
      });
    });

    res.json({ ventasPorEquipo, puntosPorEquipo, ventasPorProducto });
  } catch (error) {
    console.error("Error al obtener datos para gráficas:", error);
    res.status(500).json({ error: "No se pudieron cargar los datos para gráficas." });
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
