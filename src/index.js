/* eslint-env noteplan */
/* global HTMLView */

import { buildGraph, collectFolderTree, collectTopLevelFolders } from './buildGraph.js'
import { graphHTMLMessage as _graphHTMLMessage, pushToPanel } from './messageBridge.js'
import { listSavedViews, readSavedViewNote } from './savedViews.js'
import { getDefaultViewFilename, getSettings } from './settings.js'
import { buildHtml } from './webview/template.js'

const PANEL_WINDOW_ID = 'graph-view'

async function buildAndShowPanel(opts) {
  const o = opts || {}
  const settings = getSettings()

  let activeView = null
  if (o.viewFilename) {
    activeView = readSavedViewNote(o.viewFilename)
  } else {
    const defaultFn = getDefaultViewFilename()
    console.log('buildAndShowPanel: defaultViewFilename=' + JSON.stringify(defaultFn))
    if (defaultFn) activeView = readSavedViewNote(defaultFn)
  }

  const filters = activeView
    ? activeView.filters
    : {
        includeCalendarNotes: settings.includeCalendarNotes === true,
        excludedFolders: Array.isArray(settings.excludedFolders) ? settings.excludedFolders : null,
        orphanMode: 'all',
        excludeOrphans: false,
        showFolderRoots: false,
      }

  const graph = buildGraph(filters)
  const folderList = collectTopLevelFolders(graph.nodes)
  const folderTree = collectFolderTree(graph.nodes)

  const initialData = {
    graph,
    filters,
    appearance: activeView ? activeView.appearance : { colorBy: 'folder', showLabels: 'hover' },
    savedViews: listSavedViews(),
    activeViewFilename: activeView ? activeView.filename : null,
    folderList,
    folderTree,
    settings: {
      defaultLinkDistance: Number(settings.defaultLinkDistance != null ? settings.defaultLinkDistance : 60),
      defaultChargeStrength: Number(settings.defaultChargeStrength != null ? settings.defaultChargeStrength : -200),
      nodeRadiusMin: Number(settings.nodeRadiusMin != null ? settings.nodeRadiusMin : 4),
      nodeRadiusMax: Number(settings.nodeRadiusMax != null ? settings.nodeRadiusMax : 20),
      labelZoomThreshold: Number(settings.labelZoomThreshold != null ? settings.labelZoomThreshold : 1.0),
    },
  }

  const html = buildHtml(initialData)
  HTMLView.showInMainWindow(html, 'Graph View', {
    id: PANEL_WINDOW_ID,
    splitView: false,
    icon: 'diagram-project',
    iconColor: 'purple-500',
  })
}

export async function openGraphView() {
  try {
    await buildAndShowPanel({})
  } catch (e) {
    console.log('openGraphView error: ' + e.message)
  }
}

export async function loadSavedView(viewFilename) {
  try {
    if (!viewFilename) {
      console.log('loadSavedView: missing viewFilename')
      return
    }
    await buildAndShowPanel({ viewFilename })
  } catch (e) {
    console.log('loadSavedView error: ' + e.message)
  }
}

export async function saveCurrentView() {
  try {
    await pushToPanel('promptForSave', {})
  } catch (e) {
    console.log('saveCurrentView error: ' + e.message)
  }
}

export async function refreshGraph() {
  try {
    const graph = buildGraph({})
    await pushToPanel('graphData', { graph })
  } catch (e) {
    console.log('refreshGraph error: ' + e.message)
  }
}

export const graphHTMLMessage = _graphHTMLMessage

export async function onSettingsUpdated() {
  try {
    await buildAndShowPanel({})
  } catch (e) {
    console.log('onSettingsUpdated error: ' + e.message)
  }
}

export function onUpdateOrInstall() {
  console.log('ryan.graph-view installed/updated')
}
