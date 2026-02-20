/**
 * SEO Score History endpoint handler.
 * Returns score history + trend for a specific document.
 *
 * Query params:
 *   - documentId (required) — ID of the document
 *   - collection (required) — collection slug ('pages', 'posts')
 *   - limit (optional, default: 30) — max snapshots to return
 *
 * Response:
 *   { history: [...], trend: 'improving' | 'declining' | 'stable', scoreDelta: number }
 *
 * NOTE: Rate limiting is not handled by this plugin. The consuming application
 * should implement rate limiting via its own middleware (e.g., express-rate-limit,
 * Next.js middleware, or a reverse proxy like Nginx/Caddy).
 */

import type { PayloadHandler } from 'payload'

/** Trend threshold — delta must exceed this to be considered improving/declining */
const TREND_THRESHOLD = 3

export function createHistoryHandler(): PayloadHandler {
  return async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url as string)
      const documentId = url.searchParams.get('documentId')
      const collection = url.searchParams.get('collection')
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '30', 10)))

      if (!documentId || !collection) {
        return Response.json(
          { error: 'Missing required parameters: documentId, collection' },
          { status: 400 },
        )
      }

      // Fetch snapshots ordered by date (newest first)
      const result = await req.payload.find({
        collection: 'seo-score-history',
        where: {
          and: [
            { documentId: { equals: documentId } },
            { collection: { equals: collection } },
          ],
        },
        sort: '-snapshotDate',
        limit,
        depth: 0,
        overrideAccess: true,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snapshots = result.docs as any[]

      // Build history array (chronological order — oldest first)
      const history = snapshots
        .map((snap) => ({
          score: snap.score as number,
          level: snap.level as string,
          focusKeyword: (snap.focusKeyword as string) || '',
          wordCount: (snap.wordCount as number) || 0,
          checksSummary: snap.checksSummary || { pass: 0, warning: 0, fail: 0 },
          snapshotDate: snap.snapshotDate as string,
        }))
        .reverse()

      // Compute trend: compare average of last 5 vs previous 5
      let trend: 'improving' | 'declining' | 'stable' = 'stable'
      let scoreDelta = 0

      if (history.length >= 2) {
        const recentSlice = history.slice(-5)
        const previousSlice = history.slice(-10, -5)

        const recentAvg =
          recentSlice.reduce((sum, s) => sum + s.score, 0) / recentSlice.length

        if (previousSlice.length > 0) {
          const previousAvg =
            previousSlice.reduce((sum, s) => sum + s.score, 0) / previousSlice.length
          scoreDelta = Math.round(recentAvg - previousAvg)
        } else {
          // Less than 10 entries: compare last vs first
          scoreDelta = history[history.length - 1].score - history[0].score
        }

        if (scoreDelta > TREND_THRESHOLD) trend = 'improving'
        else if (scoreDelta < -TREND_THRESHOLD) trend = 'declining'
      }

      return Response.json({
        history,
        trend,
        scoreDelta,
      })
    } catch (error) {
      console.error('[seo-plugin/history] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
