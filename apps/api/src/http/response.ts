import type { Response } from 'express'

export function sendNoStoreJson(response: Response, status: number, body: unknown): void {
  response.setHeader('Cache-Control', 'no-store')
  response.status(status).json(body)
}
