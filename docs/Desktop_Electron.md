# Mercantile for Windows (Electron)

Mercantile can be installed as a normal Windows application. In production the Electron window starts a local Next.js server and Spring Boot backend, then opens the application at a local-only address.

## Architecture

For one PC, install Mercantile and PostgreSQL on that PC. For a multi-counter shop, install PostgreSQL and the Spring Boot backend on a dedicated shop-server PC, then configure each cashier desktop app to use that server's LAN address.

```text
Mercantile desktop app -> local Next server -> Spring Boot API -> PostgreSQL
```

The app uses Electron's isolated preload bridge. The web UI has no Node.js access, and only the safe runtime-info method is exposed.

## Local development

Start the existing frontend and backend as usual, then in a second terminal run:

```powershell
npm run desktop:dev
```

Electron loads `http://127.0.0.1:3000` in development. Set `MERCANTILE_DEV_URL` if your frontend is using another address.

## Build the Windows installer

Prerequisites:

- Node.js and npm
- Java 21 and Maven
- The sibling backend repository at `../auradev-erp-backend`
- PostgreSQL configuration available to the packaged Spring Boot backend

Run:

```powershell
npm run desktop:dist
```

This builds the Spring Boot JAR, produces a standalone Next.js server, and generates an NSIS Windows installer in `release/`.

## Shop-server configuration

By default, a packaged app launches its own local backend on port `18080`. To connect a cashier app to a shared shop server instead, create this file after installation:

```text
%APPDATA%\Mercantile\mercantile.config.json
```

```json
{
  "backendUrl": "http://192.168.1.20:8080"
}
```

For a fully self-contained one-PC installation, bundle a supported Java runtime under `desktop/runtime/jre` before building. PostgreSQL is deliberately not bundled into each cashier application: a shared PostgreSQL server keeps stock, bills, returns, and shifts consistent across terminals.

## Local desktop database configuration

On its first local launch, the installed application creates this file:

```text
%APPDATA%\Mercantile\.env
```

It supplies the local database URL, database credentials, and JWT secret to Spring Boot. The included defaults match the development PostgreSQL database on port `5433`; replace them with client-specific PostgreSQL credentials and a unique long JWT secret before delivery. If startup fails, inspect `%APPDATA%\Mercantile\backend.log` for the exact database or Java error.

Code signing should be added before distributing the installer to clients, otherwise Windows may show an unknown-publisher warning.
