# Flowlace para Windows — guía de uso

Flowlace es ahora una aplicación de escritorio para Windows 10/11 de 64 bits. Conserva la misma interfaz y las mismas funciones que la versión HTML: Overview, Projects, Tasks, Resources, calendarios, Workflow y Settings. La diferencia es que los datos ya no se guardan en el navegador, sino en una base de datos SQLite que tú eliges.

Hay dos formas de trabajar:

| | **Local workspace** | **Company workspace** |
|---|---|---|
| Para | trabajar solo, sin servidor ni internet | que varias personas trabajen sobre los mismos datos |
| Dónde están los datos | en una carpeta de tu computadora | en Flowlace Server, en un disco local de la máquina servidor |
| Quién abre la base de datos | solo tu Flowlace | solo el servicio Flowlace Server; los clientes usan su API |
| Usuarios | tu usuario de Windows | usuarios del servidor (administrador / miembro) |

---

## 1. Instalar Flowlace en una computadora

1. Ejecuta **`FlowlaceSetup.exe`**. No hace falta tener permisos de administrador, Node.js ni un navegador.
2. El instalador copia Flowlace en `%LocalAppData%\Flowlace`, crea los accesos directos en el menú Inicio y en el escritorio, y abre la aplicación.
3. Windows SmartScreen puede advertir que el instalador no está firmado. En ese caso elige *Más información → Ejecutar de todas formas*. Para evitar el aviso, el instalador se puede firmar con un certificado de firma de código de la empresa (ver `DESARROLLO.md`).

Como alternativa sin instalador, existe `Flowlace-win32-x64-1.0.0.zip` (copia portátil): se descomprime y se abre `Flowlace.exe`.

**Qué se guarda dónde**

- **Programa:** `%LocalAppData%\Flowlace\app-<versión>`. Se reemplaza en cada actualización.
- **Preferencias del equipo:** `%AppData%\Flowlace\flowlace-settings.json`. Guarda qué espacio de trabajo abrir y los recientes; las sesiones de servidor se guardan aparte, cifradas con tu cuenta de Windows.
- **Datos:** en la carpeta del espacio de trabajo que elijas, o en el servidor. Nunca en la carpeta de instalación.

Desinstalar o reinstalar Flowlace **no borra** ni los espacios de trabajo ni las preferencias.

## 2. Elegir una carpeta y trabajar localmente

Al abrir Flowlace por primera vez aparece **Choose where your data lives**.

**Crear un espacio de trabajo nuevo**

1. **Local workspace → Create a workspace…**
2. Escribe un nombre y pulsa **Choose folder…**. Elige una carpeta vacía, por ejemplo `Documentos\Flowlace\Alphazeta`.
3. Pulsa **Create**. Flowlace crea en esa carpeta:
   - `flowlace-workspace.json`: identifica el espacio de trabajo (id y nombre) y no contiene datos de proyectos;
   - `flowlace.db`: la base de datos SQLite;
   - `backups\`: la carpeta de backups por defecto.
4. El espacio de trabajo empieza **vacío**. Los datos de ejemplo solo se cargan si pulsas **Load example data** (ver la sección 8).

**Abrir uno existente:** **Open an existing one…** y elige la carpeta que contiene `flowlace-workspace.json`.

- Si la carpeta no es un espacio de trabajo, Flowlace lo indica y **no crea nada**.
- Una unidad de red o NAS se rechaza para la base activa. SQLite no es fiable sobre carpetas compartidas, y para trabajo compartido se usa Company.

Flowlace recuerda el espacio de trabajo al cerrar. Si la próxima vez la carpeta no está disponible (un disco externo desconectado, una carpeta movida o renombrada), aparece **The workspace can't be opened** con el motivo y las opciones **Try again**, **Open another folder…** o **Choose another workspace**. En ese caso **no se crea una base vacía** en su lugar.

**Settings → Workspace & Storage** muestra:

- el nombre e identificador del espacio de trabajo;
- el modo (Local o Company);
- la carpeta de datos o la dirección del servidor;
- el estado de conexión y de guardado;
- la fecha del último backup.

Desde ahí hay acciones con un efecto distinto cada una:

| Acción | Qué hace con los datos |
|---|---|
| **Create or open another workspace…** | Cambia de espacio de trabajo. **No copia ni mueve nada.** |
| **Move this workspace to another folder…** | **Traslada** los datos: hace una copia consistente en la carpeta nueva, la verifica y la usa. La carpeta antigua no se borra, solo se marca como movida para no abrirla por error. |
| **Import a JSON export…** | Añade datos de un archivo, con un resumen previo y sin duplicar (sección 5). |
| **Test connection** | Comprueba la carpeta o el servidor. |

## 3. Instalar Flowlace Server y elegir dónde almacena los datos

Esto se hace una sola vez, en la máquina que actuará como servidor. La guía completa, que cubre HTTPS, certificados, firewall, cuentas y actualización, está en **`SERVIDOR.md`**. En resumen:

1. Copia `FlowlaceServer-1.0.0-win-x64.zip` al servidor y descomprímelo.
2. Abre PowerShell **como administrador** en esa carpeta y ejecuta:
   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\install-service.ps1 -DataDir D:\FlowlaceData -CertificatePfx C:\certs\flowlace.pfx -WorkspaceName "Alphazeta"
   ```
   `-DataDir` es **la carpeta de datos, en un disco local de esa máquina**; el script rechaza rutas de red. El script te pide la contraseña del administrador `admin`.
