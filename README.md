# Zettel Graph View

Obsidian-style force-directed graph view of your NotePlan vault, with note-backed saved views and a click-to-anchor focus mode.

> Current version: v1.0.2 — see [CHANGELOG.md](CHANGELOG.md) for version history.

## Features

Highlights:

- Force-directed graph view of your vault with click-to-focus, drag, zoom, and pan
- **Folder Roots mode** — collapse top-level folders into hub nodes for a vault-wide overview
- **Saved Views** stored as notes, with anchor + filters captured per view
- **Export Outline** — generate a wikilink outline of any node's 1-hop neighborhood
- Sidebar-pinnable, dark-mode-aware, works on iOS

See [REFERENCE.md](REFERENCE.md) for the full feature reference, settings details, and known limitations.

## Requirements

- NotePlan 3.20.1 or later

## Install (development)

This plugin is installed in-place at `~/Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3/Plugins/marginalreader.ZettelGraphView/`.

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
| `/zettel graph view` | `graph`, `gv`, `zgv` | Open the graph panel |
| `/zettel graph view: save view` | `save view` | Save the current view as a note |
| `/zettel graph view: load view` | `load view` | Load a saved view (used by callback links) |
| `/zettel graph view: refresh` | `regraph` | Force a full rescan and redraw |

## Settings

| Setting | Default | Description |
|---|---|---|
| Include Calendar Notes | `false` | Show daily/weekly notes as graph nodes |
| Excluded Folders | `@Templates, @Archive, @Trash, @Plugins` | Folders never scanned (always applied, even on top of saved-view filters) |
| Saved Views Folder | `@Plugins/Zettel Graph View/Views` | Where saved-view notes live |
| Outline Export Folder | `Notes` | Where the **Export outline** button creates new notes |
| Link Distance | `60` | D3 force-link distance |
| Charge Strength | `-200` | D3 charge force strength |
| Node Radius Min/Max | `4` / `20` | Smallest/largest node circle radius |
| Label Zoom Threshold | `1.0` | Show labels only when zoom ≥ this value (`0` = always show) |

The default view is managed inside the panel (Manage… → Set default), not in this settings page.

## Saved Views

Each saved view is its own note in `@Plugins/Zettel Graph View/Views/`. Frontmatter holds metadata; a fenced ` ```json ` block in the body holds the full filter, appearance, and anchor config.

To favorite a view in NotePlan's sidebar: navigate to the view's note and add it to favorites. Clicking the in-note "Load this view" link applies the view to the graph panel via NotePlan's x-callback URL scheme.

To set a default view (loaded automatically when the panel opens, including after a NotePlan restart): use **Manage… → Set default** in the view picker. The default is stored as a NotePlan preference (`graphView_defaultViewFilename`).

## Architecture

```
marginalreader.ZettelGraphView/
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

Ideas parked for future versions — nothing committed, just what might come next:

- Co-tag and co-mention edges (notes sharing N or more `#tags` / `@mentions` get an inferred edge)
- Focus mode — render only the n-hop neighborhood of the locked anchor
- Time-based filters / animation across creation dates
- Canvas renderer for very large vaults (currently SVG)

## Reporting issues

Open an issue at https://github.com/marginalreader/zettel-graph-view/issues. The plugin logs saved-view read/write/load actions to NotePlan's plugin console (View → Show Plugin Console) — including those lines in the report helps trace failures.
