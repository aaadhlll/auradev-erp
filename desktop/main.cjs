const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const DEFAULT_BACKEND_PORT = 18080
const DEFAULT_FRONTEND_PORT = 13000
let backendProcess = null
let nextProcess = null
let mainWindow = null

// Keep per-user settings, logs, and uploads under a human-readable folder.
app.setName('Mercantile')

if (!app.requestSingleInstanceLock()) app.quit()

function readDesktopConfig() {
  const configPath = path.join(app.getPath('userData'), 'mercantile.config.json')
  try {
    return { ...JSON.parse(fs.readFileSync(configPath, 'utf8')), configPath }
  } catch {
    return { configPath }
  }
}

function ensureDesktopEnvironment() {
  const environmentPath = path.join(app.getPath('userData'), '.env')
  if (fs.existsSync(environmentPath)) return environmentPath

  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  const templatePath = path.join(app.getAppPath(), 'desktop', 'backend.env.example')
  fs.copyFileSync(templatePath, environmentPath)
  return environmentPath
}

function isLocalAddress(value) {
  try {
    return ['127.0.0.1', 'localhost', '::1'].includes(new URL(value).hostname)
  } catch {
    return false
  }
}

function findJava(config) {
  const bundled = path.join(process.resourcesPath, 'runtime', 'jre', 'bin', 'javaw.exe')
  if (app.isPackaged && fs.existsSync(bundled)) return bundled
  if (config.javaPath && fs.existsSync(config.javaPath)) return config.javaPath
  return process.platform === 'win32' ? 'javaw.exe' : 'java'
}

function waitForHttp(url, timeout = 90000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, response => {
        response.resume()
        if (response.statusCode && response.statusCode < 500) return resolve()
        retry()
      })
      request.on('error', retry)
      request.setTimeout(1500, () => { request.destroy(); retry() })
    }
    const retry = () => {
      if (Date.now() - started >= timeout) return reject(new Error(`Timed out waiting for ${url}`))
      setTimeout(attempt, 300)
    }
    attempt()
  })
}

function startBackend(config, backendUrl) {
  if (!app.isPackaged || !isLocalAddress(backendUrl)) return
  const jar = config.backendJar || path.join(process.resourcesPath, 'runtime', 'mercantile-backend.jar')
  if (!fs.existsSync(jar)) throw new Error(`Backend package not found: ${jar}`)
  const environmentPath = ensureDesktopEnvironment()
  const logPath = path.join(app.getPath('userData'), 'backend.log')
  const log = fs.openSync(logPath, 'a')

  backendProcess = spawn(findJava(config), ['-jar', jar], {
    windowsHide: true,
    cwd: app.getPath('userData'),
    env: {
      ...process.env,
      PORT: String(new URL(backendUrl).port || DEFAULT_BACKEND_PORT),
      SPRING_PROFILES_ACTIVE: 'desktop',
      APP_UPLOADS_DIR: path.join(app.getPath('userData'), 'uploads'),
    },
    stdio: ['ignore', log, log],
  })
  backendProcess.on('error', error => dialog.showErrorBox('Mercantile backend', `Could not start the local backend.\n\n${error.message}\n\nLog: ${logPath}`))
  return { environmentPath, logPath }
}

function startNext(backendUrl) {
  if (!app.isPackaged) return process.env.MERCANTILE_DEV_URL || 'http://127.0.0.1:3000'

  const server = path.join(process.resourcesPath, 'next', 'server.js')
  if (!fs.existsSync(server)) throw new Error(`Desktop frontend not found: ${server}`)
  const port = String(DEFAULT_FRONTEND_PORT)
  const logPath = path.join(app.getPath('userData'), 'next.log')
  const log = fs.openSync(logPath, 'a')
  nextProcess = spawn(process.execPath, [server], {
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: port,
      HOSTNAME: '127.0.0.1',
      API_PROXY_URL: backendUrl,
    },
    stdio: ['ignore', log, log],
  })
  nextProcess.on('error', error => dialog.showErrorBox('Mercantile frontend', `Could not start the local frontend.\n\n${error.message}\n\nLog: ${logPath}`))
  return `http://127.0.0.1:${port}`
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    icon: path.join(__dirname, 'icon.png'),
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Mercantile',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    void shell.openExternal(target)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(url)) event.preventDefault()
  })
  return mainWindow.loadURL(url)
}

function stopProcess(processToStop) {
  if (processToStop && !processToStop.killed) processToStop.kill()
}

ipcMain.handle('mercantile:runtime-info', () => ({ packaged: app.isPackaged, version: app.getVersion() }))

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.whenReady().then(async () => {
  const config = readDesktopConfig()
  const backendUrl = config.backendUrl || (app.isPackaged
    ? `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`
    : process.env.MERCANTILE_DEV_API_URL || 'http://127.0.0.1:8080')
  try {
    process.env.MERCANTILE_API_URL = backendUrl
    startBackend(config, backendUrl)
    const frontendUrl = startNext(backendUrl)
    if (app.isPackaged) {
      await waitForHttp(`${backendUrl}/actuator/health`)
      await waitForHttp(frontendUrl)
    }
    await createWindow(frontendUrl)
  } catch (error) {
    const logNote = backendProcess
      ? `\n\nBackend log: ${path.join(app.getPath('userData'), 'backend.log')}\nFrontend log: ${path.join(app.getPath('userData'), 'next.log')}`
      : ''
    dialog.showErrorBox('Mercantile could not start', `${error.message}\n\nCheck the desktop configuration and local database connection.${logNote}`)
    app.quit()
  }
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => { stopProcess(nextProcess); stopProcess(backendProcess) })
