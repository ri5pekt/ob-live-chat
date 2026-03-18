// Per-route rate limit configurations
// Applied via route-level options using @fastify/rate-limit

export const sessionCreateRateLimit = {
  max: 5,
  timeWindow: '1 minute',
}

export const messageSendRateLimit = {
  max: 10,
  timeWindow: '1 minute',
  keyGenerator: (request: { headers: Record<string, string | undefined> }) =>
    request.headers['visitor-token'] ?? 'anonymous',
}

export const attachmentUploadRateLimit = {
  max: 5,
  timeWindow: '1 minute',
  keyGenerator: (request: { headers: Record<string, string | undefined> }) =>
    request.headers['visitor-token'] ?? 'anonymous',
}
