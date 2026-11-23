// Exposes a small file API to the page as window.native.
// The main process re-checks every request, so this bridge grants nothing by itself
// except for files you drag in (the browser vouches for those; the page can't fake them).
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const inv = (ch, ...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('native', {
  getArgs: () => inv('args'),
  pickFolder: () => inv('pickFolder'),
  pickFile: () => inv('pickFile'),
  stat: p => inv('stat', p),
  scanFolder: dir => inv('scan', dir),
  readBytes: async (p, start, end) => {
    const u = await inv('read', p, start, end);
    return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
  },
  writeText: (p, text) => inv('writeText', p, text),
  saveDialog: name => inv('saveDialog', name),
  runSync: ops => inv('sync', ops),
  fileOp: (mode, toSide, items) => inv('fileop', mode, toSide, items),
  // Only real dropped or picked files have a path; files made by script return ''.
  pathOf: file => {
    let p = '';
    try { p = webUtils.getPathForFile(file); } catch (e) {}
    if (p) ipcRenderer.send('grant-drop', p);
    return p;
  },
});
