// Redirige al login si no hay token de sesión en localStorage
(function () {
  const token = localStorage.getItem('token'); // Cambia 'token' si usas otro nombre
  if (!token) {
    window.location.href = 'login.html'; // Cambia si tu login tiene otro nombre
  }
})();