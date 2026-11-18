// Builds the release once: dist/site (the page), dist/api (the functions, with production packages) and
// dist/tools (configure.mjs and what it needs, for a customer who deploys the package themselves).
// No environment goes into the build: there is no config.json or staticwebapp.config.json in dist/site.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = join(root, 'dist')
const at = (...p) => join(root, ...p)

function commit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return 'local'
  }
}

const sha = commit()
const version = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : `0.0.0-${sha.slice(0, 7)}`

rmSync(dist, { recursive: true, force: true })

// Site
cpSync(at('app'), join(dist, 'site'), { recursive: true })
writeFileSync(join(dist, 'site', 'build.json'), JSON.stringify({ version, commit: sha, builtAt: new Date().toISOString() }, null, 2) + '\n')
for (const f of ['config.json', 'staticwebapp.config.json']) {
  if (existsSync(join(dist, 'site', f))) throw new Error(`app/${f} must not exist: it's written per environment at deploy time`)
}

// API, with only its production packages
mkdirSync(join(dist, 'api'), { recursive: true })
for (const f of ['host.json', 'package.json', 'package-lock.json', 'src']) cpSync(at('api', f), join(dist, 'api', f), { recursive: true })
execSync('npm ci --omit=dev --no-audit --no-fund', { cwd: join(dist, 'api'), stdio: 'inherit' })

// Tools for configuring a site from the package
for (const f of ['scripts/lib.mjs', 'scripts/configure.mjs', 'app/config.js', 'deploy/staticwebapp.base.json', 'deploy/envs/acme-test.json']) {
  cpSync(at(f), join(dist, 'tools', f), { recursive: true })
}

console.log(`built ${version} (${sha.slice(0, 7)}) into dist/`)
