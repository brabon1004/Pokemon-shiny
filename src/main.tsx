import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles/tokens.css'
import './styles/app.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Unable to mount app: index.html has no #root element')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
