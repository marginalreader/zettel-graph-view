# Zettel Graph View — v1.0 Release Notes

**Release Date:** May 17, 2026  
**Plugin ID:** marginalreader.ZettelGraphView  
**Author:** Marginal Reader  
**Minimum NotePlan Version:** 3.20.1

---

## Overview

Zettel Graph View is a NotePlan plugin that brings an Obsidian-style graph view to your vault, plus the ability to save and recall different views of that graph. Built for Zettelkasten workflows where the same notes are browsed through many different lenses — permanent notes only, this month's literature, a single project's neighborhood — it provides an interactive force-directed graph docked inside NotePlan's main window.

---

## Features

### Graph Panel
- **Auto-discovered nodes** — every project note in your vault appears as a node automatically. No indexing step, no configuration.
- **Force-directed layout** — D3-powered simulation with charge, link, and centering forces. Nodes settle into a natural arrangement and respond to drag.
- **Wikilink edges** — connections are pulled from `[[wikilinks]]` between notes. Edge thickness scales with the number of links between two notes.
- **Degree-based node sizing** — heavily-linked notes appear larger so hub notes are visible at a glance.
- **Color by folder** — each top-level folder gets a distinct color, making cluster structure immediately legible.
- **Hover highlight** — hovering a node dims the rest of the graph and highlights the node plus its direct neighbors.
- **Click to focus** — single-click any node to lock focus on it. The camera pans and zooms to center the node, 1-hop neighbors stay highlighted, and the rest of the graph dims. Click the locked node or the background to release the lock.
- **Double-click to open** — double-click any node to open that note in the NotePlan editor.
- **Drag** — reposition any node by dragging. The simulation re-settles around your changes.
- **Zoom & pan** — mouse wheel + background drag on desktop, pinch + two-finger pan on iOS.

### Saved Views
- **Save current view** — capture the current filters, appearance, and locked-node anchor, then give it a name. Each saved view is stored as its own note in the configured saved-views folder, so views sync across devices via iCloud and can be favorited in NotePlan's sidebar. Loading a view re-applies its filters and re-focuses on the saved anchor.
- **View picker** — switch between saved views with a single click in the top bar dropdown.
- **Default view** — mark one view to load automatically when the panel opens.
- **Manage views** — rename or delete any saved view from a small modal.

### Filter Bar
- **Folder filter** — multi-select tree of folders to include or exclude from the graph.
- **Orphan mode** — three-way switch: Show all, Hide orphans, or Only orphans. "Only orphans" is useful for finding notes that need linking.
- **Live filtering** — graph re-renders as you adjust. No "apply" button.

### Folder Roots Mode
- **Toggle in the filter panel** — collapses each top-level folder into a single hub node labeled with the folder name and note count.
- **Aggregated edges** — wikilinks between notes in different folders become weighted hub-to-hub edges, so the inter-folder structure of your vault is visible at a glance.
- **Click a hub to expand** — the folder's child notes appear alongside the hub, connected by spoke edges. Click again to collapse.
- **Double-click a hub** — opens the most-recently-changed note in that folder.

### Export Outline
- **Locked-node export** — with a node locked (single-click), click the Export Outline button in the top bar to generate a new note containing the anchor and all its 1-hop neighbors as `[[wikilink]]` bullets.
- **Folder picker** — choose where the new outline note lives. The configured default folder is pinned to the top of the picker.
- **Opens in split view** — the new outline note opens beside your existing note for immediate editing.

### Design
- Docked inside NotePlan's main window — no floating windows
- Sidebar-pinnable — pin the graph to NotePlan's sidebar for one-click access
- Dark mode support — auto-detects NotePlan's current theme
- Mobile-friendly — touch targets sized for iPhone and iPad
- Clean, minimal UI consistent with NotePlan's aesthetic

---

## Edge Sources

| Source | How it works |
|---|---|
| `[[wikilinks]]` | Read from `note.linkedItems` — every wikilink between two notes creates an edge |

---

## Plugin Settings

| Setting | Default | Description |
|---|---|---|
| `includeCalendarNotes` | `false` | Include daily/weekly/etc. notes as nodes in the graph |
| `excludedFolders` | `["@Templates", "@Archive", "@Trash", "@Plugins"]` | Folders never scanned |
| `savedViewsFolder` | `@Plugins/Zettel Graph View/Views` | Folder where saved-view notes are stored |
| `outlineExportFolder` | `09 - QUICK ACCESS` | Folder pinned to the top of the picker when exporting an outline |
| `defaultLinkDistance` | `60` | D3 force link distance |
| `defaultChargeStrength` | `-200` | D3 charge force strength |
| `nodeRadiusMin` | `4` | Smallest node radius |
| `nodeRadiusMax` | `20` | Largest node radius |
| `labelZoomThreshold` | `1.0` | Zoom level below which node labels are hidden to reduce clutter |

---

## Known Limitations

- **No focus mode yet** — can't restrict the graph to a single note's n-hop neighborhood. Planned for a future version.
- **Co-tag and co-mention edges not supported** — only `[[wikilinks]]` count as connections in this version.
- **SVG renderer only** — vaults with more than ~2,000 nodes may see slowdown. A canvas renderer is planned for larger vaults.
- **Graph snapshots at panel open time** — adding or linking notes while the panel is open requires hitting refresh to see the new state.

---

## Commands

| Command | Alias | Description |
|---|---|---|
| `/zettel graph view` | `graph`, `gv`, `zgv` | Open the graph panel |
| `/zettel graph view: load view` | `load view` | Load a saved view by filename (typically invoked by the callback URL in a saved-view note) |
| `/zettel graph view: save view` | `save view` | Save the current filters and appearance as a named view |
| `/zettel graph view: refresh` | `regraph` | Force a full rescan of the vault and redraw the graph |

---

*Built by Marginal Reader with Claude — May 2026*
