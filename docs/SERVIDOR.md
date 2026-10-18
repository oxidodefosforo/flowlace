# Flowlace Server — instalación y administración

Flowlace Server es el servicio que permite que varias personas trabajen sobre los mismos espacios de trabajo "Company".

- **Acceso a la base de datos:** el servicio es el único programa que abre las bases SQLite, que están en un disco local de su máquina. Las aplicaciones Flowlace de cada computadora se conectan a su API por HTTPS y reciben los cambios en vivo.
- **Sin dependencias externas:** no usa servicios externos, cuentas en la nube ni suscripciones. Funciona dentro de la red de la empresa.

## 1. Requisitos

- **Sistema:** Windows Server 2016 o posterior, o Windows 10/11 de 64 bits.
- **Equipo siempre encendido:** el servicio se inicia solo con Windows, sin que nadie inicie sesión.
- **Disco local:** un disco **local** (fijo) para los datos, por ejemplo `D:\FlowlaceData`. El instalador rechaza rutas de red.
- **Red:** un nombre DNS estable en la red, por ejemplo `srv-flowlace.alphazeta.local`, y un puerto TCP libre (8443 por defecto).
- **Certificado HTTPS** para ese nombre (ver la sección 3).
- **Instalación:** cuenta de administrador local para instalar.

> **¿Por qué no basta una carpeta compartida o un NAS?** Una carpeta compartida solo guarda archivos y no ejecuta programas. Para que varias personas editen a la vez sin perder cambios, alguien tiene que:
>
> - recibir cada operación;
> - comprobar la versión del registro y los permisos del usuario;
> - guardar en una transacción;
> - avisar a los demás.
>
> Eso lo hace Flowlace Server. Si varias computadoras abrieran el mismo archivo SQLite por la red, el bloqueo de archivos de SMB podría corromper la base, no se detectarían los conflictos y no habría actualizaciones en vivo. Por eso Flowlace no ofrece ese modo. Un NAS que permita ejecutar una máquina virtual o un contenedor con Windows sí puede alojar el servicio. Una carpeta de red sí sirve como **destino de backups**.

## 2. Contenido del paquete `FlowlaceServer-1.0.0-win-x64.zip`

| Archivo | Para qué sirve |
|---|---|
| `node\node.exe` | Node.js 24.21.0, incluido. No hay que instalar nada. |
| `app\` | Programa del servidor. |
| `FlowlaceServer.exe` + `.xml` | Contenedor de servicio de Windows (WinSW 2.12). |
| `flowlace-server.cmd` | Línea de comandos: `init`, `create-user`, `reset-password`, `list-users`, `list-workspaces`, `create-workspace`, `check`. |
| `install-service.ps1` | Instalación completa. |
| `service-control.ps1` | `status`, `start`, `stop`, `restart`, `update`, `uninstall`. |
| `docs\` | Esta guía y la guía de uso. |

## 3. Certificado HTTPS

Flowlace siempre valida el certificado del servidor con el almacén de certificados de Windows de cada computadora y **no tiene ninguna opción para saltarse esa validación**. El certificado debe:

- estar emitido para el nombre que usarán los clientes, incluido en *Subject Alternative Name*; por ejemplo `srv-flowlace.alphazeta.local` y, si se quiere, `srv-flowlace`;
- tener el uso "Autenticación del servidor";
- ser de confianza en las computadoras cliente.

Hay tres formas de conseguirlo, de la más recomendable a la menos:

**a) CA interna de la empresa (Active Directory Certificate Services)**

1. TI emite un certificado "Servidor web" para el nombre del servidor.
2. Lo exporta **con clave privada** como `.pfx`.
3. Los equipos del dominio ya confían en la CA.

**b) Certificado comercial** para un nombre DNS de la empresa (por ejemplo `flowlace.alphazeta.com.au`) que resuelva internamente a la IP del servidor.

**c) Certificado autofirmado (solo si no hay CA)**

En el servidor, en PowerShell como administrador:

```powershell
$cert = New-SelfSignedCertificate -DnsName 'srv-flowlace.alphazeta.local','srv-flowlace' `
  -CertStoreLocation Cert:\LocalMachine\My -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(3) `
  -KeyUsage DigitalSignature,KeyEncipherment -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.1')
