// --- CONFIGURACIÓN AUTOMÁTICA DE URL DEL BACKEND ---
const API_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://connecting-klf7.onrender.com"; // <-- Cambia esta URL por la tuya de Render

// --- FUNCIÓN FETCH AUTENTICADA ---
async function fetchAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  options.headers = options.headers || {};
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, options);
}

// --- TAB NAVIGATION ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = function(e) {
    e.preventDefault();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('leadTab').style.display = (this.dataset.tab === 'leadTab') ? 'block' : 'none';
    document.getElementById('costumerTab').style.display = (this.dataset.tab === 'costumerTab') ? 'block' : 'none';
    if(this.dataset.tab === 'costumerTab') {
      cargarCostumerPanel();
    }
  }
});

// --- LEAD PANEL INICIALIZACIÓN ---
async function getAgenteInfo() {
  const resp = await fetchAuth(`${API_URL}/api/agente/info`);
  return await resp.json();
}
getAgenteInfo().then(info => {
  if(document.getElementById('nombreAgente')) document.getElementById('nombreAgente').textContent = info.nombre || '';
  if(document.getElementById('agente')) document.getElementById('agente').value = info.nombreCompleto || '';
  if(document.getElementById('fecha')) document.getElementById('fecha').valueAsDate = new Date();
  cargarGraficaMensual();
  cargarGraficaProducto();
});

// --- LEAD FORMULARIO (NUEVO FORMULARIO ADAPTADO) ---
document.getElementById('crmForm').onsubmit = async function(e) {
  e.preventDefault();
  const f = this;
  const formData = new FormData(f);

  // Mapear campos del formulario de acuerdo al HTML actualizado
  const data = {
    nombre_cliente: formData.get('nombre_cliente'),
    telefono_principal: formData.get('telefono_principal'),
    telefono_alterno: formData.get('telefono_alterno'),
    numero_cuenta: formData.get('numero_cuenta'),
    autopago: formData.get('autopago'),
    direccion: formData.get('direccion'),
    tipo_servicios: formData.get('tipo_servicios'),
    sistema: formData.get('sistema'),
    riesgo: formData.get('riesgo'),
    dia_venta: formData.get('dia_venta'),
    dia_instalacion: formData.get('dia_instalacion'),
    status: formData.get('status'),
    servicios: formData.get('servicios'),
    mercado: formData.get('mercado'),
    supervisor: formData.get('supervisor'),
    comentario: formData.get('comentario'),
    motivo_llamada: formData.get('motivo_llamada'),
    zip_code: formData.get('zip_code')
  };

  // Limpia mensajes previos
  let okDiv = document.getElementById('leadSuccess');
  let errorDiv = document.getElementById('leadError');
  if(okDiv) okDiv.style.display = "none";
  if(errorDiv) errorDiv.style.display = "none";

  // Envía datos al backend
  const resp = await fetchAuth(`${API_URL}/api/agente/leads`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  const res = await resp.json();

  // Usar SweetAlert2 si existe, si no usar alert clásico
  if(res.success){
    if(typeof Swal !== "undefined") {
      Swal.fire({
        icon: 'success',
        title: '¡Venta registrada!',
        text: 'Lead guardado correctamente.',
        timer: 1800,
        showConfirmButton: false
      });
    } else {
      if(okDiv) {
        okDiv.textContent = "Venta registrada!";
        okDiv.style.display = "block";
      } else {
        alert("Venta registrada!");
      }
    }
    f.reset();
    // Si tienes campos de fecha que quieres resetear a hoy:
    if(f.dia_venta) f.dia_venta.value = new Date().toISOString().slice(0,10);
    if(f.dia_instalacion) f.dia_instalacion.value = new Date().toISOString().slice(0,10);
    // Actualizar gráficas y métricas
    cargarGraficaMensual();
    cargarGraficaProducto();
    if(typeof cargarCostumerPanel === 'function') cargarCostumerPanel();
  }else{
    if(typeof Swal !== "undefined") {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: res.error || "Error al guardar."
      });
    } else {
      if(errorDiv) {
        errorDiv.textContent = res.error || "Error al guardar.";
        errorDiv.style.display = "block";
      } else {
        alert(res.error || "Error al guardar.");
      }
    }
  }
};

