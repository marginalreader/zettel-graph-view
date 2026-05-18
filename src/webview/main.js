import { renderGraph } from './graph.js'
import { wireUi, updateViewPicker, refreshManageModal, syncFilterUi } from './ui.js'

const state = {
  graph: { nodes: [], edges: [] },
  filters: {},
  appearance: { colorBy: 'folder', showLabels: 'hover' },
  savedViews: [],
  activeViewFilename: null,
  folderList: [],
  folderTree: [],
  openFilterFolders: new Set(),
  settings: {
    defaultLinkDistance: 60,
    defaultChargeStrength: -200,
    nodeRadiusMin: 4,
    nodeRadiusMax: 20,
    labelZoomThreshold: 1.5,
  },
  simulation: null,
  expandedFolders: new Set(),
}

function sendToPlugin(functionName, params) {
  const argsJson = JSON.stringify(JSON.stringify({ functionName, params: params || {} }))
  const code =
    '(async function() { try {' +
    'await DataStore.invokePluginCommandByName("graphHTMLMessage", "marginalreader.ZettelGraphView", [' +
    argsJson +
    ']);' +
    '} catch(e) { console.log("IIFE error: " + e.message); } })()'
  // eslint-disable-next-line no-undef
  window.webkit.messageHandlers.jsBridge.postMessage({ code, onHandle: '', id: '1' })
}

window.GraphView = { state, sendToPlugin, renderGraph }

window.onPluginMessage = function (data) {
  if (!data || !data.type) return
  switch (data.type) {
    case 'graphData':
      state.graph = data.graph
      renderGraph(state)
      break
    case 'viewLoaded':
      if (data.filters) state.filters = data.filters
      if (data.appearance) state.appearance = data.appearance
      state.activeViewFilename = data.filename || null
      if (data.graph) state.graph = data.graph
      state.pendingFocus = data.focus || null
      renderGraph(state)
      updateViewPicker(state)
      syncFilterUi(state)
      break
    case 'viewSaved':
    case 'viewDeleted':
      state.savedViews = data.savedViews || []
      updateViewPicker(state)
      refreshManageModal(state)
      break
    case 'promptForSave': {
      const name = window.prompt('Save current view as:', '')
      if (name && name.trim()) {
        sendToPlugin('handleSaveView', {
          name: name.trim(),
          filters: state.filters,
          appearance: state.appearance,
        })
      }
      break
    }
    case 'error':
      console.log('plugin error: ' + (data.message || ''))
      break
    default:
      break
  }
}

function init() {
  const data = window.INITIAL_DATA || {}
  if (data.graph) state.graph = data.graph
  if (data.filters) state.filters = data.filters
  if (data.appearance) state.appearance = data.appearance
  if (data.savedViews) state.savedViews = data.savedViews
  if (data.activeViewFilename) state.activeViewFilename = data.activeViewFilename
  if (data.folderList) state.folderList = data.folderList
  if (data.folderTree) state.folderTree = data.folderTree
  if (data.settings) Object.assign(state.settings, data.settings)

  wireUi(state)
  renderGraph(state)

  // Always ask the plugin to apply the default view on init. NotePlan restores cached
  // HTML on relaunch (it doesn't re-run buildAndShowPanel), so reading the default
  // from preferences is the only way to make sure it's applied after restart.
  setTimeout(() => {
    if (window.GraphView) {
      window.GraphView.sendToPlugin('handleApplyDefault', {})
    }
  }, 100)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