$pw = Read-Host -AsSecureString 'Password for the PFX'
Export-PfxCertificate -Cert $cert -FilePath C:\certs\flowlace.pfx -Password $pw
Export-Certificate   -Cert $cert -FilePath C:\certs\flowlace.cer
```

Después, distribuye `flowlace.cer` a **Entidades de certificación raíz de confianza** en cada cliente:

- por directiva de grupo: *Configuración del equipo → Directivas → Configuración de Windows → Configuración de seguridad → Directivas de clave pública*;
- o manualmente: doble clic → *Instalar certificado* → *Equipo local* → *Entidades de certificación raíz de confianza*.

**Renovación:** sustituye el `.pfx` en `%ProgramData%\Flowlace Server\certs\flowlace.pfx`, con la misma contraseña, o cambia la ruta en la configuración. Después ejecuta `.\service-control.ps1 restart`.

## 4. Instalar el servicio

1. Copia y descomprime el zip en el servidor, por ejemplo en `C:\Instaladores\FlowlaceServer-1.0.0-win-x64`.
2. Abre **PowerShell como administrador** en esa carpeta:
   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\install-service.ps1 -DataDir D:\FlowlaceData -CertificatePfx C:\certs\flowlace.pfx -WorkspaceName "Alphazeta"
   ```

**Parámetros de `install-service.ps1`**

| Parámetro | Descripción |
|---|---|
| `-DataDir` | Obligatorio. Carpeta en un disco local de esta máquina donde se guardan las bases. |
| `-Port` | Puerto TCP (por defecto 8443). |
| `-CertificatePfx` | Certificado `.pfx`. El script pide su contraseña y la guarda en un archivo que solo pueden leer SYSTEM y los administradores. |
| `-CertificateFile` + `-KeyFile` | Alternativa en formato PEM (cadena completa + clave). |
| `-BackupDir` | Carpeta de backups (por defecto `DataDir\backups`). Puede ser una carpeta de red. |
| `-AdminUser` | Nombre del primer administrador (por defecto `admin`). El script pide su contraseña, de al menos 10 caracteres. |
| `-WorkspaceName` | Primer espacio de trabajo. |
| `-InstallDir` | Carpeta de instalación (por defecto `C:\Program Files\Flowlace Server`). |
| `-AllowHttp` | Solo para una **primera prueba** en una red de confianza, sin certificado. No usar en producción. |
| `-NoFirewallRule` | No crea la regla de firewall. |

**Qué hace el script**

1. Copia el programa a `-InstallDir`.
2. Crea la configuración `%ProgramData%\Flowlace Server\flowlace-server.json`, la carpeta de datos, el primer administrador y el primer espacio de trabajo.
3. Limita los permisos de la carpeta de datos a SYSTEM y Administradores.
4. Registra el servicio **Flowlace Server**: inicio automático retrasado, reinicio automático si falla y registros en `%ProgramData%\Flowlace Server\logs`.
5. Crea la regla de firewall y arranca el servicio.

Volver a ejecutar el script en un servidor ya instalado conserva la configuración, los usuarios y los datos.

**Inicio sin sesión abierta:** el servicio se ejecuta como `LocalSystem` y arranca con Windows. Para usar una cuenta de servicio de dominio, cámbiala en *services.msc → Flowlace Server → Iniciar sesión*. Esa cuenta necesita control total sobre `DataDir`, la carpeta de backups y `%ProgramData%\Flowlace Server`.

## 5. Firewall y red

El script crea la regla **"Flowlace Server"**: entrada, TCP 8443, perfiles Dominio y Privado. Para restringirla a la subred de la oficina:

```powershell
Set-NetFirewallRule -DisplayName 'Flowlace Server' -RemoteAddress 10.0.0.0/24
```

Si la regla se crea a mano:

```powershell
New-NetFirewallRule -DisplayName 'Flowlace Server' -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow -Profile Domain,Private
```

**Otras consideraciones de red**

