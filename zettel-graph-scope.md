# Zettel Graph Plugin — Scoping Document

**Plugin ID (proposed):** `user.zettel-graph`
**Min NotePlan Version:** 3.20.1 (required for `HTMLView.showInMainWindow` + sidebar pinning)
**Build target:** macOS + iOS, docked inside the NotePlan main window
**Sibling plugin:** Role Focus (`user.role-focus`) — same UX pattern (docked HTML panel)

---

## Goal

Replicate Obsidian-style graph view inside NotePlan, plus add a "Saved Views" feature that lets you snapshot a filtered/positioned graph and recall it instantly. Useful for Zettelkasten work where the same vault is browsed through many different lenses (e.g. "Permanent notes only", "This month's literature notes", "Project Atlas neighborhood").

---

## NotePlan API — relevant pieces

These are the surfaces the plugin will use. Confirmed from NotePlan's JS API docs and the `EduardMe` API gists.

### Reading graph data
- `DataStore.projectNotes` — `[NoteObject]`, every regular note in the vault
- `DataStore.calendarNotes` — `[NoteObject]`, every daily/weekly/monthly/etc. note
- `note.linkedItems` (v3.2+) — paragraphs in `note` that link to other (non-day) notes
- `note.backlinks` — paragraphs from other notes pointing at `note` (use this OR derive yourself)
- `note.hashtags` — `[String]`, e.g. `["#zettel", "#permanent"]`
- `note.mentions` — `[String]`, e.g. `["@sasha", "@reading"]`
- `note.frontmatterAttributes` — `{key: value}` for frontmatter-driven filters
- `note.title`, `note.filename`, `note.type` — for node identity/display

### Rendering UI
- `HTMLView.showInMainWindow(html, title, options)` (v3.20+) — docks an HTML panel inside the main window. This is what Role Focus uses.
- `sidebarView` config in `plugin.json` (v3.20.1+) — lets the user pin the command to the sidebar. Set `windowID`, `title`, `icon`, `iconColor`.
- WebKit message handlers — HTML side calls back into NotePlan via `window.webkit.messageHandlers.jsBridge.postMessage(...)` (the same pattern Role Focus uses).

### Persistence
- `DataStore.settings` — read/write the plugin's settings JSON. Saved Views live here as a JSON array (no separate file required).

### Navigation
- `Editor.openNoteByFilename(filename)` — clicking a node in the graph opens that note in the editor.
- `Editor.highlightByIndex(start, length)` — optional, for jumping to a line.

---

## Architecture

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│   script.js (plugin core)   │         │  webview/index.html      │
│                             │         │                          │
│   buildGraph()  ───────────────────►  │  receives JSON           │
│   (scans all notes,          │  HTML  │  renders graph (D3)      │
│    builds nodes + edges)    │  string │  handles UI events       │
│                             │         │                          │
│   handleMessage()  ◄──────────── postMessage ────  click/save/   │
│   (open note, save view,    │         │           load view      │
│    delete view, refresh)    │         │                          │
└─────────────────────────────┘         └──────────────────────────┘
        ▲                                          │
        │  DataStore.settings (saved views JSON)   │
        └──────────────────────────────────────────┘
