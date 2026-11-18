import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { checkConfig } from '../app/config.js'
import { hello } from '../api/src/hello.js'
import { ROOT, frameAncestors, loadProfile, pickTarget, profileErrors, readJson, swaConfig } from '../scripts/lib.mjs'

const good = loadProfile('dev')

test('every committed env profile is usable', () => {
  const names = readdirSync(new URL('deploy/envs/', ROOT)).map((f) => f.replace(/\.json$/, ''))
  assert.ok(names.includes('dev') && names.includes('acme-prod'))
  for (const n of names) assert.deepEqual(profileErrors(loadProfile(n)), [], n)
})

test('the page refuses a missing or broken config (no fallback)', () => {
  assert.equal(checkConfig(null).ok, false)
  assert.equal(checkConfig({}).ok, false)
  assert.match(checkConfig({ environment: 'x', portalUrl: 'http://plain.example', clientId: 'c' }).error, /https/)
  assert.match(checkConfig({ ...good.config, banner: 'red' }).error, /banner/)
  assert.equal(checkConfig(good.config).ok, true)
})

test('profile problems are named', () => {
  const errors = profileErrors({ ...good, appUrl: 'http://example.com', frameAncestors: ['https://x.example/path'], requireTag: 'no' })
  assert.equal(errors.length, 3)
  assert.match(errors.join(' '), /appUrl.*requireTag.*frameAncestors/s)
})

test("each site's staticwebapp.config.json carries its own frame-ancestors", () => {
  const base = readJson(new URL('deploy/staticwebapp.base.json', ROOT))
  const acme = swaConfig(base, loadProfile('acme-prod'))
  assert.equal(acme.globalHeaders['Content-Security-Policy'], "frame-ancestors 'self' https://acme.sharepoint.com")
  assert.equal(acme.globalHeaders['X-Content-Type-Options'], 'nosniff')
  assert.equal(acme.$comment, undefined)
  assert.equal(base.globalHeaders['Content-Security-Policy'], undefined, 'template left as it was')
  assert.equal(frameAncestors([]), "frame-ancestors 'self'")
})

test('main goes to dev, tags to stable, customers only from a tag', () => {
  assert.equal(pickTarget({ event: 'push', ref: 'refs/heads/main' }), 'dev')
  assert.equal(pickTarget({ event: 'push', ref: 'refs/tags/v1.0.0' }), 'stable')
  assert.equal(pickTarget({ event: 'workflow_dispatch', ref: 'refs/tags/v1.0.0', input: 'acme-prod' }), 'acme-prod')
  assert.throws(() => pickTarget({ event: 'workflow_dispatch', ref: 'refs/heads/main', input: 'acme-prod' }), /release tag/)
  assert.throws(() => pickTarget({ event: 'workflow_dispatch', ref: 'refs/heads/main', input: '../secrets' }), /environment name/)
  assert.throws(() => pickTarget({ event: 'push', ref: 'refs/heads/feature' }), /nothing deploys/)
})

test('the API reports its Azure settings without echoing the secret', () => {
  assert.deepEqual(hello({ ENVIRONMENT_NAME: 'acme-prod', DEMO_SECRET: 's3cret' }), { message: 'Hello from the API', environment: 'acme-prod', secretConfigured: true })
  assert.equal(hello({}).secretConfigured, false)
  assert.ok(!JSON.stringify(hello({ DEMO_SECRET: 's3cret' })).includes('s3cret'))
})