- **Sin exposición a internet:** no hay que abrir el puerto en el router o firewall perimetral. Para trabajar desde fuera, se usa la VPN de la empresa.
- **Proxy:** si hay un proxy HTTPS de inspección entre clientes y servidor, excluye el nombre del servidor. Las actualizaciones en vivo usan una conexión HTTP de larga duración (Server-Sent Events).
- **Comprobar desde un cliente:** abrir `https://srv-flowlace.alphazeta.local:8443/api/health` en un navegador debe mostrar `{"ok":true,"service":"Flowlace Server",…}` sin advertencias de certificado.

## 6. Usuarios, permisos y espacios de trabajo

| Rol | Puede |
|---|---|
| **member** | Ver y editar proyectos, entregables, tareas, fases de proyecto, horas, capacidad y personas. Gestionar sus preferencias. |
| **admin** | Todo lo anterior, más la configuración de empresa (fases, disciplinas, equipos, valores por defecto, estándar de Workflow, datos y apariencia), usuarios, backups, restauración, renombrar espacios y cargar datos de ejemplo. |

El servidor comprueba los permisos en **cada** operación. Cada cambio queda registrado con usuario, fecha y hora; se consulta en **Settings → Workspace & Storage → Recent changes**.

**Gestión de usuarios**

Desde Flowlace, como administrador, en **Workspace & Storage → Users of this server**: crear, cambiar el rol, desactivar o fijar contraseña.

O en el servidor, desde la carpeta de instalación:

```bat
flowlace-server.cmd create-user --username laura --name "Laura Chen" --role member
flowlace-server.cmd reset-password --username laura
flowlace-server.cmd list-users
```

**Seguridad de las cuentas**

- Las contraseñas se guardan cifradas con **scrypt**.
- Las sesiones caducan a las 12 h (`sessionHours`).
- Tras 5 intentos fallidos desde una misma IP, el inicio de sesión se bloquea temporalmente.
- Desactivar un usuario o cambiar su contraseña cierra sus sesiones.

**Varios espacios de trabajo:** `flowlace-server.cmd create-workspace --name "Proyectos 2027"`. Cada usuario elige al conectarse a qué espacio de trabajo entra.

## 7. Backups y restauración en el servidor

- **Automáticos:** se configuran en Flowlace, como administrador, en **Workspace & Storage → Backups**. Las opciones son frecuencia y cantidad a conservar; por defecto, cada día y se conservan 14. Los hace el servicio aunque nadie tenga Flowlace abierto.
- **Mecanismo:** cada backup es una copia consistente hecha con `VACUUM INTO` y verificada antes de guardarse. Nunca se copia el archivo activo.
- **Ubicación:** por defecto `DataDir\backups\<id del espacio>`. Para otra carpeta, incluida una de red (`\\nas\backups\flowlace`), indica `"backupDir"` en la configuración y reinicia.
  - Si el servicio se ejecuta como `LocalSystem`, en la red actúa como la cuenta del equipo (`DOMINIO\SRV-FLOWLACE$`). Dale permiso de escritura en el recurso compartido y en NTFS, o usa una cuenta de servicio de dominio.
- **Restaurar:**
  - Solo un administrador puede hacerlo, desde **Backups → Restore…**.
  - El servidor valida el backup, guarda una copia previa de los datos actuales y bloquea las escrituras mientras restaura.
  - Al terminar, todos los clientes recargan los datos.
- **Copia externa:** conviene copiar periódicamente la carpeta de backups a otro medio, como parte del backup general del servidor. No hace falta detener el servicio para copiar la carpeta de **backups**. Para copiar la carpeta **de datos** con una herramienta de backup de archivos, detén antes el servicio, o mejor copia solo los backups.

## 8. Operación, actualización y desinstalación

En PowerShell como administrador, en `C:\Program Files\Flowlace Server`:

```powershell
.\service-control.ps1 status      # estado, configuración y últimas líneas del registro
.\service-control.ps1 stop        # los clientes muestran "Disconnected" y conservan sus cambios pendientes
.\service-control.ps1 start
.\service-control.ps1 restart
.\service-control.ps1 update -From C:\Instaladores\FlowlaceServer-1.1.0-win-x64
.\service-control.ps1 uninstall   # quita el servicio y la regla de firewall; NO borra datos ni configuración
```

