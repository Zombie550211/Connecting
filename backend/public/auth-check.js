/**
 * Verifica si el usuario está autenticado antes de permitir el acceso a la página.
 * Redirige a la página de login si no hay un token válido.
 */

(function() {
  'use strict';

  // Lista de rutas públicas que no requieren autenticación
  const rutasPublicas = [
    '/login.html',
    '/index.html',
    '/'
  ];

  // Verificar si la ruta actual es pública
  const esRutaPublica = rutasPublicas.some(ruta => 
    window.location.pathname.endsWith(ruta)
  );

  if (esRutaPublica) {
    return; // No hacer verificación en rutas públicas
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
      console.log('🔍 Verificando token...');
      const response = await fetch('/api/auth/verificar-token', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include', // Importante para incluir cookies de sesión
        cache: 'no-store' // Evitar caché
      });

      console.log('🔍 Respuesta del servidor:', response.status, response.statusText);

      if (!response.ok) {
        // Si el error es 401 (No autorizado), redirigir al login
        if (response.status === 401) {
          console.warn('⚠️ Token inválido o expirado');
          localStorage.removeItem('token'); // Limpiar token inválido
          document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
          throw new Error('Sesión expirada o inválida');
        }
        throw new Error(`Error en la verificación: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔍 Datos de autenticación:', data);
      
      if (data.success && data.usuario) {
        console.log('✅ Usuario autenticado:', data.usuario);
        // Actualizar el token en localStorage si se envió uno nuevo
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        return true;
      } else {
        throw new Error('Respuesta de autenticación inválida');
      }
    } catch (error) {
      console.error('❌ Error al verificar el token:', error.message);
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
