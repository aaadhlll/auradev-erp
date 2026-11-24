const fs = require('node:fs')
const path = require('node:path')

/**
 * electron-builder intentionally filters node_modules from broad extraResources
 * copies. A Next standalone server needs its trimmed runtime dependencies beside
 * server.js, so copy them after Electron has completed its app packaging.
 */
exports.default = async function afterPack(context) {
  const projectDir = context.packager?.projectDir || process.cwd()
  const source = path.join(projectDir, '.next', 'standalone', 'node_modules')
  const destination = path.join(context.appOutDir, 'resources', 'next', 'node_modules')
  if (!fs.existsSync(source)) {
    throw new Error(`Next standalone dependencies are missing: ${source}`)
  }
  fs.cpSync(source, destination, { recursive: true, force: true })
}
