import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// This ensures we're in strict mode and forces the app to render completely
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 