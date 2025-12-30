import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Registro del Service Worker para habilitar PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(reg => console.log('SW registrado con éxito', reg.scope))
      .catch(err => console.log('Error al registrar SW', err));
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);