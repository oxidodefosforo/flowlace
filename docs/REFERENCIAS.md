# Referencias de diseño (versión 1.8)

La versión 1.8 rediseña la interfaz de Flowlace con Notion como referencia visual. También añade tres mejoras de uso, inspiradas en aplicaciones de código abierto.

**No se copió código, estilos ni recursos de ninguna referencia.** Flowlace no tiene licencia pública (su código es propietario), así que no puede incorporar código AGPL (AppFlowy, AppFlowy-Web, Plane). De las referencias con licencia permisiva (AFFiNE MIT, BlockNote MPL-2.0) solo se estudió el comportamiento. sgbj/notion-clone no declara licencia, por lo que su código no puede reutilizarse; solo se observó su comportamiento. Todo lo implementado está escrito desde cero sobre el código existente de Flowlace. No se añadió ninguna dependencia.

## Fuentes consultadas

Los repositorios se revisaron el 6 de noviembre de 2026, en una copia superficial de cada uno.

| Referencia | Commit consultado | Licencia (archivo) | Uso |
|---|---|---|---|
| Notion (público) | — | Producto comercial | Solo la ayuda pública (ver abajo); sin capturas propias de la app |
| [AppFlowy-Web](https://github.com/AppFlowy-IO/AppFlowy-Web) | `d940e0e767b0bb8df594bb15a9390b958ff89ee4` | AGPL-3.0 (`LICENSE`) | Comportamiento: barra de filtros y orden de la vista, cajón lateral redimensionable |
| [AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) | `8fcee27d9bd93aad4ee0191d5d8d915d6a9a4e93` | AGPL-3.0 (`LICENSE`) | Contexto del modelo de base de datos y vistas (no se tomó nada concreto) |
| [Plane](https://github.com/makeplane/plane) | `618d0eb74658329a6f6e92434ac54231422c5b96` | AGPL-3.0 (`LICENSE.txt`) | Comportamiento: barra lateral redimensionable con teclado, opciones de vista (agrupar / ordenar / propiedades) |
| [AFFiNE](https://github.com/toeverything/AFFiNE) | `ef401b20cb2a5960278a8e7ab2c0e96d8f759aeb` | MIT fuera de `packages/backend` (`LICENSE`, `LICENSE-MIT`) | Comportamiento: barra de herramientas del lienzo agrupada y barra contextual para la selección |
| [sgbj/notion-clone](https://github.com/sgbj/notion-clone) | `f30a63e7f2c7d5cf472b32ab7be3cc3379209f3b` | Sin licencia (todos los derechos reservados) | Comportamiento: barra lateral plegable con ancho limitado, búsqueda Ctrl+K |
| [BlockNote](https://github.com/TypeCellOS/BlockNote) | `262fb815a25e892b7a6e4d06b63df19a9ae5d6a8` | MPL-2.0, salvo los paquetes XL (`LICENSE.txt`) | Evaluado y descartado para esta entrega (ver abajo) |

## Qué se tomó de cada una

### Notion

Se consultó la documentación pública. No se instaló ni se usó la app. Se distingue entre lo que dice la documentación y lo que se decidió para Flowlace.

**Lo que dice la documentación:**

- **[Navigate with the sidebar](https://www.notion.com/en-gb/help/navigate-with-the-sidebar)**:
  - la barra lateral tiene Search, Home, Favourites, Teamspaces/Private y Settings;
  - se redimensiona arrastrando el borde y se pliega con «<<»;
  - las secciones se pliegan desde su título;
  - atajos: `Ctrl/⌘ + \` (mostrar u ocultar la barra) y `Ctrl/⌘ + K` (buscar).
- **[Views, filters, sorts & groups](https://notion.com/help/views-filters-and-sorts)**:
  - cada vista guarda su propio diseño, filtros, orden, agrupación y propiedades visibles;
  - los filtros y el orden pueden ser personales o para todos;
  - tabla, tablero y lista abren las páginas en *side peek*, un panel a la derecha que deja la base de datos usable.

**Lo que se decidió para Flowlace:**

- La paleta se eligió para Flowlace. Se buscó el mismo efecto que Notion: página blanca, barra lateral gris cálida y texto gris oscuro. No se copiaron valores ni hojas de estilo de Notion.
- Las etiquetas van en mayúscula inicial y los títulos son grandes.
- Las tablas tienen filas de una línea con separadores finos.
- Las propiedades del panel tienen fondo transparente hasta pasar el cursor.

### Plane

Archivos que sustentan decisiones:

- `apps/web/components/sidebar/resizable-sidebar.tsx`:
  - el control de redimensionado se maneja con el teclado: ←/→ ±10 px, Home = mínimo, End = máximo;
  - expone `role="separator"` con `aria-valuemin/max`;
  - el doble clic cambia el estado de la barra;
  - ancho entre 236 y 350 px.
- `packages/types/src/view-props.ts`:
  - `IIssueDisplayFilterOptions` (`layout`, `group_by`, `sub_group_by`, `order_by`, `show_empty_groups`) e `IIssueDisplayProperties` confirman que agrupar es una opción de cada vista, independiente del diseño;
  - de ahí sale **Group by en Table**.
- `apps/web/components/issues/issue-layouts/filters/header/display-filters/*`: los controles de vista viven en una barra compacta.

**Verificado en el código:** el teclado del redimensionado y los tipos de las opciones de vista.
**Solo descrito:** nada adicional.

### sgbj/notion-clone

- `app/(main)/_components/navigation.tsx`:
  - ancho entre 240 y 480 px;
  - la barra se pliega a 0 y, en pantallas de menos de 768 px, se pliega sola al navegar;
  - un clic en el borde restaura el ancho.
- `app/(main)/_components/item.tsx`: elementos con sangría y acciones visibles al pasar el cursor.
- `components/search-command.tsx`: `Ctrl/⌘ + K` abre un buscador de documentos.

**Verificado en el código:** el ancho, el plegado y el atajo.

### AppFlowy-Web

- `src/components/database/components/conditions/DatabaseConditions.tsx`: la barra de filtros y orden se desplaza horizontalmente cuando no cabe. Flowlace hace lo mismo con la barra de vista en ventanas estrechas.
- `src/components/database/components/tabs/DatabaseTabs.tsx`: pestañas de vista.
- `src/components/_shared/outline/OutlineDrawer.tsx`: cajón lateral con ancho configurable (`onResizeWidth`, `Resizer`).

**Verificado en el código:** el desplazamiento horizontal de la barra y el ancho del cajón.

### AFFiNE (blocksuite)

- `blocksuite/affine/widgets/edgeless-toolbar/src/edgeless-toolbar.ts`: barra de herramientas del lienzo, compacta y agrupada.
- `blocksuite/affine/widgets/toolbar/src/toolbar.ts`: barra contextual según la selección.

Flowlace ya tenía una línea contextual en el workflow. En esta versión se agrupan las herramientas con separadores (historial · herramientas y conexiones · vista · zoom), sin quitar ninguna opción.

### BlockNote: evaluado, no integrado

BlockNote es un editor de bloques en React sobre ProseMirror/Tiptap. Flowlace usa JavaScript sin framework ni empaquetador, y tiene notas de texto plano. Integrarlo exigiría:

- añadir React y un paso de empaquetado;
- cambiar el formato de las notas, con su migración.

Sería un cambio de arquitectura amplio que no resuelve ningún problema observado en esta entrega. Queda como posible mejora futura (ver «Siguientes mejoras» en la guía).
