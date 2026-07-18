/**
 * Application entry point.
 * Implements FRONTEND_ARCHITECTURE.md §3's app/ bootstrap contract:
 * mounts React, initializes i18next, then renders App.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './translations/i18n.js';
import './styles/main.scss';
import App from './app/App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
