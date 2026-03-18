import { store } from './store.js'
import { api } from './api.js'
import { connectSocket, onNewMessage, onStatusChange, onVisitorNameUpdate } from './socket.js'
import {
  createChatWindow,
  openWindow,
  closeWindow,
  setStatus,
  renderMessages,
  appendMessage,
  showSkeleton,
  updateTypingVisibility,
} from './ui/chat-window.js'
import { injectContactCard } from './ui/message-list.js'
import { createInlineContactCard } from './ui/contact-form.js'
import { createMessageElement } from './ui/message-item.js'

const LS_SESSION_ID = 'lc_session_id'
const LS_VISITOR_TOKEN = 'lc_visitor_token'
const LS_VISITOR_NAME = 'lc_visitor_name'

let unreadCount = 0
let windowOpen = false
let _onChatClosed = null
let contactCardShown = false

export async function initApp(root, onUnreadChange, onChatClosed) {
  _onChatClosed = onChatClosed ?? null
  console.log('[LiveChat] initApp starting')
  loadFromStorage()
  console.log('[LiveChat] storage loaded — sessionId:', store.sessionId, 'hasToken:', !!store.visitorToken)

  const chatWindow = createChatWindow({
    onClose: handleClose,
    onSend: handleSend,
  })
  root.appendChild(chatWindow)
  console.log('[LiveChat] chat window DOM created')


  onNewMessage((message) => {
    console.log('[LiveChat] new message received:', message)
    appendMessage(message)
    updateTypingVisibility()
    if (!windowOpen) {
      unreadCount++
      store.incrementUnread()
      onUnreadChange?.(store.unreadCount)
    }
  })

  onStatusChange((status) => {
    console.log('[LiveChat] socket status changed:', status)
    setStatus(status)
    store.setState({ status })
  })

  onVisitorNameUpdate((name) => {
    console.log('[LiveChat] visitor name updated via socket:', name)
    store.setState({ visitorName: name })
    saveVisitorName(name)
    rerenderVisitorNames()
  })

  store.subscribe((state) => {
    setStatus(state.status)
  })

  await initSession()
}

function loadFromStorage() {
  try {
    const sessionId = localStorage.getItem(LS_SESSION_ID)
    const visitorToken = localStorage.getItem(LS_VISITOR_TOKEN)
    const visitorName = localStorage.getItem(LS_VISITOR_NAME)
    const unread = parseInt(localStorage.getItem('lc_unread') ?? '0', 10)
    if (sessionId && visitorToken) {
      store.setState({ sessionId, visitorToken })
    }
    if (visitorName) {
      store.setState({ visitorName })
    }
    if (unread > 0) {
      store.setState({ unreadCount: unread })
      unreadCount = unread
    }
  } catch {}
}

function saveToStorage(sessionId, visitorToken) {
  try {
    localStorage.setItem(LS_SESSION_ID, sessionId)
    localStorage.setItem(LS_VISITOR_TOKEN, visitorToken)
  } catch {}
}

function saveVisitorName(name) {
  try {
    if (name) localStorage.setItem(LS_VISITOR_NAME, name)
    else localStorage.removeItem(LS_VISITOR_NAME)
  } catch {}
}

function getContactState(sessionId) {
  try {
    return localStorage.getItem(`lc_contact_${sessionId}`) // 'submitted' | 'skipped' | null
  } catch {
    return null
  }
}

function setContactState(sessionId, state) {
  try {
    localStorage.setItem(`lc_contact_${sessionId}`, state)
  } catch {}
}

async function initSession() {
  console.log('[LiveChat] initSession — calling POST /api/chat/session')
  store.setState({ status: 'loading' })

  try {
    const res = await api.createOrRestoreSession({
      visitorToken: store.visitorToken ?? undefined,
      pageUrl: window.location.href,
      referrerUrl: document.referrer || undefined,
    })

    console.log('[LiveChat] session ready — sessionId:', res.sessionId)
    store.setState({
      sessionId: res.sessionId,
      visitorToken: res.visitorToken,
      visitorName: res.visitorName ?? store.visitorName,
    })
    if (res.visitorName) saveVisitorName(res.visitorName)
    saveToStorage(res.sessionId, res.visitorToken)

    console.log('[LiveChat] connecting socket...')
    connectSocket(res.sessionId, res.visitorToken)
  } catch (err) {
    console.error('[LiveChat] Failed to initialize session:', err)
    store.setState({ status: 'error' })
  }
}