```

Two halves: a Node-side `script.js` that has access to `DataStore` and the editor, and a webview HTML/JS bundle that does all the graph rendering and interaction. They talk via `postMessage` in both directions — same pattern as Role Focus.

---

## Data Model

### Node
```ts
type Node = {
  id: string;            // filename (unique, stable, used as graph id)
  title: string;         // display label
  type: "project" | "calendar";
  folder: string;        // top-level folder, e.g. "Zettel/Permanent"
  hashtags: string[];    // for color/filter
  mentions: string[];    // for color/filter
  frontmatter: Record<string, string>;
  degree: number;        // computed: edge count, used for node size
  createdAt?: string;    // optional, for time-based filtering
};
```

### Edge
```ts
type Edge = {
  source: string;   // filename
  target: string;   // filename
  weight: number;   // count of links between the two notes (>=1)
};
```

### Saved View
```ts
type SavedView = {
  id: string;                       // uuid
  name: string;                     // user-given
  createdAt: string;                // iso
  filters: {
    folders?: string[];             // include only these top-level folders
    folderMode?: "include" | "exclude";
    hashtags?: string[];            // include only nodes with these tags
    mentions?: string[];
    nodeTypes?: ("project" | "calendar")[];
    excludeOrphans?: boolean;       // hide nodes with degree 0
    minDegree?: number;
  };
  appearance: {
    colorBy: "folder" | "hashtag" | "mention" | "none";
    showLabels: "always" | "hover" | "neighbors-only";
    linkDistance?: number;
    chargeStrength?: number;
  };
  focus?: {
    centerNodeId?: string;          // if set, render only n-hop neighborhood
    depth?: number;                 // 1, 2, 3...
  };
  layout?: {
    pinned: { id: string; x: number; y: number }[];  // remembered positions
    zoom: number;
    pan: { x: number; y: number };
  };
};
```

Saved views are stored as a JSON array in `DataStore.settings.savedViews`. The active/default view is `DataStore.settings.defaultViewId`.

---

## Features

### Graph Tab (default)

- **Force-directed layout** — D3's `forceSimulation` (charge + link + center forces).
- **Nodes** — circles, sized by degree, colored by current `colorBy` rule.
- **Edges** — straight lines, opacity scaled by edge weight.
- **Labels** — title shown next to node per `showLabels` rule.
- **Hover** — highlight node + 1-hop neighbors, dim everything else.
- **Click** — opens the note in the NotePlan editor (via `postMessage`).
- **Drag** — manually reposition a node; positions can be saved with the view.
- **Zoom & pan** — mouse wheel + drag on background, or pinch on iOS.
- **Focus mode** — double-click a node to switch to its n-hop neighborhood (depth configurable).
- **Auto-detect dark mode** — match NotePlan's current theme.

### Saved Views Tab / Dropdown

- **View dropdown in top bar** — shows all saved views, plus "Save current as…" and "Manage views…".
- **Save current view** — captures current filters, appearance, focus, and node positions; prompts for a name.
- **Load view** — applies filters and re-runs the simulation; restores pinned positions if present.
- **Update / Rename / Delete** — manage views from a small modal.
- **Default view** — one view can be marked default; loads on panel open.

### Filter Bar

- **Folder picker** — multi-select tree of folders.
- **Hashtag picker** — multi-select chips of all hashtags in the vault.
- **Mention picker** — multi-select chips of all mentions.
- **Hide orphans** toggle.
- **Min degree** slider.

### Edge Sources (configurable in settings)

What counts as a connection between two notes? Each toggle is in `plugin.settings`:

| Source | Default | Notes |
|---|---|---|
| `[[wikilinks]]` | on | The primary edge type. Read from `note.linkedItems`. |
| `>date` references to/from calendar notes | on | Read from `note.datedTodos`; creates note → calendar-note edges. |
| Shared `#hashtags` (>= N) | off | Optional "co-tag" edges. Heavy — keep off by default. |
| Shared `@mentions` (>= N) | off | Same caveat as hashtags. |

---

## Plugin Settings (`plugin.json` → `plugin.settings`)

| Setting | Default | Description |
|---|---|---|
| `includeCalendarNotes` | `true` | Show daily/weekly/etc. notes as nodes |
| `excludedFolders` | `["@Templates", "@Archive", "@Trash"]` | Folders never scanned |
| `coTagEdges` | `false` | Create edges between notes sharing >= N hashtags |
| `coTagThreshold` | `2` | N for the rule above |
| `defaultColorBy` | `"folder"` | Initial color rule for new views |
| `defaultLinkDistance` | `60` | D3 force link distance |
| `defaultChargeStrength` | `-200` | D3 charge force strength |
| `nodeRadiusMin` | `4` | Smallest node radius |
| `nodeRadiusMax` | `20` | Largest node radius |

---

## Commands

| Command | Alias | Description |
|---|---|---|
| `/zettel graph` | `graph`, `zg` | Open the graph panel |
| `/zettel graph: save view` | `save view` | Save the current view (also available in panel) |
| `/zettel graph: load view` | `load view` | Open the view picker (also available in panel) |
| `/zettel graph: refresh` | `regraph` | Force a full rescan and redraw |

The first command should declare `sidebarView` so the user can pin the graph to NotePlan's sidebar.

---

## File Layout

```
user.zettel-graph/
├── plugin.json
├── README.md
├── src/
│   ├── index.js              # Plugin entry: command handlers + showWindow
│   ├── buildGraph.js         # Scans DataStore, builds nodes+edges
│   ├── savedViews.js         # CRUD over DataStore.settings.savedViews
│   ├── messageBridge.js      # postMessage routing both ways
│   └── webview/
│       ├── index.html        # Webview shell
│       ├── graph.js          # D3 force simulation + render
│       ├── ui.js             # Top bar, filter chips, view dropdown
│       └── styles.css        # Theme-aware styling
├── requiredFiles/            # NotePlan looks here for static assets
│   └── d3.min.js             # D3 v7 bundled, ~280KB
└── script.js                 # Compiled output (rollup → committed for release)
```

---

