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

const child = spawn('pnpm', ['run', 'dev', '--', ...process.argv.slice(2)], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: isWindows
})

child.on('exit', code => {
  process.exit(code ?? 0)
})

child.on('error', error => {
  console.error(error)
  process.exit(1)
})
