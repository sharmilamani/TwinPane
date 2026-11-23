// Twinpane — desktop shell (Electron main process)
//
// Security model: the window shows the contents of files you compare, and those
// files can come from anywhere. The page therefore gets no Node access, runs
// sandboxed, and can only reach files and folders that you opened yourself
// (file dialog, drag and drop, Explorer menu or command line). Everything the
// page asks for is checked here again.
const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const APP_DIR = path.join(__dirname, 'app');
const HOST = 'twinpane';
const ORIGIN = `app://${HOST}`;
const IS_WIN = process.platform === 'win32';
const MAX_READ = 1024 * 1024 * 1024;   // largest single read: 1 GB
const MAX_TEXT = 256 * 1024 * 1024;    // largest text save: 256 MB
const MAX_OPS = 200000;                // largest sync plan
const MAX_SCAN = 300000;               // most files listed per folder

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

// The page is served from app://twinpane/ instead of file://, so it gets no
// file-system privileges from its address.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true } }]);
app.enableSandbox();

const argv = process.argv.slice(app.isPackaged ? 1 : 2);
let launchPaths = [];
let win = null;

/* ---------------- paths the user has granted ---------------- */

const grants = []; // { real, dir }
let grantQueue = Promise.resolve();

const keyOf = p => (IS_WIN ? p.toLowerCase() : p);

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!path.isAbsolute(rel) && rel.split(path.sep)[0] !== '..');
}

// Resolves symlinks and junctions on the deepest part of the path that exists,
// so a link inside a granted folder can't point the app somewhere else.
async function realOf(p) {
  let cur = path.resolve(p);
  const rest = [];
  for (;;) {
    try { return path.join(await fsp.realpath(cur), ...rest); }
    catch (e) {
      const up = path.dirname(cur);
      if (up === cur) return path.resolve(p);
      rest.unshift(path.basename(cur));
      cur = up;
    }
  }
}

function validPath(p) {
  return typeof p === 'string' && p.length > 0 && p.length < 32768 && !p.includes('\0');
}

async function grant(p, dir) {
  if (!validPath(p)) return;
  const real = keyOf(await realOf(p));
  if (!grants.some(g => g.real === real && g.dir === dir)) grants.push({ real, dir });
}

function queueGrant(p, dir) {
  grantQueue = grantQueue.then(() => grant(p, dir)).catch(() => {});
  return grantQueue;
}

async function grantByType(p) {
  if (!validPath(p)) return;
  try { const st = await fsp.stat(p); await grant(p, st.isDirectory()); } catch (e) {}
}

async function check(p) {
  await grantQueue;
  if (!validPath(p)) throw new Error('Invalid path');
  const real = keyOf(await realOf(p));
  const ok = grants.some(g => (g.dir ? isInside(real, g.real) : real === g.real));
  if (!ok) throw new Error(`Twinpane can only use files and folders you opened. Not allowed: ${p}`);
  return path.resolve(p);
}

/* ---------------- launch arguments ---------------- */

function selectionFile() {
  return path.join(app.getPath('userData'), 'left-selection.txt');
}

// Explorer context menu support:
//   Twinpane.exe --select-left "<path>"   remembers a file or folder as the left side
//   Twinpane.exe --compare-to "<path>"    compares the remembered left side with this one
//   Twinpane.exe "<left>" "<right>"       compares two files or folders directly (Git difftool)
function resolveLaunch() {
  const iSel = argv.indexOf('--select-left');
  if (iSel >= 0 && validPath(argv[iSel + 1])) {
    fs.mkdirSync(path.dirname(selectionFile()), { recursive: true });
    fs.writeFileSync(selectionFile(), path.resolve(argv[iSel + 1]), 'utf8');
    return 'quit';
  }
  const iCmp = argv.indexOf('--compare-to');
  if (iCmp >= 0 && validPath(argv[iCmp + 1])) {
    let left = '';
    try { left = fs.readFileSync(selectionFile(), 'utf8').trim(); } catch (e) {}
    launchPaths = (validPath(left) ? [left] : []).concat(path.resolve(argv[iCmp + 1]));
    return 'open';
  }
  launchPaths = argv.filter(a => validPath(a) && !a.startsWith('--')).slice(0, 2).map(p => path.resolve(p));
  return 'open';
}

