import { cpSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const standalone = path.join(root, '.next', 'standalone')
const staticFiles = path.join(root, '.next', 'static')
const publicFiles = path.join(root, 'public')

if (!existsSync(path.join(standalone, 'server.js'))) {
  throw new Error('Next standalone build is missing. Run the frontend build first.')
}

mkdirSync(path.join(standalone, '.next'), { recursive: true })
cpSync(staticFiles, path.join(standalone, '.next', 'static'), { recursive: true })
if (existsSync(publicFiles)) cpSync(publicFiles, path.join(standalone, 'public'), { recursive: true })
console.log('Prepared standalone Next files for Electron.')