// --- GRÁFICAS ---
async function cargarGraficaMensual() {
  const resp = await fetchAuth(`${API_URL}/api/agente/estadisticas-mes`);
  const data = await resp.json();
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const ctx = document.getElementById('graficaMensual')?.getContext('2d');
  if(!ctx) return;
  if(window.graficaMensualObj) window.graficaMensualObj.destroy();
  window.graficaMensualObj = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: meses,
      datasets: [
        { label:'Ventas', data: data.ventasPorMes, backgroundColor: '#22b3ec' },
        { label:'Puntaje', data: data.puntajePorMes, backgroundColor: '#ef5350' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend:{position:'top'}, title:{display:true,text:'Ventas mensuales personales'} },
      scales: { x:{ticks:{color:'#222'}}, y:{beginAtZero:true} }
    }
  });
}
async function cargarGraficaProducto() {
  const resp = await fetchAuth(`${API_URL}/api/agente/ventas-producto`);
  const data = await resp.json();
  const ctx = document.getElementById('graficaProducto')?.getContext('2d');
  if(!ctx) return;
  if(window.graficaProductoObj) window.graficaProductoObj.destroy();
  window.graficaProductoObj = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{ label:'Ventas por producto', data: data.data, backgroundColor: '#22b3ec' }]
    },
    options:{ responsive:true, plugins:{legend:{display:false},title:{display:true,text:'Ventas por producto'}}, indexAxis:'x', scales:{x:{ticks:{color:'#222'}}, y:{beginAtZero:true}} }
  });
}

// --- COSTUMER PANEL (MÉTRICAS + FILTROS + TABLA) ---
let costumerFiltro = {
  fechaDesde: '', fechaHasta: '', team: '', numero: '', direccion: '', zip: ''
};

async function cargarCostumerPanel() {
  await Promise.all([
    cargarCostumerMetricas(),
    cargarCostumerTeams(),
    cargarCostumersTabla()
  ]);
}

// --- Métricas ---
async function cargarCostumerMetricas() {
  const params = new URLSearchParams(costumerFiltro).toString();
  const resp = await fetchAuth(`${API_URL}/api/agente/costumer-metricas?` + params);
  const m = await resp.json();
  if(document.getElementById('ventasHoy')) document.getElementById('ventasHoy').textContent = m.ventasHoy || 0;
  if(document.getElementById('leadsPendientes')) document.getElementById('leadsPendientes').textContent = m.leadsPendientes || 0;
  if(document.getElementById('clientesTotal')) document.getElementById('clientesTotal').textContent = m.clientes || 0;
  if(document.getElementById('ventasMes')) document.getElementById('ventasMes').textContent = m.ventasMes || 0;
}

// --- Teams para filtro ---
async function cargarCostumerTeams() {
  const resp = await fetchAuth(`${API_URL}/api/agente/teams`);
  const teams = await resp.json();
  const sel = document.getElementById('filtroTeam');
  if(!sel) return;
  let prev = sel.value;
  sel.innerHTML = '<option value="">Todos</option>' + teams.map(t=>`<option value="${t}">${t}</option>`).join('');
  sel.value = prev || '';
}

// --- Tabla principal ---
async function cargarCostumersTabla() {
  const params = new URLSearchParams(costumerFiltro).toString();
  const resp = await fetchAuth(`${API_URL}/api/agente/costumer?` + params);
  const data = await resp.json();
  const tbody = document.querySelector('#tablaCostumer tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  data.costumers.forEach(c => {
    tbody.innerHTML += `<tr>
      <td>${c.fecha||''}</td>
      <td>${c.equipo||''}</td>
      <td>${c.agente||''}</td>
      <td>${c.producto||''}</td>
      <td>${c.estado||''}</td>
      <td>${c.puntaje||''}</td>
      <td>${c.cuenta||''}</td>
      <td>${c.telefono||''}</td>
      <td>${c.direccion||''}</td>
      <td>${c.zip||''}</td>
      <td class="acciones">
        <button onclick="editarCostumer('${c._id}')" title="Editar">&#9998;</button>
        <button onclick="eliminarCostumer('${c._id}')" title="Eliminar" style="color:#ef5350;">&#10006;</button>
      </td>
    </tr>`;
  });
}

