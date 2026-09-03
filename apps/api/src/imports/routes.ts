import express, { Router } from 'express'

import {
  MAX_LEGACY_BACKUP_BYTES,
  legacyBackupCommitRequestSchema,
  legacyBackupCommitResponseSchema,
  legacyBackupExportResponseSchema,
  legacyBackupPreviewRequestSchema,
  legacyBackupPreviewResponseSchema,
} from '@poker-range-trainer/contracts'

import type { AuthMiddleware } from '../auth/middleware.js'
import { sendUnauthenticated } from '../auth/middleware.js'
import { sendNoStoreJson } from '../http/response.js'
import { parseRequestBody } from '../http/validation.js'
import { sendProblem } from '../problem.js'
import {
  LegacyImportAlreadyImportedError,
  LegacyImportDigestMismatchError,
  LegacyImportInProgressError,
} from './repository.js'
import { ImportsService } from './service.js'

/**
 * A backup is orders of magnitude larger than any other request body, so it is
 * read only after `middleware.csrf` has accepted the caller — that check needs
 * cookies and headers alone, and rejects an anonymous request without the
 * process ever holding the file.
 */
const parseBackupBody = express.json({ limit: MAX_LEGACY_BACKUP_BYTES, strict: true })

export interface ImportsRouterOptions {
  service: Pick<ImportsService, 'preview' | 'commit' | 'exportBackup'>
  middleware: Pick<AuthMiddleware, 'required' | 'csrf'>
}

function ownerId(request: Parameters<typeof sendUnauthenticated>[0]): string | undefined {
  return request.authContext?.user.id
}

function sendConflict(
  request: Parameters<typeof sendUnauthenticated>[0],
  response: Parameters<typeof sendUnauthenticated>[1],
  detail: string,
): void {
  sendProblem(request, response, { status: 409, title: 'Conflict', detail, code: 'CONFLICT' })
}

function mapImportError(
  error: unknown,
  request: Parameters<typeof sendUnauthenticated>[0],
  response: Parameters<typeof sendUnauthenticated>[1],
): boolean {
  if (error instanceof LegacyImportDigestMismatchError) {
    sendConflict(
      request,
      response,
      'The backup changed since it was previewed. Preview it again before importing.',
    )
    return true
  }
  if (error instanceof LegacyImportAlreadyImportedError) {
    sendConflict(request, response, 'This backup was already imported.')
    return true
  }
  if (error instanceof LegacyImportInProgressError) {
    sendConflict(request, response, 'An import of this backup is already recorded.')
    return true
  }
  return false
}

function requireOwner(
  request: Parameters<typeof sendUnauthenticated>[0],
  response: Parameters<typeof sendUnauthenticated>[1],
): string | undefined {
  const userId = ownerId(request)
  if (!userId) sendUnauthenticated(request, response)
  return userId
}

function noStore(): Router {
  const router = Router()
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })
  return router
}

/**
 * Authenticated legacy-backup import boundary. Preview never writes; commit is
 * one atomic repository transaction. The router receives a service port, so it
 * owns no database pool and never derives identity from request input.
 */
export function createImportsRouter(options: ImportsRouterOptions): Router {
  const router = noStore()

  router.post(
    '/legacy-backup/preview',
    options.middleware.csrf,
    parseBackupBody,
    async (request, response, next) => {
      const parsed = parseRequestBody(legacyBackupPreviewRequestSchema, request, response)
      if (!parsed.ok) return
      const userId = requireOwner(request, response)
      if (!userId) return
      try {
        const result = await options.service.preview(userId, parsed.data.backup)
        sendNoStoreJson(response, 200, legacyBackupPreviewResponseSchema.parse({ data: result }))
      } catch (error) {
        if (!mapImportError(error, request, response)) next(error)
      }
    },
  )

  router.post(
    '/legacy-backup',
    options.middleware.csrf,
    parseBackupBody,
    async (request, response, next) => {
      const parsed = parseRequestBody(legacyBackupCommitRequestSchema, request, response)
      if (!parsed.ok) return
      const userId = requireOwner(request, response)
      if (!userId) return
      try {
        const result = await options.service.commit(userId, parsed.data)
        sendNoStoreJson(response, 200, legacyBackupCommitResponseSchema.parse({ data: result }))
      } catch (error) {
        if (!mapImportError(error, request, response)) next(error)
      }
    },
  )

  return router
}

/** Authenticated backup export: the owner's live library as a v1 backup file. */
export function createExportsRouter(options: ImportsRouterOptions): Router {
  const router = noStore()

  router.get('/backup', options.middleware.required, async (request, response, next) => {
    const userId = requireOwner(request, response)
    if (!userId) return
    try {
      const backup = await options.service.exportBackup(userId)
      // The file is offered as a download, named for the day it was taken.
      const day = backup.exportedAt.slice(0, 10)
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="poker-range-trainer-backup-${day}.json"`,
      )
      sendNoStoreJson(
        response,
        200,
        legacyBackupExportResponseSchema.parse({ data: { backup } }),
      )
    } catch (error) {
      if (!mapImportError(error, request, response)) next(error)
    }
  })

  return router
}
