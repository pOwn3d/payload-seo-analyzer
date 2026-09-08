// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SeoErrorBoundary } from '../components/ErrorBoundary.js'

// Every test here renders a component that throws on purpose. React logs the
// caught error through console.error; silence it so the run stays readable, but
// keep a handle on the spy — one test asserts on what the boundary itself logs.
let consoleSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Boom({ message = 'kaboom' }: { message?: string }): React.ReactElement {
  throw new Error(message)
}

function Fine() {
  return <p>rendered fine</p>
}

describe('SeoErrorBoundary — containment', () => {
  it('renders children untouched when nothing throws', () => {
    render(
      <SeoErrorBoundary viewName="Test">
        <Fine />
      </SeoErrorBoundary>,
    )
    expect(screen.getByText('rendered fine')).toBeTruthy()
  })

  it('catches a child render error instead of letting it unmount the tree', () => {
    render(
      <div>
        <p>sibling survives</p>
        <SeoErrorBoundary viewName="Test">
          <Boom />
        </SeoErrorBoundary>
      </div>,
    )
    // The sibling is the point: without the boundary React unmounts the whole
    // root, and this assertion fails.
    expect(screen.getByText('sibling survives')).toBeTruthy()
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('never puts the error message on screen (it can carry a URL or a document fragment)', () => {
    render(
      <SeoErrorBoundary viewName="Test">
        <Boom message="secret-token-in-url" />
      </SeoErrorBoundary>,
    )
    expect(screen.queryByText(/secret-token-in-url/)).toBeNull()
    // …but the console gets it, prefixed with the mount that blew up.
    const logged = consoleSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n')
    expect(logged).toContain('[seo-analyzer] Test crashed:')
    expect(logged).toContain('secret-token-in-url')
  })
})

describe('SeoErrorBoundary — fallback', () => {
  it('renders nothing at all for fallback={null}', () => {
    // This is the regression the hardening exists for: the payload-support
    // original tested `if (this.props.fallback)`, so an explicit `null` fell
    // through to the default panel — a permanent error box in the sidebar of
    // every admin page.
    const { container } = render(
      <SeoErrorBoundary viewName="NavLink" fallback={null}>
        <Boom />
      </SeoErrorBoundary>,
    )
    expect(container.innerHTML).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders a custom fallback when one is given', () => {
    render(
      <SeoErrorBoundary viewName="Test" fallback={<span>degraded</span>}>
        <Boom />
      </SeoErrorBoundary>,
    )
    expect(screen.getByText('degraded')).toBeTruthy()
  })

  it('uses the localized labels it is handed, and English otherwise', () => {
    const { unmount } = render(
      <SeoErrorBoundary viewName="Test" labels={{ title: 'Erreur de chargement', retry: 'Réessayer' }}>
        <Boom />
      </SeoErrorBoundary>,
    )
    expect(screen.getByText('Erreur de chargement')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy()
    unmount()

    render(
      <SeoErrorBoundary viewName="Test">
        <Boom />
      </SeoErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })
})

describe('SeoErrorBoundary — recovery', () => {
  it('remounts the subtree on Retry, so a transient failure can succeed', () => {
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('transient')
      return <p>recovered</p>
    }

    render(
      <SeoErrorBoundary viewName="Test">
        <Flaky />
      </SeoErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()

    shouldThrow = false
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('recovered')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clears the error when a resetKey changes', () => {
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('transient')
      return <p>recovered</p>
    }

    const { rerender } = render(
      <SeoErrorBoundary viewName="Test" resetKeys={['doc-1']}>
        <Flaky />
      </SeoErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()

    // Navigating to another document must not keep showing the previous one's
    // crash.
    shouldThrow = false
    rerender(
      <SeoErrorBoundary viewName="Test" resetKeys={['doc-2']}>
        <Flaky />
      </SeoErrorBoundary>,
    )
    expect(screen.getByText('recovered')).toBeTruthy()
  })

  it('keeps showing the error while the resetKeys stay identical', () => {
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('transient')
      return <p>recovered</p>
    }

    const { rerender } = render(
      <SeoErrorBoundary viewName="Test" resetKeys={['doc-1']}>
        <Flaky />
      </SeoErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()

    shouldThrow = false
    rerender(
      <SeoErrorBoundary viewName="Test" resetKeys={['doc-1']}>
        <Flaky />
      </SeoErrorBoundary>,
    )
    // Same key: nothing suggests the cause is gone, so the notice stays and the
    // user decides with the Retry button.
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByText('recovered')).toBeNull()
  })
})

describe('SeoErrorBoundary — the notice itself', () => {
  it('is an alert with a typed retry button (no implicit form submit)', () => {
    render(
      <SeoErrorBoundary viewName="Test">
        <Boom />
      </SeoErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    const button = screen.getByRole('button')
    // The field boundaries live inside Payload's document <form>: an untyped
    // button would submit it.
    expect(button.getAttribute('type')).toBe('button')
  })

  it('styles itself from --theme-* tokens, not hard-coded hex', () => {
    const { container } = render(
      <SeoErrorBoundary viewName="Test">
        <Boom />
      </SeoErrorBoundary>,
    )
    const html = container.innerHTML
    expect(html).toContain('--theme-elevation')
    expect(html).not.toMatch(/#dc2626|#2563eb|#6b7280/)
  })
})
