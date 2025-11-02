import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from './components/Toast'
import './index.css'
import './styles/global.css'
import './styles/mobile.css'
import './styles/fixes.css'

// 🔄 一次性版本号缓存刷新（base: '/' 迁移时生效）
// 这段代码在版本变化时触发一次 reload，清除旧 hash 缓存
const APP_VERSION = '2025-11-02-base-slash-v1'
const VERSION_KEY = 'app_version_cache_key'

try {
  const storedVersion = localStorage.getItem(VERSION_KEY)
  if (storedVersion !== APP_VERSION) {
    console.log(
      `[Cache] Version changed: ${storedVersion || 'none'} → ${APP_VERSION}. Clearing cache and reloading...`
    )
    localStorage.setItem(VERSION_KEY, APP_VERSION)
    
    // 清理所有 localStorage 前缀的缓存（可选，保留关键数据）
    const keysToKeep = ['firebaseAuthToken', 'uid', 'cs.profile.'] // 保留这些前缀的键
    const allKeys = Object.keys(localStorage)
    allKeys.forEach(key => {
      const shouldKeep = keysToKeep.some(prefix => key.startsWith(prefix))
      if (!shouldKeep && key !== VERSION_KEY) {
        localStorage.removeItem(key)
      }
    })
    
    // 清理浏览器缓存
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName)
        })
      })
    }
    
    // 注销 Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => reg.unregister())
      })
    }
    
    // 一次性 reload，不会再次触发（因为版本号已更新）
    setTimeout(() => {
      location.reload()
    }, 100)
  }
} catch (err) {
  console.warn('[Cache] Version check error:', err)
  // 继续运行，不中断应用
}

/* mobile.css disabled to restore original mobile behavior */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App/>
    </ToastProvider>
  </React.StrictMode>
)
