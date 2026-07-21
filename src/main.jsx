import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global error guard for browser extension / Range DOM selection errors (e.g. Google Translate, text selection tools)
window.addEventListener('error', (event) => {
  if (
    event.message &&
    (event.message.includes('selectNode') ||
     event.message.includes('InvalidNodeTypeError') ||
     event.message.includes('has no parent'))
  ) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
}, true);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
