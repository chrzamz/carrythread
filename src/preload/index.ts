import { contextBridge, ipcRenderer } from 'electron'
import type { CarrythreadAPI } from '../core/contracts'

const invoke = (method: string, ...args: unknown[]) =>
  ipcRenderer.invoke(`carrythread:${method}`, ...args)
const api: CarrythreadAPI = {
  onChange: (listener) => { const callback = () => listener(); ipcRenderer.on('carrythread:changed', callback); return () => ipcRenderer.removeListener('carrythread:changed', callback) },
  snapshot: () => invoke('snapshot'),
  chooseSource: (agent) => invoke('chooseSource', agent),
  chooseWorkspace: (current) => invoke('chooseWorkspace', current),
  detectSources: () => invoke('detectSources'),
  saveSettings: (settings) => invoke('saveSettings', settings),
  scan: () => invoke('scan'),
  session: (id) => invoke('session', id),
  search: (query) => invoke('search', query),
  saveProvider: (config, key) => invoke('saveProvider', config, key),
  removeProvider: (id) => invoke('removeProvider', id),
  testProvider: (id) => invoke('testProvider', id),
  providerPresets: () => invoke('providerPresets'),
  previewReview: (request) => invoke('previewReview', request),
  review: (request) => invoke('review', request),
  cancelReview: () => invoke('cancelReview'),
  patchItem: (patch) => invoke('patchItem', patch),
  itemHistory: (id) => invoke('itemHistory', id),
  mergeItems: (ids, title) => invoke('mergeItems', ids, title),
  splitItem: (id, titles) => invoke('splitItem', id, titles),
  targets: () => invoke('targets'),
  prepareHandoff: (request) => invoke('prepareHandoff', request),
  launchHandoff: (id) => invoke('launchHandoff', id),
  exportHandoff: (id) => invoke('exportHandoff', id),
  openEvidence: (id) => invoke('openEvidence', id),
  exportData: () => invoke('exportData'),
  importData: () => invoke('importData'),
  clearLocalData: () => invoke('clearLocalData'),
  openExternal: (url) => invoke('openExternal', url),
  version: () => invoke('version'),
}
contextBridge.exposeInMainWorld('carrythread', api)
