/* eslint-env noteplan */
/* global DataStore */

export const PREF_DEFAULT_VIEW = 'graphView_defaultViewFilename'

export function getSettings() {
  return DataStore.settings || {}
}

export function getSavedViewsFolder() {
  const s = getSettings()
  return (s.savedViewsFolder || '@Plugins/Zettel Graph View/Views').trim()
}

export function getDefaultViewFilename() {
  try { return DataStore.preference(PREF_DEFAULT_VIEW) || '' } catch (e) { return '' }
}

export function setDefaultViewFilename(filename) {
  try { DataStore.setPreference(PREF_DEFAULT_VIEW, filename || '') } catch (e) { console.log('setDefaultViewFilename: ' + e.message) }
}
