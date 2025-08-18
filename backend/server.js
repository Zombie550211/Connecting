require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

// Inicialización de la aplicación
const app = express();

// Conectar a MongoDB
connectDB();

// Import routes
const summaryRoutes = require('./routes/summary');
const crmAgenteRoutes = require('./routes/crm_agente');
const costumerRoutes = require('./routes/costumer');
const graficasRoutes = require('./routes/graficas');
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Configuración de CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://crm-connecting.onrender.com',
  'https://connecting-klf7.onrender.com',
  /^https?:\/\/.*\.render\.com$/, // Permitir cualquier subdominio de render.com
  /^https?:\/\/.*\.netlify\.app$/ // Permitir sitios de Netlify
];

const corsOptions = {
  origin: function (origin, callback) {
    // En desarrollo o sin origen definido, permitir
    if (process.env.NODE_ENV !== 'production' || !origin) {
      return callback(null, true);
    }
    
    // Verificar contra la lista de orígenes permitidos
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      return callback(null, true);
    } else {
      console.warn('Origen no permitido:', origin);
      return callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Content-Length',
    'X-Requested-With',
    'Accept',
    'X-Access-Token',
    'X-Refresh-Token'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'X-Access-Token',
    'X-Refresh-Token'
  ],
  maxAge: 86400, // 24 horas
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Middleware para verificar el token JWT
const protect = (req, res, next) => {
  // 1. Verificar token en el encabezado de autorización (Bearer token)
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // 2. Si no hay token en el encabezado, verificar en las cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  // Si hay un token, intentar verificarlo
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto_super_secreto');
      req.user = decoded; // Agregar el payload del token a la solicitud
      return next();
    } catch (error) {
      console.error('Error en la autenticación:', error);
      // Limpiar la cookie si el token es inválido
      res.clearCookie('token');
      return res.status(401).json({ 
        success: false,
        message: 'Sesión expirada o inválida' 
      });
    }
  } 
  // 3. Verificar sesión de express-session (si se está usando)
  else if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  
  // Si no hay token ni sesión válida
  return res.status(401).json({ 
    success: false,
    message: 'No autorizado. Por favor inicia sesión.' 
  });
};

// Ruta para verificar el token
app.get('/api/auth/verificar-token', protect, async (req, res) => {
  try {
    console.log('🔍 Verificación de token solicitada');
    console.log('🔑 Usuario autenticado:', req.user || req.session.user);
    
    // Si llegamos aquí, el token es válido
    const response = {
      success: true,
      usuario: req.user || req.session.user,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Token verificado correctamente');
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error al verificar el token:', error);
    
    // Limpiar la cookie si hay un error
    res.clearCookie('token');
    
    res.status(401).json({ 
      success: false, 
      error: 'Token inválido o expirado',
      tokenValido: false,
      timestamp: new Date().toISOString()
    });
  }
});

// Middlewares
app.use(cookieParser());
app.use(cors({
  ...corsOptions,
  credentials: true // Permitir credenciales (cookies, encabezados de autenticación)
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Montar rutas de la API con autenticación
app.use('/api/crm', protect, crmAgenteRoutes);
app.use('/api/costumer', protect);

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
  const { username, password, rememberMe } = req.body;

  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      mensaje: 'Usuario y contraseña son requeridos.' 
    });
  }
  
  console.log(`🔐 Intento de inicio de sesión para usuario: ${username}`);

  try {
    // Acceso especial para el administrador por defecto
    if (username === 'admin' && password === '1234') {
      const payload = { 
        id: 'admin-id', 
        username: 'admin', 
        rol: 'admin',
        nombre: 'Administrador'
      };
      
      const tokenExpiry = rememberMe ? '7d' : '1d';
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'secreto_super_secreto', {
        expiresIn: tokenExpiry,
      });
      
      // Configurar la cookie HTTP-Only segura
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 7 días o 1 día
        path: '/',
      };
      
      res.cookie('token', token, cookieOptions);
      
      return res.json({ 
        success: true, 
        token, // También enviamos el token en la respuesta para el cliente
        user: payload,
        mensaje: 'Inicio de sesión exitoso'
      });
    }

    // Buscar usuario en la base de datos para usuarios normales
    const user = await User.findOne({ 
      $or: [
        { usuario: username },
        { email: username } // Permitir login con email también
      ] 
    });
    
    if (!user) {
      console.warn(`❌ Intento de inicio de sesión fallido - Usuario no encontrado: ${username}`);
      return res.status(401).json({ 
        success: false, 
        mensaje: 'Credenciales inválidas.' 
      });
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn(`❌ Intento de inicio de sesión fallido - Contraseña incorrecta para usuario: ${username}`);
      return res.status(401).json({ 
        success: false, 
        mensaje: 'Credenciales inválidas.' 
      });
    }

    // Crear payload para el token
    const payload = {
      id: user._id,
      usuario: user.usuario,
      email: user.email,
      nombre: user.nombre || user.usuario,
      rol: user.rol || 'agente', // Asignar un rol por defecto si no existe
      equipo: user.equipo || ''
    };

    // Configurar tiempo de expiración del token
    const tokenExpiry = rememberMe ? '7d' : '1d';
    
    // Firmar el token
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secreto_super_secreto', {
      expiresIn: tokenExpiry,
    });

    // Configuración de la cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 7 días o 1 día
      path: '/',
    };

    // Establecer la cookie HTTP-Only
    res.cookie('token', token, cookieOptions);
    
    console.log(`✅ Inicio de sesión exitoso para usuario: ${username}`);

    // Devolver respuesta exitosa con el token y datos del usuario
    res.json({ 
      success: true, 
      token: token, // Para compatibilidad con clientes que lo necesitan
      user: payload,
      mensaje: 'Inicio de sesión exitoso',
      expiresIn: rememberMe ? '7d' : '1d'
    });

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

    console.log(`Buscando datos para la fecha: ${fecha}`); // <-- LOG DE DIAGNÓSTICO

    const resultados = await CrmAgente.find({ dia_venta: fecha });

    const ventasPorEquipo = {};
    const puntosPorEquipo = {};
    const ventasPorProducto = {};

    resultados.forEach(item => {
      // Procesar ventas y puntos por equipo
      if (item.equipo) {
        ventasPorEquipo[item.equipo] = (ventasPorEquipo[item.equipo] || 0) + 1;
        puntosPorEquipo[item.equipo] = (puntosPorEquipo[item.equipo] || 0) + (item.puntaje || 0);
      }
      // Procesar ventas por producto
      if (item.producto) {
        ventasPorProducto[item.producto] = (ventasPorProducto[item.producto] || 0) + 1;
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

// Rutas de la API con prefijo /api
app.use('/api/summary', summaryRoutes);
app.use('/api/crm-agente', protect, crmAgenteRoutes);
app.use('/api/costumer', protect, costumerRoutes);
app.use('/api/graficas', protect, graficasRoutes);
app.use('/api', graficasRoutes);

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

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
  // Limpiar la cookie de autenticación
  res.clearCookie('token');
  res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
