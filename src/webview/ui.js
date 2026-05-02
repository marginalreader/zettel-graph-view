import { renderGraph } from './graph.js'

export function wireUi(state) {
  renderFolderTree(state)

  bind('folder-all', 'click', () => {
    state.filters = Object.assign({}, state.filters, { excludedFolders: [] })
    renderFolderTree(state)
    renderGraph(state)
  })
  bind('folder-none', 'click', () => {
    const all = collectAllFolderPaths(state.folderTree || [])
    state.filters = Object.assign({}, state.filters, { excludedFolders: all })
    renderFolderTree(state)
    renderGraph(state)
  })

  const orphanSelect = document.getElementById('orphan-mode')
  if (orphanSelect) {
    const initial = (state.filters && state.filters.orphanMode)
      || (state.filters && state.filters.excludeOrphans ? 'hide' : 'all')
    orphanSelect.value = initial
    orphanSelect.addEventListener('change', () => {
      state.filters = Object.assign({}, state.filters, {
        orphanMode: orphanSelect.value,
        excludeOrphans: orphanSelect.value === 'hide',
      })
      renderGraph(state)
    })
  }

  const rootsCb = document.getElementById('folder-roots')
  if (rootsCb) {
    rootsCb.checked = !!(state.filters && state.filters.showFolderRoots)
    rootsCb.addEventListener('change', () => {
      state.filters = Object.assign({}, state.filters, { showFolderRoots: rootsCb.checked })
      // Reset expansion state whenever the toggle flips — start with everything collapsed.
      state.expandedFolders = new Set()
      renderGraph(state)
    })
  }

  document.addEventListener('graphview:filterchange', () => {
    syncFilterUi(state)
    renderGraph(state)
  })

  bind('save-view-btn', 'click', () => openSaveModal(state))
  bind('save-cancel', 'click', () => closeSaveModal())
  bind('save-confirm', 'click', () => submitSaveModal(state))
  const saveInput = document.getElementById('save-name')
  if (saveInput) {
    saveInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        submitSaveModal(state)
      } else if (e.key === 'Escape') {
        closeSaveModal()
      }
    })
  }

  bind('manage-views-btn', 'click', () => openManageModal(state))
  bind('manage-close', 'click', () => closeManageModal())
  bind('confirm-cancel', 'click', () => closeConfirmModal(false))
  bind('confirm-ok', 'click', () => closeConfirmModal(true))
  bind('export-outline-btn', 'click', () => exportOutline(state))
  syncExportButton(state)
  document.addEventListener('graphview:lockchange', () => syncExportButton(state))

  const picker = document.getElementById('view-picker')
  if (picker) {
    picker.addEventListener('change', () => {
      const fn = picker.value
      if (!fn) return
      if (window.GraphView) window.GraphView.sendToPlugin('handleLoadView', { filename: fn })
    })
  }

  updateViewPicker(state)
}

function bind(id, event, handler) {
  const el = document.getElementById(id)
  if (el) el.addEventListener(event, handler)
}

function collectAllFolderPaths(tree) {
  const out = []
  const walk = (nodes) => {
    for (const n of nodes) {
      out.push(n.path)
      if (n.children && n.children.length) walk(n.children)
    }
  }
  walk(tree)
  return out
}

function renderFolderTree(state) {
  const container = document.getElementById('folder-checkboxes')
  if (!container) return
  container.innerHTML = ''
  if (!(state.openFilterFolders instanceof Set)) state.openFilterFolders = new Set()
  const excluded = new Set(Array.isArray(state.filters?.excludedFolders) ? state.filters.excludedFolders : [])
  const tree = state.folderTree || []
  for (const node of tree) {
    container.appendChild(buildFolderRow(node, 0, state, excluded))
  }
}

