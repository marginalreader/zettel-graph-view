/* eslint-env noteplan */
/* global DataStore */

import { buildGraph } from './buildGraph.js'
import { pushToPanel } from './messageBridge.js'
import { getDefaultViewFilename, getSavedViewsFolder, setDefaultViewFilename } from './settings.js'

const PREF_LAST_VIEW = 'graphView_lastViewFilename'

export function listSavedViews() {
  const folder = getSavedViewsFolder()
  const defaultFn = getDefaultViewFilename()
  const notes = DataStore.projectNotes || []
  return notes
    .filter(n => n && n.filename && n.filename.startsWith(folder + '/'))
    .filter(n => {
      const fm = n.frontmatterAttributes || {}
      return fm.graphView === true || fm.graphView === 'true'
    })
    .map(n => ({
      filename: n.filename,
      name: n.title || n.filename,
      isDefault: n.filename === defaultFn,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function readSavedViewNote(filename) {
  if (!filename) return null
  const note = (DataStore.projectNotes || []).find(n => n.filename === filename)
  if (!note) return null
  const fm = note.frontmatterAttributes || {}
  console.log('readSavedViewNote: ' + filename + ' fmKeys=' + JSON.stringify(Object.keys(fm)))

  // Primary: body fenced ```json block. Most reliable — NotePlan doesn't touch body content.
  let cfg = extractBodyJson(note.content || '')
  let source = cfg ? 'body' : null

  // Fallback 1: frontmatter graphViewConfig (string OR pre-parsed object).
  if (!cfg) {
    const raw = fm.graphViewConfig
    const preview = typeof raw === 'string' ? raw.slice(0, 80) : JSON.stringify(raw || null).slice(0, 80)
    console.log('readSavedViewNote: graphViewConfig type=' + typeof raw + ' val=' + preview)
    if (typeof raw === 'string' && raw.length > 0) {
      try { cfg = JSON.parse(raw); source = 'fm-string' } catch (e) {
        console.log('readSavedViewNote: JSON parse failed: ' + e.message)
      }
    } else if (raw && typeof raw === 'object') {
      cfg = raw
      source = 'fm-object'
    }
  }

  // Fallback 2: legacy nested fm.filters / fm.appearance.
  if (!cfg && (fm.filters || fm.appearance)) {
    cfg = { filters: fm.filters, appearance: fm.appearance }
    source = 'fm-legacy'
  }

  if (!cfg) cfg = {}
  console.log('readSavedViewNote: source=' + source + ' cfgKeys=' + JSON.stringify(Object.keys(cfg)))

  return {
    filename: note.filename,
    name: note.title || filename,
    filters: normalizeFilters(cfg.filters),
    appearance: normalizeAppearance(cfg.appearance),
    focus: cfg.focus && typeof cfg.focus === 'object' ? cfg.focus : null,
    isDefault: fm.isDefault === true || fm.isDefault === 'true',
  }
}

function extractBodyJson(content) {
  if (!content) return null
  const m = content.match(/```json\s*\n([\s\S]*?)\n```/)
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch (e) {
    console.log('extractBodyJson: parse failed: ' + e.message)
    return null
  }
}

function normalizeFilters(raw) {
  const f = (raw && typeof raw === 'object') ? raw : {}
  let orphanMode = f.orphanMode
  if (orphanMode !== 'all' && orphanMode !== 'hide' && orphanMode !== 'only') {
    orphanMode = (f.excludeOrphans === true || f.excludeOrphans === 'true') ? 'hide' : 'all'
  }
  return {
    includeCalendarNotes: f.includeCalendarNotes === true || f.includeCalendarNotes === 'true',
    includeFolders: Array.isArray(f.includeFolders) ? f.includeFolders.slice() : null,
    excludedFolders: Array.isArray(f.excludedFolders) ? f.excludedFolders.slice() : null,
    orphanMode,
    excludeOrphans: orphanMode === 'hide',
    showFolderRoots: f.showFolderRoots === true || f.showFolderRoots === 'true',
  }
}

function normalizeAppearance(raw) {
  const a = (raw && typeof raw === 'object') ? raw : {}
  return {
    colorBy: a.colorBy || 'folder',
    showLabels: a.showLabels || 'hover',
    linkDistance: a.linkDistance != null ? Number(a.linkDistance) : null,
    chargeStrength: a.chargeStrength != null ? Number(a.chargeStrength) : null,
  }
}

function sanitizeName(name) {
  return String(name || 'View').replace(/[\/\\:*?"<>|]/g, '_').trim().slice(0, 80) || 'View'
}

function toYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent)
  const lines = []
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`)
      } else if (value.every(v => typeof v !== 'object' || v === null)) {
        lines.push(`${pad}${key}: [${value.map(v => yamlScalar(v)).join(', ')}]`)
      } else {
        lines.push(`${pad}${key}:`)
        for (const item of value) lines.push(`${pad}- ${yamlScalar(item)}`)
      }
    } else if (typeof value === 'object') {
      lines.push(`${pad}${key}:`)
      lines.push(toYaml(value, indent + 1))
    } else {
      lines.push(`${pad}${key}: ${yamlScalar(value)}`)
    }
  }
  return lines.join('\n')
}

function yamlScalar(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  const s = String(v)
  if (s === '' || /[:#\-?{}\[\],&*!|>'"%@`\n]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s)
  }
  return s
}

export function buildSavedViewMarkdown(name, filters, appearance, focus, viewFilename) {
  const cfgJson = JSON.stringify(
    { filters: filters || {}, appearance: appearance || {}, focus: focus || null },
    null,
    2,
  )
  const fm = {
    title: name,
    graphView: true,
    graphViewVersion: 1,
    isDefault: false,
    createdAt: new Date().toISOString(),
  }
  const yaml = toYaml(fm)
  const cmd = encodeURIComponent('graph view: load view')
  const arg = encodeURIComponent(viewFilename)
  const callback = `noteplan://x-callback-url/runPlugin?pluginID=ryan.graph-view&command=${cmd}&arg0=${arg}`
  return (
    `---\n${yaml}\n---\n\n` +
    `# ${name}\n\n` +
    `Saved view for the Graph View plugin.\n\n` +
    '```json\n' +
    cfgJson +
    '\n```\n\n' +
    `[Load this view](${callback})\n`
  )
}

export async function handleSaveView(paramsStr) {
  const { name, filters, appearance, focus } = JSON.parse(paramsStr)
  const folder = getSavedViewsFolder()
  const safeName = sanitizeName(name)
  const predictedFn = `${folder}/${safeName}.md`
  const md = buildSavedViewMarkdown(safeName, filters, appearance, focus, predictedFn)
  // eslint-disable-next-line no-undef
  const newFn = await DataStore.newNoteWithContent(md, folder)
  const finalFn = newFn || predictedFn
  if (newFn && newFn !== predictedFn) {
    const note = (DataStore.projectNotes || []).find(n => n.filename === newFn)
    if (note) {
      const fixed = md.replace(encodeURIComponent(predictedFn), encodeURIComponent(newFn))
      try { note.content = fixed } catch (e) { console.log('handleSaveView: rewrite failed: ' + e.message) }
    }
  }
  // DataStore.projectNotes does not always include the just-created note synchronously,
  // so fold it in manually to keep the picker fresh.
  const indexed = listSavedViews()
  const present = indexed.some(v => v.filename === finalFn)
  const merged = present
    ? indexed
    : indexed
        .concat([{ filename: finalFn, name: safeName, isDefault: false }])
        .sort((a, b) => a.name.localeCompare(b.name))
  await pushToPanel('viewSaved', { savedViews: merged, filename: finalFn })
}

export async function handleLoadView(paramsStr) {
  const { filename } = JSON.parse(paramsStr)
  const view = readSavedViewNote(filename)
  if (!view) {
    await pushToPanel('error', { message: 'View not found: ' + filename })
    return
  }
  console.log('handleLoadView: ' + filename + ' filters=' + JSON.stringify(view.filters) + ' focus=' + JSON.stringify(view.focus))
  const graph = buildGraph(view.filters)
  console.log('handleLoadView: built graph nodes=' + graph.nodes.length + ' edges=' + graph.edges.length)
  try { DataStore.setPreference(PREF_LAST_VIEW, filename) } catch (e) { /* ignore */ }
  await pushToPanel('viewLoaded', {
    filename,
    filters: view.filters,
    appearance: view.appearance,
    focus: view.focus,
    graph,
  })
}

export async function handleDeleteView(paramsStr) {
  const { filename } = JSON.parse(paramsStr)
  console.log('handleDeleteView: ' + filename)
  const note = (DataStore.projectNotes || []).find(n => n.filename === filename)
  if (!note) {
    console.log('handleDeleteView: note not found in DataStore.projectNotes')
  } else {
    // Always soft-delete first — flip the graphView flag so the note is excluded from
    // listSavedViews regardless of whether moveNote actually relocates the file.
    try {
      const original = note.content || ''
      const flipped = original.replace(/^graphView:\s*true\s*$/m, 'graphView: false')
      if (flipped !== original) {
        note.content = flipped
        console.log('handleDeleteView: flipped graphView flag')
      } else {
        console.log('handleDeleteView: graphView flag not found in content')
      }
    } catch (e) {
      console.log('handleDeleteView: content rewrite failed: ' + e.message)
    }
    // Then try to move to @Trash (best effort).
    if (typeof DataStore.moveNote === 'function') {
      try {
        const result = DataStore.moveNote(note.filename, '@Trash')
        console.log('handleDeleteView: moveNote returned ' + JSON.stringify(result))
      } catch (e) {
        console.log('handleDeleteView: moveNote threw: ' + e.message)
      }
    } else {
      console.log('handleDeleteView: DataStore.moveNote is not a function')
    }
  }
  if (getDefaultViewFilename() === filename) {
    setDefaultViewFilename('')
  }
  // Always exclude the deleted filename from the response — DataStore.projectNotes
  // doesn't always reflect the deletion synchronously.
  const merged = listSavedViews().filter(v => v.filename !== filename)
  await pushToPanel('viewDeleted', { savedViews: merged })
}

export async function handleSetDefaultView(paramsStr) {
  const { filename } = JSON.parse(paramsStr)
  setDefaultViewFilename(filename || '')
  await pushToPanel('viewSaved', { savedViews: listSavedViews() })
}

export async function handleListViews() {
  await pushToPanel('viewSaved', { savedViews: listSavedViews() })
}

export async function handleApplyDefault() {
  const defaultFn = getDefaultViewFilename()
  console.log('handleApplyDefault: defaultViewFilename=' + JSON.stringify(defaultFn))
  if (!defaultFn) return
  const view = readSavedViewNote(defaultFn)
  if (!view) {
    console.log('handleApplyDefault: default view not found: ' + defaultFn)
    return
  }
  const graph = buildGraph(view.filters)
  await pushToPanel('viewLoaded', {
    filename: defaultFn,
    filters: view.filters,
    appearance: view.appearance,
    focus: view.focus,
    graph,
  })
}
