const BASE_URL = window.__LIVE_CHAT_CONFIG__?.backendUrl ?? 'https://nonappropriable-masked-tarah.ngrok-free.dev'

async function request(method, path, body, visitorToken) {
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  }
  if (visitorToken) headers['visitor-token'] = visitorToken

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }))
    throw Object.assign(new Error(err.message ?? 'Request failed'), { status: res.status })
  }

  return res.json()
}

export const api = {
  createOrRestoreSession(data) {
    return request('POST', '/api/chat/session', data)
  },

  getMessages(sessionId, visitorToken) {
    return request('GET', `/api/chat/session/${sessionId}/messages`, null, visitorToken)
  },

  sendMessage(sessionId, visitorToken, text, attachmentId) {
    return request(
      'POST',
      `/api/chat/session/${sessionId}/messages`,
      { text, attachmentId },
      visitorToken
    )
  },

  saveContact(sessionId, visitorToken, { name, email }) {
    const body = {}
    if (name != null && name !== '') body.name = name
    if (email != null && email !== '') body.email = email
    return request('POST', `/api/chat/session/${sessionId}/contact`, body, visitorToken)
  },

  uploadAttachment(sessionId, visitorToken, file) {
    const formData = new FormData()
    formData.append('file', file)
    return fetch(`${BASE_URL}/api/chat/session/${sessionId}/attachments`, {
      method: 'POST',
      headers: {
        'visitor-token': visitorToken,
        'ngrok-skip-browser-warning': 'true',
      },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }))
        throw Object.assign(new Error(err.message ?? 'Upload failed'), { status: res.status })
      }
      return res.json()
    })
  },
}
