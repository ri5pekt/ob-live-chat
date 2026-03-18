import './styles.css'
import { createLauncher, setLauncherIcon, setUnreadCount } from './ui/launcher.js'
import { initApp, openChat, notifyWindowClosed } from './app.js'
import { store } from './store.js'

;(function () {
  console.log('[LiveChat] script executing')

  if (window.__LIVE_CHAT_LOADED__) {
    console.warn('[LiveChat] already loaded, skipping')
    return
  }
  window.__LIVE_CHAT_LOADED__ = true

  console.log('[LiveChat] config:', window.__LIVE_CHAT_CONFIG__ ?? '(none — using default)')

  const root = document.createElement('div')
  root.id = 'lc-root'
  document.body.appendChild(root)
  console.log('[LiveChat] #lc-root appended to body')

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
      console.log('[LiveChat] session reset by admin')
      window.location.reload()
    })
    root.appendChild(resetBtn)
  }

  const launcher = createLauncher(handleLauncherClick)
  root.appendChild(launcher)
  console.log('[LiveChat] launcher button rendered')

  initApp(root, (count) => {
    console.log('[LiveChat] unread count:', count)
    setUnreadCount(count)
  }, () => {
    // Header X button was clicked — sync launcher state
    chatOpen = false
    setLauncherIcon(false)
  }).then(() => {
    // Show any persisted unread count immediately after init
    if (store.unreadCount > 0) {
      setUnreadCount(store.unreadCount)
      console.log('[LiveChat] restored unread count from storage:', store.unreadCount)
    }
  }).catch((err) => {
    console.error('[LiveChat] init error:', err)
  })

  async function handleLauncherClick() {
    chatOpen = !chatOpen
    console.log('[LiveChat] launcher clicked, chatOpen:', chatOpen)
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