function buildFolderRow(node, depth, state, excluded) {
  const wrap = document.createElement('div')
  wrap.className = 'folder-tree-node'

  const row = document.createElement('div')
  row.className = 'folder-row depth-' + Math.min(depth, 6)
  row.style.paddingLeft = (depth * 14) + 'px'

  const hasChildren = node.children && node.children.length > 0
  const expandBtn = document.createElement('button')
  expandBtn.type = 'button'
  expandBtn.className = 'expand-btn'
  if (hasChildren) {
    const isOpen = state.openFilterFolders.has(node.path)
    expandBtn.textContent = isOpen ? '▾' : '▸'
    expandBtn.addEventListener('click', () => {
      if (state.openFilterFolders.has(node.path)) state.openFilterFolders.delete(node.path)
      else state.openFilterFolders.add(node.path)
      renderFolderTree(state)
    })
  } else {
    expandBtn.textContent = ''
    expandBtn.disabled = true
    expandBtn.classList.add('expand-spacer')
  }
  row.appendChild(expandBtn)

  const label = document.createElement('label')
  label.className = 'folder-label'
  const cb = document.createElement('input')
  cb.type = 'checkbox'
  cb.checked = !excluded.has(node.path)
  cb.addEventListener('change', () => onFolderToggle(node.path, cb.checked, state))
  const span = document.createElement('span')
  span.textContent = node.name
  label.appendChild(cb)
  label.appendChild(span)
  row.appendChild(label)

  wrap.appendChild(row)

  if (hasChildren && state.openFilterFolders.has(node.path)) {
    const childWrap = document.createElement('div')
    childWrap.className = 'folder-children'
    for (const child of node.children) {
      childWrap.appendChild(buildFolderRow(child, depth + 1, state, excluded))
    }
    wrap.appendChild(childWrap)
  }
  return wrap
}

function findDescendantPaths(tree, targetPath) {
  const result = []
  const collect = (children) => {
    for (const c of children) {
      result.push(c.path)
      if (c.children && c.children.length) collect(c.children)
    }
  }
  const visit = (nodes) => {
    for (const n of nodes) {
      if (n.path === targetPath) {
        if (n.children) collect(n.children)
        return true
      }
      if (n.children && visit(n.children)) return true
    }
    return false
  }
  visit(tree)
  return result
}

function onFolderToggle(path, checked, state) {
  const excluded = new Set(Array.isArray(state.filters?.excludedFolders) ? state.filters.excludedFolders : [])
  const descendants = findDescendantPaths(state.folderTree || [], path)
  if (checked) {
    // Removing exclusion: clear this folder, every ancestor (so a child re-include
    // also re-includes its parent), and every descendant (so a parent re-include
    // sweeps in any previously-hidden subfolders).
    let p = path
    while (p) {
      excluded.delete(p)
      const idx = p.lastIndexOf('/')
      if (idx < 0) break
      p = p.slice(0, idx)
    }
    for (const d of descendants) excluded.delete(d)
  } else {
    excluded.add(path)
    for (const d of descendants) excluded.add(d)
  }
  state.filters = Object.assign({}, state.filters, { excludedFolders: [...excluded] })
  renderFolderTree(state)
  renderGraph(state)
}

export function syncExportButton(state) {
  const btn = document.getElementById('export-outline-btn')
  if (btn) btn.disabled = !state.lockedNodeId
}

function exportOutline(state) {
  if (!state.lockedNodeId || !window.GraphView) return
  const anchorId = state.lockedNodeId
  const neighbors = []
  const seen = new Set()
  for (const e of (state.graph && state.graph.edges) || []) {
    const s = typeof e.source === 'string' ? e.source : (e.source && e.source.id)
    const t = typeof e.target === 'string' ? e.target : (e.target && e.target.id)
    if (s === anchorId && t && !seen.has(t)) { seen.add(t); neighbors.push(t) }
    if (t === anchorId && s && !seen.has(s)) { seen.add(s); neighbors.push(s) }
  }
  window.GraphView.sendToPlugin('handleExportOutline', {
    anchorFilename: anchorId,
    neighborFilenames: neighbors,
  })
}

export function syncFilterUi(state) {
  const filters = state.filters || {}
  const orphanSelect = document.getElementById('orphan-mode')
  if (orphanSelect) {
    orphanSelect.value = filters.orphanMode || (filters.excludeOrphans ? 'hide' : 'all')
  }
  const rootsCb = document.getElementById('folder-roots')
  if (rootsCb) {
    rootsCb.checked = !!filters.showFolderRoots
  }
  // Folder tree may have changed paths or expansion state; re-render it.
  renderFolderTree(state)
}