3. El servicio **Flowlace Server** queda instalado, arranca con Windows **sin que nadie inicie sesión** y abre el puerto TCP 8443 en el firewall (perfiles Dominio y Privado).

> **Una carpeta compartida o un NAS que solo almacena archivos no sirve como servidor.** Flowlace Server es un programa que debe *ejecutarse*. Recibe las operaciones de todos, comprueba versiones y permisos, guarda en transacciones y avisa a los demás de los cambios. Abrir un mismo archivo SQLite desde varias computadoras a través de una carpeta compartida puede corromperlo y no permite detectar conflictos. Por eso Flowlace no ofrece esa opción como modo multiusuario. Un NAS que permite ejecutar programas o máquinas virtuales con Windows sí podría ejecutar el servicio; una carpeta de red se puede usar para **guardar backups**.

## 4. Conectar dos computadoras al mismo espacio de trabajo

**Administrador:**

1. Crea los usuarios en Flowlace → **Settings → Workspace & Storage → Users of this server**, o en el servidor con:
   ```
   flowlace-server.cmd create-user --username laura --name "Laura Chen" --role member
   ```
2. Entrega a cada persona su usuario, una contraseña inicial y la dirección del servidor, por ejemplo `https://SRV-FLOWLACE:8443`.

**En cada computadora:**

1. **Company workspace → Connect to Flowlace Server…**
2. Escribe la dirección y pulsa **Test connection**.
   - Si el certificado HTTPS no es de confianza en esa computadora, Flowlace lo indica y **no se conecta**. No se puede saltar esta comprobación; el área de TI debe instalar el certificado de la empresa (ver `SERVIDOR.md`).
3. Inicia sesión y elige el espacio de trabajo en **Workspaces on this server → Connect**.

**Qué ocurre después:**

- **Cambios en vivo:** los cambios confirmados llegan a los demás al instante (por Server-Sent Events). Un panel abierto, los filtros y un formulario que alguien esté escribiendo no se cierran ni se reinician. Si estás editando un campo, la actualización se aplica cuando terminas.
- **Preferencias personales:** cada persona conserva sus preferencias (tema, filtros, anchos de columnas, vistas guardadas y favoritos). Se guardan para ese usuario y no cambian la vista de los demás.
- **Permisos:**
  - Los **miembros** editan proyectos, entregables, tareas, horas y personas.
  - Los **administradores** además cambian la configuración de empresa (fases, disciplinas, equipos, valores por defecto, estándar de Workflow, datos y apariencia de la empresa), gestionan usuarios y backups, y restauran.
  - El servidor comprueba los permisos en cada operación, no solo la interfaz.
- **Auditoría:** el servidor registra quién cambió qué y cuándo (**Recent changes**).

**Estados de guardado** (indicador junto al nombre del espacio de trabajo)

