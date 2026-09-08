/**
 * Wiring between the pure `SeoErrorBoundary` and this plugin's translations.
 *
 * Kept apart from ErrorBoundary.tsx on purpose: the boundary itself must stay
 * free of Payload imports so it can be unit-tested without an admin provider
 * tree. Everything that needs `useLocale()` lives here.
 *
 * 'use client' is prepended to the whole client bundle by tsup.
 */

import React from 'react'
import { SeoErrorBoundary, type SeoErrorBoundaryProps } from './ErrorBoundary.js'
import { useSeoLocale } from '../hooks/useSeoLocale.js'
import { getDashboardT } from '../dashboard-i18n.js'

export type LocalizedSeoErrorBoundaryProps = Omit<SeoErrorBoundaryProps, 'labels'>

/**
 * `SeoErrorBoundary` with the plugin's own FR/EN strings wired in.
 *
 * Safe to mount above anything: `useLocale()` is `use(LocaleContext)` with a
 * `{}` default in @payloadcms/ui, so it never throws outside a provider — which
 * matters, because nothing catches an error thrown by the boundary's own
 * wrapper.
 */
export function LocalizedSeoErrorBoundary(props: LocalizedSeoErrorBoundaryProps) {
  const locale = useSeoLocale()
  const t = getDashboardT(locale)
  return (
    <SeoErrorBoundary
      {...props}
      labels={{ title: t.common.loadingError, retry: t.common.retry }}
    />
  )
}

/**
 * Wraps a component in a localized boundary, for the entry points Payload
 * mounts itself from the import map.
 *
 * Pass `fallback: null` for anything rendered on EVERY admin page (the sidebar
 * nav link): a permanent error panel across the whole admin is worse than a
 * missing link. Omit `fallback` where a visible, retryable notice is the honest
 * answer (a field, a view).
 */
export function withSeoErrorBoundary<P extends object>(
  Inner: React.ComponentType<P>,
  options: { viewName: string; fallback?: React.ReactNode },
): React.FC<P> {
  // hasOwnProperty, not a truthiness test: `fallback: null` is a meaningful
  // value ("render nothing") and must reach the boundary.
  const hasFallback = Object.prototype.hasOwnProperty.call(options, 'fallback')

  const Wrapped: React.FC<P> = (props) => (
    <LocalizedSeoErrorBoundary
      viewName={options.viewName}
      {...(hasFallback ? { fallback: options.fallback } : {})}
    >
      <Inner {...props} />
    </LocalizedSeoErrorBoundary>
  )

  Wrapped.displayName = `withSeoErrorBoundary(${options.viewName})`
  return Wrapped
}
