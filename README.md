# Graph View

Obsidian-style force-directed graph view of your NotePlan vault, with note-backed saved views and a click-to-anchor focus mode.

> v0.2 — see [CHANGELOG.md](./CHANGELOG.md) for the full version history.

## Features

- Force-directed graph of all project notes (and optionally calendar notes)
- Edges from `[[wikilinks]]`
- **Click a node to lock + center** on it. The locked node renders as a hollow accent-bordered circle; its 1-hop neighborhood stays highlighted while everything else dims. Click the same node again, or click the background, to unlock.
- **Double-click a node to open the note** in the editor.
- Drag a node to reposition; mouse-wheel to zoom; drag the background to pan.
- Color nodes by top-level folder; node radius scales with degree.
- **Filter bar:**
  - Nested folder tree — expand/collapse folders; checking/unchecking a parent propagates to all descendants.
  - Tri-state Orphans selector (Show all / Hide orphans / Only orphans). "Only orphans" is great for surfacing notes that need linking.
  - **Show folder roots** toggle (mindmap-style): collapses each top-level folder into a single hub with a note count. Click a hub to expand it and see its children orbiting; inter-folder wikilinks aggregate into hub-to-hub edges so folder-level structure is visible at a glance.
- **Export outline** button: with a node locked as the anchor, exports a new outline note (title + bullet links to anchor and 1-hop neighbors) to a configurable folder, then opens it in an adjacent split-view.
- **Saved views** stored as individual notes in `@Plugins/Zettel Graph/Views/`. Each view captures filters + appearance + the locked anchor node. Favoriting a view note in NotePlan's sidebar gives you one-click recall.
- **Default view** loads automatically on panel open and survives NotePlan restarts.
- Sidebar-pinnable; respects NotePlan dark mode.

## Requirements

- NotePlan 3.20.1 or later

## Install (development)

This plugin is installed in-place at `~/Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3/Plugins/ryan.graph-view/`.

```sh
npm install
npm run build      # one-shot build
npm run autowatch  # rebuild on save
```

The built artifacts (`script.js`, `webview-bundle.js`, `webview-styles.css`) live alongside `plugin.json`. NotePlan loads them on launch.

## Usage

| Interaction | Result |
|---|---|
| Single-click a node | Lock highlight + camera-center on it |
| Single-click locked node | Unlock |
| Single-click background | Unlock |
| Double-click a node | Open the note in the editor |
| Drag a node | Reposition (force simulation pulls neighbors with it) |
| Mouse-wheel | Zoom in/out |
| Drag background | Pan |

## Commands

| Command | Alias | Description |
|---|---|---|
| `/graph view` | `graph`, `gv` | Open the graph panel |
| `/graph view: save view` | `save view` | Save the current view as a note |
| `/graph view: load view` | `load view` | Load a saved view (used by callback links) |
| `/graph view: refresh` | `regraph` | Force a full rescan and redraw |

## Settings

| Setting | Default | Description |
|---|---|---|
| Include Calendar Notes | `false` | Show daily/weekly notes as graph nodes |
| Excluded Folders | `@Templates, @Archive, @Trash, @Plugins` | Folders never scanned (always applied, even on top of saved-view filters) |
| Saved Views Folder | `@Plugins/Zettel Graph/Views` | Where saved-view notes live |
| Outline Export Folder | `09 - QUICK ACCESS` | Where the **Export outline** button creates new notes |
| Link Distance | `60` | D3 force-link distance |
| Charge Strength | `-200` | D3 charge force strength |
| Node Radius Min/Max | `4` / `20` | Smallest/largest node circle radius |
| Label Zoom Threshold | `1.0` | Show labels only when zoom ≥ this value (`0` = always show) |

The default view is managed inside the panel (Manage… → Set default), not in this settings page.

## Saved Views

Each saved view is its own note in `@Plugins/Zettel Graph/Views/`. Frontmatter holds metadata; a fenced ` ```json ` block in the body holds the full filter, appearance, and anchor config.

To favorite a view in NotePlan's sidebar: navigate to the view's note and add it to favorites. Clicking the in-note "Load this view" link applies the view to the graph panel via NotePlan's x-callback URL scheme.

To set a default view (loaded automatically when the panel opens, including after a NotePlan restart): use **Manage… → Set default** in the view picker. The default is stored as a NotePlan preference (`graphView_defaultViewFilename`).

## Architecture

```
ryan.graph-view/
├── plugin.json           (manifest, sidebar pin, settings)
├── d3.min.js             (D3 v7 UMD, declared in plugin.requiredFiles)
├── script.js             (built: Node-side bundle)
├── webview-bundle.js     (built: webview JS bundle, treats d3 as external global)
├── webview-styles.css    (built: webview CSS, theme-token-driven)
├── package.json + rollup.config.js + babel.config.js
└── src/
    ├── index.js          (entry, buildAndShowPanel, command handlers)
    ├── buildGraph.js     (scans DataStore, returns {nodes, edges})
    ├── savedViews.js     (note-backed saved view CRUD; body-JSON schema)
    ├── messageBridge.js  (postMessage routing both ways)
    ├── settings.js       (settings + preferences accessors)
    └── webview/
        ├── template.js   (HTML shell)
        ├── main.js       (webview entry, state, postMessage bridge)
        ├── graph.js      (D3 force layout, drag/zoom/lock/center)
        ├── ui.js         (top bar, filter bar, save/manage modals)
        └── styles.css    (CSS tokens + dark-mode media query)
```

The webview HTML is generated at runtime in the plugin and served via `HTMLView.showInMainWindow`. It loads `./d3.min.js`, `./webview-styles.css`, and `./webview-bundle.js` from the plugin root.

## Roadmap

v0.2 shipped:
- ✅ Folder root nodes (mindmap-style collapse/expand)
- ✅ Export outline button
- ✅ Nested folder filter

Parked for future versions:
- Co-tag and co-mention edges (notes sharing N or more `#tags` / `@mentions` get an inferred edge)
- Focus mode — render only the n-hop neighborhood of the locked anchor
- Time-based filters / animation across creation dates
- Canvas renderer for very large vaults (currently SVG)
- Persist node positions inside saved views

## Reporting issues

Diagnostic logs land in `_MCP-console.log` next to `script.js`. The plugin logs read/write/load actions for saved views and the default-view path so failures are easy to trace.
