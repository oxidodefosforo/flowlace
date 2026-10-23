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

**Zonas.** Cada fase se organiza de izquierda a derecha en tres zonas: **Inputs → Actions → Outputs**. Se ven por defecto, con su encabezado, un fondo apenas distinto y una línea vertical entre zonas (la de Outputs es punteada y lleva el título "Outputs — [fase]"). **Hide zones / Show zones** oculta o muestra estas guías sin mover nada. En **Edit layout** las líneas verticales se pueden arrastrar (ver más abajo).

- **Actividades nuevas:** solo se coloca el bloque nuevo, en un hueco libre de su carril y de su zona, con la separación mínima y, si es posible, dentro de la parte visible del diagrama. Nada más se mueve: ni los bloques, ni los carriles, ni los separadores, ni los recorridos ajustados. Si el hueco queda fuera de la vista, la barra ofrece **Locate new activity**. Si el carril no tiene ningún hueco, el bloque va debajo del último de su carril y ese carril crece (es el único caso en que los carriles de abajo bajan). Agregar una actividad nunca ejecuta Auto layout; la reorganización general solo ocurre al pulsar **Auto layout**.
- **Outputs sin dependencias:** aparecen siempre en la zona de Outputs.
- **Referencias de otras fases:** se muestran en la banda "Other phases", dentro de la zona de Inputs. Si alimentan un Input, quedan en una subcolumna a su izquierda. Moverlas solo cambia su lugar en esa fase.
- **Relaciones en sentido contrario:** se conservan y se marcan para revisión. Por ejemplo, una Action que depende de un Output.
- **Auto layout** aplica las mismas reglas.

**Tipos de actividad.** La **categoría** (Input, Action, Output) dice dónde va la actividad y da su color: Input verde azulado, Action azul, Output violeta. El **Activity type**, elegido explícitamente, da la forma y el comportamiento:

| Tipo | Forma |
|---|---|
| Standard | rectángulo (en cualquier categoría) |
| Information | paralelogramo |
| Document | rectángulo con el borde inferior ondulado |
| Decision | rombo ámbar con salidas Yes / No |
| QA / Approval | rombo violeta con la etiqueta **QA** y salidas Yes / No |

- La forma nunca se deduce de la categoría, de ser un requisito externo ni del nombre: un Input normal es un rectángulo verde; un Input + Information, un paralelogramo verde; un Action + Information, un paralelogramo azul.
- Se elige al crear (selector junto al nombre en la matriz) y se cambia en **Show details**, con vista previa de la forma y su color. Cambiar el tipo conserva id, nombre, descripción, categoría, fase, especialidad, dependencias, roles, tareas y posición. Si una Decision o QA con salidas pasa a otro tipo, se pregunta antes: convertir esas salidas en dependencias normales (si no crean un requisito circular) o quitarlas.
- La fila **Types** filtra por tipo (con su propia distribución). En **Depends on** hay también un filtro **Activity type**.
- La forma dibujada, el área de clic y los puntos de conexión de las flechas usan el mismo contorno.

**Tres tipos de conexión**

- **Dependencia normal** ("Depends on"): un requisito para poder hacer la actividad. Nunca puede ser circular: si Connect detecta un requisito circular, ofrece convertirlo en un retorno de revisión.
- **Salida condicional** de una Decision o QA (Yes / No) hacia una actividad posterior: continúa según la respuesta. No es una dependencia: no aparece en "Depends on".
- **Retorno de revisión**: vuelve a trabajo anterior para repetirlo. Puede ser una salida (por ejemplo, QA Sketches / No → Preliminary design sketches) o un enlace de retorno desde un trabajo de corrección (Resolve review comments ↺ Prepare drawings, creado con Connect). Se dibuja discontinuo, por debajo del recorrido principal, con su etiqueta. Un retorno nunca bloquea el trabajo inicial.

Se configuran en Show details (salidas y lista de retornos), desde el menú del bloque (**Set Yes / No outlet…**) o con **Connect**. Al seleccionar una flecha: **Clear outlet** o **Remove return**. Los loops se conservan al guardar, publicar, exportar, importar y reiniciar. Los datos de la 1.6 se migran solos: la copia de cada salida que estaba en "Depends on" del destino se quita una vez y la salida se mantiene.

