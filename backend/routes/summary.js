const express = require('express');
const router = express.Router();

// Función para obtener la fecha actual en formato YYYY-MM-DD
function getFechaLocalHoy() {
  const hoy = new Date();
  const [month, day, year] = hoy.toLocaleDateString('es-SV', { timeZone: 'America/El_Salvador' }).split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Ruta de resumen con respuestas de ejemplo
router.get('/summary', (req, res) => {
  try {
    // Devolver valores predeterminados como ejemplo
    const resumen = {
      ventasHoy: 0,        // Número de ventas hoy
      leadsPendientes: 0,  // Número de leads pendientes
      clientes: 0,         // Número total de clientes
      ventasMes: 0         // Número de ventas este mes
    };
    
    res.json(resumen);
  } catch (err) {
    console.error('Error al obtener el resumen:', err);
    res.status(500).json({ error: 'Error al obtener el resumen' });
  }
});

module.exports = router;