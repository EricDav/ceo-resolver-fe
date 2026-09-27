# Leader Resolver Web

Next.js dashboard for the Leader Resolver API: upload a list, watch the run, review the
results, export.

## Local development

```bash
cp .env.example .env.local     # point NEXT_PUBLIC_API_URL at your API
npm install
npm run dev                    # http://localhost:3000
```

## Deploying to Netlify

1. Push this folder to its own Git repository.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Build command `npm run build`, publish directory `.next` — `netlify.toml` already
   sets both, along with the Next.js runtime plugin.
4. Set environment variables under **Site settings → Environment variables**:
   - `NEXT_PUBLIC_API_URL` — `https://your-resolver-api.herokuapp.com`
   - `NEXT_PUBLIC_API_KEY` — only if you set `API_KEY` on the API

Then add the Netlify URL to `CORS_ORIGINS` on the Heroku app, or the browser will block
every request.

`NEXT_PUBLIC_*` variables are compiled into the client bundle and visible to anyone who
opens devtools. That is fine for the API URL. It means `NEXT_PUBLIC_API_KEY` is a
deterrent against casual access, not a real secret — if the data matters, put proper
user auth in front of the API instead.

## Pages

- `/` — start a run (paste or upload) and see recent runs, refreshed every 4s
- `/jobs/[id]` — progress, counters, cost, filterable results, inline editing, export

Polling runs at 2.5s while a job is active and stops when it finishes.
# ceo-resolver-fe
