import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'
const env = {
  ...process.env,
  NUXT_REAL_DATA_ONLY: 'true',
  NUXT_PUBLIC_REAL_DATA_ONLY: 'true',
  NUXT_PUBLIC_SITE_URL: process.env.NUXT_PUBLIC_SITE_URL || 'https://cuphotoclub.pages.dev'
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: 'inherit',
      shell: isWindows
    })
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

await run('pnpm', ['run', 'build'])

// The build emits dist/_worker.js/wrangler.json with `remote: true` on every binding
// (D1, KV, R2). Keep it as-is — this script binds all three to the real Cloudflare
// resources. Requires `wrangler login` (already done: cuphotoclub2023@gmail.com).
// Every write here (album/post edits, uploads) is live on the real site immediately.
//
// `wrangler pages dev` refuses a custom --config path — it only looks for a
// wrangler.json(c) in the served directory itself. So the generated config is written
// straight to dist/wrangler.json, and pages dev is run with --cwd dist so it resolves
// there automatically.
const generatedCfgPath = resolve(root, 'dist/_worker.js/wrangler.json')
const cfg = JSON.parse(readFileSync(generatedCfgPath, 'utf8'))
// pages_build_output_dir must be relative to the new config location (dist/).
cfg.pages_build_output_dir = '.'
writeFileSync(resolve(root, 'dist/wrangler.json'), JSON.stringify(cfg, null, 2))

// Apply any pending migrations to the real D1 database before serving, same as CI does.
await run('npx', ['wrangler@latest', 'd1', 'migrations', 'apply', 'cuphotoclub-db', '--remote'])

await run('npx', ['wrangler@latest', 'pages', 'dev', '.', '--cwd', 'dist'])
