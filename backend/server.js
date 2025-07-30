require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./models/user');

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

// Middleware de autenticación JWT
const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto_super_secreto');
      req.user = decoded; // Agrega el payload del token a la request
      next();
    } catch (error) {
      console.error('Error de autenticación:', error.message);
      res.status(401).json({ success: false, mensaje: 'Token no válido' });
    }
  } else {
    res.status(401).json({ success: false, mensaje: 'No autorizado, no hay token' });
  }
};

// Rutas de autenticación
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, mensaje: 'Usuario y contraseña son requeridos.' });
  }

  try {
    // Buscar usuario en la base de datos
    const user = await User.findOne({ usuario: username });
    if (!user) {
      return res.status(401).json({ success: false, mensaje: 'Credenciales inválidas.' });
    }

    // Comparar contraseñas
    // Nota: Asumiendo que la contraseña en la BD está hasheada. Si no lo está, esto fallará.
    // const isMatch = await bcrypt.compare(password, user.password);
    // Usando comparación directa temporalmente si las contraseñas no están hasheadas
    const isMatch = password === user.password;

    if (!isMatch) {
      return res.status(401).json({ success: false, mensaje: 'Credenciales inválidas.' });
    }

    // Crear payload para el token
    const payload = {
      id: user._id,
      usuario: user.usuario,
      rol: user.rol || 'agente' // Asignar un rol por defecto si no existe
    };

    // Firmar el token
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secreto_super_secreto', {
      expiresIn: '1d',
    });

    res.json({ success: true, token });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, mensaje: 'Error interno del servidor' });
  }
});

// Rutas de la API (protegidas)
app.get('/api/costumers', protect, async (req, res) => {
  try {
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

app.get('/api/facturacion/:anio/:mes', protect, (req, res) => {
  try {
    const { anio, mes } = req.params;
    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);
    
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parámetros inválidos.' 
      });
    }
    
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

// Importar y usar otras rutas
const rankingsRoutes = require('./routes/rankings');
app.use('/api/rankings', protect, rankingsRoutes);

// Ruta raíz que redirige al login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Ruta de bienvenida para la API
app.get('/api', (req, res) => {
  res.json({
    message: 'Bienvenido a la API de Connecting CRM',
    endpoints: {
      login: 'POST /api/login',
      costumers: 'GET /api/costumers',
      rankings: 'GET /api/rankings',
      facturacion: 'GET /api/facturacion/:anio/:mes'
    }
  });
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