## Tech Stack — Decisions & Rationale

- **Graph library: D3 v7 force simulation.** Smaller and more flexible than Cytoscape for a custom-themed view, and the data shape matches D3 idioms exactly. Bundle locally into `requiredFiles/` rather than CDN — the WebView in NotePlan can be flaky with external network on iOS.
- **Build tooling: stick with NotePlan's standard rollup setup** (`npc plugin:create` scaffolds it). Don't introduce React/Vue — the Role Focus plugin is plain JS for the webview and that's worked well.
- **Node 16** for build (NotePlan plugin tooling hasn't migrated past 16 yet — use `n` or `nvm` to switch if your dev machine is on a newer Node).
- **No frameworks in the webview.** Vanilla JS modules. Keeps the plugin small and avoids a build-config rabbit hole inside the webview half.

---

## Performance Considerations

A Zettelkasten vault can easily have 1,000+ notes and 10,000+ edges. Things to plan for:

- **Initial scan is the expensive part.** Cache the graph in memory after first build; only rebuild on explicit refresh, on note save (if a `noteHasChanged` trigger is wired), or after N minutes.
- **Force simulation cost is O(n²) by default.** Use D3's quadtree (`forceManyBody().theta(0.9)`) and cap simulation iterations (`alphaDecay(0.05)`) on first paint.
- **Don't render labels for every node at every zoom level.** Hide labels under a zoom threshold or a degree threshold.
- **Edges are usually the bottleneck.** Render with canvas, not SVG, if the vault is >2k nodes. Start with SVG (simpler, easier to style); fall back to canvas if it lags.

---

## v0.1 MVP Scope

Build this first, ship, then iterate.

### In
- Force-directed graph of all project notes + calendar notes
- Edges from `[[wikilinks]]` only (no co-tag/co-mention edges in v0.1)
- Hover highlight, click-to-open, drag, zoom, pan
- Color by folder
- Filter bar: folder picker + hide-orphans toggle
- Saved views: save / load / delete (filter + appearance only — no pinned positions yet)
- Dark mode
- Sidebar-pinnable

### Out (future)
- Node-position persistence in saved views
- Co-tag and co-mention edges
- Focus mode (n-hop neighborhood)
- Local graph view (centered on currently open note)
- Time-based filters / animation across creation dates
- Canvas renderer for very large vaults

---

## Open Questions

These are worth deciding before Claude Code starts. None block the architecture.

1. **Should daily/weekly notes be hidden by default?** A vault with years of dailies makes the graph noisy. Default to `includeCalendarNotes: false` and let the user opt in?
2. **Plugin name.** "Zettel Graph"? "Graph View"? "Notes Graph"? Naming affects the command and ID.
3. **Public release?** If you want this in NotePlan's public plugin registry, the ID convention is `firstname.PluginName` rather than `user.something`. Decide now to avoid renaming later.
4. **Saved views as JSON only, or also exportable to a note?** A "View → Export to note" option would let saved views travel with the vault across devices via iCloud sync of the note itself, which might be more reliable than `DataStore.settings`.

---

## Recommended Build Order (for Claude Code)

1. **Scaffold** — `npc plugin:create`, set `plugin.id`, `minAppVersion: "3.20.1"`, declare commands and `sidebarView`.
2. **`buildGraph.js`** — pure function: takes `DataStore`-style input, returns `{nodes, edges}`. Unit-testable in isolation.
3. **`webview/index.html` + `graph.js`** — get a static graph rendering from a hardcoded JSON blob. Verify D3 force layout, zoom, drag.
4. **Bridge** — wire `script.js` → webview (initial graph payload) and webview → `script.js` (open note on click).
5. **Filter bar** — folder picker + hide-orphans. Live re-render.
6. **Saved views** — schema, CRUD, dropdown, "Save current as…" prompt.
7. **Settings** — wire `plugin.json → plugin.settings` to actual behavior.
8. **Polish** — dark mode, label thresholds, performance tuning, README.

---

## Reference Links

- NotePlan plugin tooling: https://github.com/NotePlan/plugins
- Plugin authoring guide: https://help.noteplan.co/article/67-create-command-bar-plugins
- JS API overview: https://help.noteplan.co/article/70-javascript-plugin-api
- NoteObject API gist: https://gist.github.com/EduardMe/b67ea33750c34a9f4d93aba3857fdb5e
- Editor API gist: https://gist.github.com/EduardMe/e433cf31efd30a88d30989ef749c3772
- v3.20 release (HTMLView.showInMainWindow + sidebarView): https://noteplan.co/changelog/v3.20

---

*Scoping doc — ready for Claude Code handoff.*
