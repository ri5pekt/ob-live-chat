import { createMessageElement, createSkeletonMessages } from './message-item.js'
import { showTypingIndicator, removeTypingIndicator } from './typing-indicator.js'
import { store } from '../store.js'

let listEl = null

export function createMessageList() {
  listEl = document.createElement('div')
  listEl.id = 'lc-messages'
  listEl.setAttribute('role', 'log')
  listEl.setAttribute('aria-live', 'polite')
  return listEl
}

export function renderMessages(messages) {
  if (!listEl) return
  listEl.innerHTML = ''

  if (messages.length === 0) {
    const empty = document.createElement('p')
    empty.style.cssText = 'text-align:center;color:#94a3b8;padding:24px 0;font-size:13px'
    empty.textContent = '...שלח הודעה ראשונה'
    listEl.appendChild(empty)
  } else {
    messages.forEach((msg) => listEl.appendChild(createMessageElement(msg)))
  }

  updateTypingVisibility()
  scrollToBottom(false)
}

export function appendMessage(message) {
  if (!listEl) return

  const empty = listEl.querySelector('p')
  if (empty) empty.remove()

  const existing = listEl.querySelector(`[data-message-id="${message.id}"]`)
  if (existing) {
    existing.replaceWith(createMessageElement(message))
  } else {
    // Insert before typing indicator if present
    const indicator = document.getElementById('lc-typing-wrapper')
    if (indicator) {
      listEl.insertBefore(createMessageElement(message), indicator)
    } else {
      listEl.appendChild(createMessageElement(message))
    }
    scrollToBottom(true)
  }

  if (message.senderType === 'agent') {
    removeTypingIndicator()
  }
}

export function updateTypingVisibility() {
  if (!listEl) return
  if (!store.agentHasReplied && store.status !== 'closed') {
    showTypingIndicator(listEl)
  } else {
    removeTypingIndicator()
  }
}

export function showSkeleton() {
  if (!listEl) return
  listEl.innerHTML = ''
  listEl.appendChild(createSkeletonMessages())
}

export function scrollToBottom(smooth = true) {
  if (!listEl) return
  listEl.scrollTo({ top: listEl.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
}

export function injectContactCard(cardEl) {
  if (!listEl) return
  if (document.getElementById('lc-contact-card')) return // already present
  const indicator = document.getElementById('lc-typing-wrapper')
  if (indicator) {
    listEl.insertBefore(cardEl, indicator)
  } else {
    listEl.appendChild(cardEl)
  }
  scrollToBottom(true)
}
