(function () {
  'use strict';

  function _arrayLikeToArray(r, a) {
    (null == a || a > r.length) && (a = r.length);
    for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
    return n;
  }
  function _arrayWithHoles(r) {
    if (Array.isArray(r)) return r;
  }
  function _iterableToArrayLimit(r, l) {
    var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (null != t) {
      var e,
        n,
        i,
        u,
        a = [],
        f = true,
        o = false;
      try {
        if (i = (t = t.call(r)).next, 0 === l) ; else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
      } catch (r) {
        o = true, n = r;
      } finally {
        try {
          if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
        } finally {
          if (o) throw n;
        }
      }
      return a;
    }
  }
  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  function _slicedToArray(r, e) {
    return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
  }
  function _unsupportedIterableToArray(r, a) {
    if (r) {
      if ("string" == typeof r) return _arrayLikeToArray(r, a);
      var t = {}.toString.call(r).slice(8, -1);
      return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
    }
  }

  /* global d3 */

  const colorScale = d3.scaleOrdinal(d3.schemeTableau10);
  function renderGraph(state) {
    const svg = d3.select('#graph');
    svg.selectAll('*').remove();
    if (state.simulation) {
      state.simulation.stop();
      state.simulation = null;
    }
    const _applyFilters = applyFilters(state),
      nodes = _applyFilters.nodes,
      edges = _applyFilters.edges;
    setStatus(`${nodes.length} nodes · ${edges.length} edges`);
    if (nodes.length === 0) return;
    const width = window.innerWidth;
    const height = window.innerHeight - 48;
    const root = svg.attr('viewBox', `0 0 ${width} ${height}`);
    const container = root.append('g').attr('class', 'container');
    const linkSel = container.append('g').attr('class', 'links').selectAll('line').data(edges).join('line').attr('class', 'link').attr('stroke-width', d => Math.min(1 + Math.log2(d.weight + 1), 4)).attr('stroke-opacity', d => Math.min(0.15 + d.weight * 0.05, 0.6));
    const nodeG = container.append('g').attr('class', 'nodes');
    let clickTimer = null;
    const nodeSel = nodeG.selectAll('circle').data(nodes, d => d.id).join('circle').attr('class', d => 'node' + (d.type === 'folder-root' ? ' folder-root' : '')).attr('r', d => nodeRadius(d, state.settings)).attr('fill', d => colorScale(d.folder)).attr('stroke', 'var(--node-stroke)').on('mouseenter', (event, d) => {
      if (state.lockedNodeId) return;
      onHoverEnter(d, nodes, edges);
    }).on('mouseleave', () => {
      if (state.lockedNodeId) return;
      onHoverLeave();
    }).on('click', (event, d) => {
      event.stopPropagation();
      if (clickTimer) return;
      clickTimer = setTimeout(() => {
        clickTimer = null;
        if (d.type === 'folder-root') {
          toggleFolderExpansion(d.folder, state);
        } else {
          toggleLock(d, state, nodes, edges);
        }
      }, 220);
    }).on('dblclick', (event, d) => {
      event.stopPropagation();
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      if (!window.GraphView) return;
      if (d.type === 'folder-root') {
        window.GraphView.sendToPlugin('handleOpenFolder', {
          folder: d.folder
        });
      } else {
        window.GraphView.sendToPlugin('handleOpenNote', {
          filename: d.id
        });
      }
    }).call(makeDrag(state));
    const labelSel = container.append('g').attr('class', 'labels').selectAll('text').data(nodes, d => d.id).join('text').attr('class', d => 'label' + (d.type === 'folder-root' ? ' folder-label' : '')).attr('dx', d => nodeRadius(d, state.settings) + 3).attr('dy', '0.32em').text(d => d.title);
    const sim = d3.forceSimulation(nodes).force('link', d3.forceLink(edges).id(d => d.id).distance(state.settings.defaultLinkDistance || 60).strength(0.4)).force('charge', d3.forceManyBody().strength(state.settings.defaultChargeStrength || -200).theta(0.9)).force('center', d3.forceCenter(width / 2, height / 2)).force('x', d3.forceX(width / 2).strength(0.04)).force('y', d3.forceY(height / 2).strength(0.04)).force('collide', d3.forceCollide().radius(d => nodeRadius(d, state.settings) + 2)).alphaDecay(0.05).velocityDecay(0.4).on('tick', () => {
      linkSel.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      nodeSel.attr('cx', d => d.x).attr('cy', d => d.y);
      labelSel.attr('x', d => d.x).attr('y', d => d.y);
    });
    state.simulation = sim;
    const zoom = d3.zoom().scaleExtent([0.1, 8]).on('zoom', event => {
      container.attr('transform', event.transform);
      const showLabels = event.transform.k >= labelThreshold(state);
      labelSel.style('display', d => {
        if (d.type === 'folder-root') return null;
        return showLabels ? null : 'none';
      });
    });
    root.call(zoom).on('dblclick.zoom', null);
    state.zoom = zoom;
    state.zoomRoot = root;
    const initialShow = 1 >= labelThreshold(state);
    labelSel.style('display', d => {
      if (d.type === 'folder-root') return null;
      return initialShow ? null : 'none';
    });
    root.on('click', () => {
      if (state.lockedNodeId) {
        state.lockedNodeId = null;
        clearHighlight();
        document.dispatchEvent(new CustomEvent('graphview:lockchange'));
      }
    });

    // Re-apply a focus that was loaded from a saved view.
    if (state.pendingFocus && state.pendingFocus.centerNodeId) {
      const targetId = state.pendingFocus.centerNodeId;
      state.pendingFocus = null;
      state.lockedNodeId = null;
      const tryApply = attempt => {
        const node = nodes.find(n => n.id === targetId);
        if (!node) return;
        if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
          toggleLock(node, state, nodes, edges);
        } else if (attempt < 4) {
          setTimeout(() => tryApply(attempt + 1), 250);
        }
      };
      setTimeout(() => tryApply(0), 350);
    } else if (state.lockedNodeId) {
      // Preserve the existing lock through filter changes — re-apply highlight,
      // but don't recenter the camera (the user is exploring, not initiating focus).
      const lockedNode = nodes.find(n => n.id === state.lockedNodeId);
      if (lockedNode) {
        applyLockVisuals(lockedNode, edges);
      } else {
        // Locked node was filtered out by the new filter — drop the lock.
        state.lockedNodeId = null;
      }
    }
  }
  function applyLockVisuals(node, edges) {
    highlightNeighbors(node, edges);
    d3.selectAll('.node').classed('focus-node', d => d.id === node.id);
  }
  function toggleFolderExpansion(folder, state) {
    if (!(state.expandedFolders instanceof Set)) state.expandedFolders = new Set();
    if (state.expandedFolders.has(folder)) state.expandedFolders.delete(folder);else state.expandedFolders.add(folder);
    renderGraph(state);
    // Pan the camera to the clicked hub once the simulation has placed it.
    const hubId = '__folder:' + folder;
    const tryCenter = attempt => {
      if (!state.simulation) return;
      const hubNode = state.simulation.nodes().find(n => n.id === hubId);
      if (hubNode && Number.isFinite(hubNode.x) && Number.isFinite(hubNode.y)) {
        centerOnNode(hubNode, state);
      } else if (attempt < 5) {
        setTimeout(() => tryCenter(attempt + 1), 200);
      }
    };
    setTimeout(() => tryCenter(0), 350);
  }
  function toggleLock(node, state, nodes, edges) {
    if (state.lockedNodeId === node.id) {
      state.lockedNodeId = null;
      clearHighlight();
      document.dispatchEvent(new CustomEvent('graphview:lockchange'));
      return;
    }
    state.lockedNodeId = node.id;
    applyLockVisuals(node, edges);
    centerOnNode(node, state);
    document.dispatchEvent(new CustomEvent('graphview:lockchange'));
  }
  function highlightNeighbors(node, edges) {
    const neighbors = new Set([node.id]);
    for (const e of edges) {
      const s = e.source.id || e.source;
      const t = e.target.id || e.target;
      if (s === node.id) neighbors.add(t);
      if (t === node.id) neighbors.add(s);
    }
    d3.selectAll('.node').classed('dimmed', d => !neighbors.has(d.id));
    d3.selectAll('.label').classed('dimmed', d => !neighbors.has(d.id));
    d3.selectAll('.link').classed('dimmed', d => {
      const s = d.source.id || d.source;
      const t = d.target.id || d.target;
      return !(neighbors.has(s) && neighbors.has(t));
    });
  }
  function clearHighlight() {
    d3.selectAll('.node').classed('dimmed', false).classed('focus-node', false);
    d3.selectAll('.label').classed('dimmed', false);
    d3.selectAll('.link').classed('dimmed', false);
  }
  function centerOnNode(node, state) {
    if (!state.zoom || !state.zoomRoot) return;
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    const width = window.innerWidth;
    const height = window.innerHeight - 48;
    const targetK = 1.5;
    const t = d3.zoomIdentity.translate(width / 2, height / 2).scale(targetK).translate(-node.x, -node.y);
    state.zoomRoot.transition().duration(400).call(state.zoom.transform, t);
  }
  function labelThreshold(state) {
    const t = state.settings && state.settings.labelZoomThreshold;
    return Number.isFinite(t) ? t : 1.0;
  }
  function nodeRadius(d, settings) {
    const max = settings.nodeRadiusMax || 20;
    if (d.type === 'folder-root') return max + 6;
    const min = settings.nodeRadiusMin || 4;
    const r = min + Math.sqrt(d.degree || 0) * 2;
    return Math.max(min, Math.min(max, r));
  }
  function endpointId(v) {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && typeof v.id === 'string') return v.id;
    return null;
  }
  function applyFilters(state) {
    const graph = state.graph,
      filters = state.filters;
    const includeFolders = filters && filters.includeFolders;
    const excludeFolders = filters && filters.excludedFolders;
    const orphanMode = filters && filters.orphanMode || (filters && filters.excludeOrphans ? 'hide' : 'all');
    // Hierarchical: a note is excluded if its folder path OR any ancestor is in
    // excludeFolders. Same for include: must match the path or any ancestor.
    const ancestorChain = path => {
      const chain = [];
      let p = path;
      while (p) {
        chain.push(p);
        const idx = p.lastIndexOf('/');
        if (idx < 0) break;
        p = p.slice(0, idx);
      }
      return chain;
    };
    const folderAllowed = path => {
      if (!path) return true;
      const chain = ancestorChain(path);
      if (Array.isArray(excludeFolders) && excludeFolders.length > 0) {
        if (chain.some(p => excludeFolders.includes(p))) return false;
      }
      if (Array.isArray(includeFolders) && includeFolders.length > 0) {
        if (!chain.some(p => includeFolders.includes(p))) return false;
      }
      return true;
    };
    const keep = new Set();
    for (const n of graph.nodes) if (folderAllowed(n.folderPath || n.folder)) keep.add(n.id);

    // Normalize edges to {source, target, weight} with string IDs. D3's forceLink
    // mutates source/target on whatever array we pass to it, so source data may
    // contain object references on subsequent renders — this neutralizes that.
    const normalizedEdges = [];
    for (const e of graph.edges) {
      const s = endpointId(e.source);
      const t = endpointId(e.target);
      if (!s || !t) continue;
      if (!keep.has(s) || !keep.has(t)) continue;
      normalizedEdges.push({
        source: s,
        target: t,
        weight: e.weight || 1
      });
    }
    let nodes = graph.nodes.filter(n => keep.has(n.id));
    let edges = normalizedEdges;

    // Compute degree on the folder-filtered subgraph.
    const degree = new Map();
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) || 0) + 1);
      degree.set(e.target, (degree.get(e.target) || 0) + 1);
    }
    if (orphanMode === 'hide') {
      nodes = nodes.filter(n => (degree.get(n.id) || 0) > 0);
      const live = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => live.has(e.source) && live.has(e.target));
    } else if (orphanMode === 'only') {
      nodes = nodes.filter(n => (degree.get(n.id) || 0) === 0);
      edges = [];
    }

    // Mindmap-style collapse/expand when folder roots are on:
    //   - Each folder is represented by a single hub node by default (collapsed).
    //   - Expanded folders show their child notes alongside the hub.
    //   - Wikilinks between collapsed folders aggregate into a single hub-to-hub edge.
    if (filters && filters.showFolderRoots && nodes.length > 0) {
      const expanded = state.expandedFolders instanceof Set ? state.expandedFolders : new Set();
      const folderOfNode = new Map();
      for (const n of nodes) folderOfNode.set(n.id, n.folder);
      const folders = new Set();
      for (const n of nodes) folders.add(n.folder);
      const visibleNodes = [];
      const noteCount = new Map();
      for (const folder of folders) noteCount.set(folder, 0);
      for (const n of nodes) noteCount.set(n.folder, (noteCount.get(n.folder) || 0) + 1);
      for (const folder of folders) {
        visibleNodes.push({
          id: '__folder:' + folder,
          title: folder + ' (' + noteCount.get(folder) + ')',
          type: 'folder-root',
          folder,
          expanded: expanded.has(folder),
          hashtags: [],
          mentions: [],
          degree: 0
        });
        if (expanded.has(folder)) {
          for (const n of nodes) if (n.folder === folder) visibleNodes.push(n);
        }
      }
      const visibleEdges = [];
      const aggregate = new Map();
      const addAggregate = (a, b, weight) => {
        const _ref = a < b ? [a, b] : [b, a],
          _ref2 = _slicedToArray(_ref, 2),
          s = _ref2[0],
          t = _ref2[1];
        const key = s + '::' + t;
        const existing = aggregate.get(key);
        if (existing) existing.weight += weight;else aggregate.set(key, {
          source: s,
          target: t,
          weight,
          synthetic: true
        });
      };
      for (const e of edges) {
        const srcFolder = folderOfNode.get(e.source);
        const tgtFolder = folderOfNode.get(e.target);
        if (!srcFolder || !tgtFolder) continue;
        const srcExpanded = expanded.has(srcFolder);
        const tgtExpanded = expanded.has(tgtFolder);
        if (srcExpanded && tgtExpanded) {
          visibleEdges.push({
            source: e.source,
            target: e.target,
            weight: e.weight
          });
        } else if (srcExpanded) {
          addAggregate(e.source, '__folder:' + tgtFolder, e.weight);
        } else if (tgtExpanded) {
          addAggregate('__folder:' + srcFolder, e.target, e.weight);
        } else if (srcFolder !== tgtFolder) {
          addAggregate('__folder:' + srcFolder, '__folder:' + tgtFolder, e.weight);
        }
      }
      for (const agg of aggregate.values()) visibleEdges.push(agg);

      // Synthetic spokes from each expanded folder's hub to its child notes.
      for (const folder of folders) {
        if (!expanded.has(folder)) continue;
        for (const n of nodes) {
          if (n.folder !== folder) continue;
          visibleEdges.push({
            source: '__folder:' + folder,
            target: n.id,
            weight: 1,
            synthetic: true
          });
        }
      }
      nodes = visibleNodes;
      edges = visibleEdges;
    }

    // Recompute degree for sizing (now reflects the final visible subgraph).
    const deg = new Map();
    for (const e of edges) {
      deg.set(e.source, (deg.get(e.source) || 0) + e.weight);
      deg.set(e.target, (deg.get(e.target) || 0) + e.weight);
    }
    nodes = nodes.map(n => Object.assign({}, n, {
      degree: deg.get(n.id) || 0
    }));
    return {
      nodes,
      edges
    };
  }
  function makeDrag(state) {
    return d3.drag().on('start', (event, d) => {
      if (!event.active && state.simulation) state.simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }).on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    }).on('end', (event, d) => {
      if (!event.active && state.simulation) state.simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
  }
  let hoverTimer = null;
  function onHoverEnter(node, nodes, edges) {
    clearTimeout(hoverTimer);
    highlightNeighbors(node, edges);
  }
  function onHoverLeave() {
    hoverTimer = setTimeout(() => {
      d3.selectAll('.node, .label, .link').classed('dimmed', false);
    }, 50);
  }
  function setStatus(text) {
    const el = document.getElementById('status');
    if (el) el.textContent = text;
  }

  function wireUi(state) {
    renderFolderTree(state);
    bind('folder-all', 'click', () => {
      state.filters = Object.assign({}, state.filters, {
        excludedFolders: []
      });
      renderFolderTree(state);
      renderGraph(state);
    });
    bind('folder-none', 'click', () => {
      const all = collectAllFolderPaths(state.folderTree || []);
      state.filters = Object.assign({}, state.filters, {
        excludedFolders: all
      });
      renderFolderTree(state);
      renderGraph(state);
    });
    const orphanSelect = document.getElementById('orphan-mode');
    if (orphanSelect) {
      const initial = state.filters && state.filters.orphanMode || (state.filters && state.filters.excludeOrphans ? 'hide' : 'all');
      orphanSelect.value = initial;
      orphanSelect.addEventListener('change', () => {
        state.filters = Object.assign({}, state.filters, {
          orphanMode: orphanSelect.value,
          excludeOrphans: orphanSelect.value === 'hide'
        });
        renderGraph(state);
      });
    }
    const rootsCb = document.getElementById('folder-roots');
    if (rootsCb) {
      rootsCb.checked = !!(state.filters && state.filters.showFolderRoots);
      rootsCb.addEventListener('change', () => {
        state.filters = Object.assign({}, state.filters, {
          showFolderRoots: rootsCb.checked
        });
        // Reset expansion state whenever the toggle flips — start with everything collapsed.
        state.expandedFolders = new Set();
        renderGraph(state);
      });
    }
    document.addEventListener('graphview:filterchange', () => {
      syncFilterUi(state);
      renderGraph(state);
    });
    bind('save-view-btn', 'click', () => openSaveModal(state));
    bind('save-cancel', 'click', () => closeSaveModal());
    bind('save-confirm', 'click', () => submitSaveModal(state));
    const saveInput = document.getElementById('save-name');
    if (saveInput) {
      saveInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitSaveModal(state);
        } else if (e.key === 'Escape') {
          closeSaveModal();
        }
      });
    }
    bind('manage-views-btn', 'click', () => openManageModal(state));
    bind('manage-close', 'click', () => closeManageModal());
    bind('confirm-cancel', 'click', () => closeConfirmModal(false));
    bind('confirm-ok', 'click', () => closeConfirmModal(true));
    bind('export-outline-btn', 'click', () => exportOutline(state));
    syncExportButton(state);
    document.addEventListener('graphview:lockchange', () => syncExportButton(state));
    const picker = document.getElementById('view-picker');
    if (picker) {
      picker.addEventListener('change', () => {
        const fn = picker.value;
        if (!fn) return;
        if (window.GraphView) window.GraphView.sendToPlugin('handleLoadView', {
          filename: fn
        });
      });
    }
    updateViewPicker(state);
  }
  function bind(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }
  function collectAllFolderPaths(tree) {
    const out = [];
    const walk = nodes => {
      for (const n of nodes) {
        out.push(n.path);
        if (n.children && n.children.length) walk(n.children);
      }
    };
    walk(tree);
    return out;
  }
  function renderFolderTree(state) {
    const container = document.getElementById('folder-checkboxes');
    if (!container) return;
    container.innerHTML = '';
    if (!(state.openFilterFolders instanceof Set)) state.openFilterFolders = new Set();
    const excluded = new Set(Array.isArray(state.filters?.excludedFolders) ? state.filters.excludedFolders : []);
    const tree = state.folderTree || [];
    for (const node of tree) {
      container.appendChild(buildFolderRow(node, 0, state, excluded));
    }
  }
  function buildFolderRow(node, depth, state, excluded) {
    const wrap = document.createElement('div');
    wrap.className = 'folder-tree-node';
    const row = document.createElement('div');
    row.className = 'folder-row depth-' + Math.min(depth, 6);
    row.style.paddingLeft = depth * 14 + 'px';
    const hasChildren = node.children && node.children.length > 0;
    const expandBtn = document.createElement('button');
    expandBtn.type = 'button';
    expandBtn.className = 'expand-btn';
    if (hasChildren) {
      const isOpen = state.openFilterFolders.has(node.path);
      expandBtn.textContent = isOpen ? '▾' : '▸';
      expandBtn.addEventListener('click', () => {
        if (state.openFilterFolders.has(node.path)) state.openFilterFolders.delete(node.path);else state.openFilterFolders.add(node.path);
        renderFolderTree(state);
      });
    } else {
      expandBtn.textContent = '';
      expandBtn.disabled = true;
      expandBtn.classList.add('expand-spacer');
    }
    row.appendChild(expandBtn);
    const label = document.createElement('label');
    label.className = 'folder-label';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !excluded.has(node.path);
    cb.addEventListener('change', () => onFolderToggle(node.path, cb.checked, state));
    const span = document.createElement('span');
    span.textContent = node.name;
    label.appendChild(cb);
    label.appendChild(span);
    row.appendChild(label);
    wrap.appendChild(row);
    if (hasChildren && state.openFilterFolders.has(node.path)) {
      const childWrap = document.createElement('div');
      childWrap.className = 'folder-children';
      for (const child of node.children) {
        childWrap.appendChild(buildFolderRow(child, depth + 1, state, excluded));
      }
      wrap.appendChild(childWrap);
    }
    return wrap;
  }
  function findDescendantPaths(tree, targetPath) {
    const result = [];
    const collect = children => {
      for (const c of children) {
        result.push(c.path);
        if (c.children && c.children.length) collect(c.children);
      }
    };
    const visit = nodes => {
      for (const n of nodes) {
        if (n.path === targetPath) {
          if (n.children) collect(n.children);
          return true;
        }
        if (n.children && visit(n.children)) return true;
      }
      return false;
    };
    visit(tree);
    return result;
  }
  function onFolderToggle(path, checked, state) {
    const excluded = new Set(Array.isArray(state.filters?.excludedFolders) ? state.filters.excludedFolders : []);
    const descendants = findDescendantPaths(state.folderTree || [], path);
    if (checked) {
      // Removing exclusion: clear this folder, every ancestor (so a child re-include
      // also re-includes its parent), and every descendant (so a parent re-include
      // sweeps in any previously-hidden subfolders).
      let p = path;
      while (p) {
        excluded.delete(p);
        const idx = p.lastIndexOf('/');
        if (idx < 0) break;
        p = p.slice(0, idx);
      }
      for (const d of descendants) excluded.delete(d);
    } else {
      excluded.add(path);
      for (const d of descendants) excluded.add(d);
    }
    state.filters = Object.assign({}, state.filters, {
      excludedFolders: [...excluded]
    });
    renderFolderTree(state);
    renderGraph(state);
  }
  function syncExportButton(state) {
    const btn = document.getElementById('export-outline-btn');
    if (btn) btn.disabled = !state.lockedNodeId;
  }
  function exportOutline(state) {
    if (!state.lockedNodeId || !window.GraphView) return;
    const anchorId = state.lockedNodeId;
    const neighbors = [];
    const seen = new Set();
    for (const e of state.graph && state.graph.edges || []) {
      const s = typeof e.source === 'string' ? e.source : e.source && e.source.id;
      const t = typeof e.target === 'string' ? e.target : e.target && e.target.id;
      if (s === anchorId && t && !seen.has(t)) {
        seen.add(t);
        neighbors.push(t);
      }
      if (t === anchorId && s && !seen.has(s)) {
        seen.add(s);
        neighbors.push(s);
      }
    }
    window.GraphView.sendToPlugin('handleExportOutline', {
      anchorFilename: anchorId,
      neighborFilenames: neighbors
    });
  }
  function syncFilterUi(state) {
    const filters = state.filters || {};
    const orphanSelect = document.getElementById('orphan-mode');
    if (orphanSelect) {
      orphanSelect.value = filters.orphanMode || (filters.excludeOrphans ? 'hide' : 'all');
    }
    const rootsCb = document.getElementById('folder-roots');
    if (rootsCb) {
      rootsCb.checked = !!filters.showFolderRoots;
    }
    // Folder tree may have changed paths or expansion state; re-render it.
    renderFolderTree(state);
  }
  function updateViewPicker(state) {
    const picker = document.getElementById('view-picker');
    if (!picker) return;
    const current = state.activeViewFilename || '';
    picker.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— current view —';
    picker.appendChild(blank);
    for (const v of state.savedViews || []) {
      const opt = document.createElement('option');
      opt.value = v.filename;
      opt.textContent = v.name + (v.isDefault ? ' (default)' : '');
      if (v.filename === current) opt.selected = true;
      picker.appendChild(opt);
    }
  }
  function openSaveModal(state) {
    const modal = document.getElementById('save-modal');
    const input = document.getElementById('save-name');
    const info = document.getElementById('save-anchor-info');
    if (!modal || !input) return;
    input.value = '';
    if (info) {
      if (state.lockedNodeId) {
        const node = (state.graph && state.graph.nodes || []).find(n => n.id === state.lockedNodeId);
        const title = node ? node.title || state.lockedNodeId : state.lockedNodeId;
        info.textContent = 'Anchor: ' + title;
        info.className = 'save-anchor has-anchor';
      } else {
        info.textContent = 'No anchor — click a node first to lock it as this view\u2019s anchor.';
        info.className = 'save-anchor no-anchor';
      }
    }
    modal.hidden = false;
    setTimeout(() => input.focus(), 0);
  }
  function closeSaveModal() {
    const modal = document.getElementById('save-modal');
    if (modal) modal.hidden = true;
  }
  function submitSaveModal(state) {
    const input = document.getElementById('save-name');
    const name = input ? input.value.trim() : '';
    if (!name) return;
    if (window.GraphView) {
      window.GraphView.sendToPlugin('handleSaveView', {
        name,
        filters: state.filters,
        appearance: state.appearance,
        focus: state.lockedNodeId ? {
          centerNodeId: state.lockedNodeId
        } : null
      });
    }
    closeSaveModal();
  }
  let confirmResolver = null;
  function openConfirmModal(message, title) {
    const modal = document.getElementById('confirm-modal');
    const t = document.getElementById('confirm-title');
    const m = document.getElementById('confirm-message');
    if (!modal || !m) return Promise.resolve(false);
    if (t) t.textContent = title;
    m.textContent = message || '';
    modal.hidden = false;
    return new Promise(resolve => {
      confirmResolver = resolve;
    });
  }
  function closeConfirmModal(result) {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.hidden = true;
    if (confirmResolver) {
      confirmResolver(!!result);
      confirmResolver = null;
    }
  }
  function openManageModal(state) {
    renderManageModal(state);
    const modal = document.getElementById('manage-modal');
    if (modal) modal.hidden = false;
  }
  function refreshManageModal(state) {
    const modal = document.getElementById('manage-modal');
    if (!modal || modal.hidden) return;
    renderManageModal(state);
  }
  function renderManageModal(state) {
    const list = document.getElementById('manage-list');
    if (!list) return;
    list.innerHTML = '';
    if (!state.savedViews || state.savedViews.length === 0) {
      list.textContent = 'No saved views yet. Use Save to create one.';
      return;
    }
    for (const v of state.savedViews) {
      const row = document.createElement('div');
      row.className = 'manage-row';
      const label = document.createElement('span');
      label.textContent = v.name + (v.isDefault ? ' (default)' : '');
      const setDefault = document.createElement('button');
      setDefault.type = 'button';
      setDefault.textContent = v.isDefault ? 'Default' : 'Set default';
      setDefault.disabled = v.isDefault;
      setDefault.addEventListener('click', () => {
        if (window.GraphView) window.GraphView.sendToPlugin('handleSetDefaultView', {
          filename: v.filename
        });
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        const ok = await openConfirmModal('Delete view "' + v.name + '"?', 'Delete view');
        if (ok && window.GraphView) {
          window.GraphView.sendToPlugin('handleDeleteView', {
            filename: v.filename
          });
        }
      });
      row.appendChild(label);
      row.appendChild(setDefault);
      row.appendChild(del);
      list.appendChild(row);
    }
  }
  function closeManageModal() {
    const modal = document.getElementById('manage-modal');
    if (modal) modal.hidden = true;
  }

  const state = {
    graph: {
      nodes: [],
      edges: []
    },
    filters: {},
    appearance: {
      colorBy: 'folder',
      showLabels: 'hover'
    },
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
      labelZoomThreshold: 1.0
    },
    simulation: null,
    expandedFolders: new Set()
  };
  function sendToPlugin(functionName, params) {
    const argsJson = JSON.stringify(JSON.stringify({
      functionName,
      params: params || {}
    }));
    const code = '(async function() { try {' + 'await DataStore.invokePluginCommandByName("graphHTMLMessage", "marginalreader.ZettelGraphView", [' + argsJson + ']);' + '} catch(e) { console.log("IIFE error: " + e.message); } })()';
    // eslint-disable-next-line no-undef
    window.webkit.messageHandlers.jsBridge.postMessage({
      code,
      onHandle: '',
      id: '1'
    });
  }
  window.GraphView = {
    state,
    sendToPlugin,
    renderGraph
  };
  window.onPluginMessage = function (data) {
    if (!data || !data.type) return;
    switch (data.type) {
      case 'graphData':
        state.graph = data.graph;
        renderGraph(state);
        break;
      case 'viewLoaded':
        if (data.filters) state.filters = data.filters;
        if (data.appearance) state.appearance = data.appearance;
        state.activeViewFilename = data.filename || null;
        if (data.graph) state.graph = data.graph;
        state.pendingFocus = data.focus || null;
        renderGraph(state);
        updateViewPicker(state);
        syncFilterUi(state);
        break;
      case 'viewSaved':
      case 'viewDeleted':
        state.savedViews = data.savedViews || [];
        updateViewPicker(state);
        refreshManageModal(state);
        break;
      case 'promptForSave':
        {
          const name = window.prompt('Save current view as:', '');
          if (name && name.trim()) {
            sendToPlugin('handleSaveView', {
              name: name.trim(),
              filters: state.filters,
              appearance: state.appearance
            });
          }
          break;
        }
      case 'error':
        console.log('plugin error: ' + (data.message || ''));
        break;
    }
  };
  function init() {
    const data = window.INITIAL_DATA || {};
    if (data.graph) state.graph = data.graph;
    if (data.filters) state.filters = data.filters;
    if (data.appearance) state.appearance = data.appearance;
    if (data.savedViews) state.savedViews = data.savedViews;
    if (data.activeViewFilename) state.activeViewFilename = data.activeViewFilename;
    if (data.folderList) state.folderList = data.folderList;
    if (data.folderTree) state.folderTree = data.folderTree;
    if (data.settings) Object.assign(state.settings, data.settings);
    wireUi(state);
    renderGraph(state);

    // Always ask the plugin to apply the default view on init. NotePlan restores cached
    // HTML on relaunch (it doesn't re-run buildAndShowPanel), so reading the default
    // from preferences is the only way to make sure it's applied after restart.
    setTimeout(() => {
      if (window.GraphView) {
        window.GraphView.sendToPlugin('handleApplyDefault', {});
      }
    }, 100);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
