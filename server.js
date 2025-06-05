const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const app = express();
const PORT = 3000;

const EXCEL_PATH = path.join(__dirname, "leads.xlsx");
const HOY = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

// ✅ Crear hoja del día si no existe
if (fs.existsSync(EXCEL_PATH)) {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const existeHojaConFecha = workbook.SheetNames.some(name =>
    name.replace(/[^0-9]/g, '') === HOY.replace(/[^0-9]/g, '')
  );

  if (!existeHojaConFecha) {
    console.log("🆕 Hoja de hoy no existe. Creando hoja:", HOY);
    const header = [["FECHA", "TEAM", "AGENTE", "NÚMERO", "SERVICIO", "PUNTOS", "CUENTA", "DIRECCIÓN", "ZIP CODE"]];
    const worksheet = XLSX.utils.aoa_to_sheet(header);
    workbook.SheetNames.push(HOY);
    workbook.Sheets[HOY] = worksheet;
    XLSX.writeFile(workbook, EXCEL_PATH);
  } else {
    console.log("✅ Hoja de hoy ya existe (detectada con formato flexible).");
  }
} else {
  console.log("📁 Archivo Excel no existe. Creándolo con hoja de hoy:", HOY);
  const workbook = XLSX.utils.book_new();
  const header = [["FECHA", "TEAM", "AGENTE", "NÚMERO", "SERVICIO", "PUNTOS", "CUENTA", "DIRECCIÓN", "ZIP CODE"]];
  const worksheet = XLSX.utils.aoa_to_sheet(header);
  XLSX.utils.book_append_sheet(workbook, worksheet, HOY);
  XLSX.writeFile(workbook, EXCEL_PATH);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "secreto_crm_conectado",
  resave: false,
  saveUninitialized: false,
}));

app.use(express.static(path.join(__dirname, "public")));

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

function obtenerHojaPorFecha(workbook, fechaOriginal) {
  const claveFecha = fechaOriginal.replace(/[^0-9]/g, "");
  for (const nombre of workbook.SheetNames) {
    const claveHoja = nombre.replace(/[^0-9]/g, "");
    if (claveHoja === claveFecha) return nombre;
  }
  return null;
}

app.post("/api/leads", (req, res) => {
  try {
    const lead = req.body;
    const filePath = EXCEL_PATH;
    let workbook, worksheet;

    const fecha = new Date();
    const fechaHoja = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;

    if (fs.existsSync(filePath)) {
      workbook = XLSX.readFile(filePath);
      const nombreHoja = obtenerHojaPorFecha(workbook, fechaHoja) || fechaHoja;
      worksheet = workbook.Sheets[nombreHoja];
      if (!worksheet) {
        worksheet = XLSX.utils.aoa_to_sheet([["FECHA", "TEAM", "AGENTE", "NÚMERO", "SERVICIO", "PUNTOS", "CUENTA", "DIRECCIÓN", "ZIP CODE"]]);
        workbook.SheetNames.push(nombreHoja);
        workbook.Sheets[nombreHoja] = worksheet;
      }
    } else {
      workbook = XLSX.utils.book_new();
      worksheet = XLSX.utils.aoa_to_sheet([["FECHA", "TEAM", "AGENTE", "NÚMERO", "SERVICIO", "PUNTOS", "CUENTA", "DIRECCIÓN", "ZIP CODE"]]);
      workbook.SheetNames.push(fechaHoja);
      workbook.Sheets[fechaHoja] = worksheet;
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const fechaStr = new Date().toLocaleDateString();

    data.push([
      fechaStr,
      lead.team || '',
      lead.agent,
      lead.telefono,
      lead.producto,
      lead.puntaje,
      lead.cuenta,
      lead.direccion,
      lead.zip
    ]);

    const newSheet = XLSX.utils.aoa_to_sheet(data);
    workbook.Sheets[workbook.SheetNames.find(n => workbook.Sheets[n] === worksheet)] = newSheet;
    XLSX.writeFile(workbook, filePath);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error al guardar lead:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/leads", (req, res) => {
  try {
    const workbook = XLSX.readFile(EXCEL_PATH);
    const allData = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(sheet);
      allData.push(...sheetData);
    });

    res.json(allData);
  } catch (error) {
    console.error('Error al leer el archivo Excel:', error);
    res.status(500).json({ error: 'No se pudieron cargar los leads.' });
  }
});

