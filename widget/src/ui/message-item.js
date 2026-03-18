import logoUrl from '../assets/ab-logo.svg'

function formatTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function createMessageElement(message) {
  const wrapper = document.createElement('div')
  wrapper.className = `lc-message lc-${message.senderType}`
  wrapper.dataset.messageId = message.id

  if (message.senderType === 'agent' || message.senderType === 'ai') {
    const avatar = document.createElement('div')
    avatar.className = 'lc-agent-avatar'
    const logoImg = document.createElement('img')
    logoImg.src = logoUrl
    logoImg.alt = 'logo'
    avatar.appendChild(logoImg)
    wrapper.appendChild(avatar)

    const body = document.createElement('div')
    body.className = 'lc-message-body'
    body.appendChild(buildBubble(message))
    const agentTime = document.createElement('span')
    agentTime.className = 'lc-message-time'
    agentTime.textContent = formatTime(message.createdAt)
    body.appendChild(agentTime)
    wrapper.appendChild(body)

  } else if (message.senderType === 'system') {
    const bubble = document.createElement('div')
    bubble.className = 'lc-bubble'
    bubble.textContent = message.text ?? ''
    wrapper.appendChild(bubble)

  } else {
    // Visitor
    wrapper.appendChild(buildBubble(message))
    if (!message._sending) {
      const time = document.createElement('span')
      time.className = 'lc-message-time'
      time.textContent = formatTime(message.createdAt)
      wrapper.appendChild(time)
    }
  }

  return wrapper
}

function buildBubble(message) {
  const bubble = document.createElement('div')
  bubble.className = 'lc-bubble'

  if (message.messageType === 'image' && message.attachment) {
    const img = document.createElement('img')
    img.src = message.attachment.url
    img.alt = 'Image'
    img.loading = 'lazy'
    img.addEventListener('click', () => window.open(message.attachment.url, '_blank'))
    bubble.appendChild(img)
    if (message.text) {
      const caption = document.createElement('p')
      caption.style.marginTop = '6px'
      caption.textContent = message.text
      bubble.appendChild(caption)
    }
  } else {
    bubble.textContent = message.text ?? ''
  }

  return bubble
}

export function createSkeletonMessages() {
  const frag = document.createDocumentFragment()
  const widths = ['60%', '45%', '70%', '40%']
  widths.forEach((w) => {
    const el = document.createElement('div')
    el.className = 'lc-skeleton'
    el.style.width = w
    frag.appendChild(el)
  })
  return frag
}
