import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

try {
  const theme = localStorage.getItem('pulse_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
} catch {}

window.addEventListener('error', (e) => console.error('[global error]', e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[unhandled]', e.reason));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