// 1. Ruta DELETE para eliminar un lead del archivo Excel
app.delete("/api/leads", (req, res) => {
  const { FECHA, NÚMERO, AGENTE } = req.body; // se usarán como identificadores

  try {
    const workbook = XLSX.readFile(EXCEL_PATH);
    let cambios = false;

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      let data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const originalLength = data.length;
      data = data.filter(row => {
        return !(row["FECHA"] === FECHA && row["NÚMERO"] === NÚMERO && row["AGENTE"] === AGENTE);
      });

      if (data.length < originalLength) {
        cambios = true;
        const newSheet = XLSX.utils.json_to_sheet(data, { header: ["FECHA", "TEAM", "AGENTE", "NÚMERO", "SERVICIO", "PUNTOS", "CUENTA", "DIRECCIÓN", "ZIP CODE"] });
        workbook.Sheets[sheetName] = newSheet;
      }
    });

    if (cambios) {
      XLSX.writeFile(workbook, EXCEL_PATH);
      return res.json({ success: true });
    } else {
      return res.status(404).json({ success: false, message: "Registro no encontrado." });
    }
  } catch (error) {
    console.error("Error eliminando lead:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/graficas", (req, res) => {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const modo = req.query.modo;
  const hoy = new Date();
  const nombreHoja = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  const ventasPorEquipo = {};
  const puntosPorEquipo = {};
  const ventasPorProducto = {};

  const procesarDatos = (data) => {
    data.forEach((row) => {
      const team = row["TEAM"];
      const producto = row["SERVICIO"];
      const puntos = parseFloat(row["PUNTOS"] || 0);
      if (!team || !producto || team === "TEAM") return;
      ventasPorEquipo[team] = (ventasPorEquipo[team] || 0) + 1;
      puntosPorEquipo[team] = Math.round(((puntosPorEquipo[team] || 0) + puntos) * 100) / 100;
      ventasPorProducto[producto] = (ventasPorProducto[producto] || 0) + 1;
    });
  };

  if (modo === "todo") {
    workbook.SheetNames.forEach((hoja) => {
      const sheet = workbook.Sheets[hoja];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      procesarDatos(data);
    });
  } else {
    if (workbook.SheetNames.includes(nombreHoja)) {
      const sheet = workbook.Sheets[nombreHoja];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      procesarDatos(data);
    }
  }

  res.json({ ventasPorEquipo, puntosPorEquipo, ventasPorProducto });
});

app.get("/descargar-excel", (req, res) => {
  if (!fs.existsSync(EXCEL_PATH)) {
    return res.status(404).send("Archivo no encontrado");
  }
  res.download(EXCEL_PATH, "leads.xlsx", (err) => {
    if (err) {
      console.error("❌ Error al descargar:", err);
      res.status(500).send("Error al descargar el archivo");
    }
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

function eliminarLead(fecha, numero, agente) {
  if (!confirm("¿Estás seguro de eliminar este lead?")) return;
  fetch("/api/leads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ FECHA: fecha, NÚMERO: numero, AGENTE: agente })
  })
  .then(res => res.json())
  .then(res => {
    if (res.success) {
      alert("Lead eliminado correctamente.");
      cargarDatos();
    } else {
      alert("No se pudo eliminar el lead.");
    }
  })
  .catch(err => {
    alert("Error al eliminar el lead.");
    console.error(err);
  });
}

async function cargarDatos() {
  try {
    const res = await fetch("/api/leads");
    const tipo = res.headers.get("content-type");
    if (!tipo.includes("application/json")) throw new Error("Respuesta inesperada");
    datos = await res.json(); // << Guarda en la variable global
    renderizarTabla(datos);  // << Renderiza tabla directamente
  } catch (e) {
    console.error("Error cargando datos:", e.message);
  }
}



app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