/* ---------------- window ---------------- */

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 720,
    minHeight: 480,
    title: 'Twinpane',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#12151b' : '#eef0f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
    },
  });
  win.loadURL(`${ORIGIN}/index.html`);
}

function servePage() {
  protocol.handle('app', async req => {
    try {
      const url = new URL(req.url);
      if (url.host !== HOST) return new Response('Not found', { status: 404 });
      const rel = decodeURIComponent(url.pathname).replace(/^[/\\]+/, '') || 'index.html';
      const file = path.resolve(APP_DIR, rel);
      if (!isInside(file, APP_DIR) || file === APP_DIR) return new Response('Not found', { status: 404 });
      const body = await fsp.readFile(file);
      return new Response(body, {
        headers: {
          'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'content-security-policy': CSP,
          'x-content-type-options': 'nosniff',
        },
      });
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  });
}

function lockDownSession() {
  const ses = session.defaultSession;
  // Camera, microphone, location, notifications and the rest are refused. Only
  // writing to the clipboard (the Copy buttons) is allowed.
  ses.setPermissionRequestHandler((wc, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
  ses.setPermissionCheckHandler((wc, permission) => permission === 'clipboard-sanitized-write');
  ses.on('will-download', e => e.preventDefault());
}

app.on('web-contents-created', (e, contents) => {
  contents.on('will-attach-webview', ev => ev.preventDefault());
  contents.on('will-navigate', ev => ev.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

/* ---------------- IPC ---------------- */

function fromApp(e) {
  const f = e.senderFrame;
  return !!f && !f.parent && typeof f.url === 'string' && f.url.startsWith(ORIGIN + '/') && !!win && e.sender === win.webContents;
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (e, ...args) => {
    if (!fromApp(e)) throw new Error('Blocked request from an unknown page');
    return fn(...args);
  });
}

async function statInfo(p) {
  const st = await fsp.stat(p);
  return { path: p, size: st.size, mtime: st.mtimeMs, isDir: st.isDirectory() };
}

// Lists regular files only. Symlinks and junctions are skipped, so the scan
// can't loop or wander outside the folder.
async function walk(root) {
  const out = [];
  const stack = [''];
  while (stack.length) {
    const rel = stack.pop();
    let entries;
    try { entries = await fsp.readdir(path.join(root, rel), { withFileTypes: true }); }
    catch (e) { continue; }
    for (const ent of entries) {
      const r = rel ? rel + '/' + ent.name : ent.name;
      const abs = path.join(root, r);
      if (ent.isDirectory()) stack.push(r);
      else if (ent.isFile()) {
        try { const st = await fsp.stat(abs); out.push({ rel: r, abs, size: st.size, mtime: st.mtimeMs }); } catch (e) {}
      }
      if (out.length >= MAX_SCAN) return out;
    }
  }
  return out;
}

ipcMain.on('grant-drop', (e, p) => {
  if (!fromApp(e) || !validPath(p)) return;
  grantQueue = grantQueue.then(() => grantByType(p)).catch(() => {});
});

handle('args', async () => {
  const res = [];
  for (const p of launchPaths) { try { res.push(await statInfo(p)); } catch (e) {} }
  return res;
});

handle('pickFolder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  await queueGrant(r.filePaths[0], true);
  return r.filePaths[0];
});

handle('pickFile', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  await queueGrant(r.filePaths[0], false);
  return r.filePaths[0];
});

handle('saveDialog', async name => {
  const safeName = typeof name === 'string' && name && !name.startsWith('(') ? path.basename(name) : 'untitled.txt';
  const r = await dialog.showSaveDialog(win, { defaultPath: safeName });
  if (r.canceled || !r.filePath) return null;
  await queueGrant(r.filePath, false);
  return r.filePath;
});

handle('stat', async p => statInfo(await check(p)));

handle('scan', async dir => {
  const root = await check(dir);
  if (!(await fsp.stat(root)).isDirectory()) throw new Error('Not a folder');
  return walk(root);
});

handle('read', async (p, start, end) => {
  const file = await check(p);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) throw new Error('Invalid read range');
  const fh = await fsp.open(file, 'r');
  try {
    const { size } = await fh.stat();
    const from = Math.min(start, size);
    const len = Math.min(end, size) - from;
    if (len > MAX_READ) throw new Error('This file is too large to load (over 1 GB).');
    const buf = Buffer.alloc(len);
    const { bytesRead } = await fh.read(buf, 0, len, from);
    return new Uint8Array(buf.buffer, buf.byteOffset, bytesRead);
  } finally { await fh.close(); }
});

handle('writeText', async (p, text) => {
  if (typeof text !== 'string') throw new Error('Invalid text');
  if (text.length > MAX_TEXT) throw new Error('This text is too large to save.');
  const file = await check(p);
  await fsp.writeFile(file, text, 'utf8');
  return true;
});

// The page sends the plan; every path is re-checked here and you confirm the
// actions in a dialog drawn by this process, which the page can't skip or fake.
handle('sync', async ops => {
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > MAX_OPS) throw new Error('Invalid sync plan');
  const plan = [];
  for (const op of ops) {
    if (!op || typeof op !== 'object') throw new Error('Invalid sync plan');
    if (op.kind === 'copy') {
      const from = await check(op.from);
      const to = await check(op.to);
      if (!(await fsp.lstat(from)).isFile()) throw new Error(`Not a regular file: ${op.from}`);
      plan.push({ kind: 'copy', from, to });
    } else if (op.kind === 'del') {
      const target = await check(op.target);
      if (!(await fsp.lstat(target)).isFile()) throw new Error(`Not a regular file: ${op.target}`);
      plan.push({ kind: 'del', target });
    } else {
      throw new Error('Invalid sync plan');
    }
  }
  const copies = plan.filter(o => o.kind === 'copy');
  const dels = plan.filter(o => o.kind === 'del');
  const sample = plan.slice(0, 12).map(o => (o.kind === 'copy' ? `Copy  ${o.from}\n   →  ${o.to}` : `Recycle  ${o.target}`)).join('\n');
  const r = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Run sync', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `Run ${plan.length} sync action${plan.length === 1 ? '' : 's'}?`,
    detail: `${copies.length} file${copies.length === 1 ? '' : 's'} will be copied or overwritten and ${dels.length} moved to the Recycle Bin.\n\n${sample}${plan.length > 12 ? `\n…and ${plan.length - 12} more` : ''}`,
  });
  if (r.response !== 0) return { done: 0, errors: [], cancelled: true };

  let done = 0;
  const errors = [];
  for (const op of plan) {
    try {
      if (op.kind === 'copy') {
        await fsp.mkdir(path.dirname(op.to), { recursive: true });
        await check(op.to); // re-check after creating folders, in case a link appeared
        await fsp.copyFile(op.from, op.to);
        const st = await fsp.stat(op.from);
        await fsp.utimes(op.to, st.atime, st.mtime); // keep the modified time so the next compare matches
      } else {
        await shell.trashItem(op.target);
      }
      done++;
    } catch (err) {
      errors.push(`${op.to || op.target}: ${err.message}`);
    }
  }
  return { done, errors, cancelled: false };
});

