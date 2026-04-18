const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vault', {
    getProfiles: () => ipcRenderer.invoke('profiles:list'),
    createProfile: (payload) => ipcRenderer.invoke('profiles:create', payload),
    openProfile: (payload) => ipcRenderer.invoke('profiles:open', payload),
    updateProfile: (payload) => ipcRenderer.invoke('profiles:update', payload),
    listEntries: (payload) => ipcRenderer.invoke('entries:list', payload),
    createFolder: (payload) => ipcRenderer.invoke('entries:createFolder', payload),
    deleteEntry: (payload) => ipcRenderer.invoke('entries:delete', payload),
    renameEntry: (payload) => ipcRenderer.invoke('entries:rename', payload),
    toggleLock: (payload) => ipcRenderer.invoke('entries:toggleLock', payload),
    openEntry: (payload) => ipcRenderer.invoke('entries:open', payload),
    importFiles: (payload) => ipcRenderer.invoke('entries:importFiles', payload),
    previewEntry: (payload) => ipcRenderer.invoke('entries:preview', payload),
    searchEntries: (payload) => ipcRenderer.invoke('entries:search', payload),
    listActivity: (payload) => ipcRenderer.invoke('activity:list', payload),
    lockSession: (payload) => ipcRenderer.invoke('session:lock', payload),
    openCmd: (payload) => ipcRenderer.invoke('system:openCmd', payload),
});
