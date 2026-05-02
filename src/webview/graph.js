/* global d3 */

const colorScale = d3.scaleOrdinal(d3.schemeTableau10)

export function renderGraph(state) {
  const svg = d3.select('#graph')
  svg.selectAll('*').remove()
  if (state.simulation) {
    state.simulation.stop()
    state.simulation = null
  }

  const { nodes, edges } = applyFilters(state)
  setStatus(`${nodes.length} nodes · ${edges.length} edges`)
  if (nodes.length === 0) return

  const width = window.innerWidth
  const height = window.innerHeight - 48

  const root = svg.attr('viewBox', `0 0 ${width} ${height}`)

  const container = root.append('g').attr('class', 'container')

  const linkSel = container
    .append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(edges)
    .join('line')
    .attr('class', 'link')
    .attr('stroke-width', d => Math.min(1 + Math.log2(d.weight + 1), 4))
    .attr('stroke-opacity', d => Math.min(0.15 + d.weight * 0.05, 0.6))

  const nodeG = container.append('g').attr('class', 'nodes')
  let clickTimer = null
  const nodeSel = nodeG
    .selectAll('circle')
    .data(nodes, d => d.id)
    .join('circle')
    .attr('class', d => 'node' + (d.type === 'folder-root' ? ' folder-root' : ''))
    .attr('r', d => nodeRadius(d, state.settings))
    .attr('fill', d => colorScale(d.folder))
    .attr('stroke', 'var(--node-stroke)')
    .on('mouseenter', (event, d) => {
      if (state.lockedNodeId) return
      onHoverEnter(d, nodes, edges)
    })
    .on('mouseleave', () => {
      if (state.lockedNodeId) return
      onHoverLeave()
    })
    .on('click', (event, d) => {
      event.stopPropagation()
      if (clickTimer) return
      clickTimer = setTimeout(() => {
        clickTimer = null
        if (d.type === 'folder-root') {
          toggleFolderExpansion(d.folder, state)
        } else {
          toggleLock(d, state, nodes, edges)
        }
      }, 220)
    })
    .on('dblclick', (event, d) => {
      event.stopPropagation()
      if (clickTimer) {
        clearTimeout(clickTimer)
        clickTimer = null
      }
      if (!window.GraphView) return
      if (d.type === 'folder-root') {
        window.GraphView.sendToPlugin('handleOpenFolder', { folder: d.folder })
      } else {
        window.GraphView.sendToPlugin('handleOpenNote', { filename: d.id })
      }
    })
    .call(makeDrag(state))

  const labelSel = container
    .append('g')
    .attr('class', 'labels')
    .selectAll('text')
    .data(nodes, d => d.id)
    .join('text')
    .attr('class', d => 'label' + (d.type === 'folder-root' ? ' folder-label' : ''))
    .attr('dx', d => nodeRadius(d, state.settings) + 3)
    .attr('dy', '0.32em')
    .text(d => d.title)

  const sim = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink(edges)
        .id(d => d.id)
        .distance(state.settings.defaultLinkDistance || 60)
        .strength(0.4),
    )
    .force(
      'charge',
      d3
        .forceManyBody()
        .strength(state.settings.defaultChargeStrength || -200)
        .theta(0.9),
    )
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('x', d3.forceX(width / 2).strength(0.04))
    .force('y', d3.forceY(height / 2).strength(0.04))
    .force('collide', d3.forceCollide().radius(d => nodeRadius(d, state.settings) + 2))
    .alphaDecay(0.05)
    .velocityDecay(0.4)
    .on('tick', () => {
      linkSel
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
      nodeSel.attr('cx', d => d.x).attr('cy', d => d.y)
      labelSel.attr('x', d => d.x).attr('y', d => d.y)
    })

  state.simulation = sim

  const zoom = d3
    .zoom()
    .scaleExtent([0.1, 8])
    .on('zoom', event => {
      container.attr('transform', event.transform)
      const showLabels = event.transform.k >= labelThreshold(state)
      labelSel.style('display', d => {
        if (d.type === 'folder-root') return null
        return showLabels ? null : 'none'
      })
    })
  root.call(zoom).on('dblclick.zoom', null)
  state.zoom = zoom
  state.zoomRoot = root
  const initialShow = 1 >= labelThreshold(state)
  labelSel.style('display', d => {
    if (d.type === 'folder-root') return null
    return initialShow ? null : 'none'
  })

  root.on('click', () => {
    if (state.lockedNodeId) {
      state.lockedNodeId = null
      clearHighlight()
      document.dispatchEvent(new CustomEvent('graphview:lockchange'))
    }
  })

  // Re-apply a focus that was loaded from a saved view.
  if (state.pendingFocus && state.pendingFocus.centerNodeId) {
    const targetId = state.pendingFocus.centerNodeId
    state.pendingFocus = null
    state.lockedNodeId = null
    const tryApply = (attempt) => {
      const node = nodes.find(n => n.id === targetId)
      if (!node) return
      if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
        toggleLock(node, state, nodes, edges)
      } else if (attempt < 4) {
        setTimeout(() => tryApply(attempt + 1), 250)
      }
    }
    setTimeout(() => tryApply(0), 350)
  } else if (state.lockedNodeId) {
    // Preserve the existing lock through filter changes — re-apply highlight,
    // but don't recenter the camera (the user is exploring, not initiating focus).
    const lockedNode = nodes.find(n => n.id === state.lockedNodeId)
    if (lockedNode) {
      applyLockVisuals(lockedNode, edges)
    } else {
      // Locked node was filtered out by the new filter — drop the lock.
      state.lockedNodeId = null
    }
  }
}

