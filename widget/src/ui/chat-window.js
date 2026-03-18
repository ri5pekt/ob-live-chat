import {
  createMessageList,
  renderMessages,
  appendMessage,
  showSkeleton,
  scrollToBottom,
  updateTypingVisibility,
} from './message-list.js'
import { createComposer, setComposerDisabled } from './composer.js'
import logoUrl from '../assets/ab-logo.svg'

let windowEl = null

const STATUS_LABELS = {
  connected: 'מחובר',
  reconnecting: 'מתחבר מחדש...',
  loading: 'טוען...',
  error: 'שגיאת חיבור',
  closed: 'הצ\'אט סגור',
  opened: 'מתחבר...',
}

export function createChatWindow({ onClose, onSend }) {
  windowEl = document.createElement('div')
  windowEl.id = 'lc-window'
  windowEl.className = 'lc-hidden'
  windowEl.setAttribute('role', 'dialog')
  windowEl.setAttribute('aria-label', 'Support chat')

  // Header
  const header = document.createElement('div')
  header.id = 'lc-header'
  header.innerHTML = `
    <div id="lc-header-avatar">
      <img src="${logoUrl}" alt="logo" />
    </div>
    <div id="lc-header-info">
      <div id="lc-header-title">שירות לקוחות</div>
      <div id="lc-status-indicator">
        <span id="lc-status-dot"></span>
        <span id="lc-status-text">מתחבר...</span>
      </div>
    </div>
    <button id="lc-close-btn" aria-label="Close chat">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  `
  windowEl.appendChild(header)

  // Message list
  const messageList = createMessageList()
  windowEl.appendChild(messageList)

  // Closed banner
  const closedBanner = document.createElement('div')
  closedBanner.id = 'lc-closed-banner'
  closedBanner.textContent = 'הצ\'אט נסגר על ידי נציג התמיכה.'
  windowEl.appendChild(closedBanner)

  // Composer
  const composer = createComposer(onSend)
  windowEl.appendChild(composer)

  windowEl.querySelector('#lc-close-btn')?.addEventListener('click', onClose)

  return windowEl
}

export function openWindow() {
  if (windowEl) windowEl.classList.remove('lc-hidden')
}

export function closeWindow() {
  if (windowEl) windowEl.classList.add('lc-hidden')
}

export function setStatus(status) {
  const dot = document.getElementById('lc-status-dot')
  const text = document.getElementById('lc-status-text')
  if (!dot || !text) return

  dot.className = 'lc-status-dot'
  text.textContent = STATUS_LABELS[status] ?? status

  if (status === 'reconnecting') {
    dot.classList.add('lc-reconnecting')
    text.style.color = '#f59e0b'
  } else if (status === 'error') {
    dot.classList.add('lc-error')
    text.style.color = '#ef4444'
  } else {
    text.style.color = ''
  }

  if (status === 'closed') {
    showClosedBanner()
    setComposerDisabled(true)
  }
}

export function showClosedBanner() {
  const banner = document.getElementById('lc-closed-banner')
  if (banner) banner.style.display = 'block'
  setComposerDisabled(true)
}

// no-ops kept so any leftover callers don't crash
export function showContactPanel() {}
export function hideContactPanel() {}

export { renderMessages, appendMessage, showSkeleton, scrollToBottom, updateTypingVisibility }
