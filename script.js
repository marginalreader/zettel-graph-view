'use strict';

var exports = globalThis;

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

/* eslint-env noteplan */
/* global DataStore */

const PREF_DEFAULT_VIEW = 'graphView_defaultViewFilename';
function getSettings() {
  return DataStore.settings || {};
}
function getSavedViewsFolder() {
  const s = getSettings();
  return (s.savedViewsFolder || '@Plugins/Zettel Graph/Views').trim();
}
function getDefaultViewFilename() {
  try {
    return DataStore.preference(PREF_DEFAULT_VIEW) || '';
  } catch (e) {
    return '';
  }
}
function setDefaultViewFilename(filename) {
  try {
    DataStore.setPreference(PREF_DEFAULT_VIEW, filename || '');
  } catch (e) {
    console.log('setDefaultViewFilename: ' + e.message);
  }
}

function buildGraph() {
  let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const settings = getSettings();
  const includeCalendar = opts.includeCalendarNotes !== undefined ? opts.includeCalendarNotes : settings.includeCalendarNotes === true;
  // System-level exclusions from settings always apply. View-level excludedFolders
  // (from a saved view's filters or the live filter UI) layer on top, so unchecking
  // a folder in the picker can never accidentally re-include @Templates etc.
  const systemExcluded = Array.isArray(settings.excludedFolders) && settings.excludedFolders.length ? settings.excludedFolders : ['@Templates', '@Archive', '@Trash', '@Plugins'];
  const viewExcluded = Array.isArray(opts.excludedFolders) ? opts.excludedFolders : [];
  const excludedFolders = [...new Set([...systemExcluded, ...viewExcluded])].map(f => String(f).replace(/\/$/, ''));
  const includeFolders = Array.isArray(opts.includeFolders) && opts.includeFolders.length > 0 ? opts.includeFolders : null;
  const excludeOrphans = opts.excludeOrphans === true;
  const projectNotes = DataStore.projectNotes || [];
  const calendarNotes = includeCalendar ? DataStore.calendarNotes || [] : [];
  const allNotes = projectNotes.concat(calendarNotes);
  const isExcluded = filename => excludedFolders.some(folder => filename === folder || filename.startsWith(folder + '/'));
  const matchesIncluded = filename => {
    if (!includeFolders) return true;
    return includeFolders.some(folder => filename === folder || filename.startsWith(folder + '/'));
  };
  const nodes = new Map();
  const titleIndex = new Map(); // lowercase title → filename
  for (const note of allNotes) {
    if (!note || !note.filename) continue;
    if (isExcluded(note.filename)) continue;
    if (!matchesIncluded(note.filename)) continue;
    const folderPath = note.filename.includes('/') ? note.filename.slice(0, note.filename.lastIndexOf('/')) : '';
    const topLevel = folderPath.split('/')[0] || (note.type === 'Calendar' ? 'Calendar' : '(root)');
    nodes.set(note.filename, {
      id: note.filename,
      title: note.title || note.filename.replace(/\.(md|txt)$/, ''),
      type: note.type === 'Calendar' ? 'calendar' : 'project',
      folder: topLevel,
      folderPath: folderPath || topLevel,
      hashtags: Array.isArray(note.hashtags) ? note.hashtags : [],
      mentions: Array.isArray(note.mentions) ? note.mentions : [],
      degree: 0
    });
    const t = (note.title || '').toLowerCase().trim();
    if (t && !titleIndex.has(t)) titleIndex.set(t, note.filename);
  }
  const edges = new Map();
  const wikilinkRe = /\[\[([^\]|#^]+)(?:[|#^][^\]]*)?\]\]/g;
  for (const note of allNotes) {
    if (!note || !note.filename) continue;
    if (!nodes.has(note.filename)) continue;
    const sourceFn = note.filename;
    const seenInThisNote = new Set();
    const linkedItems = note.linkedItems || [];
    for (const para of linkedItems) {
      let targetFn = null;
      if (para && para.referencedNote && para.referencedNote.filename) {
        targetFn = para.referencedNote.filename;
      }
      if (!targetFn && para && typeof para.content === 'string') {
        wikilinkRe.lastIndex = 0;
        let m;
        while ((m = wikilinkRe.exec(para.content)) !== null) {
          const lookup = m[1].trim().toLowerCase();
          const fn = titleIndex.get(lookup);
          if (fn) addEdge(sourceFn, fn, edges, nodes, seenInThisNote);
        }
        continue;
      }
      if (targetFn) addEdge(sourceFn, targetFn, edges, nodes, seenInThisNote);
    }
  }
  for (const node of nodes.values()) node.degree = 0;
  for (const edge of edges.values()) {
    const a = nodes.get(edge.source);
    const b = nodes.get(edge.target);
    if (a) a.degree += edge.weight;
    if (b) b.degree += edge.weight;
  }
  let nodeList = [...nodes.values()];
  if (excludeOrphans) {
    const keep = new Set(nodeList.filter(n => n.degree > 0).map(n => n.id));
    nodeList = nodeList.filter(n => keep.has(n.id));
    for (const key of [...edges.keys()]) {
      const e = edges.get(key);
      if (!keep.has(e.source) || !keep.has(e.target)) edges.delete(key);
    }
  }
  return {
    nodes: nodeList,
    edges: [...edges.values()]
  };
}
function addEdge(sourceFn, targetFn, edges, nodes, seenInThisNote) {
  if (!targetFn || sourceFn === targetFn) return;
  if (!nodes.has(targetFn)) return;
  const _ref = sourceFn < targetFn ? [sourceFn, targetFn] : [targetFn, sourceFn],
    _ref2 = _slicedToArray(_ref, 2),
    a = _ref2[0],
    b = _ref2[1];
  const key = a + '::' + b;
  // Within one note, count multiple links to the same target as 1 (idempotent per scan).
  // Across notes, increment weight (mutual links).
  const seenKey = sourceFn + '|' + key;
  if (seenInThisNote.has(seenKey)) return;
  seenInThisNote.add(seenKey);
  const existing = edges.get(key);
  if (existing) existing.weight += 1;else edges.set(key, {
    source: a,
    target: b,
    weight: 1
  });
}
function collectTopLevelFolders(nodes) {
  const set = new Set();
  for (const n of nodes) set.add(n.folder);
  return [...set].sort();
}
function collectFolderTree(nodes) {
  const root = new Map();
  for (const n of nodes) {
    const path = n.folderPath || n.folder;
    if (!path) continue;
    const parts = path.split('/');
    let parent = root;
    let acc = '';
    for (const part of parts) {
      acc = acc ? acc + '/' + part : part;
      if (!parent.has(part)) {
        parent.set(part, {
          name: part,
          path: acc,
          children: new Map()
        });
      }
      parent = parent.get(part).children;
    }
  }
  const toArray = map => [...map.values()].sort((a, b) => a.name.localeCompare(b.name)).map(n => ({
    name: n.name,
    path: n.path,
    children: toArray(n.children)
  }));
  return toArray(root);
}

const PREF_LAST_VIEW = 'graphView_lastViewFilename';
function listSavedViews() {
  const folder = getSavedViewsFolder();
  const defaultFn = getDefaultViewFilename();
  const notes = DataStore.projectNotes || [];
  return notes.filter(n => n && n.filename && n.filename.startsWith(folder + '/')).filter(n => {
    const fm = n.frontmatterAttributes || {};
    return fm.graphView === true || fm.graphView === 'true';
  }).map(n => ({
    filename: n.filename,
    name: n.title || n.filename,
    isDefault: n.filename === defaultFn
  })).sort((a, b) => a.name.localeCompare(b.name));
}
function readSavedViewNote(filename) {
  if (!filename) return null;
  const note = (DataStore.projectNotes || []).find(n => n.filename === filename);
  if (!note) return null;
  const fm = note.frontmatterAttributes || {};
  console.log('readSavedViewNote: ' + filename + ' fmKeys=' + JSON.stringify(Object.keys(fm)));

  // Primary: body fenced ```json block. Most reliable — NotePlan doesn't touch body content.
  let cfg = extractBodyJson(note.content || '');
  let source = cfg ? 'body' : null;

  // Fallback 1: frontmatter graphViewConfig (string OR pre-parsed object).
  if (!cfg) {
    const raw = fm.graphViewConfig;
    const preview = typeof raw === 'string' ? raw.slice(0, 80) : JSON.stringify(raw || null).slice(0, 80);
    console.log('readSavedViewNote: graphViewConfig type=' + typeof raw + ' val=' + preview);
    if (typeof raw === 'string' && raw.length > 0) {
      try {
        cfg = JSON.parse(raw);
        source = 'fm-string';
      } catch (e) {
        console.log('readSavedViewNote: JSON parse failed: ' + e.message);
      }
    } else if (raw && typeof raw === 'object') {
      cfg = raw;
      source = 'fm-object';
    }
  }

  // Fallback 2: legacy nested fm.filters / fm.appearance.
  if (!cfg && (fm.filters || fm.appearance)) {
    cfg = {
      filters: fm.filters,
      appearance: fm.appearance
    };
    source = 'fm-legacy';
  }
  if (!cfg) cfg = {};
  console.log('readSavedViewNote: source=' + source + ' cfgKeys=' + JSON.stringify(Object.keys(cfg)));
  return {
    filename: note.filename,
    name: note.title || filename,
    filters: normalizeFilters(cfg.filters),
    appearance: normalizeAppearance(cfg.appearance),
    focus: cfg.focus && typeof cfg.focus === 'object' ? cfg.focus : null,
    isDefault: fm.isDefault === true || fm.isDefault === 'true'
  };
}
function extractBodyJson(content) {
  if (!content) return null;
  const m = content.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    console.log('extractBodyJson: parse failed: ' + e.message);
    return null;
  }
}
function normalizeFilters(raw) {
  const f = raw && typeof raw === 'object' ? raw : {};
  let orphanMode = f.orphanMode;
  if (orphanMode !== 'all' && orphanMode !== 'hide' && orphanMode !== 'only') {
    orphanMode = f.excludeOrphans === true || f.excludeOrphans === 'true' ? 'hide' : 'all';
  }
  return {
    includeCalendarNotes: f.includeCalendarNotes === true || f.includeCalendarNotes === 'true',
    includeFolders: Array.isArray(f.includeFolders) ? f.includeFolders.slice() : null,
    excludedFolders: Array.isArray(f.excludedFolders) ? f.excludedFolders.slice() : null,
    orphanMode,
    excludeOrphans: orphanMode === 'hide',
    showFolderRoots: f.showFolderRoots === true || f.showFolderRoots === 'true'
  };
}
function normalizeAppearance(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  return {
    colorBy: a.colorBy || 'folder',
    showLabels: a.showLabels || 'hover',
    linkDistance: a.linkDistance != null ? Number(a.linkDistance) : null,
    chargeStrength: a.chargeStrength != null ? Number(a.chargeStrength) : null
  };
}
function sanitizeName(name) {
  return String(name || 'View').replace(/[\/\\:*?"<>|]/g, '_').trim().slice(0, 80) || 'View';
}
function toYaml(obj) {
  let indent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  const pad = '  '.repeat(indent);
  const lines = [];
  for (const _ref of Object.entries(obj)) {
    var _ref2 = _slicedToArray(_ref, 2);
    const key = _ref2[0];
    const value = _ref2[1];
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`);
      } else if (value.every(v => typeof v !== 'object' || v === null)) {
        lines.push(`${pad}${key}: [${value.map(v => yamlScalar(v)).join(', ')}]`);
      } else {
        lines.push(`${pad}${key}:`);
        for (const item of value) lines.push(`${pad}- ${yamlScalar(item)}`);
      }
    } else if (typeof value === 'object') {
      lines.push(`${pad}${key}:`);
      lines.push(toYaml(value, indent + 1));
    } else {
      lines.push(`${pad}${key}: ${yamlScalar(value)}`);
    }
  }
  return lines.join('\n');
}
function yamlScalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (s === '' || /[:#\-?{}\[\],&*!|>'"%@`\n]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}
function buildSavedViewMarkdown(name, filters, appearance, focus, viewFilename) {
  const cfgJson = JSON.stringify({
    filters: filters || {},
    appearance: appearance || {},
    focus: focus || null
  }, null, 2);
  const fm = {
    title: name,
    graphView: true,
    graphViewVersion: 1,
    isDefault: false,
    createdAt: new Date().toISOString()
  };
  const yaml = toYaml(fm);
  const cmd = encodeURIComponent('zettel graph view: load view');
  const arg = encodeURIComponent(viewFilename);
  const callback = `noteplan://x-callback-url/runPlugin?pluginID=marginalreader.ZettelGraphView&command=${cmd}&arg0=${arg}`;
  return `---\n${yaml}\n---\n\n` + `# ${name}\n\n` + `Saved view for the Zettel Graph View plugin.\n\n` + '```json\n' + cfgJson + '\n```\n\n' + `[Load this view](${callback})\n`;
}
async function handleSaveView(paramsStr) {
  const _JSON$parse = JSON.parse(paramsStr),
    name = _JSON$parse.name,
    filters = _JSON$parse.filters,
    appearance = _JSON$parse.appearance,
    focus = _JSON$parse.focus;
  const folder = getSavedViewsFolder();
  const safeName = sanitizeName(name);
  const predictedFn = `${folder}/${safeName}.md`;
  const md = buildSavedViewMarkdown(safeName, filters, appearance, focus, predictedFn);
  // eslint-disable-next-line no-undef
  const newFn = await DataStore.newNoteWithContent(md, folder);
  const finalFn = newFn || predictedFn;
  if (newFn && newFn !== predictedFn) {
    const note = (DataStore.projectNotes || []).find(n => n.filename === newFn);
    if (note) {
      const fixed = md.replace(encodeURIComponent(predictedFn), encodeURIComponent(newFn));
      try {
        note.content = fixed;
      } catch (e) {
        console.log('handleSaveView: rewrite failed: ' + e.message);
      }
    }
  }
  // DataStore.projectNotes does not always include the just-created note synchronously,
  // so fold it in manually to keep the picker fresh.
  const indexed = listSavedViews();
  const present = indexed.some(v => v.filename === finalFn);
  const merged = present ? indexed : indexed.concat([{
    filename: finalFn,
    name: safeName,
    isDefault: false
  }]).sort((a, b) => a.name.localeCompare(b.name));
  await pushToPanel('viewSaved', {
    savedViews: merged,
    filename: finalFn
  });
}
async function handleLoadView(paramsStr) {
  const _JSON$parse2 = JSON.parse(paramsStr),
    filename = _JSON$parse2.filename;
  const view = readSavedViewNote(filename);
  if (!view) {
    await pushToPanel('error', {
      message: 'View not found: ' + filename
    });
    return;
  }
  console.log('handleLoadView: ' + filename + ' filters=' + JSON.stringify(view.filters) + ' focus=' + JSON.stringify(view.focus));
  const graph = buildGraph(view.filters);
  console.log('handleLoadView: built graph nodes=' + graph.nodes.length + ' edges=' + graph.edges.length);
  try {
    DataStore.setPreference(PREF_LAST_VIEW, filename);
  } catch (e) {/* ignore */}
  await pushToPanel('viewLoaded', {
    filename,
    filters: view.filters,
    appearance: view.appearance,
    focus: view.focus,
    graph
  });
}
async function handleDeleteView(paramsStr) {
  const _JSON$parse3 = JSON.parse(paramsStr),
    filename = _JSON$parse3.filename;
  console.log('handleDeleteView: ' + filename);
  const note = (DataStore.projectNotes || []).find(n => n.filename === filename);
  if (!note) {
    console.log('handleDeleteView: note not found in DataStore.projectNotes');
  } else {
    // Always soft-delete first — flip the graphView flag so the note is excluded from
    // listSavedViews regardless of whether moveNote actually relocates the file.
    try {
      const original = note.content || '';
      const flipped = original.replace(/^graphView:\s*true\s*$/m, 'graphView: false');
      if (flipped !== original) {
        note.content = flipped;
        console.log('handleDeleteView: flipped graphView flag');
      } else {
        console.log('handleDeleteView: graphView flag not found in content');
      }
    } catch (e) {
      console.log('handleDeleteView: content rewrite failed: ' + e.message);
    }
    // Then try to move to @Trash (best effort).
    if (typeof DataStore.moveNote === 'function') {
      try {
        const result = DataStore.moveNote(note.filename, '@Trash');
        console.log('handleDeleteView: moveNote returned ' + JSON.stringify(result));
      } catch (e) {
        console.log('handleDeleteView: moveNote threw: ' + e.message);
      }
    } else {
      console.log('handleDeleteView: DataStore.moveNote is not a function');
    }
  }
  if (getDefaultViewFilename() === filename) {
    setDefaultViewFilename('');
  }
  // Always exclude the deleted filename from the response — DataStore.projectNotes
  // doesn't always reflect the deletion synchronously.
  const merged = listSavedViews().filter(v => v.filename !== filename);
  await pushToPanel('viewDeleted', {
    savedViews: merged
  });
}
async function handleSetDefaultView(paramsStr) {
  const _JSON$parse4 = JSON.parse(paramsStr),
    filename = _JSON$parse4.filename;
  setDefaultViewFilename(filename || '');
  await pushToPanel('viewSaved', {
    savedViews: listSavedViews()
  });
}
async function handleListViews() {
  await pushToPanel('viewSaved', {
    savedViews: listSavedViews()
  });
}
async function handleApplyDefault() {
  const defaultFn = getDefaultViewFilename();
  console.log('handleApplyDefault: defaultViewFilename=' + JSON.stringify(defaultFn));
  if (!defaultFn) return;
  const view = readSavedViewNote(defaultFn);
  if (!view) {
    console.log('handleApplyDefault: default view not found: ' + defaultFn);
    return;
  }
  const graph = buildGraph(view.filters);
  await pushToPanel('viewLoaded', {
    filename: defaultFn,
    filters: view.filters,
    appearance: view.appearance,
    focus: view.focus,
    graph
  });
}

/* eslint-env noteplan */
/* global HTMLView, Editor, DataStore, CommandBar */

const PANEL_WINDOW_ID$1 = 'zettel-graph-view';
async function pushToPanel(type, data) {
  const payload = Object.assign({
    type
  }, data);
  const doubleStringified = JSON.stringify(JSON.stringify(payload));
  const jsCode = '(function() { try { var d = JSON.parse(' + doubleStringified + '); if (window.onPluginMessage) window.onPluginMessage(d); } catch(e) { console.log("pushToPanel error: " + e.message); } })()';
  await HTMLView.runJavaScript(jsCode, PANEL_WINDOW_ID$1);
}
async function handleOpenNote(paramsStr) {
  const _JSON$parse = JSON.parse(paramsStr),
    filename = _JSON$parse.filename;
  if (!filename) return;
  await Editor.openNoteByFilename(filename, false);
}
async function handleRefreshGraph(paramsStr) {
  const _JSON$parse2 = JSON.parse(paramsStr),
    filters = _JSON$parse2.filters;
  const graph = buildGraph(filters || {});
  await pushToPanel('graphData', {
    graph
  });
}
async function handleOpenFolder(paramsStr) {
  const _JSON$parse3 = JSON.parse(paramsStr),
    folder = _JSON$parse3.folder;
  if (!folder) return;
  const allNotes = DataStore.projectNotes || [];
  const inFolder = allNotes.filter(n => n.filename === folder || n.filename.startsWith(folder + '/'));
  if (inFolder.length === 0) {
    console.log('handleOpenFolder: no notes in folder ' + folder);
    return;
  }
  // Open the most-recently-changed note as a navigation anchor for that folder.
  inFolder.sort((a, b) => {
    const da = a.changedDate ? a.changedDate.getTime() : 0;
    const db = b.changedDate ? b.changedDate.getTime() : 0;
    return db - da;
  });
  const target = inFolder[0];
  try {
    await Editor.openNoteByFilename(target.filename, false, 0, 0, false);
  } catch (e) {
    console.log('handleOpenFolder: open failed: ' + e.message);
  }
}
async function handleExportOutline(paramsStr) {
  const _JSON$parse4 = JSON.parse(paramsStr),
    anchorFilename = _JSON$parse4.anchorFilename,
    neighborFilenames = _JSON$parse4.neighborFilenames;
  if (!anchorFilename) {
    console.log('handleExportOutline: missing anchorFilename');
    return;
  }
  const allNotes = DataStore.projectNotes || [];
  const anchor = allNotes.find(n => n.filename === anchorFilename);
  if (!anchor) {
    console.log('handleExportOutline: anchor not found: ' + anchorFilename);
    await pushToPanel('error', {
      message: 'Anchor note not found in vault.'
    });
    return;
  }
  const anchorTitle = anchor.title || anchorFilename.replace(/\.(md|txt)$/, '');
  const neighbors = [];
  for (const fn of neighborFilenames || []) {
    const note = allNotes.find(n => n.filename === fn);
    if (note) neighbors.push({
      filename: note.filename,
      title: note.title || note.filename.replace(/\.(md|txt)$/, '')
    });
  }
  neighbors.sort((a, b) => a.title.localeCompare(b.title));
  const settings = getSettings();
  const preferredFolder = (settings.outlineExportFolder || '').trim();
  const allFolders = (DataStore.folders || []).filter(f => {
    if (!f) return false;
    if (f === '/' || f === '@Trash') return false;
    if (f.startsWith('@Trash/')) return false;
    return true;
  });
  if (allFolders.length === 0) {
    await pushToPanel('error', {
      message: 'No folders available to export into.'
    });
    return;
  }
  const sortedFolders = preferredFolder && allFolders.includes(preferredFolder) ? [preferredFolder, ...allFolders.filter(f => f !== preferredFolder)] : allFolders.slice();
  let pickerResult;
  try {
    pickerResult = await CommandBar.showOptions(sortedFolders, `Export outline of "${anchorTitle}" to folder…`);
  } catch (e) {
    console.log('handleExportOutline: folder picker failed: ' + e.message);
    return;
  }
  if (!pickerResult || typeof pickerResult.index !== 'number' || pickerResult.index < 0) {
    console.log('handleExportOutline: folder pick cancelled');
    return;
  }
  const folder = sortedFolders[pickerResult.index];
  const safeAnchor = anchorTitle.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 60);
  const lines = [];
  lines.push(`# Outline - ${safeAnchor}`);
  lines.push('');
  lines.push(`- [[${anchorTitle}]]`);
  for (const n of neighbors) lines.push(`- [[${n.title}]]`);
  const md = lines.join('\n') + '\n';
  let newFn = null;
  try {
    newFn = await DataStore.newNoteWithContent(md, folder);
    console.log('handleExportOutline: created ' + newFn);
  } catch (e) {
    console.log('handleExportOutline: newNoteWithContent failed: ' + e.message);
    await pushToPanel('error', {
      message: 'Could not create outline note: ' + e.message
    });
    return;
  }
  if (newFn) {
    try {
      await Editor.openNoteByFilename(newFn, false, 0, 0, true);
    } catch (e) {
      console.log('handleExportOutline: open failed: ' + e.message);
    }
  }
}
async function graphHTMLMessage$1(messageStr) {
  let parsed;
  try {
    parsed = JSON.parse(messageStr);
  } catch (e) {
    console.log('graphHTMLMessage: bad JSON: ' + e.message);
    return;
  }
  const _ref = parsed || {},
    functionName = _ref.functionName,
    params = _ref.params;
  if (!functionName) {
    console.log('graphHTMLMessage: missing functionName');
    return;
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
    handleOpenFolder
  };
  if (handlers[functionName]) {
    return await handlers[functionName](JSON.stringify(params || {}));
  }
  console.log('graphHTMLMessage: unknown function: ' + functionName);
}

function buildHtml(initialData) {
  const json = JSON.stringify(initialData).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Zettel Graph View</title>
  <link rel="stylesheet" href="./webview-styles.css">
  <script src="./d3.min.js"></script>
  <script>window.INITIAL_DATA = ${json};</script>
</head>
<body>
  <div class="top-bar">
    <select id="view-picker" title="Saved views">
      <option value="">— current view —</option>
    </select>
    <button id="save-view-btn" title="Save current view as a note">Save</button>
    <button id="manage-views-btn" title="Manage saved views">Manage…</button>
    <button id="export-outline-btn" title="Export the locked anchor + its connected notes as a new outline note" disabled>Export outline</button>
    <details id="filter-panel">
      <summary>Filters</summary>
      <div class="filter-body">
        <fieldset>
          <legend>Folders</legend>
          <div id="folder-checkboxes"></div>
          <div class="folder-actions">
            <button id="folder-all" type="button">All</button>
            <button id="folder-none" type="button">None</button>
          </div>
        </fieldset>
        <label class="folder-roots-toggle">
          <input type="checkbox" id="folder-roots">
          Show folder roots
        </label>
      </div>
    </details>
    <label class="orphan-mode">
      <span>Orphans:</span>
      <select id="orphan-mode">
        <option value="all">Show all</option>
        <option value="hide">Hide orphans</option>
        <option value="only">Only orphans</option>
      </select>
    </label>
    <span class="status" id="status"></span>
  </div>
  <svg id="graph"></svg>
  <div id="save-modal" class="modal" hidden>
    <div class="modal-content">
      <h3>Save Current View</h3>
      <label class="save-label">Name
        <input id="save-name" type="text" autocomplete="off" placeholder="e.g. Permanent notes">
      </label>
      <div id="save-anchor-info" class="save-anchor"></div>
      <div class="modal-actions">
        <button id="save-cancel" type="button">Cancel</button>
        <button id="save-confirm" type="button" class="primary">Save</button>
      </div>
    </div>
  </div>
  <div id="manage-modal" class="modal" hidden>
    <div class="modal-content">
      <h3>Manage Saved Views</h3>
      <div id="manage-list"></div>
      <button id="manage-close" type="button">Close</button>
    </div>
  </div>
  <div id="confirm-modal" class="modal" hidden>
    <div class="modal-content">
      <h3 id="confirm-title">Confirm</h3>
      <p id="confirm-message"></p>
      <div class="modal-actions">
        <button id="confirm-cancel" type="button">Cancel</button>
        <button id="confirm-ok" type="button" class="primary">OK</button>
      </div>
    </div>
  </div>
  <script src="./webview-bundle.js"></script>
</body>
</html>`;
}

/* eslint-env noteplan */
/* global HTMLView */

const PANEL_WINDOW_ID = 'zettel-graph-view';
async function buildAndShowPanel(opts) {
  const o = opts || {};
  const settings = getSettings();
  let activeView = null;
  if (o.viewFilename) {
    activeView = readSavedViewNote(o.viewFilename);
  } else {
    const defaultFn = getDefaultViewFilename();
    console.log('buildAndShowPanel: defaultViewFilename=' + JSON.stringify(defaultFn));
    if (defaultFn) activeView = readSavedViewNote(defaultFn);
  }
  const filters = activeView ? activeView.filters : {
    includeCalendarNotes: settings.includeCalendarNotes === true,
    excludedFolders: Array.isArray(settings.excludedFolders) ? settings.excludedFolders : null,
    orphanMode: 'all',
    excludeOrphans: false,
    showFolderRoots: false
  };
  const graph = buildGraph(filters);
  const folderList = collectTopLevelFolders(graph.nodes);
  const folderTree = collectFolderTree(graph.nodes);
  const initialData = {
    graph,
    filters,
    appearance: activeView ? activeView.appearance : {
      colorBy: 'folder',
      showLabels: 'hover'
    },
    savedViews: listSavedViews(),
    activeViewFilename: activeView ? activeView.filename : null,
    folderList,
    folderTree,
    settings: {
      defaultLinkDistance: Number(settings.defaultLinkDistance != null ? settings.defaultLinkDistance : 60),
      defaultChargeStrength: Number(settings.defaultChargeStrength != null ? settings.defaultChargeStrength : -200),
      nodeRadiusMin: Number(settings.nodeRadiusMin != null ? settings.nodeRadiusMin : 4),
      nodeRadiusMax: Number(settings.nodeRadiusMax != null ? settings.nodeRadiusMax : 20),
      labelZoomThreshold: Number(settings.labelZoomThreshold != null ? settings.labelZoomThreshold : 1.0)
    }
  };
  const html = buildHtml(initialData);
  HTMLView.showInMainWindow(html, 'Zettel Graph View', {
    id: PANEL_WINDOW_ID,
    splitView: false,
    icon: 'diagram-project',
    iconColor: 'purple-500'
  });
}
async function openGraphView() {
  try {
    await buildAndShowPanel({});
  } catch (e) {
    console.log('openGraphView error: ' + e.message);
  }
}
async function loadSavedView(viewFilename) {
  try {
    if (!viewFilename) {
      console.log('loadSavedView: missing viewFilename');
      return;
    }
    await buildAndShowPanel({
      viewFilename
    });
  } catch (e) {
    console.log('loadSavedView error: ' + e.message);
  }
}
async function saveCurrentView() {
  try {
    await pushToPanel('promptForSave', {});
  } catch (e) {
    console.log('saveCurrentView error: ' + e.message);
  }
}
async function refreshGraph() {
  try {
    const graph = buildGraph({});
    await pushToPanel('graphData', {
      graph
    });
  } catch (e) {
    console.log('refreshGraph error: ' + e.message);
  }
}
const graphHTMLMessage = graphHTMLMessage$1;
async function onSettingsUpdated() {
  try {
    await buildAndShowPanel({});
  } catch (e) {
    console.log('onSettingsUpdated error: ' + e.message);
  }
}
function onUpdateOrInstall() {
  console.log('marginalreader.ZettelGraphView installed/updated');
}

exports.graphHTMLMessage = graphHTMLMessage;
exports.loadSavedView = loadSavedView;
exports.onSettingsUpdated = onSettingsUpdated;
exports.onUpdateOrInstall = onUpdateOrInstall;
exports.openGraphView = openGraphView;
exports.refreshGraph = refreshGraph;
exports.saveCurrentView = saveCurrentView;
