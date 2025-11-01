import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from './components/Toast'
import './index.css'
import './styles/global.css'
import './styles/mobile.css'
import './styles/fixes.css'
/* mobile.css disabled to restore original mobile behavior */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App/>
    </ToastProvider>
  </React.StrictMode>
)
