// The answer GET /api/hello gives, kept apart from the Azure wiring so it can be tested.
// ENVIRONMENT_NAME and DEMO_SECRET are the site's own Azure settings (Static Web App -> Environment variables),
// set by whoever owns that Azure tenant. They never come from the repo or the build, and the secret is never echoed.

export function hello(env = process.env) {
  return {
    message: 'Hello from the API',
    environment: env.ENVIRONMENT_NAME ?? null,
    secretConfigured: Boolean(env.DEMO_SECRET),
  }
}
