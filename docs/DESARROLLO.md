# Flowlace — desarrollo y compilación

## Estructura del proyecto

```
flowlace/
  package.json, package-lock.json   dependencias fijadas (versiones exactas)
  forge.config.js                   Electron Forge: Squirrel (instalador) + zip, iconos, fusibles de seguridad
  assets/icon.ico, icon.png         icono de la aplicación
  shared/                           LÓGICA DE NEGOCIO Y PERSISTENCIA (la misma en cliente y servidor)
    schema.js                       colecciones, registros personales, datos solo-administrador, validación de operaciones
    store.js                        base SQLite: registros versionados, lotes transaccionales, idempotencia, feed de cambios,
                                    auditoría, migraciones de esquema, backup (VACUUM INTO), inspección y restauración
    backups.js                      nombres, retención y programación de backups
    workspace-folder.js             carpeta de espacio de trabajo (manifiesto, base, bloqueo de acceso exclusivo)
    sqlite.js, canonical.js         acceso a node:sqlite; JSON canónico para comparar registros
  src/main/                         FUNCIONES DEL SISTEMA OPERATIVO (proceso principal de Electron)
    main.js                         ventana segura, instancia única, eventos del instalador Squirrel
    workspace-manager.js            elegir / abrir / cambiar / trasladar espacios de trabajo; nunca crea una base vacía al abrir
    local-backend.js                espacio Local (SQLite en la carpeta elegida)
    remote-backend.js               espacio Company (HTTPS + Server-Sent Events con net.fetch y el almacén de certificados de Windows)
    ipc.js                          canales permitidos, cada uno con validación de argumentos y de origen
    os-integration.js               diálogos de carpeta y archivo, Explorer, enlaces externos, cambios pendientes
    settings.js                     preferencias del equipo (%AppData%\Flowlace), tokens cifrados con DPAPI
  src/preload/preload.js            API limitada window.flowlace (sin Node.js ni sistema de archivos en la interfaz)
  src/renderer/                     INTERFAZ
    app/01…33-*.js                  módulos de la interfaz original (Overview, Projects, Tasks, Resources, calendario, Workflow…)
    desktop/d01-sync.js             persistencia por registro: diferencias → operaciones, estados Saving/Saved/Disconnected/Save failed,
                                    actualizaciones remotas sin cerrar paneles ni formularios, cambios pendientes
    desktop/d02-review.js           revisión de conflictos (tu versión / versión actual)
    desktop/d03-start.js            pantalla inicial: Local / Company, crear, abrir, conectar
    desktop/d04-workspace-settings.js  Settings → Workspace & Storage, backups, importación JSON, usuarios
    styles/*.css, fonts/            estilos y tipografías incluidas (sin CDN)
  server/                           FLOWLACE SERVER (componente separado)
    src/index.js                    línea de comandos (init, serve, usuarios, espacios, check)
    src/http.js, hub.js             API HTTPS, permisos, SSE, backups, restauración exclusiva
    src/accounts.js, config.js      usuarios (scrypt), sesiones, registro administrativo; configuración
    windows/                        servicio WinSW, install-service.ps1, service-control.ps1, LEEME
  scripts/build-renderer.js         construye la interfaz en src/renderer/dist (CSP estricta, sin scripts en línea)
  scripts/build-server-dist.js      empaqueta Flowlace Server para Windows
  scripts/extract-legacy.py         separó el HTML original en módulos (repetible con un HTML nuevo)
  test/                             pruebas (ver más abajo)
  docs/                             GUIA.md, SERVIDOR.md, este archivo
```

**Cómo se guarda**

- La interfaz sigue trabajando sobre su estado en memoria, como en la versión HTML.
- En cada guardado, `d01-sync.js` compara ese estado con la última versión confirmada por la base y envía **solo los registros que cambiaron**, cada uno con la versión de la que partió (`base`), en un lote con identificador único (`opId`).
- La base aplica el lote en una transacción. Si un registro cambió entretanto, rechaza el lote y devuelve la versión actual para revisarla; si el `opId` ya existe, devuelve el resultado anterior sin aplicarlo dos veces.
- En modo Company, el servidor hace lo mismo, comprueba además el rol del usuario y difunde el cambio a los demás clientes.

