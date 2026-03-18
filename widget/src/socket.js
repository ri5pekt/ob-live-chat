import { io } from 'socket.io-client'
import { store } from './store.js'

const BASE_URL = window.__LIVE_CHAT_CONFIG__?.backendUrl ?? 'https://nonappropriable-masked-tarah.ngrok-free.dev'

let socket = null
let onMessageCallback = null
let onStatusCallback = null
let onVisitorNameCallback = null

export function connectSocket(sessionId, visitorToken) {
  if (socket?.connected) {
    console.log('[LiveChat] socket already connected, reusing existing connection')
    // Re-join the session room in case server restarted
    socket.emit('session_join', { sessionId, visitorToken })
    return socket
  }
  if (socket) {
    socket.disconnect()
  }

  console.log('[LiveChat] connecting socket to', BASE_URL)

  socket = io(BASE_URL, {
    transports: ['websocket'],   // skip XHR polling — required for ngrok
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
  })

  socket.on('connect', () => {
    console.log('[LiveChat] socket connected, id:', socket.id)
    store.setState({ status: 'connected' })
    console.log('[LiveChat] emitting session_join for session:', sessionId)
    socket.emit('session_join', { sessionId, visitorToken })
  })

  socket.on('session_joined', ({ sessionId: sid, status }) => {
    console.log('[LiveChat] session_joined — sid:', sid, 'status:', status)
    store.setState({ status: status === 'open' ? 'connected' : status })
  })

  socket.on('session_join_error', ({ error }) => {
    console.error('[LiveChat] session_join_error:', error)
    store.setState({ status: 'error' })
  })

  socket.on('message_new', ({ message }) => {
    console.log('[LiveChat] message_new received:', message)
    store.addMessage(message)
    if (onMessageCallback) onMessageCallback(message)
  })

  socket.on('message_sent', ({ message }) => {
    console.log('[LiveChat] message_sent confirmed:', message.id)
    store.addMessage(message)
  })

  socket.on('visitor_name_updated', ({ visitorName }) => {
    console.log('[LiveChat] visitor_name_updated:', visitorName)
    if (onVisitorNameCallback) onVisitorNameCallback(visitorName)
  })

  socket.on('session_status_updated', ({ status }) => {
    console.log('[LiveChat] session_status_updated:', status)
    store.setState({ status })
    if (onStatusCallback) onStatusCallback(status)
  })

  socket.on('disconnect', (reason) => {
    console.warn('[LiveChat] socket disconnected:', reason)
    store.setState({ status: 'reconnecting' })
  })

  socket.on('connect_error', (err) => {
    console.error('[LiveChat] socket connect_error:', err.message)
  })

  socket.on('reconnect', (attempt) => {
    console.log('[LiveChat] socket reconnected after', attempt, 'attempts')
    socket.emit('session_join', { sessionId, visitorToken })
  })

  return socket
}

export function onNewMessage(cb) {
  onMessageCallback = cb
}

export function onStatusChange(cb) {
  onStatusCallback = cb
}

export function onVisitorNameUpdate(cb) {
  onVisitorNameCallback = cb
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
