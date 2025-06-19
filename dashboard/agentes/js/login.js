// --- CONFIGURACIÓN AUTOMÁTICA DE URL DEL BACKEND ---
const API_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://connecting-klf7.onrender.com"; // Cambia esta URL por la de tu backend en producción

document.getElementById('loginForm').onsubmit = async function(e) {
  e.preventDefault();
  const user = this.user.value;
  const pass = this.pass.value;
  const err = document.getElementById('loginError');
  err.style.display = 'none';

  try {
    const resp = await fetch(`${API_URL}/api/agente/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ user, pass })
    });
    const data = await resp.json();

    if (data.success && data.token) {
      // Guarda el token en localStorage
      localStorage.setItem('token', data.token);
      // Redirecciona al dashboard
      window.location.href = "dashboard.html";
    } else {
      err.textContent = data.error || "Usuario o contraseña incorrectos.";
      err.style.display = 'block';
    }
  } catch (error) {
    err.textContent = "Error de conexión. Intenta más tarde.";
    err.style.display = 'block';
  }
};