function applyLockVisuals(node, edges) {
  highlightNeighbors(node, edges)
  d3.selectAll('.node').classed('focus-node', d => d.id === node.id)
}

function toggleFolderExpansion(folder, state) {
  if (!(state.expandedFolders instanceof Set)) state.expandedFolders = new Set()
  if (state.expandedFolders.has(folder)) state.expandedFolders.delete(folder)
  else state.expandedFolders.add(folder)
  renderGraph(state)
  // Pan the camera to the clicked hub once the simulation has placed it.
  const hubId = '__folder:' + folder
  const tryCenter = (attempt) => {
    if (!state.simulation) return
    const hubNode = state.simulation.nodes().find(n => n.id === hubId)
    if (hubNode && Number.isFinite(hubNode.x) && Number.isFinite(hubNode.y)) {
      centerOnNode(hubNode, state)
    } else if (attempt < 5) {
      setTimeout(() => tryCenter(attempt + 1), 200)
    }
  }
  setTimeout(() => tryCenter(0), 350)
}

function toggleLock(node, state, nodes, edges) {
  if (state.lockedNodeId === node.id) {
    state.lockedNodeId = null
    clearHighlight()
    document.dispatchEvent(new CustomEvent('graphview:lockchange'))
    return
  }
  state.lockedNodeId = node.id
  applyLockVisuals(node, edges)
  centerOnNode(node, state)
  document.dispatchEvent(new CustomEvent('graphview:lockchange'))
}

function highlightNeighbors(node, edges) {
  const neighbors = new Set([node.id])
  for (const e of edges) {
    const s = e.source.id || e.source
    const t = e.target.id || e.target
    if (s === node.id) neighbors.add(t)
    if (t === node.id) neighbors.add(s)
  }
  d3.selectAll('.node').classed('dimmed', d => !neighbors.has(d.id))
  d3.selectAll('.label').classed('dimmed', d => !neighbors.has(d.id))
  d3.selectAll('.link').classed('dimmed', d => {
    const s = d.source.id || d.source
    const t = d.target.id || d.target
    return !(neighbors.has(s) && neighbors.has(t))
  })
}

