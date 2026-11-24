import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendRoot = path.resolve(frontendRoot, '..', 'auradev-erp-backend')
const runtimeDir = path.join(frontendRoot, 'desktop', 'runtime')
const mavenCommand = process.platform === 'win32' ? 'mvn.cmd' : 'mvn'

if (!existsSync(backendRoot)) throw new Error(`Backend repository not found: ${backendRoot}`)

const result = spawnSync(mavenCommand, ['-DskipTests', 'package'], {
  cwd: backendRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (result.status !== 0) process.exit(result.status ?? 1)

const targetDir = path.join(backendRoot, 'target')
const jar = readdirSync(targetDir)
  .filter(name => name.endsWith('.jar') && !name.endsWith('.jar.original'))
  .map(name => path.join(targetDir, name))
  .sort((a, b) => b.localeCompare(a))[0]
if (!jar) throw new Error('Maven completed but no runnable backend JAR was found.')

mkdirSync(runtimeDir, { recursive: true })
cpSync(jar, path.join(runtimeDir, 'mercantile-backend.jar'))
console.log(`Prepared desktop backend: ${jar}`)
