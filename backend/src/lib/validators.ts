import { z } from 'zod'

export const visitorTokenSchema = z
  .string()
  .max(128)
  .regex(/^[\w\-]+$/)
  .optional()

export const pageUrlSchema = z.string().url().optional().or(z.literal(''))

export const sessionIdSchema = z.string().uuid()

export const messageTextSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(2000, 'Message too long (max 2000 characters)')
  .trim()

export const createSessionBodySchema = z.object({
  visitorToken: visitorTokenSchema,
  pageUrl: z.string().max(2048).optional(),
  referrerUrl: z.string().max(2048).optional(),
})

export const sendMessageBodySchema = z.object({
  text: messageTextSchema,
  attachmentId: z.string().uuid().optional(),
})