| Estado | Significado |
|---|---|
| **Saving…** | Hay cambios enviándose. |
| **Saved** | La base de datos (local o del servidor) **confirmó** el cambio. |
| **Disconnected** | Sin conexión con el servidor. |
| **Save failed** | El cambio fue rechazado o no se pudo guardar. El mensaje explica por qué y el cambio se conserva. |

**Si dos personas editan la misma tarea**

- Cada registro tiene su versión. Si guardas un cambio hecho sobre una versión que otra persona ya modificó, el servidor **rechaza** la escritura.
- Flowlace te muestra, campo por campo, **tu versión y la versión actual** (quién la cambió y cuándo). Puedes:
  - **mantener la tuya**, que se guarda encima de la versión actual ya revisada;
  - **usar la actual**, descartando tu cambio.
- Nunca gana silenciosamente "el último que guarda".
- Los cambios en registros distintos (dos tareas diferentes, por ejemplo) no generan conflicto.

**Si se pierde la conexión**

- Los datos siguen visibles, con el aviso de que pueden estar desactualizados.
- Tus cambios no confirmados quedan como **pendientes** en esta computadora y sobreviven aunque cierres Flowlace. **No se escribe nada** hasta reconectar.
- Al volver la conexión, Flowlace recibe lo que cambió mientras tanto y después envía tus pendientes comprobando versiones: si alguien tocó lo mismo, aparece la revisión de conflicto.
- El espacio compartido **nunca se convierte en una copia local independiente**.

## 5. Migrar los datos de la versión HTML

Los datos de la versión HTML están en el almacenamiento interno (localStorage) del navegador donde la usabas, y Flowlace para Windows no puede leerlos directamente. La migración se hace con su exportación JSON:

1. **En la versión HTML**, en el mismo navegador de siempre: **Settings → Data & backup → Export backup**. Se descarga un archivo `.json`. Ese archivo es tu copia: la importación nunca lo modifica ni lo borra.
2. **En Flowlace para Windows**, con el espacio de trabajo abierto (Local, o Company como administrador): **Settings → Workspace & Storage → Data from the HTML version → Import a JSON export…**, o **Import from the HTML version…** en la bienvenida de un espacio nuevo.
3. Flowlace **valida** el archivo y muestra un **resumen por tipo**: proyectos, fases, especialidades, entregables, tareas, personas, horas, equipos, workflow, etc. Para cada tipo indica cuántos registros son nuevos, cuántos ya existen iguales y cuántos ya existen con contenido distinto. Para estos últimos eliges conservar los del espacio de trabajo (la opción por defecto) o reemplazarlos.
4. Al confirmar, todo se importa **en una sola transacción**: si algo falla, no se importa nada. Se conservan los **identificadores** originales, así que se mantienen todas las relaciones (tareas ↔ entregables ↔ fases, dependencias, requisitos y procedencia del workflow).
5. Importar el mismo archivo otra vez **no duplica nada**: el resumen indica que no hay nada nuevo.

Las vistas guardadas y los favoritos del archivo pasan a ser preferencias personales de quien importa.

## 6. Crear y restaurar backups

En **Settings → Workspace & Storage → Backups** (en Company, solo los administradores):

- **Back up now** crea un backup manual: una copia **consistente** de toda la base, hecha con el mecanismo de SQLite (`VACUUM INTO`) mientras la base está en uso. Nunca se copia el archivo activo directamente, y cada copia se verifica.
- **Automatic backup** puede estar desactivado o hacerse cada 6 h, cada 12 h, cada día o cada semana. **Keep the last N backups** define la retención: se conservan los N backups más recientes, manuales y automáticos. Las copias previas a una restauración nunca se borran automáticamente.
  - En Local, los backups automáticos se hacen mientras Flowlace está abierto.
  - En Company los hace el servidor, aunque nadie tenga Flowlace abierto.
- **Change backup folder…** guarda los backups en otra ubicación, por ejemplo otro disco o una carpeta de red (`\\nas\backups\flowlace`). La pantalla distingue claramente la **carpeta de backups** de la **base activa**. En Company, la carpeta de backups se configura en el servidor (ver `SERVIDOR.md`).

**Restaurar** (**Restore…** junto a un backup, o **Restore from a file…** en Local):

