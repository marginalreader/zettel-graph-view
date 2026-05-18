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
- **Click to open** — single-click any node to open that note in the NotePlan editor.
- **Drag** — reposition any node by dragging. The simulation re-settles around your changes.
- **Zoom & pan** — mouse wheel + background drag on desktop, pinch + two-finger pan on iOS.

### Saved Views
- **Save current view** — capture the current filters and appearance, give it a name. Each saved view is stored as its own note in the configured saved-views folder, so views sync across devices via iCloud and can be favorited in NotePlan's sidebar.
- **View picker** — switch between saved views with a single click in the top bar dropdown.
- **Default view** — mark one view to load automatically when the panel opens.
- **Manage views** — rename or delete any saved view from a small modal.

### Filter Bar
- **Folder filter** — multi-select tree of folders to include or exclude from the graph.
- **Hide orphans** — toggle to remove nodes with no connections.
- **Live filtering** — graph re-renders as you adjust. No "apply" button.

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
| `>date` references | Optional — creates note → calendar-note edges from scheduled tasks (off by default; toggle in settings) |

---

## Plugin Settings

| Setting | Default | Description |
|---|---|---|
| `includeCalendarNotes` | `false` | Include daily/weekly/etc. notes as nodes in the graph |
| `excludedFolders` | `["@Templates", "@Archive", "@Trash"]` | Folders never scanned |
| `savedViewsFolder` | `@Plugins/Zettel Graph View/Views` | Folder where saved-view notes are stored |
| `defaultColorBy` | `folder` | Initial color rule for new views |
| `defaultLinkDistance` | `60` | D3 force link distance |
| `defaultChargeStrength` | `-200` | D3 charge force strength |
| `nodeRadiusMin` | `4` | Smallest node radius |
| `nodeRadiusMax` | `20` | Largest node radius |

---

## Known Limitations

- **Node positions don't persist with saved views yet** — manually-dragged positions reset to the force simulation's layout on reload. Position persistence is planned for the next version.
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
