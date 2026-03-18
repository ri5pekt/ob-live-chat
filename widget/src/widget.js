import './styles.css'
import { createLauncher, setLauncherIcon, setUnreadCount } from './ui/launcher.js'
import { initApp, openChat, notifyWindowClosed } from './app.js'
import { store } from './store.js'

;(function () {
  if (window.__LIVE_CHAT_LOADED__) return
  window.__LIVE_CHAT_LOADED__ = true

  const root = document.createElement('div')
  root.id = 'lc-root'
  document.body.appendChild(root)

  let chatOpen = false

  // Admin-only reset button (visible only to WP logged-in admins)
  if (
    document.body.classList.contains('logged-in') &&
    document.body.classList.contains('admin-bar')
  ) {
    const resetBtn = document.createElement('button')
    resetBtn.id = 'lc-reset-btn'
    resetBtn.title = 'Reset chat session (admin only)'
    resetBtn.textContent = '↺ Reset'
    resetBtn.addEventListener('click', () => {
      if (!confirm('Reset chat session? This will treat you as a new visitor on next load.')) return
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('lc_'))
          .forEach((k) => localStorage.removeItem(k))
      } catch {}
      window.location.reload()
    })
    root.appendChild(resetBtn)
  }

  const launcher = createLauncher(handleLauncherClick)
  root.appendChild(launcher)

  initApp(root, (count) => {
    setUnreadCount(count)
  }, () => {
    chatOpen = false
    setLauncherIcon(false)
  }).then(() => {
    if (store.unreadCount > 0) {
      setUnreadCount(store.unreadCount)
    }
  }).catch(() => {})

  async function handleLauncherClick() {
    chatOpen = !chatOpen
    setLauncherIcon(chatOpen)

    if (chatOpen) {
      setUnreadCount(0)
      await openChat()
    } else {
      notifyWindowClosed()
      const win = document.getElementById('lc-window')
      if (win) win.classList.add('lc-hidden')
    }
  }
})()