// --- Filtros ---
function actualizarFiltroCostumer() {
  costumerFiltro.fechaDesde = document.getElementById('filtroFechaDesde')?.value || '';
  costumerFiltro.fechaHasta = document.getElementById('filtroFechaHasta')?.value || '';
  costumerFiltro.team = document.getElementById('filtroTeam')?.value || '';
  costumerFiltro.numero = document.getElementById('filtroNumero')?.value || '';
  costumerFiltro.direccion = document.getElementById('filtroDireccion')?.value || '';
  costumerFiltro.zip = document.getElementById('filtroZip')?.value || '';
  cargarCostumerPanel();
}
['filtroFechaDesde','filtroFechaHasta','filtroTeam','filtroNumero','filtroDireccion','filtroZip'].forEach(id=>{
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('change',actualizarFiltroCostumer);
  el.addEventListener('input',actualizarFiltroCostumer);
});

// --- ACCIONES: EDITAR / ELIMINAR ---
window.eliminarCostumer = async function(id){
  if(!confirm("¿Seguro de eliminar este registro?")) return;
  const resp = await fetchAuth(`${API_URL}/api/agente/costumer/`+id, {method:'DELETE'});
  const data = await resp.json();
  if(data.success){
    cargarCostumerPanel();
  }else{
    alert("Error al eliminar");
  }
};
window.editarCostumer = function(id){
  alert("Función de edición pendiente de implementar.");
  // Aquí podrías abrir un modal con los datos del costumer, etc.
};

// --- ACCIONES: DESCARGAR EXCEL ---
if(document.getElementById('btnDescargarExcel')) {
  document.getElementById('btnDescargarExcel').onclick = function(){
    const params = new URLSearchParams(costumerFiltro).toString();
    const token = localStorage.getItem('token');
    let url = `${API_URL}/api/agente/costumer-excel?` + params;
    if(token) {
      url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
    }
    window.open(url, '_blank');
  };
}

// --- ACCIONES: IMPORTAR EXCEL ---
let archivoSeleccionado = null;
if(document.getElementById('btnSeleccionarArchivo')) {
  document.getElementById('btnSeleccionarArchivo').onclick = function(){
    document.getElementById('inputExcel').click();
  };
}
if(document.getElementById('inputExcel')) {
  document.getElementById('inputExcel').onchange = function(){
    archivoSeleccionado = this.files[0];
    document.getElementById('nombreArchivo').textContent = archivoSeleccionado ? archivoSeleccionado.name : "Ningún archivo seleccionado";
  };
}
if(document.getElementById('btnImportarExcel')) {
  document.getElementById('btnImportarExcel').onclick = async function(){
    if(!archivoSeleccionado) return alert("Selecciona un archivo Excel primero.");
    const formData = new FormData();
    formData.append('excel', archivoSeleccionado);
    const resp = await fetchAuth(`${API_URL}/api/agente/costumer-import`, {method:'POST', body:formData});
    const data = await resp.json();
    if(data.success){
      alert("Importado correctamente.");
      archivoSeleccionado = null;
      document.getElementById('inputExcel').value = "";
      document.getElementById('nombreArchivo').textContent = "Ningún archivo seleccionado";
      cargarCostumerPanel();
    }else{
      alert("Error al importar: " + (data.error || ""));
    }
  };
}

// --- ACCIONES: ELIMINAR TODO ---
if(document.getElementById('btnEliminarTodo')) {
  document.getElementById('btnEliminarTodo').onclick = async function(){
    if(!confirm("¿Seguro de eliminar TODOS tus costumers?")) return;
    const resp = await fetchAuth(`${API_URL}/api/agente/costumer-eliminar-todo`, {method:'DELETE'});
    const data = await resp.json();
    if(data.success){
      alert("Eliminados todos los registros.");
      cargarCostumerPanel();
    }else{
      alert("Error al eliminar todo.");
    }
  };
}

// --- Inicialización automática si se entra directo a costumer ---
if(window.location.hash === "#costumer" || window.location.search.includes("costumer")){
  const tab = document.getElementById('tabCostumer');
  if(tab) tab.click();
}