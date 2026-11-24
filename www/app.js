import { EditorState } from "https://esm.sh/@codemirror/state@6.4.1";
import { EditorView, keymap, lineNumbers } from "https://esm.sh/@codemirror/view@6.35.0?deps=@codemirror/state@6.4.1";
import { defaultKeymap, history, historyKeymap, undo, redo, cursorCharLeft, cursorCharRight, cursorLineUp, cursorLineDown, selectLine } from "https://esm.sh/@codemirror/commands@6.7.1?deps=@codemirror/state@6.4.1,@codemirror/view@6.35.0";
import { javascript } from "https://esm.sh/@codemirror/lang-javascript@6.2.2?deps=@codemirror/state@6.4.1";
import { html } from "https://esm.sh/@codemirror/lang-html@6.4.9?deps=@codemirror/state@6.4.1";
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark@6.1.2?deps=@codemirror/state@6.4.1,@codemirror/view@6.35.0";

const STORAGE_CODE_KEY = "thumbcode_active_buffer";
const STORAGE_TM_KEY = "thumbcode_tm_snapshots";
const STORAGE_GH_KEY = "thumbcode_gh_config";
const MAX_SNAPSHOTS = 50;

const starterCode = `// ThumbCode Mobile Sandbox\nconst app = document.createElement('div');\napp.style.cssText = 'font-family:sans-serif;padding:16px;color:#111;';\napp.innerHTML = '<h2>Peepers Live Preview</h2><p>Edit code below and watch this update automatically.</p>';\ndocument.body.appendChild(app);\n`;

// --- Toast Helper ---
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => { el.style.display = "none"; }, 2600);
}

// --- UTF-8 Safe Base64 Helpers for GitHub API ---
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// --- Tier 1: Local Time Machine Snapshots ---
let snapshots = JSON.parse(localStorage.getItem(STORAGE_TM_KEY) || "[]");
let isRestoring = false;

function recordSnapshot(code) {
  if (isRestoring) return;
  if (snapshots.length && snapshots[snapshots.length - 1].code === code) return;
  snapshots.push({ ts: new Date().toLocaleTimeString(), code });
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();
  localStorage.setItem(STORAGE_TM_KEY, JSON.stringify(snapshots));
  syncTimeMachineUI();
}

function syncTimeMachineUI() {
  const slider = document.getElementById("tm-slider");
  const label = document.getElementById("tm-label");
  const max = Math.max(0, snapshots.length - 1);
  slider.max = max;
  slider.value = max;
  const current = snapshots[max];
  label.textContent = current
    ? `Tier 1 Step: ${max + 1}/${snapshots.length} (${current.ts})`
    : "Tier 1 Step: 0/0";
}

// --- Peepers Live Preview Renderer ---
function renderPeepers(code) {
  const box = document.getElementById("peepers-box");
  if (!box.classList.contains("open")) return;
  const frame = document.getElementById("peepers-frame");
  const isHtml = code.trim().startsWith("<");
  frame.srcdoc = isHtml
    ? code
    : `<!DOCTYPE html><html><body><script type="module">${code}<\/script></body></html>`;
}

// --- Initialize CodeMirror 6 ---
let debounceTimer = null;
const initialDoc = localStorage.getItem(STORAGE_CODE_KEY) || starterCode;

const view = new EditorView({
  state: EditorState.create({
    doc: initialDoc,
    extensions: [
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      javascript(),
      html(),
      oneDark,
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const code = update.state.doc.toString();
          localStorage.setItem(STORAGE_CODE_KEY, code);
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            recordSnapshot(code);
            renderPeepers(code);
          }, 650);
        }
      })
    ]
  }),
  parent: document.getElementById("editor-wrap")
});

if (!snapshots.length) recordSnapshot(initialDoc);
else syncTimeMachineUI();

// --- Thumb Deck Controls ---
document.querySelector(".thumb-deck").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  view.focus();

  const ins = btn.dataset.insert;
  if (ins) {
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: ins },
      selection: { anchor: from + ins.length }
    });
    return;
  }

  const move = btn.dataset.move;
  if (move === "left") cursorCharLeft(view);
  if (move === "right") cursorCharRight(view);
  if (move === "up") cursorLineUp(view);
  if (move === "down") cursorLineDown(view);

  const act = btn.dataset.action;
  if (act === "tab") {
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: "  " }, selection: { anchor: from + 2 } });
  }
  if (act === "undo") undo(view);
  if (act === "redo") redo(view);
  if (act === "selectLine") selectLine(view);
});

// --- Peepers Toggle ---
document.getElementById("btn-peepers").addEventListener("click", (e) => {
  const box = document.getElementById("peepers-box");
  box.classList.toggle("open");
  e.currentTarget.classList.toggle("active");
  renderPeepers(view.state.doc.toString());
});

