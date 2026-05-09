/* eslint-env noteplan */
/* global HTMLView, Editor, DataStore, CommandBar */

import { buildGraph } from './buildGraph.js'
import {
  handleSaveView,
  handleLoadView,
  handleDeleteView,
  handleListViews,
  handleSetDefaultView,
  handleApplyDefault,
} from './savedViews.js'
import { getSettings } from './settings.js'

const PANEL_WINDOW_ID = 'graph-view'

export async function pushToPanel(type, data) {
  const payload = Object.assign({ type }, data)
  const doubleStringified = JSON.stringify(JSON.stringify(payload))
  const jsCode =
    '(function() { try { var d = JSON.parse(' +
    doubleStringified +
    '); if (window.onPluginMessage) window.onPluginMessage(d); } catch(e) { console.log("pushToPanel error: " + e.message); } })()'
  await HTMLView.runJavaScript(jsCode, PANEL_WINDOW_ID)
}

async function handleOpenNote(paramsStr) {
  const { filename } = JSON.parse(paramsStr)
  if (!filename) return
  await Editor.openNoteByFilename(filename, false)
}

async function handleRefreshGraph(paramsStr) {
  const { filters } = JSON.parse(paramsStr)
  const graph = buildGraph(filters || {})
  await pushToPanel('graphData', { graph })
}

async function handleOpenFolder(paramsStr) {
  const { folder } = JSON.parse(paramsStr)
  if (!folder) return
  const allNotes = DataStore.projectNotes || []
  const inFolder = allNotes.filter(n =>
    n.filename === folder || n.filename.startsWith(folder + '/')
  )
  if (inFolder.length === 0) {
    console.log('handleOpenFolder: no notes in folder ' + folder)
    return
  }
  // Open the most-recently-changed note as a navigation anchor for that folder.
  inFolder.sort((a, b) => {
    const da = a.changedDate ? a.changedDate.getTime() : 0
    const db = b.changedDate ? b.changedDate.getTime() : 0
    return db - da
  })
  const target = inFolder[0]
  try {
    await Editor.openNoteByFilename(target.filename, false, 0, 0, false)
  } catch (e) {
    console.log('handleOpenFolder: open failed: ' + e.message)
  }
}

async function handleExportOutline(paramsStr) {
  const { anchorFilename, neighborFilenames } = JSON.parse(paramsStr)
  if (!anchorFilename) {
    console.log('handleExportOutline: missing anchorFilename')
    return
  }
  const allNotes = DataStore.projectNotes || []
  const anchor = allNotes.find(n => n.filename === anchorFilename)
  if (!anchor) {
    console.log('handleExportOutline: anchor not found: ' + anchorFilename)
    await pushToPanel('error', { message: 'Anchor note not found in vault.' })
    return
  }
  const anchorTitle = anchor.title || anchorFilename.replace(/\.(md|txt)$/, '')

  const neighbors = []
  for (const fn of neighborFilenames || []) {
    const note = allNotes.find(n => n.filename === fn)
    if (note) neighbors.push({ filename: note.filename, title: note.title || note.filename.replace(/\.(md|txt)$/, '') })
  }
  neighbors.sort((a, b) => a.title.localeCompare(b.title))

  const settings = getSettings()
  const preferredFolder = (settings.outlineExportFolder || '').trim()

  const allFolders = (DataStore.folders || []).filter(f => {
    if (!f) return false
    if (f === '/' || f === '@Trash') return false
    if (f.startsWith('@Trash/')) return false
    return true
  })
  if (allFolders.length === 0) {
    await pushToPanel('error', { message: 'No folders available to export into.' })
    return
  }
  const sortedFolders = preferredFolder && allFolders.includes(preferredFolder)
    ? [preferredFolder, ...allFolders.filter(f => f !== preferredFolder)]
    : allFolders.slice()

  let pickerResult
  try {
    pickerResult = await CommandBar.showOptions(sortedFolders, `Export outline of "${anchorTitle}" to folder…`)
  } catch (e) {
    console.log('handleExportOutline: folder picker failed: ' + e.message)
    return
  }
  if (!pickerResult || typeof pickerResult.index !== 'number' || pickerResult.index < 0) {
    console.log('handleExportOutline: folder pick cancelled')
    return
  }
  const folder = sortedFolders[pickerResult.index]
  const safeAnchor = anchorTitle.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 60)

  const lines = []
  lines.push(`# Outline - ${safeAnchor}`)
  lines.push('')
  lines.push(`- [[${anchorTitle}]]`)
  for (const n of neighbors) lines.push(`- [[${n.title}]]`)
  const md = lines.join('\n') + '\n'

  let newFn = null
  try {
    newFn = await DataStore.newNoteWithContent(md, folder)
    console.log('handleExportOutline: created ' + newFn)
  } catch (e) {
    console.log('handleExportOutline: newNoteWithContent failed: ' + e.message)
    await pushToPanel('error', { message: 'Could not create outline note: ' + e.message })
    return
  }

  if (newFn) {
    try {
      await Editor.openNoteByFilename(newFn, false, 0, 0, true)
    } catch (e) {
      console.log('handleExportOutline: open failed: ' + e.message)
    }
  }
}

export async function graphHTMLMessage(messageStr) {
  let parsed
  try {
    parsed = JSON.parse(messageStr)
  } catch (e) {
    console.log('graphHTMLMessage: bad JSON: ' + e.message)
    return
  }
  const { functionName, params } = parsed || {}
  if (!functionName) {
    console.log('graphHTMLMessage: missing functionName')
    return
  }

  const handlers = {
    handleOpenNote,
    handleRefreshGraph,
    handleSaveView,
    handleLoadView,
    handleDeleteView,
    handleListViews,
    handleSetDefaultView,
    handleApplyDefault,
    handleExportOutline,
    handleOpenFolder,
  }

  if (handlers[functionName]) {
    return await handlers[functionName](JSON.stringify(params || {}))
  }
  console.log('graphHTMLMessage: unknown function: ' + functionName)
}