// Copy or move the files you selected from one folder into the other.
// Every path is checked, you confirm in a dialog drawn by this process, and a
// file that gets replaced goes to the Recycle Bin first so it can be restored.
handle('fileop', async (mode, toSide, items) => {
  if (mode !== 'copy' && mode !== 'move') throw new Error('Invalid operation');
  if (toSide !== 'left' && toSide !== 'right') throw new Error('Invalid operation');
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_OPS) throw new Error('Invalid file list');
  const plan = [];
  const targets = new Set();
  for (const it of items) {
    if (!it || typeof it !== 'object') throw new Error('Invalid file list');
    const from = await check(it.from);
    const to = await check(it.to);
    if (keyOf(await realOf(from)) === keyOf(await realOf(to))) throw new Error(`A file can't be copied onto itself: ${it.from}`);
    if (targets.has(keyOf(to))) throw new Error(`Two files would be written to the same place: ${it.to}`);
    targets.add(keyOf(to));
    if (!(await fsp.lstat(from)).isFile()) throw new Error(`Not a regular file: ${it.from}`);
    const existing = await fsp.lstat(to).catch(() => null);
    if (existing && !existing.isFile()) throw new Error(`Can't replace a folder or link with a file: ${it.to}`);
    plan.push({ from, to, replace: !!existing });
  }
  const n = plan.length;
  const replaced = plan.filter(o => o.replace).length;
  const fromSide = toSide === 'right' ? 'left' : 'right';
  const verb = mode === 'move' ? 'Move' : 'Copy';
  const lines = [];
  lines.push(`${n} file${n === 1 ? '' : 's'} will be ${mode === 'move' ? 'moved' : 'copied'} from the ${fromSide} folder to the ${toSide} folder.`);
  if (mode === 'move') lines.push(`They will be removed from the ${fromSide} folder.`);
  if (replaced) lines.push(`${replaced} existing file${replaced === 1 ? '' : 's'} in the ${toSide} folder will be replaced. The old version${replaced === 1 ? ' goes' : 's go'} to the Recycle Bin.`);
  const sample = plan.slice(0, 10).map(o => `${o.replace ? 'Replace' : 'New    '}  ${o.to}`).join('\n');
  const r = await dialog.showMessageBox(win, {
    type: replaced || mode === 'move' ? 'warning' : 'question',
    buttons: [`${verb} ${n} file${n === 1 ? '' : 's'}`, 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `${verb} ${n} file${n === 1 ? '' : 's'} to the ${toSide}?`,
    detail: `${lines.join('\n')}\n\n${sample}${n > 10 ? `\n…and ${n - 10} more` : ''}`,
  });
  if (r.response !== 0) return { done: 0, errors: [], cancelled: true };

  let done = 0;
  const errors = [];
  for (const op of plan) {
    try {
      await fsp.mkdir(path.dirname(op.to), { recursive: true });
      await check(op.to); // re-check after creating folders, in case a link appeared
      const st = await fsp.stat(op.from);
      if (op.replace && (await fsp.lstat(op.to).catch(() => null))) await shell.trashItem(op.to);
      if (mode === 'move') {
        try {
          await fsp.rename(op.from, op.to);
        } catch (err) {
          if (err.code !== 'EXDEV') throw err;
          // Different drive: copy, check the copy, then remove the original.
          await fsp.copyFile(op.from, op.to, fs.constants.COPYFILE_EXCL);
          await fsp.utimes(op.to, st.atime, st.mtime);
          if ((await fsp.stat(op.to)).size !== st.size) throw new Error('The copy is incomplete, so the original was kept');
          await fsp.unlink(op.from);
        }
      } else {
        await fsp.copyFile(op.from, op.to, fs.constants.COPYFILE_EXCL);
        await fsp.utimes(op.to, st.atime, st.mtime); // keep the modified time so the next compare matches
      }
      done++;
    } catch (err) {
      errors.push(`${op.to}: ${err.message}`);
    }
  }
  return { done, errors, cancelled: false };
});

/* ---------------- start ---------------- */

app.whenReady().then(async () => {
  if (resolveLaunch() === 'quit') { app.quit(); return; }
  for (const p of launchPaths) await grantByType(p);
  lockDownSession();
  servePage();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