1. Flowlace **valida** el backup: integridad de SQLite, que sea un espacio de trabajo de Flowlace, que sea el mismo espacio de trabajo y que no sea de una versión más nueva. Después muestra su fecha y su contenido.
2. Antes de reemplazar, crea automáticamente una **copia previa** de los datos actuales (`…-before-restore-….db`) en la carpeta de backups.
3. La restauración se hace con **acceso exclusivo**:
   - En Local, nada más usa la base mientras tanto.
   - En Company, el servidor pone el espacio en mantenimiento, rechaza escrituras y, al terminar, **todos los clientes recargan** los datos restaurados.
   - En Company solo un **administrador** puede restaurar, y el servidor lo comprueba.

## 7. Actualizar la aplicación conservando la información

- **Flowlace (cliente):** ejecuta el `FlowlaceSetup.exe` de la versión nueva. Squirrel reemplaza el programa en `%LocalAppData%\Flowlace`. Los espacios de trabajo, backups y preferencias **no se tocan**, porque están en carpetas que el instalador no gestiona.
- **Flowlace Server:** descomprime la versión nueva y ejecuta `.\service-control.ps1 update -From <carpeta nueva>`. El script detiene el servicio, reemplaza solo los archivos del programa y lo vuelve a iniciar. La configuración y la carpeta de datos se conservan.
- **Esquema de datos:**
  - Cada base guarda su versión de esquema. Al abrirla con una versión más nueva de Flowlace, las migraciones se aplican automáticamente y antes se guarda una copia en `backups`.
  - Una versión antigua de Flowlace **no abre** una base de una versión más nueva, para no dañarla, e indica que hay que actualizar.
- **Antes de una actualización grande**, conviene hacer **Back up now**.

## 8. Datos de ejemplo

- **Solo con una acción explícita:** los datos de ejemplo se cargan solo con **Load example data**, en la bienvenida o en **Settings → Workspace & Storage → Example data**. Nunca aparecen solos al iniciar.
- **Marcados y separados:** quedan marcados como **Example** y se quitan con **Remove example data**. Si el espacio ya tiene proyectos reales, Flowlace pide confirmación y recomienda usar un espacio de trabajo aparte para probar.
- **En Company:** solo un administrador puede cargarlos.

## 9. Workflow: ordenar el diagrama y asignar por roles

**Zonas.** Cada fase se organiza de izquierda a derecha en tres zonas invisibles: **Inputs → Actions → Outputs**. Una línea punteada con el título "Outputs — [fase]" marca el inicio de los Outputs. Es solo una referencia visual: no intercepta clics y las flechas pueden atravesarla.

- **Actividades nuevas:** se colocan al inicio de su zona, a la izquierda de la primera de su categoría y en el carril de su especialidad. Si no hay sitio, los bloques de la derecha se desplazan.
- **Outputs sin dependencias:** aparecen siempre en la zona de Outputs.
- **Referencias de otras fases:** se muestran en la banda "Other phases", dentro de la zona de Inputs. Si alimentan un Input, quedan en una subcolumna a su izquierda. Moverlas solo cambia su lugar en esa fase.
- **Relaciones en sentido contrario:** se conservan y se marcan para revisión. Por ejemplo, una Action que depende de un Output.
- **Auto layout** aplica las mismas reglas.

**Mover bloques.** Arrastra cualquier bloque; un clic sin arrastrar sigue seleccionándolo o abriéndolo.

- **Vertical:** el carril crece mientras arrastras y empuja hacia abajo los carriles inferiores, incluida "Other phases", con sus bloques y flechas. El bloque nunca cambia de especialidad.
- **Horizontal:** se mueven con él las actividades que le siguen a su derecha. Si una Action necesita más espacio, la zona de Actions se amplía, el separador de Outputs se desplaza y los Outputs se apartan lo necesario. El movimiento se detiene en la posición válida más cercana: ninguna actividad queda antes que lo que necesita, y nada entra en una zona anterior.
- **Guías:** al acercar un bloque a otro aparecen guías rojas de alineación (bordes y centros) con un ajuste suave. Si sigues moviendo, el ajuste se suelta. En X sirven los bloques de cualquier carril; en Y, solo los del mismo carril.
- **Varios bloques:** con **Edit layout**, Mayús o Ctrl + clic selecciona varios. El primero es la referencia fija. Están disponibles **Align columns**, **Align rows** y **Distribute**. Lo que no puede moverse por una dependencia, una zona o una superposición se queda donde estaba y se explica por qué.
- **Teclado:** Alt + flechas mueve el bloque enfocado. **Esc** cancela un arrastre y lo devuelve a su sitio.

