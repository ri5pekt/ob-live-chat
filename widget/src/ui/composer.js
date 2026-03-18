let onSendCallback = null
let pendingAttachment = null

export function createComposer(onSend) {
  onSendCallback = onSend

  const wrapper = document.createElement('div')
  wrapper.id = 'lc-composer'

  const preview = document.createElement('div')
  preview.id = 'lc-attachment-preview'
  preview.className = 'lc-hidden'
  preview.innerHTML = `
    <img id="lc-attachment-thumb" src="" alt="preview" />
    <span id="lc-attachment-name"></span>
    <button id="lc-attachment-remove" title="Remove attachment">×</button>
  `
  wrapper.appendChild(preview)

  const inner = document.createElement('div')
  inner.id = 'lc-composer-inner'

  const textarea = document.createElement('textarea')
  textarea.id = 'lc-textarea'
  textarea.placeholder = '...הקלד הודעה'
  textarea.rows = 1
  textarea.setAttribute('aria-label', 'Message input')
  inner.appendChild(textarea)

  const sendBtn = document.createElement('button')
  sendBtn.id = 'lc-send-btn'
  sendBtn.disabled = true
  sendBtn.setAttribute('aria-label', 'Send message')
  sendBtn.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  `
  inner.appendChild(sendBtn)

  wrapper.appendChild(inner)

  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    sendBtn.disabled = textarea.value.trim().length === 0
  })

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!sendBtn.disabled) triggerSend()
    }
  })

  sendBtn.addEventListener('click', () => {
    if (!sendBtn.disabled) triggerSend()
  })

  document.getElementById('lc-attachment-remove')?.addEventListener('click', clearAttachment)

  return wrapper
}

function triggerSend() {
  const textarea = document.getElementById('lc-textarea')
  const text = textarea?.value.trim()
  if (!text && !pendingAttachment) return

  if (onSendCallback) {
    onSendCallback({ text: text || '', attachment: pendingAttachment })
  }

  if (textarea) {
    textarea.value = ''
    textarea.style.height = 'auto'
  }

  const sendBtn = document.getElementById('lc-send-btn')
  if (sendBtn) sendBtn.disabled = true

  clearAttachment()
}

export function setPendingAttachment(attachment) {
  pendingAttachment = attachment
  const preview = document.getElementById('lc-attachment-preview')
  const thumb = document.getElementById('lc-attachment-thumb')
  const name = document.getElementById('lc-attachment-name')
  if (!preview || !thumb || !name) return

  thumb.src = attachment.previewUrl
  name.textContent = attachment.originalFilename ?? 'image'
  preview.classList.remove('lc-hidden')

  const sendBtn = document.getElementById('lc-send-btn')
  if (sendBtn) sendBtn.disabled = false
}

export function clearAttachment() {
  pendingAttachment = null
  const preview = document.getElementById('lc-attachment-preview')
  if (preview) preview.classList.add('lc-hidden')
}

export function setComposerDisabled(disabled) {
  const textarea = document.getElementById('lc-textarea')
  const sendBtn = document.getElementById('lc-send-btn')
  if (textarea) textarea.disabled = disabled
  if (sendBtn) sendBtn.disabled = disabled
}
