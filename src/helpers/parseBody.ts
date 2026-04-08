/**
 * Consistent JSON body parsing helper for Payload request handlers.
 * Replaces inconsistent patterns across endpoints:
 *   - (req as any).json()
 *   - req.json?.()
 *   - req.json!()
 */

import type { PayloadRequest } from 'payload'

/**
 * Safely parse JSON body from a Payload request.
 * Returns an empty object if parsing fails or no body is present.
 */
export async function parseJsonBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const json = req.json ? await req.json() : {}
    return json && typeof json === 'object' && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
