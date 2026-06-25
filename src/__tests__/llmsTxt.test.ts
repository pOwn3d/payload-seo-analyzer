import { describe, it, expect } from 'vitest'
import { buildLlmsTxt } from '../endpoints/llmsTxt.js'

describe('buildLlmsTxt', () => {
  it('renders title, summary and link sections', () => {
    const out = buildLlmsTxt({
      siteName: 'Acme',
      siteDescription: 'We build things.',
      sections: [
        {
          heading: 'Pages',
          pages: [
            { title: 'Home', url: 'https://acme.com/home' },
            { title: 'About', url: 'https://acme.com/about', description: 'Who we are' },
          ],
        },
      ],
    })
    expect(out).toContain('# Acme')
    expect(out).toContain('> We build things.')
    expect(out).toContain('## Pages')
    expect(out).toContain('- [Home](https://acme.com/home)')
    expect(out).toContain('- [About](https://acme.com/about): Who we are')
    expect(out.endsWith('\n')).toBe(true)
  })

  it('skips empty sections and link-less sections', () => {
    const out = buildLlmsTxt({
      siteName: 'Acme',
      sections: [
        { heading: 'Empty', pages: [] },
        { heading: 'Bad', pages: [{ title: '', url: '' }] },
        { heading: 'Good', pages: [{ title: 'X', url: 'https://acme.com/x' }] },
      ],
    })
    expect(out).not.toContain('## Empty')
    expect(out).not.toContain('## Bad')
    expect(out).toContain('## Good')
  })

  it('omits the summary blockquote when no description', () => {
    const out = buildLlmsTxt({ siteName: 'Acme', sections: [] })
    expect(out).toBe('# Acme\n')
  })

  it('caps output to the byte budget by dropping trailing lines', () => {
    const pages = Array.from({ length: 500 }, (_, i) => ({
      title: `Page ${i}`,
      url: `https://acme.com/page-${i}`,
    }))
    const out = buildLlmsTxt({ siteName: 'Acme', sections: [{ heading: 'Pages', pages }] }, 1024)
    expect(Buffer.byteLength(out, 'utf8')).toBeLessThanOrEqual(1024)
    expect(out).toContain('# Acme')
  })
})
