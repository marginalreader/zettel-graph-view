/* eslint-env noteplan */
/* global DataStore */

import { getSettings } from './settings.js'

export function buildGraph(opts = {}) {
  const settings = getSettings()
  const includeCalendar =
    opts.includeCalendarNotes !== undefined
      ? opts.includeCalendarNotes
      : settings.includeCalendarNotes === true
  // System-level exclusions from settings always apply. View-level excludedFolders
  // (from a saved view's filters or the live filter UI) layer on top, so unchecking
  // a folder in the picker can never accidentally re-include @Templates etc.
  const systemExcluded = Array.isArray(settings.excludedFolders) && settings.excludedFolders.length
    ? settings.excludedFolders
    : ['@Templates', '@Archive', '@Trash', '@Plugins']
  const viewExcluded = Array.isArray(opts.excludedFolders) ? opts.excludedFolders : []
  const excludedFolders = [...new Set([...systemExcluded, ...viewExcluded])]
    .map(f => String(f).replace(/\/$/, ''))
  const includeFolders = Array.isArray(opts.includeFolders) && opts.includeFolders.length > 0 ? opts.includeFolders : null
  const excludeOrphans = opts.excludeOrphans === true

  const projectNotes = DataStore.projectNotes || []
  const calendarNotes = includeCalendar ? (DataStore.calendarNotes || []) : []
  const allNotes = projectNotes.concat(calendarNotes)

  const isExcluded = filename =>
    excludedFolders.some(folder => filename === folder || filename.startsWith(folder + '/'))
  const matchesIncluded = filename => {
    if (!includeFolders) return true
    return includeFolders.some(folder => filename === folder || filename.startsWith(folder + '/'))
  }

  const nodes = new Map()
  const titleIndex = new Map() // lowercase title → filename
  for (const note of allNotes) {
    if (!note || !note.filename) continue
    if (isExcluded(note.filename)) continue
    if (!matchesIncluded(note.filename)) continue
    const folderPath = note.filename.includes('/') ? note.filename.slice(0, note.filename.lastIndexOf('/')) : ''
    const topLevel = folderPath.split('/')[0] || (note.type === 'Calendar' ? 'Calendar' : '(root)')
    nodes.set(note.filename, {
      id: note.filename,
      title: note.title || note.filename.replace(/\.(md|txt)$/, ''),
      type: note.type === 'Calendar' ? 'calendar' : 'project',
      folder: topLevel,
      folderPath: folderPath || topLevel,
      hashtags: Array.isArray(note.hashtags) ? note.hashtags : [],
      mentions: Array.isArray(note.mentions) ? note.mentions : [],
      degree: 0,
    })
    const t = (note.title || '').toLowerCase().trim()
    if (t && !titleIndex.has(t)) titleIndex.set(t, note.filename)
  }

  const edges = new Map()
  const wikilinkRe = /\[\[([^\]|#^]+)(?:[|#^][^\]]*)?\]\]/g
  for (const note of allNotes) {
    if (!note || !note.filename) continue
    if (!nodes.has(note.filename)) continue
    const sourceFn = note.filename
    const seenInThisNote = new Set()

    const linkedItems = note.linkedItems || []
    for (const para of linkedItems) {
      let targetFn = null
      if (para && para.referencedNote && para.referencedNote.filename) {
        targetFn = para.referencedNote.filename
      }
      if (!targetFn && para && typeof para.content === 'string') {
        wikilinkRe.lastIndex = 0
        let m
        while ((m = wikilinkRe.exec(para.content)) !== null) {
          const lookup = m[1].trim().toLowerCase()
          const fn = titleIndex.get(lookup)
          if (fn) addEdge(sourceFn, fn, edges, nodes, seenInThisNote)
        }
        continue
      }
      if (targetFn) addEdge(sourceFn, targetFn, edges, nodes, seenInThisNote)
    }
  }

  for (const node of nodes.values()) node.degree = 0
  for (const edge of edges.values()) {
    const a = nodes.get(edge.source)
    const b = nodes.get(edge.target)
    if (a) a.degree += edge.weight
    if (b) b.degree += edge.weight
  }

  let nodeList = [...nodes.values()]
  if (excludeOrphans) {
    const keep = new Set(nodeList.filter(n => n.degree > 0).map(n => n.id))
    nodeList = nodeList.filter(n => keep.has(n.id))
    for (const key of [...edges.keys()]) {
      const e = edges.get(key)
      if (!keep.has(e.source) || !keep.has(e.target)) edges.delete(key)
    }
  }

  return { nodes: nodeList, edges: [...edges.values()] }
}

function addEdge(sourceFn, targetFn, edges, nodes, seenInThisNote) {
  if (!targetFn || sourceFn === targetFn) return
  if (!nodes.has(targetFn)) return
  const [a, b] = sourceFn < targetFn ? [sourceFn, targetFn] : [targetFn, sourceFn]
  const key = a + '::' + b
  // Within one note, count multiple links to the same target as 1 (idempotent per scan).
  // Across notes, increment weight (mutual links).
  const seenKey = sourceFn + '|' + key
  if (seenInThisNote.has(seenKey)) return
  seenInThisNote.add(seenKey)
  const existing = edges.get(key)
  if (existing) existing.weight += 1
  else edges.set(key, { source: a, target: b, weight: 1 })
}

export function collectTopLevelFolders(nodes) {
  const set = new Set()
  for (const n of nodes) set.add(n.folder)
  return [...set].sort()
}

export function collectFolderTree(nodes) {
  const root = new Map()
  for (const n of nodes) {
    const path = n.folderPath || n.folder
    if (!path) continue
    const parts = path.split('/')
    let parent = root
    let acc = ''
    for (const part of parts) {
      acc = acc ? acc + '/' + part : part
      if (!parent.has(part)) {
        parent.set(part, { name: part, path: acc, children: new Map() })
      }
      parent = parent.get(part).children
    }
  }
  const toArray = (map) =>
    [...map.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(n => ({ name: n.name, path: n.path, children: toArray(n.children) }))
  return toArray(root)
}