**Respuestas y rondas en cada proyecto.** El estándar define preguntas, criterios, salidas y retornos; cada proyecto registra sus respuestas (tarjeta del Workflow o panel de la tarea): **Pending**, **Yes** o **No**.

- Empieza en Pending; una Decision o QA no puede marcarse Done sin respuesta. Mientras está pendiente, lo que sigue espera; el trabajo anterior puede empezar.
- Respuesta hacia adelante: el camino elegido continúa y el otro se atenúa (no bloquea, no cuenta como pendiente, no se marca como hecho). Si el camino elegido acaba volviendo a revisión, la continuación aprobada sigue pendiente.
- **Ronda de revisión:** un No (o Yes) que vuelve a trabajo anterior, o terminar un trabajo con retorno, abre un diálogo con el trabajo que se repetirá: solo lo que va desde el destino del retorno hasta la revisión (se puede desmarcar). Al confirmar se guarda la respuesta con sus observaciones, ese trabajo vuelve a To Do, la revisión vuelve a **Pending** y su número de ronda sube. Cuando se terminan las correcciones, la nueva revisión está disponible; puede volver a ser No (otra ronda) o Yes (continúa).
- Cada actividad sigue siendo una sola tarea: se conservan responsables, horas, notas, finalizaciones anteriores (en su historial de intentos) y todas las respuestas (R1: No, R2: Yes…). Las rondas no aumentan el número de actividades del avance. Volver a dibujar, guardar o reiniciar nunca abre otra ronda; si cancelas el diálogo de un retorno, puedes hacerlo luego con **↺ Send back for review…**.
- Los entregables que dependían del trabajo que se repite quedan marcados **Review after rework** (sus datos se conservan).
- Cada proyecto tiene sus propias respuestas y rondas: no cambian el estándar ni otros proyectos.

**Mover bloques.** Arrastra cualquier bloque: **se mueve solo ese bloque**. Sus predecesoras y sucesoras se quedan donde están y las flechas se adaptan (aunque tengan que ir hacia la izquierda). Las dependencias nunca limitan el movimiento; lo único que lo limita son las zonas (un bloque no entra en una zona anterior, con la separación mínima), y cuando eso ocurre el separador se marca en rojo indicando qué zona termina ahí. Mover nunca cambia dependencias, fase, especialidad, categoría ni estado.

- **Selección múltiple:** clic selecciona una actividad; **Mayús/Ctrl/Cmd + clic** agrega o quita; arrastrar sobre una zona vacía dibuja un **rectángulo** que selecciona las actividades visibles que toca (con Mayús amplía la selección); clic en una zona vacía deselecciona. El conjunto se rodea con un contorno y "N activities selected". La selección es temporal: no crea grupos.
- **Mover en bloque:** arrastra cualquiera de las seleccionadas y todas se mueven con el mismo desplazamiento, conservando su distribución; las demás no se mueven. Si al soltar un bloque quedaría encima de otro, la superposición se marca en rojo durante el arrastre y el conjunto baja junto lo justo. Un movimiento es una sola operación de Undo; **Esc** durante el arrastre lo cancela.
- **Select / Pan:** con **Pan**, arrastrar desplaza el lienzo; con cualquier herramienta, mantener **Espacio** y arrastrar también lo desplaza.
- **Move with successors** (desactivado por defecto): al pasar sobre un bloque se resaltan lo que eligiste (azul) y lo que se añade automáticamente (ámbar, discontinuo) antes de arrastrar.

- **Vertical:** el carril crece mientras arrastras y empuja hacia abajo los carriles inferiores, incluida "Other phases", con sus bloques y flechas. El bloque nunca cambia de especialidad.
- **Horizontal:** si una Action necesita más espacio, la zona de Actions se amplía, el separador de Outputs se desplaza y los Outputs se apartan lo necesario (se ve mientras arrastras).
- **Guías:** al acercar un bloque a otro aparecen guías rojas de alineación (bordes y centros) con un ajuste suave. Si sigues moviendo, el ajuste se suelta. En X sirven los bloques de cualquier carril; en Y, solo los del mismo carril.
- **Alinear varios:** con varios seleccionados, el primero es la referencia fija. Están disponibles **Align columns**, **Align rows** y **Distribute**. Lo que no puede moverse por una dependencia, una zona o una superposición se queda donde estaba y se explica por qué.
- **Teclado:** Alt + flechas mueve el bloque enfocado. **Esc** cancela un arrastre y lo devuelve a su sitio.

