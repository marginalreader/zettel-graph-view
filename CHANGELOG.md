# Changelog

## 0.2.0 — 2026-05-02

### Export outline
- New top-bar **Export outline** button (disabled until a node is locked as the anchor).
- Creates `<outlineExportFolder>/Outline - <anchor title>.md` with an H1 title and a flat bullet list — `[[anchor]]` first, then `[[wikilinks]]` to each 1-hop neighbor.
- Output folder defaults to `09 - QUICK ACCESS` and is configurable via the `outlineExportFolder` plugin setting.
- Opens the new note in an adjacent split-view automatically.

### Folder root nodes (mindmap-style collapse/expand)
- New **"Show folder roots"** toggle in the Filters panel (off by default; saved per view).
- When on, the graph collapses into one synthetic **hub per top-level folder** with a count appended (e.g. `100 - ZETTELKASTEN (87)`).
- Inter-folder wikilinks **aggregate into hub-to-hub edges** with weight = total connections, so folder-level structure is visible at a glance.
- **Single-click a hub** → expand the folder; child notes appear orbiting the hub via synthetic spokes; cross-folder wikilinks auto-rewrite to point at collapsed neighboring hubs. Click again to collapse.
- **Double-click a hub** → opens the most-recently-changed note in that folder.
- Camera **auto-centers on the clicked hub** after each expand/collapse.
- Orphan filter (`Hide` / `Only` orphans) classifies based on real wikilink degree — synthetic folder edges don't mask true orphans.
- Layout uses gentle X/Y center forces so collapsed hubs cluster near the middle instead of drifting to the corners.

### Nested folder filter
- The Filters panel now renders the **full folder tree**, not just top-level folders. Each folder has a `▸ / ▾` triangle to expand/collapse its subfolders.
- **Hierarchical exclusion**: unchecking a folder hides its notes *and* every descendant. Re-checking a subfolder under an unchecked parent re-includes both. Toggling a parent propagates to every descendant.
- The `All` / `None` buttons act on every folder in the tree.
- Saved views round-trip the tree's exact selection state.

### Plumbing
- Each node now carries a full `folderPath` field; the filter logic walks the ancestor chain to decide visibility.
- Filter UI re-renders on every change so checkbox state always matches `excludedFolders`.

## 0.1.0 — 2026-05-01

### Graph
- Force-directed graph of all project notes (calendar notes opt-in via setting).
- Edges from `[[wikilinks]]`.
- Drag, zoom, pan; hover highlights node + 1-hop neighbors.
- **Single-click locks + camera-centers** on a node; locked node renders as a hollow accent-bordered circle. Click background or same node to unlock.
- **Double-click opens** the note in the editor.
- Color by top-level folder; node radius scales with degree; label visibility gated by zoom level.

### Filters
- Per-folder checkboxes with All / None buttons (top-level folders only — see v0.2 for nested).
- Tri-state Orphans selector: Show all / Hide orphans / Only orphans.
- System-level excluded folders (`@Templates`, `@Archive`, `@Trash`, `@Plugins`) always apply, even on top of saved-view filters.

### Saved views
- Each saved view is its own note in `@Plugins/Zettel Graph/Views/`.
- Save modal shows the captured anchor before commit.
- View config (filters + appearance + anchor) stored as JSON in a fenced body block — sidesteps NotePlan's nested-frontmatter quirks.
- Manage modal: Set default / Delete.
- Delete is idempotent: flips `graphView: true → false` flag *and* moves to `@Trash`; response list always excludes the deleted filename.
- Default view stored as a NotePlan preference (`graphView_defaultViewFilename`); auto-applies on panel open and survives app restart.
- Filter UI re-syncs to the loaded view's filters on every load — dropdown and checkboxes always reflect actual state.

### Plumbing
- jgclark-style multi-file rollup build (`src/` → `script.js` + `webview-bundle.js`); D3 v7 bundled as a sibling root file.
- Sidebar-pinnable via `sidebarView` declaration on the primary command.
- Dark-mode-aware via CSS tokens + `prefers-color-scheme` media query.
