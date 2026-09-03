import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(router)

app.mount('#app')

const VERSION_KEY = 'beluga-life-board-version'

async function checkForUpdate() {
  try {
    const versionUrl = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`

    const response = await fetch(versionUrl, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return
    }

    const data = await response.json()

    const latestVersion = data.version

    if (!latestVersion) {
      return
    }

    const currentVersion = localStorage.getItem(VERSION_KEY)

    if (!currentVersion) {
      localStorage.setItem(VERSION_KEY, latestVersion)

      return
    }

    if (currentVersion !== latestVersion) {
      localStorage.setItem(VERSION_KEY, latestVersion)

      window.location.reload()
    }
  } catch (error) {
    console.warn('업데이트 확인 실패:', error)
  }
}

checkForUpdate()

window.addEventListener('focus', checkForUpdate)

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkForUpdate()
  }
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)

      console.log('Service Worker 등록 완료')
    } catch (error) {
      console.error('Service Worker 등록 실패:', error)
    }
  })
}
