// Clean Feature-Gate Flag (Option 1C: Unlocked for v1.0 launch; swap to native billing in v1.1)
const ENTITLEMENT_STATE = {
  isPro: true
};

// Default Starter Code
const STARTER_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; background: #0d1117; color: #e6edf3; padding: 24px; text-align: center; }
    button { background: #2f81f7; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-size: 16px; }
  </style>
</head>
<body>
  <h2>ThumbCode Live Sandbox</h2>
  <p>Edit with the bottom thumb deck and tap <b>▶ Run</b> anytime.</p>
  <button onclick="alert('ThumbCode works offline!')">Test Tap</button>
</body>
</html>`;

// State
let editor;
let blockSnapshots = [STARTER_HTML];
let snapshotTimer = null;
let currentSource = 'local'; // 'local' | 'github'
let currentPath = 'index.html';
let currentFileSha = null;

// Default 4 Programmable Thumb Macros
const DEFAULT_MACROS = [
  { label: '() => {}', code: '() => {\n  \n}' },
  { label: 'log()', code: 'console.log();' },
  { label: 'const =', code: 'const  = ;' },
  { label: '<div>', code: '<div></div>' }
];

function getMacros() {
  try {
    const saved = JSON.parse(localStorage.getItem('tc_macros')) || [...DEFAULT_MACROS];
    if (localStorage.getItem('tc_egg_unlocked') === 'true' && saved.length < 5) {
      saved.push({ label: '⚡ Gold', code: '// Built with ThumbCode Forge Gold\n' });
    }
    return saved;
  } catch {
    return DEFAULT_MACROS;
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2600);
}

// Initialize Editor & UI
document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('codeArea');
  textarea.value = localStorage.getItem('tc_draft_code') || STARTER_HTML;

  if (window.CodeMirror) {
    editor = CodeMirror.fromTextArea(textarea, {
      mode: 'htmlmixed',
      theme: 'material-darker',
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      indentWithTabs: false
    });

    editor.on('change', () => {
      const val = editor.getValue();
      localStorage.setItem('tc_draft_code', val);
      clearTimeout(snapshotTimer);
      snapshotTimer = setTimeout(() => {
        if (blockSnapshots[blockSnapshots.length - 1] !== val) {
          blockSnapshots.push(val);
          if (blockSnapshots.length > 30) blockSnapshots.shift();
        }
      }, 1200);
    });
  }

  renderMacroDeck();
  loadSavedGitHubConfig();
  bindEvents();
});

function insertTextAtCursor(text) {
  if (!editor) return;
  const doc = editor.getDoc();
  const cursor = doc.getCursor();
  doc.replaceRange(text, cursor);
  editor.focus();
}

function renderMacroDeck() {
  const macros = getMacros();
  const row = document.getElementById('macroRow');
  row.innerHTML = '';
  macros.forEach((m) => {
    const btn = document.createElement('button');
    btn.className = 'macro-btn';
    btn.textContent = m.label;
    btn.addEventListener('click', () => insertTextAtCursor(m.code));
    row.appendChild(btn);
  });

  // Also populate Macro Settings Editor in Drawer
  const list = document.getElementById('macroEditorList');
  list.innerHTML = '';
  macros.forEach((m, idx) => {
    const wrap = document.createElement('div');
    wrap.style.marginBottom = '10px';
    wrap.innerHTML = `
      <label class="field-label">Slot ${idx + 1} Label & Snippet</label>
      <div class="input-row">
        <input type="text" class="macro-label-in" value="${m.label.replace(/"/g, '&quot;')}" style="max-width:110px" />
        <input type="text" class="macro-code-in" value="${m.code.replace(/\n/g, '\\n').replace(/"/g, '&quot;')}" />
      </div>
    `;
    list.appendChild(wrap);
  });
}

function bindEvents() {
  // Bottom Symbol Row
  document.getElementById('symbolRow').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !editor) return;
    const ins = btn.dataset.insert;
    const act = btn.dataset.action;
    if (ins) {
      insertTextAtCursor(ins);
    } else if (act === 'tab') {
      insertTextAtCursor('  ');
    } else if (act === 'left') {
      const c = editor.getCursor();
      editor.setCursor({ line: c.line, ch: Math.max(0, c.ch - 1) });
      editor.focus();
    } else if (act === 'right') {
      const c = editor.getCursor();
      editor.setCursor({ line: c.line, ch: c.ch + 1 });
      editor.focus();
    }
  });

  // 2-Tier Undo / Redo
  document.getElementById('btnUndoChar').addEventListener('click', () => {
    if (editor) editor.undo();
  });

  document.getElementById('btnUndoBlock').addEventListener('click', () => {
    if (!editor || blockSnapshots.length <= 1) {
      showToast('At oldest block snapshot');
      return;
    }
    blockSnapshots.pop();
    const prev = blockSnapshots[blockSnapshots.length - 1];
    editor.setValue(prev);
    showToast('Reverted block change');
  });

  document.getElementById('btnRedo').addEventListener('click', () => {
    if (editor) editor.redo();
  });

  // Theme Toggle (Midnight Forge <-> Sunlight High-Contrast)
  document.getElementById('btnTheme').addEventListener('click', () => {
    const html = document.documentElement;
    const isSun = html.getAttribute('data-theme') === 'sunlight';
    html.setAttribute('data-theme', isSun ? 'midnight' : 'sunlight');
    if (editor) {
      editor.setOption('theme', isSun ? 'material-darker' : 'default');
    }
    showToast(isSun ? 'Midnight Forge Dark' : 'Sunlight High-Contrast');
  });

  // Live WebView Sandbox Preview
  document.getElementById('btnPreview').addEventListener('click', () => {
    const frame = document.getElementById('sandboxFrame');
    frame.srcdoc = editor ? editor.getValue() : '';
    document.getElementById('previewContainer').classList.remove('hidden');
  });

  document.getElementById('btnClosePreview').addEventListener('click', () => {
    document.getElementById('previewContainer').classList.add('hidden');
  });

  // Drawer Open/Close & Tabs
  document.getElementById('btnFiles').addEventListener('click', () => {
    document.getElementById('sideDrawer').classList.remove('hidden');
  });
  document.getElementById('btnCloseDrawer').addEventListener('click', () => {
    document.getElementById('sideDrawer').classList.add('hidden');
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.remove('hidden');
    });
  });

  // Save Macros
  document.getElementById('btnSaveMacros').addEventListener('click', () => {
    const labels = document.querySelectorAll('.macro-label-in');
    const codes = document.querySelectorAll('.macro-code-in');
    const updated = [];
    labels.forEach((lbl, i) => {
      updated.push({
        label: lbl.value || `M${i + 1}`,
        code: (codes[i].value || '').replace(/\\n/g, '\n')
      });
    });
    const hasEgg = updated.some(m =>
      m.label.toUpperCase().includes('FORGE-GOLD') || m.code.toUpperCase().includes('FORGE-GOLD')
    );
    if (hasEgg && localStorage.getItem('tc_egg_unlocked') !== 'true') {
      localStorage.setItem('tc_egg_unlocked', 'true');
      document.documentElement.setAttribute('data-theme', 'forge-gold');
      updated.push({ label: '⚡ Gold', code: '// Forge Gold Unlocked\n' });
      showToast('🏆 Easter Egg Unlocked: Forge Gold + 5th Macro!');
    } else {
      showToast('Custom Thumb Macros Saved');
    }
    localStorage.setItem('tc_macros', JSON.stringify(updated));
    renderMacroDeck();
  });

  // GitHub API Connect & Load
  document.getElementById('btnSaveToken').addEventListener('click', () => {
    const tok = document.getElementById('ghToken').value.trim();
    localStorage.setItem('tc_gh_token', tok);
    showToast('GitHub Token Saved Locally');
  });

  document.getElementById('btnLoadRepo').addEventListener('click', loadGitHubRepoFiles);
  document.getElementById('btnRefreshCI').addEventListener('click', fetchLatestWorkflowRun);

  // Push Modal
  document.getElementById('btnPush').addEventListener('click', () => {
    const repo = document.getElementById('ghRepo').value.trim();
    document.getElementById('pushTargetLabel').textContent = repo
      ? `Target: ${repo} (${currentPath})`
      : 'Enter owner/repo in Workspace Drawer first';
    document.getElementById('pushModal').classList.remove('hidden');
  });

  document.getElementById('btnCancelPush').addEventListener('click', () => {
    document.getElementById('pushModal').classList.add('hidden');
  });

  document.getElementById('btnConfirmPush').addEventListener('click', commitAndPushGitHubFile);

  // Local Device Filesystem Bridge
  document.getElementById('btnNewLocalFile').addEventListener('click', saveToDeviceStorage);
  document.getElementById('btnLoadDeviceDir').addEventListener('click', listDeviceStorageFiles);
}

function loadSavedGitHubConfig() {
  const tok = localStorage.getItem('tc_gh_token') || '';
  const repo = localStorage.getItem('tc_gh_repo') || '';
  document.getElementById('ghToken').value = tok;
  document.getElementById('ghRepo').value = repo;
}

// GITHUB REST API FUNCTIONS
async function loadGitHubRepoFiles() {
  const token = document.getElementById('ghToken').value.trim();
  const repo = document.getElementById('ghRepo').value.trim();
  const branch = document.getElementById('ghBranch').value.trim() || 'main';
  if (!token || !repo) {
    showToast('Enter Token & owner/repo');
    return;
  }
  localStorage.setItem('tc_gh_repo', repo);

  try {
    showToast('Fetching repo tree...');
    const res = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load repo');

    const list = document.getElementById('repoFileList');
    list.innerHTML = '';
    const blobs = (data.tree || []).filter((item) => item.type === 'blob').slice(0, 60);

    blobs.forEach((file) => {
      const row = document.createElement('div');
      row.className = 'file-item';
      row.innerHTML = `<span>${file.path}</span><button class="pill-btn">Edit</button>`;
      row.addEventListener('click', () => openGitHubFile(repo, branch, file.path, token));
      list.appendChild(row);
    });

    document.getElementById('ciStrip').classList.remove('hidden');
    fetchLatestWorkflowRun();
    showToast(`Loaded ${blobs.length} files`);
  } catch (err) {
    showToast(`GitHub Error: ${err.message}`);
  }
}

async function openGitHubFile(repo, branch, path, token) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Cannot open file');

    const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
    currentSource = 'github';
    currentPath = path;
    currentFileSha = data.sha;

    document.getElementById('activeFileName').textContent = path;
    document.getElementById('repoBadge').textContent = repo;
    setEditorModeByFilename(path);
    editor.setValue(decoded);
    blockSnapshots = [decoded];
    document.getElementById('sideDrawer').classList.add('hidden');
    showToast(`Opened ${path}`);
  } catch (err) {
    showToast(err.message);
  }
}

async function commitAndPushGitHubFile() {
  const token = document.getElementById('ghToken').value.trim();
  const repo = document.getElementById('ghRepo').value.trim();
  const branch = document.getElementById('ghBranch').value.trim() || 'main';
  const message = document.getElementById('commitMsg').value.trim() || 'Update via ThumbCode';

  if (!token || !repo) {
    showToast('Connect GitHub repo first');
    return;
  }

  try {
    const contentB64 = btoa(unescape(encodeURIComponent(editor.getValue())));
    const body = { message, content: contentB64, branch };
    if (currentSource === 'github' && currentFileSha) {
      body.sha = currentFileSha;
    }

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${currentPath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Commit failed');

    currentSource = 'github';
    currentFileSha = data.content.sha;
    document.getElementById('pushModal').classList.add('hidden');
    document.getElementById('ciStrip').classList.remove('hidden');
    showToast('Pushed to GitHub!');
    setTimeout(fetchLatestWorkflowRun, 2500);
  } catch (err) {
    showToast(`Push failed: ${err.message}`);
  }
}

async function fetchLatestWorkflowRun() {
  const token = document.getElementById('ghToken').value.trim();
  const repo = document.getElementById('ghRepo').value.trim();
  if (!token || !repo) return;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });
    const data = await res.json();
    const run = data.workflow_runs && data.workflow_runs[0];
    if (!run) return;

    const status = run.conclusion || run.status;
    document.getElementById('ciText').textContent = `Actions (${run.name}): ${status}`;
    const dot = document.getElementById('ciDot');
    dot.style.background =
      status === 'success' ? '#3fb950' : status === 'failure' ? '#f85149' : '#d29922';
  } catch {
    // Ignore silent CI poll errors
  }
}

// CAPACITOR DEVICE FILESYSTEM BRIDGE
async function saveToDeviceStorage() {
  const nameInput = document.getElementById('newLocalFileName').value.trim();
  const fileName = nameInput || currentPath || 'snippet.html';
  try {
    const { Filesystem, Directory, Encoding } = window.Capacitor.Plugins;
    await Filesystem.writeFile({
      path: `ThumbCode/${fileName}`,
      data: editor.getValue(),
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    });
    currentSource = 'local';
    currentPath = fileName;
    currentFileSha = null;
    document.getElementById('activeFileName').textContent = fileName;
    document.getElementById('repoBadge').textContent = 'Documents/ThumbCode';
    showToast(`Saved Documents/ThumbCode/${fileName}`);
    listDeviceStorageFiles();
  } catch (err) {
    showToast('Saved to browser cache (Native FS on APK)');
  }
}

async function listDeviceStorageFiles() {
  try {
    const { Filesystem, Directory, Encoding } = window.Capacitor.Plugins;
    const res = await Filesystem.readdir({
      path: 'ThumbCode',
      directory: Directory.Documents
    });
    const list = document.getElementById('localFileList');
    list.innerHTML = '';
    (res.files || []).forEach((f) => {
      const fname = typeof f === 'string' ? f : f.name;
      const row = document.createElement('div');
      row.className = 'file-item';
      row.innerHTML = `<span>${fname}</span><button class="pill-btn">Open</button>`;
      row.addEventListener('click', async () => {
        const fileData = await Filesystem.readFile({
          path: `ThumbCode/${fname}`,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
        currentSource = 'local';
        currentPath = fname;
        currentFileSha = null;
        document.getElementById('activeFileName').textContent = fname;
        document.getElementById('repoBadge').textContent = 'Documents/ThumbCode';
        setEditorModeByFilename(fname);
        editor.setValue(fileData.data);
        document.getElementById('sideDrawer').classList.add('hidden');
        showToast(`Opened ${fname}`);
      });
      list.appendChild(row);
    });
  } catch {
    showToast('No files in Documents/ThumbCode yet');
  }
}

function setEditorModeByFilename(filename) {
  if (!editor) return;
  if (filename.endsWith('.js') || filename.endsWith('.json')) {
    editor.setOption('mode', 'javascript');
  } else if (filename.endsWith('.css')) {
    editor.setOption('mode', 'css');
  } else {
    editor.setOption('mode', 'htmlmixed');
  }
}
