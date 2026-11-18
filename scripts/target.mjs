// Prints the environment this workflow run deploys to, and adds it to $GITHUB_OUTPUT as target=<name>.
// Reads GITHUB_EVENT_NAME, GITHUB_REF and TARGET_INPUT (the manual run's choice) from the environment.
import { appendFileSync } from 'node:fs'
import { pickTarget } from './lib.mjs'

try {
  const target = pickTarget({ event: process.env.GITHUB_EVENT_NAME ?? '', ref: process.env.GITHUB_REF ?? '', input: process.env.TARGET_INPUT ?? '' })
  console.log(target)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `target=${target}\n`)
} catch (e) {
  console.error(`::error::${e.message}`)
  process.exit(1)
}
