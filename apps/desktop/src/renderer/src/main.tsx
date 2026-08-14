import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BootstrapApp } from './bootstrap/BootstrapApp'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('TELOS renderer root was not found')
}

createRoot(root).render(
  <StrictMode>
    <BootstrapApp />
  </StrictMode>
)