**Ajustar flechas (clic sobre la línea)**

- **Seleccionar:** haz clic directamente sobre la flecha; el área sensible es algo más ancha que la línea. Solo esa flecha queda resaltada (las demás se atenúan) y la barra muestra su nombre y sus acciones. Si varias flechas pasan por el mismo sitio, cada clic selecciona la siguiente y un aviso indica cuántas hay. **Esc** o un clic en el fondo quita la selección. Seleccionar o arrastrar una flecha nunca mueve el lienzo ni los bloques.
- **Segmentos:** cada tramo tiene un pequeño cuadrado. Un tramo vertical se arrastra a izquierda o derecha (cursor ↔) y uno horizontal hacia arriba o abajo (cursor ↕); los tramos vecinos se ajustan y los extremos siguen unidos a sus actividades. Ejemplo: si varias flechas llegan a "Prepare preliminary drawings", selecciona una y lleva su tramo vertical a la izquierda, selecciona otra y llévala a la derecha.
- **Puntos de paso:** doble clic en la línea añade un quiebre; doble clic en un cuadrado lo quita.
- **Origen y destino:** arrastra el círculo de cada extremo a cualquiera de los cuatro bordes de su bloque (arriba, abajo, izquierda, derecha) y a lo largo de ese borde. El borde se resalta, el recorrido se recalcula para la nueva dirección y la dependencia no cambia. Si sueltas lejos del bloque o pulsas **Esc**, el extremo vuelve a donde estaba. Se guardan el borde y la posición relativa, así que siguen igual al mover el bloque.
- **Reconnect source… / Reconnect target…** (Company workflow): cambia la actividad de origen o de destino de la flecha seleccionada. Haz clic en la nueva actividad y confirma. Duplicados, autorreferencias y ciclos se rechazan con la explicación; si cancelas o no es válido, la relación original se conserva. El extremo que no cambia mantiene su anclaje.
- **Reset selected route** devuelve solo esa flecha al recorrido y anclajes automáticos. **Reset all routes** hace lo mismo con todas las flechas de la vista. Ninguno cambia dependencias ni posiciones de bloques.
- **Al mover bloques:** las flechas automáticas se recalculan como siempre. Las ajustadas conservan sus anclajes y su recorrido; solo se recalcula una flecha ajustada si sus bloques se movieron y el recorrido guardado atravesaría otro bloque. Las flechas no afectadas no cambian. **Auto layout** recoloca los bloques y conserva los ajustes de flechas que siguen siendo válidos.
- **Rounded** suaviza las esquinas, solo visualmente.

**Ancho de las zonas (Edit layout)**

- Arrastra la línea **Inputs | Actions** para reducir o ampliar el espacio entre Inputs y Actions; Actions y Outputs se desplazan con ella. La línea **Actions | Outputs** hace lo mismo con Outputs. Las posiciones verticales no cambian y las flechas se actualizan mientras arrastras.
- Hay una separación mínima: no se pueden superponer bloques ni crear coordenadas inválidas.
- **Fit zones to content** elimina el espacio sobrante entre y dentro de las zonas, manteniendo el orden.
- Sigue funcionando lo anterior: mover una actividad puede ampliar su carril o empujar las zonas posteriores.

**Editar una actividad sin salir del diagrama** (Company workflow)

1. Haz clic en la actividad (Input, Action u Output). Queda seleccionada y aparece un pequeño menú a su lado. La página, el diagrama y el zoom no se mueven, y no se salta a la matriz.
2. **Add prerequisites…** abre el selector flotante junto al bloque: búsqueda, filtros Type, Service y Phase, selección múltiple, las dependencias ya elegidas (aunque los filtros las oculten) y opciones desactivadas con el motivo si crearían un ciclo. Cada cambio se guarda al momento, las flechas y la matriz se actualizan y el bloque sigue seleccionado y visible.
3. **Show details…** abre los campos de la actividad (nombre, descripción, especialidad, categoría, roles, dependencias) en un panel flotante. Los cambios se reflejan en la tarjeta de la matriz.
4. **Done**, × o **Esc** cierran el panel sin saltos de pantalla y devuelven el foco al bloque.