## Compilar en Windows (procedimiento exacto)

Requisitos: Windows 10/11 x64, [Node.js 22.13+ o 24 LTS](https://nodejs.org/) y Git.

```powershell
git clone <repositorio> flowlace   # o descomprime flowlace-source.zip
cd flowlace
npm ci                               # instala exactamente las versiones de package-lock.json (incluye Electron 43.7.7)
npm test                             # pruebas de base de datos y servidor
npm start                            # abre Flowlace en modo desarrollo
npm run make:win                     # → out\make\squirrel.windows\x64\FlowlaceSetup.exe
                                     #   out\make\zip\win32\x64\Flowlace-win32-x64-1.0.0.zip
npm run server:dist                  # → out\server\FlowlaceServer-1.0.0-win-x64.zip
```

`npm run server:dist` descarga `node-win-x64@24.21.0` (npm) y WinSW 2.12.0 (GitHub) y verifica sus SHA-256. Para usar el `node.exe` oficial de nodejs.org: `set FLOWLACE_NODE_EXE=C:\ruta\node.exe` antes del comando.

**Firma de código (recomendada):**

1. Con un certificado de firma de código de la empresa, añade al maker de Squirrel en `forge.config.js`: `certificateFile: 'C:\\certs\\codesign.pfx', certificatePassword: process.env.CODESIGN_PASSWORD`. También puedes usar `windowsSign` con signtool.
2. Firma también `FlowlaceServer.exe` y `node\node.exe` si la política de la empresa lo exige.

**Versión nueva:** cambia `version` en `package.json` (cliente) y en `server/package.json` (servidor). Si cambia la estructura de la base, añade un paso al final de `MIGRATIONS` en `shared/store.js` y sube `SCHEMA_VERSION`. Nunca modifiques un paso ya publicado.

## Compilar en Linux (como se generó esta entrega)

Requiere Wine (32 y 64 bits) y Mono para el instalador Squirrel:

```bash
sudo dpkg --add-architecture i386 && sudo apt-get update
sudo apt-get install -y wine64 wine32:i386 mono-complete zip xvfb
npm ci
xvfb-run -a npm run make:win
npm run server:dist
```

## Pruebas

```bash
npm test                         # node:test — shared/store (10) y servidor por HTTP(S) (11)
xvfb-run -a npm run test:ui      # Electron real con Playwright: local (13), funciones (10), company con 2 clientes (12)
```

En Windows, `npm run test:ui` funciona sin `xvfb-run`.

Los escenarios de interfaz usan perfiles y carpetas temporales. El perfil se indica con la variable `FLOWLACE_USER_DATA`, que solo se acepta en la app sin empaquetar. Las respuestas de los diálogos de Windows (elegir carpeta o archivo) las da la prueba desde el proceso principal.

## Seguridad de Electron

- **Aislamiento del renderer:** `contextIsolation`, `sandbox`, sin `nodeIntegration`, sin `webview`. La única puerta es la API de preload, con canales concretos.
- **Página cargada por un protocolo propio** con Content-Security-Policy estricta: sin scripts en línea, sin conexiones externas. La navegación y las ventanas nuevas se bloquean, y los enlaces se abren en el navegador del sistema.
- **Archivos solo vía diálogo:** las rutas solo se eligen en diálogos de Windows. La interfaz recibe referencias, no acceso libre al disco.
- **Fusibles de Electron:** `RunAsNode` desactivado, `NODE_OPTIONS` ignorado, sin `--inspect`, validación de integridad del `asar` y carga solo desde el `asar`.
- **Certificados HTTPS:** se validan siempre con el almacén de Windows y no existe ninguna opción para ignorarlos.
