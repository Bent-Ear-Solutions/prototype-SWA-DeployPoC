// After a deploy: checks the live site serves this build and this environment's config.
//   node scripts/smoke.mjs --env dev --build dist/site/build.json
// Retries for a minute, since a new deploy takes a moment to reach Azure's edge.
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { isPlaceholder, loadProfile, siteConfig } from './lib.mjs'

const { values } = parseArgs({ options: { env: { type: 'string' }, build: { type: 'string' } } })
const profile = loadProfile(values.env)
const expected = { build: JSON.parse(readFileSync(values.build, 'utf8')), config: siteConfig(profile) }

if (isPlaceholder(profile.appUrl)) {
  console.log(`::warning::${values.env}: appUrl is still a placeholder (${profile.appUrl}); skipped the live check`)
  process.exit(0)
}

const base = profile.appUrl.replace(/\/$/, '')
const get = async (path) => {
  const res = await fetch(`${base}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${path} answered ${res.status}`)
  return res.json()
}

let last = ''
for (let i = 0; i < 12; i++) {
  try {
    const [build, config] = await Promise.all([get('/build.json'), get('/config.json')])
    if (build.commit !== expected.build.commit) throw new Error(`serving commit ${build.commit.slice(0, 7)}, expected ${expected.build.commit.slice(0, 7)}`)
    if (config.environment !== expected.config.environment) throw new Error(`serving config for ${config.environment}, expected ${expected.config.environment}`)
    const api = await get('/api/hello').catch((e) => ({ error: e.message }))
    console.log(`${base}: ${build.version} (${build.commit.slice(0, 7)}), config ${config.environment}`)
    if (api.error) console.log(`::warning::API: ${api.error}`)
    else console.log(`API: ENVIRONMENT_NAME=${api.environment ?? '(not set)'}, DEMO_SECRET set=${api.secretConfigured}`)
    process.exit(0)
  } catch (e) {
    last = e.message
    await new Promise((r) => setTimeout(r, 5000))
  }
}
console.error(`::error::${base}: ${last}`)
process.exit(1)