export async function openChat() {
  console.log('[LiveChat] openChat called')
  if (!store.sessionId || !store.visitorToken) {
    await initSession()
  }

  windowOpen = true
  store.clearUnread()
  unreadCount = 0
  openWindow()
  setStatus(store.status)

  // Mark contact card as already handled if previously submitted/skipped
  if (getContactState(store.sessionId)) {
    contactCardShown = true
  }

  if (store.messages.length === 0) {
    showSkeleton()
  }

  if (store.sessionId && store.visitorToken) {
    connectSocket(store.sessionId, store.visitorToken)
  }

  try {
    console.log('[LiveChat] loading message history...')
    const { messages, session } = await fetchMessagesWithRetry(store.sessionId, store.visitorToken)
    console.log('[LiveChat] loaded', messages.length, 'messages')

    if (session?.visitorName && !store.visitorName) {
      store.setState({ visitorName: session.visitorName })
      saveVisitorName(session.visitorName)
    }

    store.setMessages(messages)
    renderMessages(messages)
    updateTypingVisibility()
  } catch (err) {
    console.error('[LiveChat] Failed to load messages:', err)
    renderMessages(store.messages)
    updateTypingVisibility()
  }
}

async function fetchMessagesWithRetry(sessionId, visitorToken, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await api.getMessages(sessionId, visitorToken)
    } catch (err) {
      if (attempt < retries) {
        console.warn(`[LiveChat] getMessages attempt ${attempt + 1} failed, retrying in 1.5s...`)
        await new Promise((r) => setTimeout(r, 1500))
      } else {
        throw err
      }
    }
  }
}

function handleClose() {
  windowOpen = false
  closeWindow()
  _onChatClosed?.()
}

export function notifyWindowClosed() {
  windowOpen = false
}

async function handleContactSubmit({ name, email }) {
  if (!store.sessionId || !store.visitorToken) return false
  try {
    await api.saveContact(store.sessionId, store.visitorToken, { name, email })
    if (name) {
      store.setState({ visitorName: name })
      saveVisitorName(name)
      rerenderVisitorNames()
    }
    setContactState(store.sessionId, 'submitted')
    console.log('[LiveChat] contact details saved')
    return true
  } catch (err) {
    console.error('[LiveChat] failed to save contact:', err)
    return false
  }
}

function handleContactSkip() {
  if (store.sessionId) setContactState(store.sessionId, 'skipped')
  console.log('[LiveChat] contact form skipped')
}

async function handleSend({ text, attachment }) {
  if (!store.sessionId || !store.visitorToken) return
  if (!text.trim() && !attachment) return

  const tempId = `temp_${Date.now()}`
  const optimistic = {
    id: tempId,
    sessionId: store.sessionId,
    senderType: 'visitor',
    senderName: store.visitorName ?? null,
    text: text || null,
    messageType: attachment ? 'image' : 'text',
    attachment: attachment
      ? { id: attachment.id, url: attachment.previewUrl ?? attachment.url, mimeType: attachment.mimeType, width: null, height: null }
      : null,
    createdAt: new Date().toISOString(),
    _sending: true,
  }

  store.addMessage(optimistic)
  appendMessage(optimistic)

  try {
    const { message } = await api.sendMessage(
      store.sessionId,
      store.visitorToken,
      text,
      attachment?.id
    )

    store.removeMessage(tempId)
    store.addMessage(message)

    const tempEl = document.querySelector(`[data-message-id="${tempId}"]`)
    if (tempEl) {
      tempEl.replaceWith(createMessageElement({ ...message, attachment: message.attachment ?? null }))
    }

    // Show inline contact card after first visitor message
    if (!contactCardShown && !getContactState(store.sessionId)) {
      contactCardShown = true
      const card = createInlineContactCard({
        onSubmit: handleContactSubmit,
        onSkip: handleContactSkip,
      })
      injectContactCard(card)
    }
  } catch (err) {
    console.error('[LiveChat] Failed to send message:', err)
    const tempEl = document.querySelector(`[data-message-id="${tempId}"]`)
    if (tempEl) {
      tempEl.classList.add('lc-message-failed')
      const retryBtn = document.createElement('button')
      retryBtn.className = 'lc-retry-btn'
      retryBtn.textContent = 'שליחה נכשלה — לחץ לנסות שוב'
      retryBtn.addEventListener('click', () => {
        tempEl.remove()
        handleSend({ text, attachment })
      })
      tempEl.appendChild(retryBtn)
    }
  }
}

// Re-render visitor name labels on all existing visitor messages in the DOM
function rerenderVisitorNames() {
  if (!store.visitorName) return
  const visitorMessages = document.querySelectorAll('.lc-message.lc-visitor')
  visitorMessages.forEach((el) => {
    let senderEl = el.querySelector('.lc-message-sender')
    if (!senderEl) {
      senderEl = document.createElement('span')
      senderEl.className = 'lc-message-sender'
      el.insertBefore(senderEl, el.firstChild)
    }
    senderEl.textContent = store.visitorName
  })
}

export function getUnreadCount() {
  return store.unreadCount
}