**Una distribución por vista.** Cada combinación de fase (o All phases) y filtro de especialidades tiene su propia distribución: todas las especialidades, solo Electrical, Electrical + Hydraulics, etc. El orden en que eliges los filtros no importa: Hydraulics + Electrical es la misma vista que Electrical + Hydraulics. Cada vista guarda posiciones, carriles, anchos de zona, recorridos, anclajes, zoom y desplazamiento, y también tiene su propio Undo / Redo.

- **Primera vez con un filtro:** la vista parte de cómo están los bloques visibles en "todas las especialidades", quitando los espacios que ocupaban los ocultos. No se guarda nada hasta que cambias algo, y nunca modifica la vista de todas las especialidades.
- **Zonas comunes:** en cada fase, Inputs → Actions → Outputs comparten límites en todos los carriles visibles. Si las posiciones guardadas (heredadas de otra vista o de una versión anterior) dejaran una zona empezando antes de que termine la anterior, esa zona y las siguientes se desplazan lo mínimo necesario, conservando la distribución interna y las posiciones verticales; ningún separador atraviesa una tarjeta. Lo mismo en All phases, fase por fase.
- **Sin barreras invisibles:** las actividades ocultas no reservan espacio, no limitan los movimientos ni agrandan el lienzo. Las dependencias con ellas siguen en los datos.
- **El espacio entre zonas no es un muro:** aunque hayas ensanchado un separador (o Fit zones lo haya fijado), un bloque puede acercarse a la zona anterior hasta la separación mínima; ese espacio se reduce solo. Lo único que limita el movimiento es lo que se ve: lo que la actividad necesita (a su izquierda) y los bloques de la zona anterior, a la separación mínima.
- **Independientes:** cambiar Electrical no toca "todas las especialidades", y al revés. Auto layout, Fit zones y los separadores afectan solo a la vista activa.
- **Mismas actividades:** nombres, descripciones, especialidades y dependencias son los mismos en todas las vistas. Una actividad nueva aparece en las vistas cuyos filtros la incluyen, colocada en un hueco libre. Si cambias su especialidad o categoría, se recoloca solo ese bloque en las vistas donde corresponde.
- **Al actualizar:** las distribuciones anteriores siguen siendo la vista de todas las especialidades de cada fase.

**Zoom:** **−**, el porcentaje (vuelve a 100 %), **+** (de 25 % a 150 %) y **Fit to view**, que encaja todo el diagrama en el área visible sin mover actividades ni flechas. Cada vista (cada fase, All phases y la vista de cada proyecto) recuerda su propio zoom y su desplazamiento. Todos los controles funcionan con cualquier zoom.

**All phases.** El primer selector de fase muestra el flujo completo en un solo diagrama, con las fases de izquierda a derecha en el orden configurado en Settings → Phases.

- Cada fase tiene un encabezado con su nombre y color y una línea continua que la separa de la anterior. Dentro de cada fase se mantiene Inputs → Actions → Outputs, y los carriles de especialidad son los mismos en todo el ancho.
- Las dependencias entre fases unen directamente las actividades reales: cada actividad aparece una sola vez y no hay tarjetas "From …" ni banda "Other phases". Solo cuando un filtro de especialidad oculta un requisito, este aparece como referencia en su propia fase.
- Se puede seleccionar, abrir el menú del bloque, Add prerequisites, Show details, mover bloques y ajustar flechas y zonas igual que en una fase. En Company workflow los cambios van al borrador y se publican con Save and publish.
- All phases tiene su propia distribución: lo que ajustes ahí no cambia la de cada fase, y al volver a una fase la encuentras como la dejaste.
- En un proyecto, All phases muestra sus fases y actividades con los estados reales y los requisitos externos. Abrirla no importa actividades ni crea tareas.
- La matriz de abajo agrupa las tarjetas por fase; para añadir una actividad desde All phases se elige su fase en el formulario.

**⛶ Full screen.** Amplía el diagrama a toda la ventana: se ocultan la navegación, los encabezados y la matriz, y queda una barra compacta con fases, filtros, zoom, edición, Undo / Redo y **Exit full screen**. Todo funciona igual (mover, alinear, segmentos, anclajes, separadores, Add prerequisites, Show details, Auto layout), y los menús y editores se abren encima. Para salir usa el mismo botón o **Esc**: si hay un menú, un editor o una flecha seleccionada, el primer Esc cierra eso y el siguiente sale. Entrar o salir conserva la selección, el zoom y la posición, y no publica nada.

