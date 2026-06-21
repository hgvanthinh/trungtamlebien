import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Sau khi deploy bản mới, file JS/CSS cũ có thể đã bị xoá trên server.
// Nếu trình duyệt cố load lại chunk cũ đó (do index.html bị cache), Vite báo lỗi này.
// Reload 1 lần để lấy index.html + bundle mới nhất, tránh màn hình trắng.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('reloaded-after-preload-error')) {
    sessionStorage.setItem('reloaded-after-preload-error', '1')
    window.location.reload()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
