import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/responsive.css';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import AppToaster from './ui/AppToaster.jsx';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AppToaster />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
