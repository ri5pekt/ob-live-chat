import { api } from './api.js'

export async function uploadFile(file, sessionId, visitorToken) {
  const previewUrl = URL.createObjectURL(file)

  const { attachment } = await api.uploadAttachment(sessionId, visitorToken, file)

  return {
    ...attachment,
    previewUrl,
  }
}
