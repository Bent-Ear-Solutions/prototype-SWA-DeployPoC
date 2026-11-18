// Checks the site config the page loads from /config.json. Shared by the page and the tests.
// Fail closed: anything missing or malformed is an error; there's no built-in fallback (KERMIT's demo mode).

const HEX = /^#[0-9a-f]{6}$/i

/** @returns {{ ok: true, config: object } | { ok: false, error: string }} */
export function checkConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'config.json is not an object' }
  for (const key of ['environment', 'portalUrl', 'clientId']) {
    if (typeof raw[key] !== 'string' || !raw[key].trim()) return { ok: false, error: `config.json has no ${key}` }
  }
  if (!/^https:\/\/[^/\s]+/.test(raw.portalUrl)) return { ok: false, error: 'portalUrl must be an https address' }
  if (raw.banner !== undefined && !HEX.test(raw.banner)) return { ok: false, error: 'banner must be a #rrggbb colour' }
  return {
    ok: true,
    config: {
      environment: raw.environment,
      label: typeof raw.label === 'string' ? raw.label : raw.environment,
      portalUrl: raw.portalUrl.replace(/\/$/, ''),
      clientId: raw.clientId,
      banner: raw.banner ?? '#555555',
    },
  }
}
