# Twinpane

**A free, open-source file and folder comparison tool for Windows.**

Twinpane shows you exactly what changed between two text files, two folders, two spreadsheets (CSV), two binary files or two pictures, and lets you merge and sync the differences. It runs entirely on your PC: no account, no internet connection and no telemetry.

> Twinpane is an independent project.

---

## Contents

- [Features](#features)
- [Install](#install)
- [Using Twinpane](#using-twinpane)
  - [Text compare](#text-compare)
  - [Folder compare](#folder-compare)
  - [Folder sync](#folder-sync)
  - [Table compare](#table-compare)
  - [Hex compare](#hex-compare)
  - [Picture compare](#picture-compare)
- [Windows Explorer right-click menu](#windows-explorer-right-click-menu)
- [Command line](#command-line)
- [Use as your Git diff tool](#use-as-your-git-diff-tool)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Security and privacy](#security-and-privacy)
- [Build from source](#build-from-source)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [How to cite](#how-to-cite)
- [License](#license)

---

## Features

| Mode | What it does |
|---|---|
| **Text compare** | Side-by-side view with changed words highlighted inside each line, an overview bar showing every difference, previous/next navigation, one-click merge of a block in either direction, undo, in-place editing and saving. |
| **Folder compare** | Recursive tree of two folders showing which files are the same, changed, or exist on one side only. Compare by contents (byte by byte), by size and modified time, or by size only. |
| **Folder sync** | Preview, then run, a mirror left → right, a mirror right → left, or a two-way update where the newer file wins. Deleted files go to the Recycle Bin. |
| **Table compare** | Compare CSV, TSV or semicolon-separated files row by row, matched by a key column (like an ID) or by position. Shows changed cells, added and removed rows, and columns that exist on one side only. |
| **Hex compare** | Byte-by-byte view of binary files with offsets, hex and ASCII columns, and jumping between differences. |
| **Picture compare** | Side by side, swipe slider, difference highlight with adjustable tolerance, and blink mode. Counts how many pixels differ. |
| **Windows integration** | Installer with Start menu and desktop shortcuts, Explorer right-click menu, drag and drop, command-line arguments and Git difftool support. |

Light and dark themes follow your Windows setting automatically.

---

## Install

### Option 1: Download a release (easiest)

1. Open the **[Releases](../../releases)** page of this repository.
2. Download one of these:
   - **`Twinpane-Setup-x.y.z.exe`** installs Twinpane for your Windows user, with Start menu and desktop shortcuts and the Explorer right-click menu. It doesn't need administrator rights.
   - **`Twinpane-x.y.z-portable.exe`** is a single file that runs without installing. Use it from a USB stick or a folder of your choice. The right-click menu is not available in this version.
3. Run the file you downloaded.

If no release is listed yet, use option 2 or 3.

> **"Windows protected your PC"?** The installer is not code-signed, so Microsoft SmartScreen warns about it. Click **More info**, then **Run anyway**. You can check the source code in this repository before you run it.

### Option 2: Build it with GitHub Actions (no setup on your PC)

1. Fork this repository, or use your own copy.
2. Go to the **Actions** tab and select **Build Windows installer**.
3. Click **Run workflow**.
4. When the run finishes (about 5 minutes), open it and download **Twinpane-windows** under *Artifacts*. The zip contains both `.exe` files.

Pushing a tag that starts with `v` (for example `v1.0.0`) also starts a build.

### Option 3: Build it on your own PC

See [Build from source](#build-from-source).

### Uninstall

Open **Settings → Apps → Installed apps**, find **Twinpane** and click **Uninstall**. This also removes the right-click menu entries. The portable version needs no uninstalling; just delete the file.

---

## Using Twinpane

Twinpane opens with example files loaded in every view, so you can try each feature right away. Pick a view from the tabs at the top.

In every view you can load files in three ways:

- Click **Open left…** and **Open right…**.
- Drag one file onto each half of the window, or drag two files at once.
- Start Twinpane from the Explorer right-click menu or the command line.

### Text compare

Lines that changed are shaded on both sides, and the exact words that changed are highlighted inside them. Lines that exist on only one side appear opposite a striped gap.

- **Move between differences:** click **↓ Next** and **↑ Prev**, or press <kbd>Alt</kbd>+<kbd>↓</kbd> and <kbd>Alt</kbd>+<kbd>↑</kbd>. The narrow bar on the right shows every difference in the file; click it to jump.
- **Merge a block:** each difference has two small buttons in the middle column. **→** copies the left block over the right one, and **←** copies the right block over the left one. **↶ Undo merge** reverses the last change.
- **Edit directly:** click **Edit / paste** to type in, or paste into, either side. Click **Done — compare** to see the result.
- **Save:** **Save left** and **Save right** write each side back to its file. If the text didn't come from a file, Twinpane asks where to save it. <kbd>Ctrl</kbd>+<kbd>S</kbd> saves every side you changed.
- **Swap sides:** click **⇄ Swap**.
- **Export:** **Unified diff** produces a standard patch you can copy, like the output of `git diff` or `diff -u`.

**Comparison options:**

| Option | Effect |
|---|---|
| Ignore case | `Hello` and `hello` count as the same. |
| Ignore whitespace | Differences in spaces and tabs are ignored. |
| Blank lines are unimportant | Added or removed empty lines are shown in grey and not counted as differences. |
| Wrap lines | Long lines wrap instead of being cut off. |
| Only differences | Hides identical lines, keeping 3 lines of context around each change. Click **⋯ identical lines — show** to expand a section. |
| Ignore pattern | A regular expression whose matches are ignored, such as `\d{4}-\d\d-\d\d` for dates or `"version": ".*"` for version numbers. |

### Folder compare

1. Click **Choose folder…** for the left and the right side, or drag a folder onto each half of the view.
2. Twinpane lists every file in both folders and their subfolders.

Each file gets a status:

| Status | Meaning |
|---|---|
| **Same** | The files match. |
| **Changed** | The files differ. A note says which side is newer. |
| **Left only** / **Right only** | The file exists in one folder only. |
| **_n_ differ** (folders) | That folder contains _n_ files that are not the same. |

- **Filter** with the buttons: *All*, *Differences*, *Same*, *Left only* and *Right only*.
- **Name filter** shows only matching files. Separate several patterns with `;`, for example `*.js;*.css` or `report*.docx`.
- **Compare by** sets how files are judged:
  - *Contents (byte by byte)* is the most accurate.
  - *Size and modified time* is much faster for large folders.
  - *Size only* is the fastest.
- **Expand all** and **Collapse all** open or close every subfolder. Click a folder row to open or close just that one.
- **Click any file** to open the pair in the right viewer: text files in Text compare, pictures in Picture compare, and anything else in Hex compare.

### Folder sync

The **Sync preview** panel under the folder list shows exactly what a sync would do before it does anything.

| Sync type | What happens |
|---|---|
| **Mirror left → right** | Makes the right folder an exact copy of the left. Changed files are overwritten on the right, left-only files are copied, and right-only files are deleted. |
| **Mirror right → left** | The same in the other direction. |
| **Update both (newer wins)** | Copies files that are missing on either side, and replaces older versions with newer ones. Nothing is deleted. |

1. Choose the sync type and review the list.
2. Click **Run sync…**.
3. Twinpane shows a summary of what will be copied and deleted. Click **Run sync** to go ahead or **Cancel** to stop.

Copied files keep their original modified time. **Deleted files go to the Recycle Bin**, so you can restore them. **Copy plan** gives you the list as text, for example to keep a record.

### Table compare

1. Paste data into the two boxes, or click **Open…** to load `.csv`, `.tsv` or `.txt` files. The separator (comma, tab, semicolon or `|`) is detected automatically.
2. Under **Match rows by**, choose a column that identifies each row, such as an ID or SKU. Choose *Row position* to compare row 1 with row 1, row 2 with row 2, and so on.

In the result:

| Mark | Meaning |
|---|---|
| `=` | Row is the same on both sides. |
| `≠` | Row changed. Each changed cell shows the old value crossed out above the new value. |
| `◀` (red) | Row exists on the left only. |
| `▶` (green) | Row exists on the right only. |
| `L only` / `R only` in a header | That column exists on one side only and isn't compared. |

**Options:**
- **First row is headers.** Turn this off if your file has no header row.
- **Ignore case** and **Trim spaces.**
- **Number tolerance** treats numbers as equal when they're this close. With a tolerance above 0, `799` and `799.00` match, as do `1,299` and `1299`.
- **Only differences** hides rows that are the same.

### Hex compare

Shows two binary files byte by byte, 16 bytes per row: the offset, the bytes in hexadecimal, and the same bytes as text. Bytes that differ are highlighted, and rows that contain differences are shaded.

- **↓ Next** and **↑ Prev** jump between rows with differences.
- **Only rows with differences** hides everything else.
- Large files load 1,024 rows at a time. Click **Show more rows** to continue.

Bytes are compared at the same position in both files, so an inserted byte makes everything after it differ.

### Picture compare

Supports PNG, JPEG, GIF, WebP, BMP and AVIF.

| Mode | Use it to |
|---|---|
| **Side by side** | See both pictures next to each other. |
| **Swipe** | Drag the slider to reveal the left picture over the right one. |
| **Difference** | See changed pixels in bright pink over a faded copy of the picture. |
| **Blink** | Flip between the two pictures in the same place, by hand or automatically, so small shifts stand out. |

**Tolerance** (0–128) sets how much a pixel's color can change before it counts as different. Raise it to ignore compression noise in JPEG files. The status line shows both sizes and how many pixels differ.

---

## Windows Explorer right-click menu

The installer adds two entries to the right-click menu for files and folders. On Windows 11 they're under **Show more options**.

1. Right-click the first file or folder and choose **Twinpane: Select left side**.
2. Right-click the second one and choose **Twinpane: Compare with left side**.

Twinpane opens with both loaded: two folders open in Folder compare, and two files open in the right viewer.

---

## Command line

The installer puts Twinpane at:

```
%LOCALAPPDATA%\Programs\twinpane\Twinpane.exe
```

```bat
:: Compare two files
Twinpane.exe "C:\old\report.txt" "C:\new\report.txt"

:: Compare two folders
Twinpane.exe "D:\Photos" "E:\Backup\Photos"

:: Remember a left side, then compare with it later (what the right-click menu uses)
Twinpane.exe --select-left "C:\project-v1"
Twinpane.exe --compare-to "C:\project-v2"
```

---

## Use as your Git diff tool

```bash
git config --global diff.tool twinpane
git config --global difftool.twinpane.cmd "\"$LOCALAPPDATA/Programs/twinpane/Twinpane.exe\" \"\$LOCAL\" \"\$REMOTE\""
git config --global difftool.prompt false
```

Then run `git difftool` to open each changed file in Twinpane, or `git difftool --dir-diff` to compare whole folders.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Alt</kbd>+<kbd>↓</kbd> | Next difference (Text compare) |
| <kbd>Alt</kbd>+<kbd>↑</kbd> | Previous difference (Text compare) |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Save every changed side (Text compare) |
| <kbd>Esc</kbd> | Close an export window |
| <kbd>Enter</kbd> or <kbd>Space</kbd> | Open the selected file or folder (Folder compare) |

---

## Security and privacy

Files you compare can come from anywhere, so Twinpane treats their contents as untrusted.

- **Access is limited to what you open.** Twinpane only reads and writes files and folders you opened yourself: through a dialog, by drag and drop, from the right-click menu or on the command line. Links and junctions that point outside those folders are refused.
- **The window is sandboxed.** The interface has no Node.js access and runs in Chromium's sandbox. It loads from a private `app://` address with a strict Content Security Policy that blocks injected scripts. Camera, microphone, location and similar permissions are refused.
- **Sync always asks first.** The confirmation dialog comes from the desktop part of the app, so the interface can't skip it. Deletions go to the Recycle Bin.
- **Nothing leaves your PC.** Twinpane makes no network requests. It remembers your view options, but never the text or file names you compared.
- **Hardened build.** Electron's debugging and "run as Node" switches are disabled, and the app only loads its own integrity-checked code.

Found a security problem? Please open an issue, or contact the maintainer privately if it's serious.

---

## Build from source

### Requirements

- Windows 10 or 11
- [Node.js](https://nodejs.org) LTS (version 20 or newer)

### Easiest: run the build script

1. Download this repository: **Code → Download ZIP**, then unzip it. Or run `git clone`.
2. Double-click **`build-windows.bat`**.
3. When it finishes, the `dist` folder opens with `Twinpane-Setup-x.y.z.exe` and `Twinpane-x.y.z-portable.exe`.

The first build downloads Electron and the build tools, which takes a few minutes. It also creates `package-lock.json`, which pins exact versions. Later builds reuse those versions.

### Manual commands

```bash
npm install        # first time (use "npm ci" once package-lock.json exists)
npm start          # run Twinpane without building an installer
npm run dist       # build the installer and portable .exe into dist/
```

### Keeping Electron up to date

Twinpane displays files with Electron's built-in Chromium, which receives regular security fixes. Every few months, delete `package-lock.json` and rebuild to get the latest Electron 44.x release. When Electron 44 leaves support, update `"electron"` in `package.json` to the current version. See [Electron's release schedule](https://releases.electronjs.org/schedule).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Windows protected your PC" | The app isn't code-signed. Click **More info → Run anyway**. |
| `build-windows.bat` says Node.js isn't installed | Install Node.js LTS from [nodejs.org](https://nodejs.org), then open a new window and run it again. |
| The build fails at `enableEmbeddedAsarIntegrityValidation` | Remove that line from the `electronFuses` section of `package.json` and build again. |
| "Twinpane can only use files and folders you opened" | You tried to use a file outside the folders you opened, often through a shortcut or link. Open that file or folder directly. |
| A folder compare is slow | Switch **Compare by** to *Size and modified time*. |
| The right-click menu entries are missing | On Windows 11, click **Show more options**. The portable version doesn't add them, so use the installer. |
| A text file shows strange characters | Twinpane reads text as UTF-8. Files in other encodings, like UTF-16, may appear garbled; Hex compare still works for them. |

---

## Project structure

```
twinpane/
├── app/
│   ├── index.html        The interface layout and styles
│   └── app.js            All compare logic: diff engine, views, merge, sync plan
├── build/
│   ├── icon.ico          Windows app icon
│   ├── icon.png          Window icon
│   └── installer.nsh     Adds and removes the Explorer right-click menu
├── .github/workflows/
│   └── build.yml         Builds the Windows installer on GitHub Actions
├── main.js               Desktop shell: window, file-access checks, sync, command line
├── preload.js            Bridge that gives the interface a limited file API
├── build-windows.bat     One-click build script for Windows
├── package.json          Dependencies and installer settings
└── LICENSE               MIT License
```

**How it works.** Twinpane is an [Electron](https://www.electronjs.org) app. The text diff uses Eugene Myers' O(ND) difference algorithm (1986), the same approach GNU diff and Git use, with a second pass over words to highlight changes within a line. All file access goes through `main.js`, which only allows paths you opened.

---

## Contributing

Bug reports, ideas and pull requests are welcome.

1. Fork the repository and create a branch.
2. Run `npm install` and `npm start` to try your change.
3. Open a pull request describing what you changed and why.

Ideas for future features: three-way merge, comparing inside zip files, FTP/SFTP folders, and other text encodings.

---

## How to cite

If you use TwinPane in research, teaching material or a project write-up, please cite it. On the repository page, click **Cite this repository** in the right sidebar to copy an APA or BibTeX citation, generated from [`CITATION.cff`](CITATION.cff).

**APA:**

> Mani, S. (2026). *TwinPane: A file, folder, table, hex and picture comparison tool for Windows* (Version 1.0.0) [Computer software]. https://github.com/sharmilamani/TwinPane

**BibTeX** (also in [`CITATION.bib`](CITATION.bib)):

```bibtex
@software{mani_twinpane_2026,
  author  = {Mani, Sharmila},
  title   = {{TwinPane}: A File, Folder, Table, Hex and Picture Comparison Tool for {Windows}},
  version = {1.0.0},
  year    = {2026},
  month   = nov,
  license = {MIT},
  url     = {https://github.com/sharmilamani/TwinPane}
}
```

If your LaTeX style doesn't support `@software`, use the `@misc` entry in `CITATION.bib` instead.

To cite the diff algorithm TwinPane uses:

> Myers, E. W. (1986). An O(ND) difference algorithm and its variations. *Algorithmica, 1*, 251–266. https://doi.org/10.1007/BF01840446

---

## License

Twinpane is released under the [MIT License](LICENSE). You can use, copy, change and share it freely, including commercially, as long as the license notice stays with it.

Twinpane is built on [Electron](https://www.electronjs.org) and packaged with [electron-builder](https://www.electron.build), both MIT-licensed. Their license notices are included in the installed app.
