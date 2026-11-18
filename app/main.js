import { checkConfig } from './config.js'

const $ = (id) => document.getElementById(id)

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

function fill(dl, rows) {
  dl.replaceChildren()
  for (const [k, v] of rows) {
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = k
    dd.textContent = v ?? '(none)'
    dl.append(dt, dd)
  }
}

function fail(message) {
  $('env-label').textContent = 'Not configured'
  const box = $('error')
  box.textContent = `This site isn't configured for this address: ${message}. Nothing else loads.`
  box.hidden = false
}

async function start() {
  let checked
  try {
    checked = checkConfig(await getJson('/config.json'))
  } catch (e) {
    return fail(e.message)
  }
  if (!checked.ok) return fail(checked.error)
  const cfg = checked.config

  document.documentElement.style.setProperty('--banner', cfg.banner)
  $('env-label').textContent = cfg.label
  document.title = `${cfg.label} · SWA deploy PoC`
  $('details').hidden = false

  fill($('config'), [['environment', cfg.environment], ['portalUrl', cfg.portalUrl], ['clientId', cfg.clientId]])

  const build = await getJson('/build.json').catch(() => null)
  fill($('build'), build ? [['version', build.version], ['commit', build.commit], ['built at', build.builtAt]] : [['build', 'build.json missing']])

  try {
    const api = await getJson('/api/hello')
    fill($('api'), [['message', api.message], ['ENVIRONMENT_NAME', api.environment], ['DEMO_SECRET set', String(api.secretConfigured)]])
  } catch (e) {
    fill($('api'), [['error', e.message]])
  }
}

start()
