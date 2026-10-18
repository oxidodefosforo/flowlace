<p align="center"><img src="assets/flowlace-logo.png" alt="Flowlace" width="420"></p>

# Flowlace

Flowlace es un planificador de proyectos, entregables, tareas y recursos, ahora como aplicación de escritorio para Windows 10/11 (x64). Tiene dos componentes:

| Componente | Entregable | Para quién |
|---|---|---|
| **Flowlace** (cliente Electron) | `FlowlaceSetup.exe` (instalador), `Flowlace-win32-x64-<v>.zip` (portátil) | cada usuario |
| **Flowlace Server** (servicio de Windows) | `FlowlaceServer-<v>-win-x64.zip` | la máquina servidor de la empresa |

**Modos de almacenamiento**

- **Local workspace:** SQLite en una carpeta elegida por el usuario. No necesita servidor ni internet.
- **Company workspace:** varios usuarios sobre la misma base. Solo Flowlace Server abre la base; los clientes usan su API HTTPS y reciben los cambios en vivo, con versiones por registro, detección de conflictos, roles administrador/miembro y auditoría.

**Guías**

- [`docs/GUIA.md`](docs/GUIA.md): instalar, trabajar localmente, conectar computadoras, migrar desde el HTML, backups, actualizar y qué se verificó.
- [`docs/SERVIDOR.md`](docs/SERVIDOR.md): instalar Flowlace Server, HTTPS y certificados, firewall, usuarios, backups, operación.
- [`docs/DESARROLLO.md`](docs/DESARROLLO.md): estructura del código, compilación en Windows/Linux, pruebas y seguridad.

**Comandos rápidos:** `npm ci` · `npm start` · `npm test` · `npm run test:ui` · `npm run make:win` · `npm run server:dist`
