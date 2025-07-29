require('dotenv').config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas básicas sin parámetros problemáticos
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/inicio.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "inicio.html"));
});

app.get("/costumer.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "costumer.html"));
});

app.get("/lead.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "lead.html"));
});

app.get("/Facturacion.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "Facturacion.html"));
});

app.get("/graficas.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "graficas.html"));
});

// API básica de prueba
app.get('/api/test', (req, res) => {
  res.json({ 
    ok: true, 
    message: "Servidor funcionando correctamente",
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});

// Login básico sin base de datos
app.post("/login", (req, res) => {
  const { usuario, contrasena } = req.body;
  
  if (usuario === "admin" && contrasena === "1234") {
    res.json({ success: true, destino: "/inicio.html" });
  } else {
    res.json({ success: false, error: "Usuario o contraseña incorrectos" });
  }
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Ruta catch-all
app.get('*', (req, res) => {
  res.redirect('/login.html');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor minimalista funcionando en puerto ${PORT}`);
  console.log(`🔧 Node.js version: ${process.version}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
