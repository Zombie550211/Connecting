const express = require('express');
const router = express.Router();

// Datos de prueba
const datosPrueba = [
  {
    fecha: new Date('2023-08-01T10:00:00'),
    equipo: 'Equipo A',
    agente: 'Juan Pérez',
    producto: 'Internet Básico',
    fecha_instalacion: new Date('2023-08-05T14:30:00'),
    estado: 'Completado',
    puntaje: 85,
    cuenta: 'CLI-001',
    telefono: '555-123-4567',
    direccion: 'Calle Falsa 123',
    zip: '01010'
  },
  {
    fecha: new Date('2023-08-02T11:30:00'),
    equipo: 'Equipo B',
    agente: 'María García',
    producto: 'Internet Premium',
    fecha_instalacion: new Date('2023-08-06T10:00:00'),
    estado: 'Pendiente',
    puntaje: 92,
    cuenta: 'CLI-002',
    telefono: '555-987-6543',
    direccion: 'Avenida Siempre Viva 742',
    zip: '02020'
  },
  {
    fecha: new Date('2023-08-03T09:15:00'),
    equipo: 'Equipo A',
    agente: 'Carlos López',
    producto: 'TV + Internet',
    fecha_instalacion: new Date('2023-08-07T16:45:00'),
    estado: 'Cancelado',
    puntaje: 78,
    cuenta: 'CLI-003',
    telefono: '555-456-7890',
    direccion: 'Boulevard de los Sueños 456',
    zip: '03030'
  }
];

// Ventas Hoy - Datos de prueba
router.get('/ventas/hoy', (req, res) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  
  const ventasHoy = datosPrueba.filter(cliente => {
    return cliente.fecha >= hoy && cliente.fecha < manana;
  });
  
  res.json({ total: ventasHoy.length });
});

// Leads Pendientes - Datos de prueba
router.get('/leads/pendientes', (req, res) => {
  const pendientes = datosPrueba.filter(cliente => cliente.estado === 'Pendiente');
  res.json({ total: pendientes.length });
});

// Total Clientes - Datos de prueba
router.get('/clientes', (req, res) => {
  res.json({ total: datosPrueba.length });
});

// Ventas este mes - Datos de prueba
router.get('/ventas/mes', (req, res) => {
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  
  const ventasMes = datosPrueba.filter(cliente => {
    return cliente.fecha >= primerDiaMes && cliente.fecha <= hoy;
  });
  
  res.json({ total: ventasMes.length });
});

// Obtener lista de clientes con filtros - Datos de prueba
router.get('/clientes/lista', (req, res) => {
  const { desde, hasta, mes, anio } = req.query;
  let clientesFiltrados = [...datosPrueba];

  // Aplicar filtros si existen
  if (desde && hasta) {
    const fechaDesde = new Date(desde);
    const fechaHasta = new Date(hasta);
    clientesFiltrados = clientesFiltrados.filter(cliente => 
      cliente.fecha >= fechaDesde && cliente.fecha <= fechaHasta
    );
  } else if (mes && anio) {
    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0);
    ultimoDia.setHours(23, 59, 59, 999);
    
    clientesFiltrados = clientesFiltrados.filter(cliente => 
      cliente.fecha >= primerDia && cliente.fecha <= ultimoDia
    );
  }

  // Ordenar por fecha descendente
  clientesFiltrados.sort((a, b) => b.fecha - a.fecha);

  res.json({ clientes: clientesFiltrados });
});

module.exports = router;