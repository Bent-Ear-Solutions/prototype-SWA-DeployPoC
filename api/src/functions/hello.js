import { app } from '@azure/functions'
import { hello } from '../hello.js'

app.http('hello', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async () => ({ jsonBody: hello(), headers: { 'Cache-Control': 'no-store' } }),
})