function clearHighlight() {
  d3.selectAll('.node').classed('dimmed', false).classed('focus-node', false)
  d3.selectAll('.label').classed('dimmed', false)
  d3.selectAll('.link').classed('dimmed', false)
}

function centerOnNode(node, state) {
  if (!state.zoom || !state.zoomRoot) return
  if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return
  const width = window.innerWidth
  const height = window.innerHeight - 48
  const targetK = 1.5
  const t = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(targetK)
    .translate(-node.x, -node.y)
  state.zoomRoot.transition().duration(400).call(state.zoom.transform, t)
}

function labelThreshold(state) {
  const t = state.settings && state.settings.labelZoomThreshold
  return Number.isFinite(t) ? t : 1.0
}

function nodeRadius(d, settings) {
  const max = settings.nodeRadiusMax || 20
  if (d.type === 'folder-root') return max + 6
  const min = settings.nodeRadiusMin || 4
  const r = min + Math.sqrt(d.degree || 0) * 2
  return Math.max(min, Math.min(max, r))
}

function endpointId(v) {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && typeof v.id === 'string') return v.id
  return null
}

function applyFilters(state) {
  const { graph, filters } = state
  const includeFolders = filters && filters.includeFolders
  const excludeFolders = filters && filters.excludedFolders
  const orphanMode = (filters && filters.orphanMode)
    || (filters && filters.excludeOrphans ? 'hide' : 'all')
  // Hierarchical: a note is excluded if its folder path OR any ancestor is in
  // excludeFolders. Same for include: must match the path or any ancestor.
  const ancestorChain = (path) => {
    const chain = []
    let p = path
    while (p) {
      chain.push(p)
      const idx = p.lastIndexOf('/')
      if (idx < 0) break
      p = p.slice(0, idx)
    }
    return chain
  }
  const folderAllowed = (path) => {
    if (!path) return true
    const chain = ancestorChain(path)
    if (Array.isArray(excludeFolders) && excludeFolders.length > 0) {
      if (chain.some(p => excludeFolders.includes(p))) return false
    }
    if (Array.isArray(includeFolders) && includeFolders.length > 0) {
      if (!chain.some(p => includeFolders.includes(p))) return false
    }
    return true
  }
  const keep = new Set()
  for (const n of graph.nodes) if (folderAllowed(n.folderPath || n.folder)) keep.add(n.id)

  // Normalize edges to {source, target, weight} with string IDs. D3's forceLink
  // mutates source/target on whatever array we pass to it, so source data may
  // contain object references on subsequent renders — this neutralizes that.
  const normalizedEdges = []
  for (const e of graph.edges) {
    const s = endpointId(e.source)
    const t = endpointId(e.target)
    if (!s || !t) continue
    if (!keep.has(s) || !keep.has(t)) continue
    normalizedEdges.push({ source: s, target: t, weight: e.weight || 1 })
  }
  let nodes = graph.nodes.filter(n => keep.has(n.id))
  let edges = normalizedEdges

  // Compute degree on the folder-filtered subgraph.
  const degree = new Map()
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1)
    degree.set(e.target, (degree.get(e.target) || 0) + 1)
  }

  if (orphanMode === 'hide') {
    nodes = nodes.filter(n => (degree.get(n.id) || 0) > 0)
    const live = new Set(nodes.map(n => n.id))
    edges = edges.filter(e => live.has(e.source) && live.has(e.target))
  } else if (orphanMode === 'only') {
    nodes = nodes.filter(n => (degree.get(n.id) || 0) === 0)
    edges = []
  }

  // Mindmap-style collapse/expand when folder roots are on:
  //   - Each folder is represented by a single hub node by default (collapsed).
  //   - Expanded folders show their child notes alongside the hub.
  //   - Wikilinks between collapsed folders aggregate into a single hub-to-hub edge.
  if (filters && filters.showFolderRoots && nodes.length > 0) {
    const expanded = state.expandedFolders instanceof Set ? state.expandedFolders : new Set()
    const folderOfNode = new Map()
    for (const n of nodes) folderOfNode.set(n.id, n.folder)

    const folders = new Set()
    for (const n of nodes) folders.add(n.folder)

    const visibleNodes = []
    const noteCount = new Map()
    for (const folder of folders) noteCount.set(folder, 0)
    for (const n of nodes) noteCount.set(n.folder, (noteCount.get(n.folder) || 0) + 1)
    for (const folder of folders) {
      visibleNodes.push({
        id: '__folder:' + folder,
        title: folder + ' (' + noteCount.get(folder) + ')',
        type: 'folder-root',
        folder,
        expanded: expanded.has(folder),
        hashtags: [],
        mentions: [],
        degree: 0,
      })
      if (expanded.has(folder)) {
        for (const n of nodes) if (n.folder === folder) visibleNodes.push(n)
      }
    }

    const visibleEdges = []
    const aggregate = new Map()
    const addAggregate = (a, b, weight) => {
      const [s, t] = a < b ? [a, b] : [b, a]
      const key = s + '::' + t
      const existing = aggregate.get(key)
      if (existing) existing.weight += weight
      else aggregate.set(key, { source: s, target: t, weight, synthetic: true })
    }
    for (const e of edges) {
      const srcFolder = folderOfNode.get(e.source)
      const tgtFolder = folderOfNode.get(e.target)
      if (!srcFolder || !tgtFolder) continue
      const srcExpanded = expanded.has(srcFolder)
      const tgtExpanded = expanded.has(tgtFolder)
      if (srcExpanded && tgtExpanded) {
        visibleEdges.push({ source: e.source, target: e.target, weight: e.weight })
      } else if (srcExpanded) {
        addAggregate(e.source, '__folder:' + tgtFolder, e.weight)
      } else if (tgtExpanded) {
        addAggregate('__folder:' + srcFolder, e.target, e.weight)
      } else if (srcFolder !== tgtFolder) {
        addAggregate('__folder:' + srcFolder, '__folder:' + tgtFolder, e.weight)
      }
    }
    for (const agg of aggregate.values()) visibleEdges.push(agg)

    // Synthetic spokes from each expanded folder's hub to its child notes.
    for (const folder of folders) {
      if (!expanded.has(folder)) continue
      for (const n of nodes) {
        if (n.folder !== folder) continue
        visibleEdges.push({
          source: '__folder:' + folder,
          target: n.id,
          weight: 1,
          synthetic: true,
        })
      }
    }

    nodes = visibleNodes
    edges = visibleEdges
  }

  // Recompute degree for sizing (now reflects the final visible subgraph).
  const deg = new Map()
  for (const e of edges) {
    deg.set(e.source, (deg.get(e.source) || 0) + e.weight)
    deg.set(e.target, (deg.get(e.target) || 0) + e.weight)
  }
  nodes = nodes.map(n => Object.assign({}, n, { degree: deg.get(n.id) || 0 }))
  return { nodes, edges }
}

function makeDrag(state) {
  return d3
    .drag()
    .on('start', (event, d) => {
      if (!event.active && state.simulation) state.simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    })
    .on('drag', (event, d) => {
      d.fx = event.x
      d.fy = event.y
    })
    .on('end', (event, d) => {
      if (!event.active && state.simulation) state.simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    })
}

let hoverTimer = null
function onHoverEnter(node, nodes, edges) {
  clearTimeout(hoverTimer)
  highlightNeighbors(node, edges)
}
function onHoverLeave() {
  hoverTimer = setTimeout(() => {
    d3.selectAll('.node, .label, .link').classed('dimmed', false)
  }, 50)
}

function setStatus(text) {
  const el = document.getElementById('status')
  if (el) el.textContent = text
}
