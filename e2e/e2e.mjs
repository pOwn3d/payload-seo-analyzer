import { getPayload } from 'payload'
import config from './payload.config.mjs'
import { analyzeSeo, buildSeoInputFromDoc } from '@consilioweb/payload-seo-analyzer'

let failures = 0
const check = (name, cond) => { console.log(`${cond ? '✅ PASS' : '❌ FAIL'} — ${name}`); if (!cond) failures++ }

const payload = await getPayload({ config })

const collSlugs = Object.keys(payload.collections)
check('plugin config transform + onInit ran (getPayload OK)', true)
check('seo-score-history registered', collSlugs.includes('seo-score-history'))
check('seo-redirects registered', collSlugs.includes('seo-redirects'))
check('seo-settings registered', collSlugs.includes('seo-settings'))

const pages = payload.config.collections.find((c) => c.slug === 'pages')
const flat = JSON.stringify(pages.fields)
check('SEO fields injected into pages (focusKeyword)', flat.includes('focusKeyword'))
check('meta group injected into pages', flat.includes('"meta"'))

const page = await payload.create({ collection: 'pages', data: { title: 'A propos', slug: 'a-propos' } })
check('page created (fields wired in DB)', !!page.id)

const post = await payload.create({ collection: 'posts', data: { title: 'Guide SEO local 2026', slug: 'guide-seo-local', focusKeyword: 'seo local' } })
check('post created with focusKeyword', post.focusKeyword === 'seo local')

const analysis = analyzeSeo(buildSeoInputFromDoc(post, 'posts'))
check('analyzeSeo returns numeric score', typeof analysis.score === 'number')
check('analyzeSeo returns >10 checks', Array.isArray(analysis.checks) && analysis.checks.length > 10)

const updated = await payload.update({ collection: 'posts', id: post.id, data: { meta: { title: 'Guide SEO local 2026 | Agence', description: 'Le guide complet du SEO local 2026 pour les PME.' } } })
check('meta update persisted (bulk-apply target works)', String(updated.meta?.title || '').includes('Guide SEO local'))

console.log(`\n=== e2e: ${failures === 0 ? 'ALL PASS ✅' : failures + ' FAILURE(S) ❌'} ===`)
process.exit(failures === 0 ? 0 : 1)
