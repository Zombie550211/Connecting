/**
 * Verifica si el usuario está autenticado antes de permitir el acceso a la página.
 * Redirige a la página de login si no hay un token válido.
 */

(function() {
  'use strict';

  // Verificar si estamos en la página de login para evitar redirección infinita
  if (window.location.pathname.endsWith('login.html') || 
      window.location.pathname.endsWith('login.html/')) {
    return;
  }

  // Función para verificar el token
  async function verificarToken() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.warn('❌ No se encontró token de autenticación');
      redirigirALogin();
      return false;
    }

    try {
      const response = await fetch('/api/auth/verificar-token', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Token inválido o expirado');
      }

      const data = await response.json();
      console.log('✅ Usuario autenticado:', data.usuario);
      return true;
    } catch (error) {
      console.error('❌ Error al verificar el token:', error);
      redirigirALogin();
      return false;
    }
  }

  // Función para redirigir al login
  function redirigirALogin() {
    // Guardar la URL actual para redirigir después del login
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login.html?returnUrl=${returnUrl}`;
  }

  // Ejecutar la verificación cuando se carga la página
  document.addEventListener('DOMContentLoaded', verificarToken);

  // También verificar periódicamente (cada 5 minutos)
  setInterval(verificarToken, 5 * 60 * 1000);
})();
