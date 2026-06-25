import { describe, it, expect, afterEach } from 'vitest'
import { isGscAdmin } from '../helpers/gscClient.js'
import { isSeoAdmin } from '../helpers/isAdmin.js'

// Shared admin-gate logic (same shape across all endpoint isAdmin checks).
describe('isGscAdmin / admin gate', () => {
  it('allows explicit admin role', () => {
    expect(isGscAdmin({ role: 'admin' })).toBe(true)
    expect(isGscAdmin({ roles: ['editor', 'admin'] })).toBe(true)
  })

  it('denies a non-admin role / roles', () => {
    expect(isGscAdmin({ role: 'editor' })).toBe(false)
    expect(isGscAdmin({ roles: ['editor'] })).toBe(false)
  })

  it('allows an authenticated user on a role-LESS setup (default Payload)', () => {
    // No `role` string and no `roles` array → reaching the admin means privileged.
    expect(isGscAdmin({ id: '1', email: 'a@b.c' })).toBe(true)
    expect(isGscAdmin({ id: '1', role: undefined })).toBe(true)
  })

  it('denies no user', () => {
    expect(isGscAdmin(null)).toBe(false)
    expect(isGscAdmin(undefined)).toBe(false)
  })
})

describe('isSeoAdmin — SEO_REQUIRE_ADMIN_ROLE opt-in', () => {
  const prev = process.env.SEO_REQUIRE_ADMIN_ROLE
  afterEach(() => {
    if (prev === undefined) delete process.env.SEO_REQUIRE_ADMIN_ROLE
    else process.env.SEO_REQUIRE_ADMIN_ROLE = prev
  })

  it('still allows an explicit admin role in strict mode', () => {
    process.env.SEO_REQUIRE_ADMIN_ROLE = '1'
    expect(isSeoAdmin({ role: 'admin' })).toBe(true)
    expect(isSeoAdmin({ roles: ['admin'] })).toBe(true)
  })

  it('denies a role-less user in strict mode (no fail-open)', () => {
    process.env.SEO_REQUIRE_ADMIN_ROLE = '1'
    expect(isSeoAdmin({ id: '1', email: 'a@b.c' })).toBe(false)
  })

  it('fails open for a role-less user when not in strict mode', () => {
    delete process.env.SEO_REQUIRE_ADMIN_ROLE
    expect(isSeoAdmin({ id: '1' })).toBe(true)
  })
})
