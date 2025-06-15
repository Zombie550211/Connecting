document.getElementById('btnGuardarFacturacion').addEventListener('click', guardarTodoFacturacion);

function recalcularFila(tr) {
  const tds = Array.from(tr.children);

  // 1. VALOR DE VENTA (Alexis, CA, Lineas)
  // Alexis
  const alexis = parseFloat(tds[1].textContent) || 0;
  const ventasAlexis = parseFloat(tds[2].textContent) || 0;
  tds[3].textContent = ventasAlexis > 0 ? (alexis / ventasAlexis).toFixed(2) : "";

  // Cuenta alterna
  const cuentaAlterna = parseFloat(tds[4].textContent) || 0;
  const ventasCA = parseFloat(tds[5].textContent) || 0;
  tds[6].textContent = ventasCA > 0 ? (cuentaAlterna / ventasCA).toFixed(2) : "";

  // Lineas
  const lineas = parseFloat(tds[7].textContent) || 0;
  const ventasLineas = parseFloat(tds[8].textContent) || 0;
  tds[9].textContent = ventasLineas > 0 ? (lineas / ventasLineas).toFixed(2) : "";

  // 2. TOTAL DEL DIA (Alexis + Cuenta alterna + Lineas)
  const totalDia = alexis + cuentaAlterna + lineas;
  tds[10].textContent = totalDia.toFixed(2);

  // 3. TOTAL VENTAS (sumar todas las columnas "VENTAS POR DIA")
  const totalVentas = ventasAlexis + ventasCA + ventasLineas;
  tds[11].textContent = totalVentas > 0 ? totalVentas : "";

  // 4. VALOR VENTA AHORA (TOTAL DEL DIA / TOTAL VENTAS)
  tds[12].textContent = (totalVentas > 0) ? (totalDia / totalVentas).toFixed(2) : "";

  // 5. CPA PUNTOS (PUNTOS / TOTAL DEL DIA)
  const puntos = parseFloat(tds[13].textContent) || 0;
  tds[14].textContent = (totalDia > 0) ? (puntos / totalDia).toFixed(2) : "";
}

// Escucha cambios en celdas editables para recalcular automáticamente
document.getElementById('excelBody').addEventListener('input', function(e) {
  const td = e.target;
  const tr = td.parentElement;
  // Solo recalcula si no es cabecera ni columna calculada
  if (td.cellIndex !== 0 && ![3,6,9,10,11,12,14].includes(td.cellIndex)) {
    recalcularFila(tr);
  }
});

// Al guardar, asegúrate de recalcular todas las filas antes de enviar
async function guardarTodoFacturacion() {
  const filas = Array.from(document.querySelectorAll('#excelBody tr'));
  let guardados = 0, errores = 0;
  for (const tr of filas) {
    recalcularFila(tr); // recalcula la fila antes de guardar
    const tds = Array.from(tr.children);
    const fecha = tds[0].textContent.trim();
    // Solo se guardan las columnas 1-14 (no la fecha)
    const campos = tds.slice(1).map(td => td.textContent.trim());
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