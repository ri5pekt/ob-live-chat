let indicatorEl = null

export function createTypingIndicator() {
  const wrapper = document.createElement('div')
  wrapper.id = 'lc-typing-wrapper'
  wrapper.className = 'lc-message lc-agent'

  const bubble = document.createElement('div')
  bubble.className = 'lc-typing-indicator'
  bubble.setAttribute('aria-label', 'נציג מקליד...')

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span')
    dot.className = 'lc-typing-dot'
    bubble.appendChild(dot)
  }

  wrapper.appendChild(bubble)
  indicatorEl = wrapper
  return wrapper
}

export function showTypingIndicator(messageList) {
  if (!messageList) return
  removeTypingIndicator()
  const indicator = createTypingIndicator()
  messageList.appendChild(indicator)
  messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' })
}

export function removeTypingIndicator() {
  const existing = document.getElementById('lc-typing-wrapper')
  if (existing) existing.remove()
  indicatorEl = null
}
