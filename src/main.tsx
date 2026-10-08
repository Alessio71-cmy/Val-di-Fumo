import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './ui/styles/tokens.css';
import './ui/styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root mancante');
if (!document.documentElement.dataset.theme) document.documentElement.dataset.theme = 'auto';
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
