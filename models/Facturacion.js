document.getElementById('btnGuardarFacturacion').addEventListener('click', guardarTodoFacturacion);

async function guardarTodoFacturacion() {
  const filas = Array.from(document.querySelectorAll('#excelBody tr'));
  let guardados = 0, errores = 0;
  for (const tr of filas) {
    const tds = Array.from(tr.children);
    const fecha = tds[0].textContent.trim();
    const campos = tds.slice(1).map(td => td.textContent.trim());
    // Solo guardar si algún campo tiene dato
    if (campos.some(val => val !== "")) {
      const res = await fetch('/api/facturacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, campos })
      });
      const data = await res.json();
      if (data.ok) guardados++;
      else errores++;
    }
  }
  actualizarGraficaFacturacion();
  alert(`Guardados: ${guardados}. Errores: ${errores}`);
}

// Modifica la función actualizarGraficaFacturacion para mostrar el total del mes:
async function actualizarGraficaFacturacion() {
  const mes = filtroMes.value;
  const ano = filtroAno.value;
  const resp = await fetch(`/api/facturacion/estadistica/${ano}/${mes}`);
  const { totalesPorDia } = await resp.json();

  // Total del mes (suma de totales diarios)
  const totalMes = totalesPorDia.reduce((a, b) => a + b, 0);

  graficaFacturacion.data.labels = ["Total del mes"];
  graficaFacturacion.data.datasets[0].data = [totalMes];
  graficaFacturacion.update();
}