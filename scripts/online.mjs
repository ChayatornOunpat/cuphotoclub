import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

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
await run('npx', ['wrangler@latest', '--cwd', 'dist', 'pages', 'dev'])