**Tamaño del lienzo.** El fondo del diagrama cubre siempre toda el área visible, también con poco contenido o con el zoom reducido, y el desplazamiento llega justo hasta el contenido real (actividades, flechas, puntos de paso, encabezados y separadores) más un margen moderado. Se recalcula al cambiar el zoom, la ventana, la fase, los filtros o al entrar y salir de pantalla completa. Los espacios que ajustaste arrastrando separadores se respetan.

**Agregar dependencias desde el diagrama** (Company workflow)

- **Connect:** haz clic en A (lo que se necesita) y luego en B (lo que lo necesita). **A → B significa que B depende de A.** Se confirma antes de guardar.
- **Arrastrando:** con Edit layout, arrastra desde el punto de conexión en el borde derecho de un bloque hasta otro bloque.
- **Add prerequisites…:** desde el menú del bloque (ver arriba), con filtros e incluidas otras fases.
- **Validaciones:** los duplicados, las autorreferencias y los ciclos se rechazan con la explicación.
- **Desde un proyecto:** "Edit in Company workflow" abre esa actividad en el estándar.

**Tarjetas de la matriz.** Muestran solo el nombre y la descripción. "Show details" abre la configuración de cada tarjeta por separado: especialidad, categoría, roles, dependencias y retiro. "Depends on" incluye:

- búsqueda por nombre y descripción;
- filtros Type, Service y Phase (por defecto la fase actual), combinados con Y entre filtros y con O dentro de un mismo filtro;
- el número de resultados;
- las dependencias elegidas, que se muestran aparte aunque los filtros las oculten. Los filtros nunca las quitan.

**Barra:** Edit layout · Undo / Redo · Auto layout · Reset layout · Reset all routes · Fit zones to content · Connect · Hide/Show zones · Rounded · zoom. Debajo, una segunda fila de altura fija muestra lo seleccionado y sus acciones; como no cambia de alto, seleccionar algo nunca desplaza el diagrama.

**Undo / Redo:** cada arrastre, alineación o ajuste es **una sola operación**, y restaura a la vez bloques, carriles, anchos de zona, segmentos, puntos de paso y anclajes. En el Company workflow también deshace las dependencias agregadas o quitadas desde el diagrama o el selector flotante y los cambios hechos con Reconnect. **Reset layout** vuelve, en el estándar, a la distribución publicada; en un proyecto, a la del estándar.

**Dónde se guarda la distribución**

- **Por fase, separada de la estructura:** se guarda aparte de las actividades y dependencias. Incluye posiciones relativas al carril, altura de carriles, inicio y ancho de zonas, recorridos, puntos de paso y anclajes (borde + posición relativa), identificados por los ids estables de las actividades.
- **En el estándar:** forma parte del borrador y se publica con **Save and publish**.
- **En cada proyecto:** el proyecto parte de la distribución del estándar y guarda sus ajustes propios, que nunca cambian el estándar.
- **Se mantiene** al cambiar de fase, filtrar, navegar entre proyectos, reiniciar y exportar o importar.