**Ajustar flechas (Edit layout + clic en una flecha)**

- **Segmentos y quiebres:** arrastra cualquier tramo. Doble clic en la línea añade un quiebre; doble clic en un control lo quita.
- **Puntos de origen y destino:** arrastra los círculos de los extremos a cualquiera de los cuatro bordes de su bloque (arriba, abajo, izquierda, derecha) y a lo largo de ese borde. El borde se resalta y el recorrido se recalcula. Si sueltas lejos del bloque, la flecha vuelve a donde estaba. La dependencia nunca cambia.
- **Reset route** devuelve solo esa flecha a su recorrido y anclajes automáticos.
- **Rounded** suaviza las esquinas, solo visualmente.
- **Al mover bloques,** los anclajes y recorridos manuales los acompañan.

**Agregar dependencias desde el diagrama** (Company workflow)

- **Connect:** haz clic en A (lo que se necesita) y luego en B (lo que lo necesita). **A → B significa que B depende de A.** Se confirma antes de guardar.
- **Arrastrando:** con Edit layout, arrastra desde el punto de conexión en el borde derecho de un bloque hasta otro bloque.
- **Add prerequisite…:** aparece al seleccionar una actividad y abre el selector con filtros, incluidas otras fases.
- **Validaciones:** los duplicados, las autorreferencias y los ciclos se rechazan con la explicación.
- **Desde un proyecto:** "Edit in Company workflow" abre esa actividad en el estándar.

**Tarjetas de la matriz.** Muestran solo el nombre y la descripción. "Show details" abre la configuración de cada tarjeta por separado: especialidad, categoría, roles, dependencias y retiro. "Depends on" incluye:

- búsqueda por nombre y descripción;
- filtros Type, Service y Phase (por defecto la fase actual), combinados con Y entre filtros y con O dentro de un mismo filtro;
- el número de resultados;
- las dependencias elegidas, que se muestran aparte aunque los filtros las oculten. Los filtros nunca las quitan.

**Barra:** Edit layout · Undo / Redo · Auto layout · Reset layout · Connect · Rounded. Cada arrastre, alineación o ajuste de flecha es **una sola operación** para Undo / Redo: bloques, carriles, zonas, recorridos y anclajes a la vez. **Reset layout** vuelve, en el estándar, a la distribución publicada; en un proyecto, a la del estándar.

**Dónde se guarda la distribución**

- **Por fase, separada de la estructura:** se guarda aparte de las actividades y dependencias. Incluye posiciones relativas al carril, altura de carriles, inicio de zonas, recorridos y anclajes (borde + posición relativa).
- **En el estándar:** forma parte del borrador y se publica con **Save and publish**.
- **En cada proyecto:** el proyecto parte de la distribución del estándar y guarda sus ajustes propios, que nunca cambian el estándar.
- **Se mantiene** al cambiar de fase, filtrar, navegar entre proyectos, reiniciar y exportar o importar.

**Roles (Settings → People)**

- **Catálogo editable:** Project Manager, Engineer, Senior Engineer, BIM Coordinator, BIM Modeler, Drafter y Reviewer / QA, más los que crees.
- **Por persona:** cada persona puede tener varios roles. La especialidad sigue siendo un campo aparte (por ejemplo Electrical + Engineer).
- **Desactivar un rol** conserva sus referencias, pero ya no se puede elegir para asignaciones nuevas.
- **No son permisos:** los roles sirven para asignar trabajo, no para dar acceso.

**Responsables por rol**

1. **En el estándar:** cada actividad tiene **Responsible role(s)**.
2. **En el proyecto:** **Responsibles by role** permite fijar, por especialidad y rol, quién lo cubre en ese proyecto.
3. **Import activities** propone un responsable para cada actividad nueva:
   - usa primero ese mapeo del proyecto;
   - si no hay, busca personas activas con la especialidad y alguno de los roles;
   - si hay una sola persona válida, la preselecciona; si hay varias, pide elegir;
   - si no hay ninguna, deja la actividad sin asignar y explica por qué;
   - siempre puedes elegir a otra persona a mano.
