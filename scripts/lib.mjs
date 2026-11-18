// Shared by the deploy scripts and the tests. Paths resolve from this file, so the same code runs from the repo
// and from the release package's tools/ folder (which mirrors the repo's scripts/, app/ and deploy/ layout).
import { readFileSync } from 'node:fs'
import { checkConfig } from '../app/config.js'

export const ROOT = new URL('../', import.meta.url)
export const envFile = (name) => new URL(`deploy/envs/${name}.json`, ROOT)

const ENV_NAME = /^[a-z][a-z0-9-]{0,39}$/
const ORIGIN = /^https:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i

export function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'))
}

export function loadProfile(name) {
  if (!ENV_NAME.test(name)) throw new Error(`"${name}" isn't an environment name (lower case, digits and dashes)`)
  return readJson(envFile(name))
}

/** Every problem with an env profile, as sentences. Empty means it's usable. */
export function profileErrors(p) {
  const errors = []
  if (!p || typeof p !== 'object') return ['the profile is not a JSON object']
  if (typeof p.appUrl !== 'string' || !/^(https:\/\/|http:\/\/localhost[:/])/.test(p.appUrl)) errors.push('appUrl must be https (or http://localhost)')
  if (typeof p.requireTag !== 'boolean') errors.push('requireTag must be true or false')
  if (!Array.isArray(p.frameAncestors)) errors.push('frameAncestors must be a list')
  else for (const o of p.frameAncestors) if (typeof o !== 'string' || !ORIGIN.test(o)) errors.push(`frameAncestors: "${o}" isn't an https origin (no path)`)
  const c = checkConfig(p.config)
  if (!c.ok) errors.push(`config: ${c.error.replace('config.json', 'config')}`)
  return errors
}

export const isPlaceholder = (url) => /[<>]/.test(url)

export function frameAncestors(origins) {
  return ["frame-ancestors 'self'", ...origins].join(' ')
}

/** The site's staticwebapp.config.json: the template plus this environment's headers. */
export function swaConfig(base, profile) {
  const out = structuredClone(base)
  delete out.$comment
  out.globalHeaders = { ...out.globalHeaders, 'Content-Security-Policy': frameAncestors(profile.frameAncestors) }
  return out
}

/** The site's config.json: what the page reads at start-up. Public values only. */
export function siteConfig(profile) {
  return checkConfig(profile.config).config
}

/**
 * Which environment a workflow run deploys to: a manual run names it; a v* tag goes to stable; main goes to dev.
 * A profile with requireTag only takes a release tag, so customers only ever get tagged releases.
 */
export function pickTarget({ event, ref, input }, load = loadProfile) {
  const tag = ref.startsWith('refs/tags/v')
  const target = event === 'workflow_dispatch' ? input : tag ? 'stable' : ref === 'refs/heads/main' ? 'dev' : null
  if (!target) throw new Error(`nothing deploys from ${ref}`)
  const profile = load(target)
  if (profile.requireTag && !tag) throw new Error(`${target} only deploys from a release tag (v*); run the workflow on a tag`)
  return target
}
