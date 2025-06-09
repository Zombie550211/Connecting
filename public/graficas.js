let chartTeam, chartProducto;

document.addEventListener("DOMContentLoaded", () => {
  // Si tienes filtros de fecha, usa "fecha-desde" como filtro principal para gráficas
  const fechaDesde = document.getElementById("fecha-desde");
  const hoy = new Date().toISOString().slice(0,10);
  if (fechaDesde) fechaDesde.value = hoy;

  // Cargar al iniciar
  cargarGraficasParaFecha(hoy);

  // Recargar gráficas al cambiar el filtro de fecha (puedes ajustar para aceptar rango si tu backend lo soporta)
  if (fechaDesde) {
    fechaDesde.addEventListener("change", () => {
      cargarGraficasParaFecha(fechaDesde.value);
    });
  }
  // Si más adelante tu backend soporta rango, puedes usar fecha-hasta también.
});

function cargarGraficasParaFecha(fecha) {
  // Modifica el endpoint según tu backend (aquí solo usa una fecha)
  fetch(`/api/graficas-costumer?fecha=${fecha}`)
    .then(res => res.json())
    .then(data => {
      renderGraficas(data);
    });
}

function renderGraficas(data) {
  // Datos para Team
  const labelsTeam = Object.keys(data.ventasPorEquipo || {});
  const ventasTeam = Object.values(data.ventasPorEquipo || {});
  const puntosTeam = labelsTeam.map(team => (data.puntosPorEquipo && data.puntosPorEquipo[team]) || 0);

  // Datos para Producto
  const labelsProducto = Object.keys(data.ventasPorProducto || {});
  const ventasProducto = Object.values(data.ventasPorProducto || {});

  // Chart Team (barra agrupada)
  const ctxTeam = document.getElementById('graficaTeam').getContext('2d');
  if(chartTeam) chartTeam.destroy();
  chartTeam = new Chart(ctxTeam, {
    type: 'bar',
    data: {
      labels: labelsTeam,
      datasets: [
        {
          label: 'Ventas',
          data: ventasTeam,
          backgroundColor: 'rgba(54, 162, 235, 0.7)'
        },
        {
          label: 'Puntaje',
          data: puntosTeam,
          backgroundColor: 'rgba(255, 99, 132, 0.7)'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });

  // Chart Producto
  const ctxProducto = document.getElementById('graficaProducto').getContext('2d');
  if(chartProducto) chartProducto.destroy();
  chartProducto = new Chart(ctxProducto, {
    type: 'bar',
    data: {
      labels: labelsProducto,
      datasets: [{
        label: 'Ventas',
        data: ventasProducto,
        backgroundColor: 'rgba(153, 102, 255, 0.7)'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 } },
        y: { beginAtZero: true }
      }
    }
  });

  // Mensaje si no hay datos
  const mensajeDiv = document.getElementById("mensajeSinDatos");
  if (mensajeDiv) {
    if(!labelsTeam.length && !labelsProducto.length) {
      mensajeDiv.innerText = "No hay datos para esta fecha";
    } else {
      mensajeDiv.innerText = "";
    }
  }
}

// Si agregas un nuevo lead y quieres recargar las gráficas, llama a esta función
function onNuevoLeadAgregado() {
  const fechaDesde = document.getElementById("fecha-desde");
  const fecha = fechaDesde ? fechaDesde.value : new Date().toISOString().slice(0,10);
  cargarGraficasParaFecha(fecha);
}