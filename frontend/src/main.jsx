import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { MarzbanProvider } from './context/MarzbanContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MarzbanProvider>
          <App />
          <Toaster position="top-right" />
        </MarzbanProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)