**Orden de especialidades:** Electrical, Mechanical, Hydraulics, Fire, las demás especialidades configuradas y, al final, Coordination (involucra a todas). Se aplica a carriles, filtros y selectores; la distribución interna de cada carril se conserva.

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
| Edición fina del workflow (18 comprobaciones, con "Prepare preliminary drawings" recibiendo tres flechas): selección por clic y flechas superpuestas; separar dos tramos verticales (izquierda/derecha) con cursor y vista previa; subir y bajar tramos horizontales; añadir y quitar quiebres; cambiar origen (abajo) y destino (arriba) sin desconectar, con Esc y suelta inválida; Reconnect con duplicado, autorreferencia, ciclo, cancelación y caso válido; ajustes que se conservan al mover bloques y flechas que no atraviesan bloques; flechas automáticas idénticas tras Reset all routes; Reset selected route; Auto layout conservando ajustes; arrastrar separadores (reducir, mínimo, ampliar) y Fit zones to content; orden, especialidad y dependencias; clic en un bloque sin mover página, diagrama ni zoom; Add prerequisites y Show details flotantes; controles al 80 % y 120 %; Undo/Redo de todo lo anterior; guardado al cambiar de fase y vista, publicar, reiniciar, exportar e importar; ajustes de proyecto separados del estándar; People y navegación intactos | 18/18 ✓ |
| All phases, pantalla completa y lienzo (13 comprobaciones, con Fee → Sketch → Design Development → Tender Issue): orden de fases, encabezados y colores, zonas por fase y carriles alineados; dependencias entre fases entre bloques reales, sin duplicados, y referencias solo para lo filtrado; distribución y zoom propios de cada vista; pantalla completa que cubre la ventana con sus controles; mover, segmentos, anclajes, separadores, Add prerequisites, Show details y Auto layout dentro de ella; Esc en dos pasos conservando selección, cambios y posición, sin publicar; sin franja blanca al 100 %, 60 % y 40 %; área desplazable que sigue al zoom, a Fit to view y al tamaño de la ventana; flechas y puntos de paso seleccionables al 70 % y un quiebre bajo el último carril incluido; proyecto con All phases sin crear tareas; reinicio y datos íntegros | 13/13 ✓ |
| Vistas y actividades nuevas (12 comprobaciones): agregar una actividad con bloques ordenados a mano sin mover ninguno (posiciones en pantalla, carriles, separadores y recorridos), en un hueco de su carril y zona y sin superposiciones; vistas que la incluyen o la excluyen; Locate new activity sin saltos de vista; con solo Electrical, mover un bloque por el espacio que usaban las especialidades ocultas y lienzo más estrecho; volver a todas las especialidades sin cambios; Electrical conserva sus ajustes; Electrical + Hydraulics = Hydraulics + Electrical; cambio de especialidad que pasa el bloque de una vista a otra; Auto layout solo en la vista activa, con Undo; con solo Mechanical y el espacio Inputs | Actions ensanchado, una Action vuelve hasta la separación mínima; reinicio con todas las vistas y su zoom; datos íntegros | 12/12 ✓ |
| Tipos, Decision / QA y selección (12 comprobaciones): datos anteriores con tipo por defecto y Fire encima de Coordination; formas (rombo ámbar, rombo violeta con QA, documento ondulado, paralelogramos) con flechas en el contorno; salidas Yes / No etiquetadas, desde el menú y a una actividad nueva, pendientes señaladas, Yes = No rechazado; cambio de tipo que conserva todo y pregunta por las salidas; filtro por tipo; A no arrastra a C y B no bloquea a A; A + C juntas con B fija; A + B + C con rectángulo; Esc y una sola Undo; Move with successors con resaltado previo; sin muros por dependencias en una vista filtrada; Pan y Espacio; respuestas por proyecto (Pending bloquea, No / Yes, rama no elegida atenuada y fuera del total, unión compartida, cambio de respuesta con lista y datos conservados, QA con su resultado), otro proyecto y estándar intactos; reinicio | 12/12 ✓ |
| Loops, formas y zonas (8 comprobaciones): Input / Action / Output normales como rectángulos con sus colores; paralelogramo solo con Information (también en Action, azul) y cambio de tipo que conserva todo; QA / No hacia trabajo anterior y retorno desde una corrección, dibujados como retornos, conservados al publicar, exportar, importar y reiniciar; Connect ofrece retorno en lugar de dependencia circular; rondas por proyecto (trabajo inicial antes del QA, alcance propuesto, observaciones, Pending de nuevo, misma tarea con historial, responsable y horas, sin rondas extra al redibujar o reiniciar, Yes habilita la continuación correcta); rework con retorno (repite dibujo y QA, nada anterior); Hydraulics + Fire, todas las especialidades y All phases sin separadores sobre tarjetas; filtros que restauran su distribución; sin muros por actividades ocultas; Auto layout con loops termina; retornos editables | 8/8 ✓ |
| Paquete de servidor: `node.exe` de Windows ejecutado con Wine (init, serve, login, commit, backup) | ✓ |

**Compilación de Windows:** `FlowlaceSetup.exe` (Squirrel), el zip portátil y el paquete de Flowlace Server se generaron en Linux con Wine y Mono. Se verificó que `Flowlace.exe` lleva el icono, el nombre y los metadatos.

**No se pudo ejecutar aquí:**

- el instalador en un Windows real (bajo Wine, Squirrel necesita .NET);
- el servicio de Windows (WinSW);
- los scripts de PowerShell.

Para esto, conviene una prueba de aceptación en una PC y un servidor Windows. Hay una lista de comprobación en `SERVIDOR.md`, sección 9.
