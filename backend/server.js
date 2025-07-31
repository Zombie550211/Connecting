require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./models/user');
const CrmAgente = require('./models/crm_agente');
const Costumer = require('./models/costumer');

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
app.post('/api/register', async (req, res) => {
  const { nombre, apellido, correo, username, password } = req.body;

  if (!nombre || !apellido || !correo || !username || !password) {
    return res.status(400).json({ success: false, mensaje: 'Todos los campos son requeridos.' });
  }

  try {
    // Verificar si el usuario o el correo ya existen
    const existingUser = await User.findOne({ $or: [{ usuario: username }, { correo: correo }] });
    if (existingUser) {
      return res.status(409).json({ success: false, mensaje: 'El usuario o correo electrónico ya está en uso.' });
    }

    // Hashear la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear nuevo usuario
    const newUser = new User({
      nombre,
      apellido,
      correo,
      usuario: username,
      password: hashedPassword
    });

    await newUser.save();

    res.status(201).json({ success: true, mensaje: 'Usuario registrado exitosamente.' });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, mensaje: 'Error interno del servidor.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, mensaje: 'Usuario y contraseña son requeridos.' });
  }

  try {
    // Acceso especial para el administrador por defecto
    if (username === 'admin' && password === '1234') {
      const payload = { id: 'admin-id', username: 'admin', rol: 'admin' };
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'secreto_super_secreto', {
        expiresIn: '1d',
      });
      return res.json({ success: true, token });
    }

    // Buscar usuario en la base de datos para usuarios normales
    const user = await User.findOne({ usuario: username });
    if (!user) {
      return res.status(401).json({ success: false, mensaje: 'Credenciales inválidas.' });
    }

    // Comparar contraseñas (hasheadas para usuarios registrados)
    const isMatch = await bcrypt.compare(password, user.password);
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
    const { fechaDesde, fechaHasta, mes, anio } = req.query;
    let query = {};
    const dateFilter = {};

    // Construir el filtro de fecha de forma flexible
    if (fechaDesde) {
      dateFilter.$gte = fechaDesde;
    }
    if (fechaHasta) {
      dateFilter.$lte = fechaHasta;
    }

    // Si no se usan los selectores de fecha, usar mes y año
    if (!fechaDesde && !fechaHasta && mes && anio) {
      const mesNum = parseInt(mes, 10);
      const anioNum = parseInt(anio, 10);

      if (!isNaN(mesNum) && !isNaN(anioNum)) {
        const primerDia = new Date(anioNum, mesNum, 1);
        const ultimoDia = new Date(anioNum, mesNum + 1, 0);
        dateFilter.$gte = primerDia.toISOString().split('T')[0];
        dateFilter.$lte = ultimoDia.toISOString().split('T')[0];
      }
    }

    // Solo añadir el filtro de fecha a la consulta si se construyó algo
    if (Object.keys(dateFilter).length > 0) {
      query.fecha = dateFilter;
    }

    const resultados = await Costumer.find(query);

    const costumers = resultados.map(item => ({
      _id: item._id,
      FECHA: item.fecha,
      TEAM: item.equipo,
      AGENTE: item.agente,
      PRODUCTO: item.producto,
      FECHA_INSTALACION: item.fecha_instalacion, // Este campo puede no existir en Costumer
      ESTADO: item.estado,
      PUNTAJE: item.puntaje,
      CUENTA: item.cuenta, // Este campo puede no existir en Costumer
      TELEFONO: item.telefono, // Este campo puede no existir en Costumer
      DIRECCION: item.direccion, // Este campo puede no existir en Costumer
      ZIP: item.zip // Este campo puede no existir en Costumer
    }));

    res.json({ costumers });

  } catch (error) {
    console.error('Error al obtener costumers:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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

// Ruta para guardar nuevos leads
app.post('/api/leads', protect, async (req, res) => {
  try {
    const { fecha, team, agent, producto, puntaje, cuenta, telefono, direccion, zip } = req.body;

    const newCostumer = new Costumer({
      fecha: fecha,
      equipo: team,
      agente: agent,
      producto: producto,
      puntaje: puntaje,
      cuenta: cuenta,
      telefono: telefono,
      direccion: direccion,
      zip: zip,
      estado: 'Pending' // Asignar estado pendiente por defecto
    });

    await newCostumer.save();
    res.status(201).json({ success: true, message: 'Lead guardado exitosamente en la colección Costumer.' });

  } catch (error) {
    console.error('Error al guardar el lead en Costumer:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor al guardar en Costumer' });
  }
});

// Nueva ruta para las gráficas de la página de leads
app.get('/api/graficas', protect, async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fecha) {
      return res.status(400).json({ ok: false, error: 'La fecha es requerida' });
    }

        const resultados = await CrmAgente.find({ fecha: fecha });

    const ventasPorEquipo = {};
    const puntosPorEquipo = {};
    resultados.forEach(costumer => {
      if (costumer.equipo) {
        ventasPorEquipo[costumer.equipo] = (ventasPorEquipo[costumer.equipo] || 0) + 1;
        puntosPorEquipo[costumer.equipo] = (puntosPorEquipo[costumer.equipo] || 0) + (costumer.puntaje || 0);
      }
    });

    const ventasPorProducto = {};
    resultados.forEach(costumer => {
      if (costumer.producto) {
        ventasPorProducto[costumer.producto] = (ventasPorProducto[costumer.producto] || 0) + 1;
      }
    });

    

    res.json({
      ok: true,
      ventasPorEquipo,
      puntosPorEquipo,
      ventasPorProducto
    });

  } catch (error) {
    console.error('Error al obtener datos para gráficas:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// Ruta para obtener todos los productos únicos
app.get('/api/productos', protect, (req, res) => {
  try {
    const todosLosProductos = [
      '225 AT&T AIR',
      '100 MBPS AT&T',
      '18 MBPS AT&T',
      '1G AT&T',
      '25 MBPS AT&T',
      '300 MBPS AT&T',
      '50 MBPS AT&T',
      '500 MBPS AT&T',
      '5G AT&T',
      '75 MBPS AT&T',
      'ALTAFIBER',
      'FRONTIER',
      'HUGHESNET',
      'MAS LATINO',
      'MAS ULTRA',
      'OPTIMO MAS',
      'OPTIMUM',
      'SPECTRUM',
      'VIASAT',
      'WINDSTREAM',
      'WOW',
      'LINEA + CELULAR',
      'VIVINT',
      'KINETIC',
      'SPECTRUM BUSINESS',
      'AT&T BUSINESS',
      'DIRECTV BUSINESS',
      'CONSOLIDATE COMMUNICATION',
      'ZYPYLFIBER',
      'SPECTRUM 500',
      'SPECTRUM 50',
      'FRONTIER 200',
      'FRONTIER 500',
      'SPECTRUM 100',
      'FRONTIER 100',
      'FRONTIER 1G',
      'SPECTRUM 1G',
      'FRONTIER 2G',
      'SPECTRUM DOUBLE PLAY PREMIER',
      'SPECTRUM DOUBLE PLAY ADVANTAGE',
      'FRONTIER 5G',
      'EARTHLINK',
      'BRIGHTSPEED',
      '2G AT&T',
      '2G SPECTRUM'
    ];
    res.json({ ok: true, productos: todosLosProductos });
  } catch (error) {
    console.error('Error al obtener la lista de productos:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
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

// Ruta para verificar la autenticación del token
app.get('/api/check-auth', protect, (req, res) => {
  res.json({ success: true, message: 'Token válido.' });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
