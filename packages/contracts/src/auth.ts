import { z } from 'zod'

import { idSchema, successResponseSchema, timestampSchema } from './common.js'

export const emailSchema = z.string().trim().toLowerCase().email().max(254)

/** Minimum policy for credentials handled by the API; never reuse this in a response schema. */
export const passwordSchema = z
  .string()
  .min(12, 'Password must contain at least 12 characters.')
  .max(128, 'Password must contain at most 128 characters.')
  .refine((password) => /[A-Za-z]/.test(password) && /\d/.test(password), {
    message: 'Password must contain at least one letter and one number.',
  })

export const registerRequestSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict()
export type RegisterRequest = z.input<typeof registerRequestSchema>

export const loginRequestSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict()
export type LoginRequest = z.input<typeof loginRequestSchema>

/** The complete user representation that may be returned to an authenticated client. */
export const authenticatedUserSchema = z
  .object({
    id: idSchema,
    email: emailSchema,
    createdAt: timestampSchema,
  })
  .strict()
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>

/** Session credentials stay in an HTTP-only cookie, never in this JSON body. */
export const authSessionDataSchema = z
  .object({
    user: authenticatedUserSchema,
  })
  .strict()
export const authSessionResponseSchema = successResponseSchema(authSessionDataSchema)
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>

/** Successful registration returns a user only; the session itself is cookie-backed. */
export const registerResponseSchema = authSessionResponseSchema
export type RegisterResponse = AuthSessionResponse

/** Successful login returns a user only; the session itself is cookie-backed. */
export const loginResponseSchema = authSessionResponseSchema
export type LoginResponse = AuthSessionResponse

/** Logout accepts no data; a client clears its session by calling this endpoint. */
export const logoutRequestSchema = z.object({}).strict()
export type LogoutRequest = z.infer<typeof logoutRequestSchema>

export const logoutResponseSchema = successResponseSchema(z.object({ success: z.literal(true) }).strict())
export type LogoutResponse = z.infer<typeof logoutResponseSchema>

export const meDataSchema = z.discriminatedUnion('authenticated', [
  z
    .object({
      authenticated: z.literal(true),
      user: authenticatedUserSchema,
    })
    .strict(),
  z.object({ authenticated: z.literal(false) }).strict(),
])
export const meResponseSchema = successResponseSchema(meDataSchema)
export type MeResponse = z.infer<typeof meResponseSchema>