export function updateViewPicker(state) {
  const picker = document.getElementById('view-picker')
  if (!picker) return
  const current = state.activeViewFilename || ''
  picker.innerHTML = ''
  const blank = document.createElement('option')
  blank.value = ''
  blank.textContent = '— current view —'
  picker.appendChild(blank)
  for (const v of state.savedViews || []) {
    const opt = document.createElement('option')
    opt.value = v.filename
    opt.textContent = v.name + (v.isDefault ? ' (default)' : '')
    if (v.filename === current) opt.selected = true
    picker.appendChild(opt)
  }
}

function openSaveModal(state) {
  const modal = document.getElementById('save-modal')
  const input = document.getElementById('save-name')
  const info = document.getElementById('save-anchor-info')
  if (!modal || !input) return
  input.value = ''
  if (info) {
    if (state.lockedNodeId) {
      const node = ((state.graph && state.graph.nodes) || []).find(n => n.id === state.lockedNodeId)
      const title = node ? (node.title || state.lockedNodeId) : state.lockedNodeId
      info.textContent = 'Anchor: ' + title
      info.className = 'save-anchor has-anchor'
    } else {
      info.textContent = 'No anchor — click a node first to lock it as this view\u2019s anchor.'
      info.className = 'save-anchor no-anchor'
    }
  }
  modal.hidden = false
  setTimeout(() => input.focus(), 0)
}
function closeSaveModal() {
  const modal = document.getElementById('save-modal')
  if (modal) modal.hidden = true
}
function submitSaveModal(state) {
  const input = document.getElementById('save-name')
  const name = input ? input.value.trim() : ''
  if (!name) return
  if (window.GraphView) {
    window.GraphView.sendToPlugin('handleSaveView', {
      name,
      filters: state.filters,
      appearance: state.appearance,
      focus: state.lockedNodeId ? { centerNodeId: state.lockedNodeId } : null,
    })
  }
  closeSaveModal()
}

let confirmResolver = null
function openConfirmModal(message, title) {
  const modal = document.getElementById('confirm-modal')
  const t = document.getElementById('confirm-title')
  const m = document.getElementById('confirm-message')
  if (!modal || !m) return Promise.resolve(false)
  if (t) t.textContent = title || 'Confirm'
  m.textContent = message || ''
  modal.hidden = false
  return new Promise(resolve => {
    confirmResolver = resolve
  })
}
function closeConfirmModal(result) {
  const modal = document.getElementById('confirm-modal')
  if (modal) modal.hidden = true
  if (confirmResolver) {
    confirmResolver(!!result)
    confirmResolver = null
  }
}

function openManageModal(state) {
  renderManageModal(state)
  const modal = document.getElementById('manage-modal')
  if (modal) modal.hidden = false
}

export function refreshManageModal(state) {
  const modal = document.getElementById('manage-modal')
  if (!modal || modal.hidden) return
  renderManageModal(state)
}

function renderManageModal(state) {
  const list = document.getElementById('manage-list')
  if (!list) return
  list.innerHTML = ''
  if (!state.savedViews || state.savedViews.length === 0) {
    list.textContent = 'No saved views yet. Use Save to create one.'
    return
  }
  for (const v of state.savedViews) {
    const row = document.createElement('div')
    row.className = 'manage-row'
    const label = document.createElement('span')
    label.textContent = v.name + (v.isDefault ? ' (default)' : '')
    const setDefault = document.createElement('button')
    setDefault.type = 'button'
    setDefault.textContent = v.isDefault ? 'Default' : 'Set default'
    setDefault.disabled = v.isDefault
    setDefault.addEventListener('click', () => {
      if (window.GraphView) window.GraphView.sendToPlugin('handleSetDefaultView', { filename: v.filename })
    })
    const del = document.createElement('button')
    del.type = 'button'
    del.textContent = 'Delete'
    del.addEventListener('click', async () => {
      const ok = await openConfirmModal('Delete view "' + v.name + '"?', 'Delete view')
      if (ok && window.GraphView) {
        window.GraphView.sendToPlugin('handleDeleteView', { filename: v.filename })
      }
    })
    row.appendChild(label)
    row.appendChild(setDefault)
    row.appendChild(del)
    list.appendChild(row)
  }
}

function closeManageModal() {
  const modal = document.getElementById('manage-modal')
  if (modal) modal.hidden = true
}
