const listeners = new Set()

export const store = {
  sessionId: null,
  visitorToken: null,
  visitorName: null,
  messages: [],
  status: 'closed',
  agentHasReplied: false,
  unreadCount: 0,

  _notify() {
    listeners.forEach((fn) => fn(this))
  },

  setState(partial) {
    Object.assign(this, partial)
    this._notify()
  },

  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  addMessage(message) {
    const existing = this.messages.findIndex((m) => m.id === message.id)
    if (existing !== -1) {
      this.messages[existing] = message
    } else {
      this.messages = [...this.messages, message]
    }
    if (message.senderType === 'agent' || message.senderType === 'ai') {
      this.agentHasReplied = true
    }
    this._notify()
  },

  removeMessage(id) {
    this.messages = this.messages.filter((m) => m.id !== id)
    this._notify()
  },

  setMessages(messages) {
    this.messages = messages
    if (messages.some((m) => m.senderType === 'agent' || m.senderType === 'ai')) {
      this.agentHasReplied = true
    }
    this._notify()
  },

  incrementUnread() {
    this.unreadCount++
    this._notify()
    try {
      localStorage.setItem('lc_unread', String(this.unreadCount))
    } catch {}
  },

  clearUnread() {
    this.unreadCount = 0
    this._notify()
    try {
      localStorage.removeItem('lc_unread')
    } catch {}
  },
}
