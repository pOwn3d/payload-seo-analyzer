/**
 * SeoErrorBoundary — keeps a crash inside one plugin component from taking the
 * whole Payload admin down.
 *
 * Why this exists: every component this plugin registers is mounted by Payload
 * itself, from the import map. The plugin never owns the parent, so it cannot be
 * given an ancestor boundary from the outside — the boundary has to live INSIDE
 * the module Payload mounts. Each entry point therefore exports a wrapper
 * (`SeoNavLink`, `MetaTitleField`, …) around an inner component holding the real
 * implementation. Without it, a single `undefined.map()` in a sidebar nav link
 * unmounts the entire admin React tree, on every admin page.
 *
 * Scope, stated plainly: React error boundaries only catch errors thrown during
 * RENDER. They do not catch rejected promises in `useEffect` (and these
 * components fetch a lot), nor errors thrown from event handlers. Those still
 * need a try/catch at the call site.
 *
 * 'use client' is prepended to the whole client bundle by tsup (see
 * tsup.config.ts), which is why there is no directive here.
 */

import React from 'react'

export interface SeoErrorBoundaryLabels {
  /** Heading shown in the default notice. */
  title?: string
  /** Label of the retry button. */
  retry?: string
}

export interface SeoErrorBoundaryProps {
  children: React.ReactNode
  /**
   * Rendered instead of the built-in notice. Pass `null` for silent
   * degradation — used by the components mounted on EVERY admin page, where a
   * permanent error panel would be worse than a missing widget.
   */
  fallback?: React.ReactNode
  /** Prefixes the console error, so the log says which mount blew up. */
  viewName?: string
  /**
   * When any of these values changes, the boundary clears its error state and
   * remounts the subtree. Useful when the crash was caused by a prop (a
   * document id, a locale) that has since changed.
   */
  resetKeys?: unknown[]
  /** Localized strings. English defaults, so a caller without i18n still reads. */
  labels?: SeoErrorBoundaryLabels
}

interface SeoErrorBoundaryState {
  hasError: boolean
  /** Bumped on every reset — used as a `key` so the subtree fully remounts. */
  resetCount: number
  /** Serialized `resetKeys` of the last render, to detect a change. */
  keySignature: string
}

/**
 * Cheap, allocation-light signature of `resetKeys`. Primitives compare exactly;
 * objects collapse to their `String()` form, which is enough for the intended
 * use (ids, slugs, locales) and never throws.
 */
function signature(keys: unknown[] | undefined): string {
  if (!keys || keys.length === 0) return ''
  let out = ''
  for (const key of keys) {
    out += `${typeof key}:${String(key)}|`
  }
  return out
}

const noticeStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderRadius: 6,
  border: '1px solid var(--theme-elevation-150)',
  backgroundColor: 'var(--theme-elevation-50)',
  color: 'var(--theme-elevation-800)',
  fontFamily: 'var(--font-body, inherit)',
  fontSize: 13,
  lineHeight: 1.5,
}

const retryStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '6px 16px',
  borderRadius: 4,
  border: '1px solid var(--theme-elevation-250)',
  backgroundColor: 'var(--theme-elevation-100)',
  color: 'var(--theme-elevation-800)',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
}

export class SeoErrorBoundary extends React.Component<
  SeoErrorBoundaryProps,
  SeoErrorBoundaryState
> {
  constructor(props: SeoErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, resetCount: 0, keySignature: signature(props.resetKeys) }
  }

  static getDerivedStateFromError(): Partial<SeoErrorBoundaryState> {
    return { hasError: true }
  }

  static getDerivedStateFromProps(
    props: SeoErrorBoundaryProps,
    state: SeoErrorBoundaryState,
  ): Partial<SeoErrorBoundaryState> | null {
    const next = signature(props.resetKeys)
    if (next === state.keySignature) return null
    // A reset key moved: forget the error and remount the subtree from scratch.
    return { keySignature: next, hasError: false, resetCount: state.resetCount + 1 }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // The message goes to the console, never to the screen: it can carry a stack
    // frame, a URL or a fragment of a document, and this renders inside a CMS
    // that non-technical editors use.
    console.error(`[seo-analyzer] ${this.props.viewName || 'component'} crashed:`, error, errorInfo)
  }

  private handleRetry = (): void => {
    // Remounting is what actually retries: clearing the flag alone would replay
    // the same component instance with the same broken state.
    this.setState((state) => ({ hasError: false, resetCount: state.resetCount + 1 }))
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // `!== undefined` on purpose: `fallback={null}` means "render nothing",
      // and must not fall through to the notice below.
      if (this.props.fallback !== undefined) return this.props.fallback

      const { title, retry } = this.props.labels || {}
      return (
        <div role="alert" style={noticeStyle}>
          <strong>{title || 'Something went wrong'}</strong>
          <div>
            <button type="button" onClick={this.handleRetry} style={retryStyle}>
              {retry || 'Retry'}
            </button>
          </div>
        </div>
      )
    }

    // The key is what makes a retry a real remount.
    return <React.Fragment key={this.state.resetCount}>{this.props.children}</React.Fragment>
  }
}

export default SeoErrorBoundary
