// Writes one environment's config.json and staticwebapp.config.json into a built site folder.
//   node scripts/configure.mjs --env dev --site dist/site
//   node tools/scripts/configure.mjs --profile ./my-env.json --site site     (a customer deploying the release package)
// It never touches anything else, so the site's other files stay exactly as built.
import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { ROOT, loadProfile, profileErrors, readJson, siteConfig, swaConfig } from './lib.mjs'

const { values } = parseArgs({ options: { env: { type: 'string' }, profile: { type: 'string' }, site: { type: 'string' } } })

function die(msg) {
  console.error(`configure: ${msg}`)
  process.exit(1)
}

if (!values.site) die('--site <built site folder> is required')
if (!values.env === !values.profile) die('give either --env <name> or --profile <file>')

const site = resolve(values.site)
if (!existsSync(join(site, 'build.json'))) die(`${site} isn't a build (no build.json); run npm run build first`)

const profile = values.env ? loadProfile(values.env) : readJson(pathToFileURL(resolve(values.profile)))
const errors = profileErrors(profile)
if (errors.length) die(`the profile has problems:\n  - ${errors.join('\n  - ')}`)

const base = readJson(new URL('deploy/staticwebapp.base.json', ROOT))
const config = siteConfig(profile)
writeFileSync(join(site, 'config.json'), JSON.stringify(config, null, 2) + '\n')
writeFileSync(join(site, 'staticwebapp.config.json'), JSON.stringify(swaConfig(base, profile), null, 2) + '\n')

console.log(`configured ${site} for ${config.environment} (${config.label})`)
console.log(`  ${swaConfig(base, profile).globalHeaders['Content-Security-Policy']}`)