**Actualización (`update`)**

- Reemplaza solo `app\`, `node\` y los scripts.
- Al abrir una base con un esquema anterior, el servidor la migra automáticamente, después de guardar una copia en su carpeta de backups.
- Una versión antigua del servidor se niega a abrir bases de una versión más nueva.

**Registros:** `%ProgramData%\Flowlace Server\logs\FlowlaceServer.out.log`, con rotación automática.

## 9. Lista de comprobación de aceptación en Windows

Las pruebas automáticas de esta entrega se ejecutaron en Linux (ver `GUIA.md`). Antes de usarlo en producción, comprueba en los equipos reales:

1. `install-service.ps1` termina sin errores y `service-control.ps1 status` muestra **Running**.
2. Reinicia el servidor sin iniciar sesión. Desde un cliente, `https://<servidor>:8443/api/health` responde sin advertencia de certificado.
3. **PC 1:** instala `FlowlaceSetup.exe`, conéctate como `admin` e importa el JSON de la versión HTML. El resumen debe ser correcto.
4. **PC 2:** instala Flowlace e inicia sesión con un usuario *member*. Los datos deben ser los mismos.
5. Edita una tarea en la PC 1 y comprueba que el cambio aparece en la PC 2 sin cerrar el panel abierto.
6. Edita la **misma** tarea en ambas PCs. La segunda debe ver la revisión del conflicto.
7. Detén el servicio. Las PCs deben mostrar *Disconnected*; haz un cambio en una de ellas. Inicia el servicio: el cambio pendiente se envía.
8. Haz **Back up now** y luego **Restore…**. Ambas PCs deben recargar los datos restaurados, y la copia previa debe aparecer en la lista de backups.
9. Actualiza el cliente con un instalador nuevo (o reinstala el mismo) y comprueba que los datos y las preferencias siguen ahí.

## 10. Referencia

**`%ProgramData%\Flowlace Server\flowlace-server.json`**

```json
{
  "dataDir": "D:\\FlowlaceData",
  "host": "0.0.0.0",
  "port": 8443,
  "tls": { "pfxFile": "C:\\ProgramData\\Flowlace Server\\certs\\flowlace.pfx",
           "passphraseFile": "C:\\ProgramData\\Flowlace Server\\certs\\pfx-pass.txt" },
  "serverName": "Flowlace Server",
  "sessionHours": 12,
  "backupDir": null,
  "allowHttp": false
}
```

En lugar de un `.pfx`, `tls` también acepta `{ "certFile": "...", "keyFile": "..." }` en PEM. Tras cambiar la configuración, ejecuta `.\service-control.ps1 restart`.

**Estructura de `DataDir`**

```
DataDir\
  server.db                     usuarios, sesiones, lista de espacios, registro administrativo
  workspaces\<id>\flowlace.db  datos de cada espacio de trabajo (solo los abre el servicio)
  backups\<id>\*.db             backups (si no se configuró otra carpeta)
```

**API (JSON sobre HTTPS)**

| Método y ruta | Uso |
|---|---|
| `GET /api/health` | Comprobación del servicio. |
| `POST /api/login` | Inicio de sesión. |
| `GET /api/w/<id>/snapshot` | Todos los registros del espacio de trabajo. |
| `GET /api/w/<id>/changes?since=N` | Cambios desde N. |
| `POST /api/w/<id>/commit` | Lote de operaciones en una transacción. Cada lote lleva un `opId` para evitar duplicados en reintentos, y cada operación la versión de partida (`base`). Si hay conflicto, el servidor responde 409 con la versión actual. |
| `GET /api/w/<id>/events` | Actualizaciones en vivo (Server-Sent Events). |
| `GET /api/w/<id>/activity` | Auditoría. |
| `/api/w/<id>/backups`, `…/restore` | Backups y restauración (solo administradores). |
| `/api/users` | Gestión de usuarios (solo administradores). |