4. **Assign by role…** completa, con vista previa, solo las actividades importadas que siguen sin responsable.

Las asignaciones existentes nunca se cambian solas, aunque cambien los roles de una persona o del estándar. Los inputs externos no reciben responsable propuesto: su diseño es del consultor, y el seguimiento interno se elige a mano.

## 10. Qué se comprobó en esta entrega

Se ejecutó todo en Linux (Ubuntu 24.04) con Electron 43.7.7 real, en pantalla virtual, y Flowlace Server en Node.js. Los resultados:

| Prueba | Resultado |
|---|---|
| Base de datos: versiones, conflictos, reintentos idempotentes, transacciones, feed de cambios, backup/restauración, retención, bloqueo de segunda instancia | 10/10 ✓ |
| Servidor y API: inicio de sesión, permisos en el servidor, validación, reintentos, conflicto 409, cambios en vivo, reconexión tras reiniciar el servidor, auditoría, preferencias por usuario, backup/restauración solo del administrador, usuario desactivado, validación HTTPS del certificado, reglas de configuración | 11/11 ✓ |
| App de escritorio, Local: primera apertura, crear, espacio vacío, guardado confirmado, **persistencia tras reiniciar**, **importación JSON con resumen y sin duplicados**, identificadores en SQLite, preferencias personales, backup, **restauración con copia previa**, carpeta ausente sin crear base vacía | 13/13 ✓ |
| App de escritorio, funciones existentes: datos de ejemplo explícitos; Overview (timeline/table/calendar), Projects y sus pestañas, panel de tarea, Resources, todas las pestañas de Settings, Workflow → Import activities; **relaciones íntegras tras reiniciar**; quitar ejemplos sin que reaparezcan | 10/10 ✓ |
| Company, servidor real + **dos clientes** Electron: conexión, importación, mismo contenido en ambos, permisos de miembro, **cambios en vivo sin cerrar el panel**, edición en curso no interrumpida, **desconexión y reconexión**, **conflicto sobre la misma tarea**, preferencias por usuario, auditoría, **restauración** con recarga de ambos clientes | 12/12 ✓ |
| Workflow (13 comprobaciones): bajar "Preliminary design sketches and notes" amplía Electrical y desplaza los carriles inferiores sin superposiciones; mover "Preliminary equipment load" desplaza el conjunto de la derecha y se detiene ante su predecesor; undo/redo de movimientos completos; flecha editada que se conserva al cambiar de vista, al publicar y al reiniciar; filtros que conservan posiciones; proyecto basado en el estándar con ajustes propios; roles con propuesta, selección manual, mapeo y "Assign by role" sin tocar asignaciones previas; exportación JSON con distribución y roles; datos existentes íntegros | 13/13 ✓ |
| Edición del workflow (20 comprobaciones): People antes y después de usar el diagrama, incluso con un arrastre interrumpido; zonas Inputs → Actions → Outputs al crear y con Auto layout; referencias de otras fases en la zona de Inputs; carriles y separador de Outputs que se desplazan en tiempo real; secuencia y dependencias conservadas; filtros de "Depends on"; tarjetas independientes; guías y alineación; origen de la flecha de "Send architectural layouts…" en el borde superior; anclajes y recorridos que siguen a los bloques; Connect A → B; duplicados y ciclos rechazados; Undo/Redo; reinicio; datos íntegros | 20/20 ✓ |
| Paquete de servidor: `node.exe` de Windows ejecutado con Wine (init, serve, login, commit, backup) | ✓ |

**Compilación de Windows:** `FlowlaceSetup.exe` (Squirrel), el zip portátil y el paquete de Flowlace Server se generaron en Linux con Wine y Mono. Se verificó que `Flowlace.exe` lleva el icono, el nombre y los metadatos.

**No se pudo ejecutar aquí:**

- el instalador en un Windows real (bajo Wine, Squirrel necesita .NET);
- el servicio de Windows (WinSW);
- los scripts de PowerShell.

Para esto, conviene una prueba de aceptación en una PC y un servidor Windows. Hay una lista de comprobación en `SERVIDOR.md`, sección 9.
