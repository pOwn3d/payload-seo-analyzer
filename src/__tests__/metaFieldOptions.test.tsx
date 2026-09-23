// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// @payloadcms/ui is a peer dependency whose entry point imports CSS, which the
// node/jsdom loader cannot parse. The meta fields only need a field value, the
// document they belong to, and the two i18n hooks behind useDashboardT.
vi.mock('@payloadcms/ui', () => ({
  useField: () => ({ value: '', setValue: () => {} }),
  useDocumentInfo: () => ({ collectionSlug: 'pages', id: '1' }),
  useTranslation: () => ({ i18n: { language: 'en' } }),
  useConfig: () => undefined,
}))

import { MetaTitleField } from '../components/MetaTitleField.js'
import { MetaDescriptionField } from '../components/MetaDescriptionField.js'
import { resolveMetaFieldOptions } from '../components/metaFieldOptions.js'
import { metaFields } from '../metaFields.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// The client field Payload hands to the component: metaFields() output, as is.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clientField(name: 'title' | 'description', config: Parameters<typeof metaFields>[0]): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group = metaFields(config)[0] as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return group.fields.find((f: any) => f.name === name)
}

describe('meta fields read their options from admin.custom', () => {
  it('shows the generate button when metaFields() says a generate function exists', () => {
    const field = clientField('title', { hasGenerateTitle: true })
    render(<MetaTitleField path="meta.title" field={field} />)
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy()
  })

  it('hides it when there is none', () => {
    const field = clientField('title', {})
    render(<MetaTitleField path="meta.title" field={field} />)
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull()
  })

  it('calls the generate endpoint under the configured base path', () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ result: 'x' })))
    vi.stubGlobal('fetch', fetchMock)
    const field = clientField('description', { hasGenerateDescription: true, basePath: '/api/seo' })
    render(<MetaDescriptionField path="meta.description" field={field} />)
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/seo/generate', expect.objectContaining({ method: 'POST' }))
  })
})

describe('resolveMetaFieldOptions', () => {
  it('prefers direct props, then admin.custom, then the defaults', () => {
    const field = { admin: { custom: { hasGenerateFn: true, basePath: '/api/custom' } } }
    expect(resolveMetaFieldOptions({ field })).toEqual({ hasGenerateFn: true, basePath: '/api/custom' })
    expect(resolveMetaFieldOptions({ field, hasGenerateFn: false, basePath: '/api/own' })).toEqual({
      hasGenerateFn: false,
      basePath: '/api/own',
    })
    expect(resolveMetaFieldOptions({})).toEqual({ hasGenerateFn: false, basePath: '/api/seo-plugin' })
  })
})
