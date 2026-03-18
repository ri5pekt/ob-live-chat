import { io } from 'socket.io-client'
import { store } from './store.js'

const BASE_URL = window.__LIVE_CHAT_CONFIG__?.backendUrl ?? 'https://nonappropriable-masked-tarah.ngrok-free.dev'

let socket = null
let onMessageCallback = null
let onStatusCallback = null
let onVisitorNameCallback = null

export function connectSocket(sessionId, visitorToken) {
  if (socket?.connected) {
    socket.emit('session_join', { sessionId, visitorToken })
    return socket
  }
  if (socket) {
    socket.disconnect()
  }

  socket = io(BASE_URL, {
    transports: ['websocket'],   // skip XHR polling — required for ngrok
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
  })

  socket.on('connect', () => {
    store.setState({ status: 'connected' })
    socket.emit('session_join', { sessionId, visitorToken })
  })

  socket.on('session_joined', ({ status }) => {
    store.setState({ status: status === 'open' ? 'connected' : status })
  })

  socket.on('session_join_error', () => {
    store.setState({ status: 'error' })
  })

  socket.on('message_new', ({ message }) => {
    store.addMessage(message)
    if (onMessageCallback) onMessageCallback(message)
  })

  socket.on('message_sent', ({ message }) => {
    store.addMessage(message)
  })

  socket.on('visitor_name_updated', ({ visitorName }) => {
    if (onVisitorNameCallback) onVisitorNameCallback(visitorName)
  })

  socket.on('session_status_updated', ({ status }) => {
    store.setState({ status })
    if (onStatusCallback) onStatusCallback(status)
  })

  socket.on('disconnect', () => {
    store.setState({ status: 'reconnecting' })
  })

  socket.on('connect_error', () => {})

  socket.on('reconnect', () => {
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
