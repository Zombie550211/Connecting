// Middleware para verificar si el usuario está autenticado
const protect = (req, res, next) => {
  if (req.session && req.session.user) {
    // Usuario autenticado, continuar
    return next();
  }
  
  // Usuario no autenticado
  return res.status(401).json({ 
    success: false, 
    error: 'No autorizado. Por favor inicia sesión.' 
  });
};

// Middleware para verificar si el usuario es administrador
const admin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.rol === 'admin') {
    // Usuario es administrador, continuar
    return next();
  }
  
  // Usuario no autorizado
  return res.status(403).json({ 
    success: false, 
    error: 'No tienes permisos para realizar esta acción.' 
  });
};

module.exports = {
  protect,
  admin
};
