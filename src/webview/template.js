export function buildHtml(initialData) {
  const json = JSON.stringify(initialData).replace(/</g, '\\u003c')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Graph View</title>
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
</html>`
}
