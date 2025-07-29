require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');

// Inicialización de la aplicación
const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Configuración de CORS
const corsOptions = {
  origin: isProduction ? 'https://crm-connecting.onrender.com' : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexión a MongoDB
const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
  console.error('❌ Error: La variable de entorno MONGO_URL no está definida');
  process.exit(1);
}

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Error al conectar a MongoDB:', err);
    process.exit(1);
  });

// Configuración de sesión
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'secreto_seguro_para_el_desarrollo',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URL,
    ttl: 24 * 60 * 60, // 1 día
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 día
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  }
};

app.use(session(sessionConfig));

// Middleware de autenticación
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.status(401).json({ success: false, error: 'No autorizado' });
};

// Rutas de autenticación
app.post('/api/login', async (req, res) => {
  // Usar los nombres de campos que vienen del frontend
  const { username: usuario, password: contrasena } = req.body;
  
  try {
    // Autenticación de ejemplo
    if (usuario === 'admin' && contrasena === '1234') {
      req.session.user = { usuario, rol: 'admin' };
      return res.json({ success: true, user: { usuario, rol: 'admin' } });
    }
    
    res.status(401).json({ success: false, error: 'Credenciales inválidas' });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Error al cerrar sesión' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Ruta de verificación de autenticación
app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  res.json({ authenticated: false });
});

// Rutas de la API (protegidas)
app.get('/api/costumers', requireAuth, async (req, res) => {
  try {
    // Ejemplo de datos de clientes
    const costumers = [
      { id: 1, nombre: 'Cliente 1', email: 'cliente1@ejemplo.com' },
      { id: 2, nombre: 'Cliente 2', email: 'cliente2@ejemplo.com' }
    ];
    
    res.json({ success: true, data: costumers });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ success: false, error: 'Error al obtener clientes' });
  }
});

// Ruta de facturación con parámetros validados
app.get('/api/facturacion/:anio/:mes', requireAuth, (req, res) => {
  try {
    const { anio, mes } = req.params;
    
    // Validar parámetros
    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);
    
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parámetros inválidos. Año debe ser un número y mes debe estar entre 1 y 12' 
      });
    }
    
    // Ejemplo de datos de facturación
    const facturacionData = {
      anio: anioNum,
      mes: mesNum,
      total: 1000,
      detalles: [
        { concepto: 'Servicio 1', monto: 500 },
        { concepto: 'Servicio 2', monto: 500 }
      ]
    };
    
    res.json({ success: true, data: facturacionData });
    
  } catch (error) {
    console.error('Error en facturación:', error);
    res.status(500).json({ success: false, error: 'Error al obtener datos de facturación' });
  }
});

// Ruta para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Importar rutas
const rankingsRoutes = require('./routes/rankings');

// Usar rutas
app.use('/api/rankings', rankingsRoutes);

// Ruta raíz que redirige al login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Ruta de bienvenida para la API
app.get('/api', (req, res) => {
  res.json({
    message: 'Bienvenido a la API de Connecting CRM',
    endpoints: {
      auth: {
        login: 'POST /api/login',
        logout: 'POST /api/logout',
        checkAuth: 'GET /api/check-auth'
      },
      costumers: 'GET /api/costumers',
      facturacion: 'GET /api/facturacion/:anio/:mes'
    }
  });
});

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'El servidor está funcionando correctamente' });
});

// Manejador de errores
app.use((err, req, res, next) => {
  console.error('Error del servidor:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Error interno del servidor',
    message: isProduction ? undefined : err.message
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
