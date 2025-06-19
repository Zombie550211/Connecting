// Verifica si el token existe en localStorage antes de cargar el dashboard
if (!localStorage.getItem('token')) {
  window.location.href = "login.html";
}