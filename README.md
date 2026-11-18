# SWA deploy PoC

A hello-world app that tests the deployment model planned for SPARC and KERMIT (KERMIT backlog KB-24 to KB-27): **build once, configure per environment, deploy with GitHub Environments**. One page and one API function; no framework and no ArcGIS sign-in.

What it proves:

| Claim | How you see it |
|---|---|
| One build runs everywhere | Every site shows the same version and commit; only the banner and config differ. |
| The environment lives in data, not code | Each target is `deploy/envs/<target>.json` plus a GitHub Environment. Adding one changes no code. |
| The build holds no environment | `dist/site` has no `config.json` or `staticwebapp.config.json`; `configure.mjs` writes them at deploy time. |
| Missing config fails closed | Delete `config.json` from a site and the page says it isn't configured; there's no fallback. |
| Embed origins are per site | Each site's `Content-Security-Policy: frame-ancestors` comes from its profile. |
| Customer secrets stay in the customer's Azure | `/api/hello` reports `ENVIRONMENT_NAME` and whether `DEMO_SECRET` is set; both are Azure settings on that site only. |
| Customers only get tagged releases | Profiles with `requireTag` refuse a deploy from a branch. |
| A customer can deploy BES's package themselves | Each tag attaches the unconfigured build plus the configure tool to a GitHub Release. |

## Layout

```
app/                    the page: index.html, main.js, config.js (checks /config.json), style.css
api/                    one Azure Function: GET /api/hello
deploy/envs/*.json      one profile per target: dev, stable (BES), acme-test, acme-prod (a stand-in customer), local
deploy/staticwebapp.base.json   template for each site's staticwebapp.config.json
scripts/build.mjs       dist/site, dist/api (with production packages), dist/tools
scripts/configure.mjs   writes one environment's config.json and staticwebapp.config.json into a built site
scripts/target.mjs      which environment a workflow run deploys to
scripts/smoke.mjs       after a deploy: the live site serves this commit and this environment's config
.github/workflows/      ci.yml (pull requests), deploy.yml (build once, deploy, package)
```

## Run it locally

```bash
cd api && npm install && cd ..
npm test
npm run build                                          # dist/
node scripts/configure.mjs --env acme-prod --site dist/site
npm run preview                                        # local profile, SWA CLI at http://localhost:4280 (the API needs Azure Functions Core Tools)
```

## Set up the environments

The workflow needs GitHub Environments with their own secrets. On GitHub Free, those exist only on **public** repos; a private repo needs GitHub Team (KB-26). Nothing in this repo is secret: profiles hold placeholder IDs, and tokens live in GitHub's secret store.

For each target (`dev`, `stable`, `acme-test`, `acme-prod`):

1. **Azure.** Create a Static Web App (Standard or Free). The `acme-*` sites stand in for a customer: put them in a different resource group or subscription to play the customer's tenant.
   ```bash
   az staticwebapp create -n poc-dev -g rg-swa-poc --location eastus2 --sku Free
   az staticwebapp secrets list -n poc-dev -g rg-swa-poc --query properties.apiKey -o tsv    # the deployment token
   ```
   Optionally, as the "customer", set `ENVIRONMENT_NAME` and `DEMO_SECRET` under the site's Environment variables.
2. **Profile.** Put the site's default hostname in `appUrl` in `deploy/envs/<target>.json` (it stays a placeholder until then, and the live check is skipped).
3. **GitHub.** Settings → Environments → New environment named after the target, with the secret `SWA_TOKEN` set to the deployment token. For `acme-prod`, add a required reviewer, and limit deployments to tags `v*`.

## What to try

1. **Merge to main.** dev deploys; the page shows `0.0.0-<sha>` and a blue banner.
2. **Tag a release.** `git tag v0.1.0 && git push origin v0.1.0`: stable deploys, and a GitHub Release gets `swa-deploy-poc-v0.1.0.zip` and its checksum.
3. **Deploy a customer.** Actions → Deploy → Run workflow, pick tag `v0.1.0` and `acme-test`. Same version and commit as stable, with Acme's banner and config.
4. **Gate production.** Run it for `acme-prod`; it waits for the reviewer.
5. **Refuse a branch.** Run it from `main` for `acme-prod`; it stops with "only deploys from a release tag".
6. **Roll back.** Tag `v0.2.0`, deploy it, then run the workflow on `v0.1.0` for the same target.
7. **Deploy from the package.** Download the zip, then: `node tools/scripts/configure.mjs --profile tools/deploy/envs/acme-test.json --site site` and `swa deploy ./site --api-location ./api --api-language node --api-version 22 --env production`.
8. **Check embedding.** `curl -sI <site>/ | grep -i content-security` differs per site.
9. **Fail closed.** Configure the build, delete `dist/site/config.json` and preview: the page refuses to start.

## Things the PoC settles (or doesn't)

- **Profiles come from the deployed commit.** A tag carries its own profiles, so a deploy is reproducible; changing a customer's address means a new tag. The alternative is to read profiles from `main` at deploy time.
- **A new target needs one line in `deploy.yml`** (the `options` list). A free-text input would avoid that, at the cost of typos; `target.mjs` refuses names without a profile either way.
- **The token can only upload content.** It can't read or change the site's settings, and whoever owns that Azure can reset it to revoke BES.
- Not covered: custom domains, OAuth redirect URIs, ArcGIS provisioning, the Teams package.