document.getElementById("btn-peepers-refresh").addEventListener("click", () => {
  renderPeepers(view.state.doc.toString());
  toast("Peepers refreshed");
});

// --- Time Machine Drawer & Scrubber ---
document.getElementById("btn-tm").addEventListener("click", (e) => {
  document.getElementById("tm-bar").classList.toggle("open");
  e.currentTarget.classList.toggle("active");
});

document.getElementById("tm-slider").addEventListener("input", (e) => {
  const idx = Number(e.target.value);
  const snap = snapshots[idx];
  if (!snap) return;
  document.getElementById("tm-label").textContent = `Previewing Step ${idx + 1}/${snapshots.length} (${snap.ts})`;
});

document.getElementById("btn-tm-restore").addEventListener("click", () => {
  const idx = Number(document.getElementById("tm-slider").value);
  const snap = snapshots[idx];
  if (!snap) return;
  isRestoring = true;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: snap.code }
  });
  isRestoring = false;
  renderPeepers(snap.code);
  toast(`Restored snapshot #${idx + 1}`);
});

// --- Tier 2: Direct GitHub REST API Sync ---
function getGhConfig() {
  return JSON.parse(localStorage.getItem(STORAGE_GH_KEY) || '{"owner":"jacobstradiota123ff","repo":"thumbcode","path":"www/app.js","token":""}');
}

const modal = document.getElementById("gh-modal");
document.getElementById("btn-gh-cfg").addEventListener("click", () => {
  const cfg = getGhConfig();
  document.getElementById("gh-owner").value = cfg.owner || "";
  document.getElementById("gh-repo").value = cfg.repo || "";
  document.getElementById("gh-path").value = cfg.path || "";
  document.getElementById("gh-token").value = cfg.token || "";
  modal.classList.add("open");
});

document.getElementById("btn-gh-close").addEventListener("click", () => modal.classList.remove("open"));

document.getElementById("btn-gh-save").addEventListener("click", () => {
  const cfg = {
    owner: document.getElementById("gh-owner").value.trim(),
    repo: document.getElementById("gh-repo").value.trim(),
    path: document.getElementById("gh-path").value.trim(),
    token: document.getElementById("gh-token").value.trim()
  };
  localStorage.setItem(STORAGE_GH_KEY, JSON.stringify(cfg));
  modal.classList.remove("open");
  toast("GitHub config saved");
});

async function ghFetch(endpoint, options = {}) {
  const cfg = getGhConfig();
  if (!cfg.token || !cfg.owner || !cfg.repo) {
    modal.classList.add("open");
    throw new Error("Configure GitHub token & repo first");
  }
  const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${cfg.token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub HTTP ${res.status}`);
  }
  return res.json();
}

// Push current editor buffer directly to GitHub
document.getElementById("btn-push").addEventListener("click", async () => {
  try {
    const cfg = getGhConfig();
    toast("Syncing to GitHub...");
    let sha;
    try {
      const existing = await ghFetch(`/contents/${cfg.path}`);
      sha = existing.sha;
    } catch (_) { /* File does not exist yet; create new */ }

    const content = toBase64(view.state.doc.toString());
    await ghFetch(`/contents/${cfg.path}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `ThumbCode mobile sync: ${cfg.path}`,
        content,
        ...(sha ? { sha } : {})
      })
    });
    toast(`Pushed ${cfg.path} to GitHub`);
  } catch (err) {
    toast(err.message);
  }
});

// Pull latest file from GitHub
document.getElementById("btn-gh-pull").addEventListener("click", async () => {
  try {
    const cfg = getGhConfig();
    toast("Pulling from GitHub...");
    const data = await ghFetch(`/contents/${cfg.path}`);
    const decoded = fromBase64(data.content);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: decoded } });
    recordSnapshot(decoded);
    toast(`Pulled ${cfg.path}`);
  } catch (err) {
    toast(err.message);
  }
});

// Tier 2 Remote Rollback: Fetch previous commit version of the file
document.getElementById("btn-gh-prev-commit").addEventListener("click", async () => {
  try {
    const cfg = getGhConfig();
    toast("Fetching commit history...");
    const commits = await ghFetch(`/commits?path=${encodeURIComponent(cfg.path)}&per_page=2`);
    if (commits.length < 2) return toast("No older commit found");
    const prevSha = commits[1].sha;
    const prevFile = await ghFetch(`/contents/${cfg.path}?ref=${prevSha}`);
    const decoded = fromBase64(prevFile.content);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: decoded } });
    recordSnapshot(decoded);
    toast(`Rolled back to ${prevSha.slice(0, 7)}`);
  } catch (err) {
    toast(err.message);
  }
});
