// Git worker (Part 3): isomorphic-git over an OPFS fs adapter. Classic worker
// (importScripts) — the vendored libs are UMD builds. All repo state lives in
// .git inside the project dir; the page talks to us with {id, op, ...args}
// messages and gets {id, ok, result|error} back.
importScripts('vendor/isomorphic-git.umd.min.js', 'vendor/isomorphic-git-http.umd.js');

let corsProxy = null; // set once via {op:'configure'}; used by clone/pull/push

// ---- OPFS fs adapter (fs.promises shape for isomorphic-git) ----
// Writes use createSyncAccessHandle — worker-only, and the only write path
// that is safe on WebKit. Every missing-path error must carry .code='ENOENT'
// because isomorphic-git branches on it.
let rootPromise = null;
function opfsRoot() {
  rootPromise ??= navigator.storage.getDirectory();
  return rootPromise;
}

function enoent(path, cause) {
  const error = new Error(`ENOENT: no such file or directory, ${path}` +
    (cause ? ` (${cause.name ?? cause})` : ''));
  error.code = 'ENOENT';
  return error;
}

function isNotFound(e) {
  return e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError' ||
    e.code === 'ENOENT');
}

function segments(path) {
  return String(path).split('/').filter((s) => s.length > 0 && s !== '.');
}

// Resolve the directory handle containing `path`; returns [dirHandle, name].
async function resolveParent(path, create = false) {
  const parts = segments(path);
  const name = parts.pop();
  let dir = await opfsRoot();
  try {
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
  } catch (e) {
    if (isNotFound(e)) throw enoent(path, e);
    throw e;
  }
  return [dir, name];
}

async function resolveDir(path, create = false) {
  let dir = await opfsRoot();
  try {
    for (const part of segments(path)) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
  } catch (e) {
    if (isNotFound(e)) throw enoent(path, e);
    throw e;
  }
  return dir;
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

const fsPromises = {
  async readFile(path, opts) {
    const [dir, name] = await resolveParent(path);
    for (let attempt = 0; ; attempt++) {
      let file;
      try {
        file = await (await dir.getFileHandle(name)).getFile();
      } catch (e) {
        if (isNotFound(e)) throw enoent(path, e);
        throw e;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const encoding = typeof opts === 'string' ? opts : opts?.encoding;
        return encoding === 'utf8' ? utf8Decoder.decode(bytes) : bytes;
      } catch (e) {
        // A concurrent writer (workspace autosave) invalidates the File
        // snapshot between getFile() and arrayBuffer(), or briefly holds
        // the lock: re-acquire and retry.
        if (e.name !== 'NotReadableError' || attempt >= 3) throw e;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  },

  async writeFile(path, data, opts) {
    const encoding = typeof opts === 'string' ? opts : opts?.encoding;
    const bytes = typeof data === 'string' || encoding === 'utf8'
      ? utf8Encoder.encode(String(data))
      : (data instanceof Uint8Array ? data : new Uint8Array(data));
    const [dir, name] = await resolveParent(path);
    let handle;
    try {
      handle = await dir.getFileHandle(name, { create: true });
    } catch (e) {
      if (isNotFound(e)) throw enoent(path, e);
      throw e;
    }
    const write = async () => {
      const access = await handle.createSyncAccessHandle();
      try {
        access.truncate(0);
        access.write(bytes, { at: 0 });
        access.flush();
      } finally {
        access.close();
      }
    };
    try {
      await write();
    } catch (e) {
      // Lock contention with the workspace worker's own handles: retry once.
      if (e.name === 'InvalidStateError' || e.name === 'NoModificationAllowedError') {
        await new Promise((r) => setTimeout(r, 50));
        await write();
      } else {
        throw e;
      }
    }
  },

  async unlink(path) {
    const [dir, name] = await resolveParent(path);
    try {
      await dir.removeEntry(name);
    } catch (e) {
      if (isNotFound(e)) throw enoent(path, e);
      throw e;
    }
  },

  async readdir(path) {
    const dir = await resolveDir(path);
    const names = [];
    for await (const name of dir.keys()) names.push(name);
    return names;
  },

  async mkdir(path) {
    await resolveDir(path, true);
  },

  async rmdir(path, options) {
    const [dir, name] = await resolveParent(path);
    try {
      // isomorphic-git only ever removes empty directories; the recursive
      // form is ours, for cleaning up after a clone that died half-way.
      await dir.removeEntry(name, { recursive: options?.recursive === true });
    } catch (e) {
      if (isNotFound(e)) throw enoent(path, e);
      throw e;
    }
  },

  async stat(path) {
    const [dir, name] = await resolveParent(path);
    try {
      const file = await (await dir.getFileHandle(name)).getFile();
      return {
        type: 'file', size: file.size,
        mtimeMs: file.lastModified, ctimeMs: file.lastModified,
        mode: 0o100644, uid: 0, gid: 0, dev: 0, ino: 0,
        isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false,
      };
    } catch (e) {
      if (!isNotFound(e) && e.name !== 'TypeMismatchError') throw e;
    }
    try {
      await dir.getDirectoryHandle(name);
      return {
        type: 'dir', size: 0,
        mtimeMs: 0, ctimeMs: 0,
        mode: 0o40000, uid: 0, gid: 0, dev: 0, ino: 0,
        isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false,
      };
    } catch (e) {
      if (isNotFound(e)) throw enoent(path, e);
      throw e;
    }
  },

  async lstat(path) {
    return fsPromises.stat(path);
  },

  async readlink(path) {
    throw enoent(path); // no symlinks in OPFS
  },

  async symlink(target, path) {
    throw enoent(path); // no symlinks in OPFS
  },
};

const fs = { promises: fsPromises };

// ---- git operations ----
function projectDir(args) {
  return '/workspace/' + args.project;
}

function onAuthFor(token) {
  return token
    ? () => ({ username: token, password: 'x-oauth-basic' })
    : undefined;
}

// statusMatrix row: [filepath, head, workdir, stage] — classify the states we
// surface; null means unmodified (or an exotic combination we don't report).
function classifyRow([, head, workdir, stage]) {
  if (head === 0 && workdir === 2) return stage === 0 ? 'untracked' : 'added';
  if (head === 1 && workdir === 2) return 'modified';
  if (head === 1 && workdir === 0) return 'deleted';
  return null;
}

// ---- line diff (for the `diff` op): Myers O(ND) greedy over line arrays ----
// Returns edit ops [{t: ' '|'-'|'+', text}] transforming a into b.
function myersOps(a, b) {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max;
  const v = new Array(2 * max + 1).fill(0);
  const trace = []; // v-state before each d iteration, for backtracking
  let found = 0;
  outer:
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]))
        ? v[offset + k + 1]
        : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[offset + k] = x;
      if (x >= n && y >= m) { found = d; break outer; }
    }
  }
  const ops = [];
  let x = n;
  let y = m;
  for (let d = found; d >= 0; d--) {
    const vp = trace[d];
    const k = x - y;
    const prevK = (k === -d || (k !== d && vp[offset + k - 1] < vp[offset + k + 1]))
      ? k + 1
      : k - 1;
    const prevX = vp[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { ops.push({ t: ' ', text: a[--x] }); y--; }
    if (d > 0) {
      if (x === prevX) ops.push({ t: '+', text: b[--y] });
      else ops.push({ t: '-', text: a[--x] });
    }
  }
  return ops.reverse();
}

// Group edit ops into unified-diff hunks with `context` lines of context.
function hunkLines(ops, context = 2) {
  const changed = [];
  for (let i = 0; i < ops.length; i++) if (ops[i].t !== ' ') changed.push(i);
  const lines = [];
  let g = 0;
  while (g < changed.length) {
    let end = g;
    while (end + 1 < changed.length &&
           changed[end + 1] - changed[end] - 1 <= 2 * context) end++;
    const lo = Math.max(0, changed[g] - context);
    const hi = Math.min(ops.length - 1, changed[end] + context);
    let aStart = 1;
    let bStart = 1;
    for (let i = 0; i < lo; i++) {
      if (ops[i].t !== '+') aStart++;
      if (ops[i].t !== '-') bStart++;
    }
    let aCount = 0;
    let bCount = 0;
    for (let i = lo; i <= hi; i++) {
      if (ops[i].t !== '+') aCount++;
      if (ops[i].t !== '-') bCount++;
    }
    lines.push({ t: '@', text: `@@ -${aCount === 0 ? aStart - 1 : aStart},${aCount}` +
      ` +${bCount === 0 ? bStart - 1 : bStart},${bCount} @@` });
    for (let i = lo; i <= hi; i++) lines.push(ops[i]);
    g = end + 1;
  }
  return lines;
}

function diffLines(oldText, newText) {
  const a = oldText === '' ? [] : oldText.split('\n');
  const b = newText === '' ? [] : newText.split('\n');
  // Strip the common prefix/suffix first — Myers cost grows with edit
  // distance, and re-adding the trims as context ops keeps hunk numbering
  // trivial.
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let post = 0;
  while (post < a.length - pre && post < b.length - pre &&
         a[a.length - 1 - post] === b[b.length - 1 - post]) post++;
  const ops = [];
  for (let i = 0; i < pre; i++) ops.push({ t: ' ', text: a[i] });
  for (const op of myersOps(a.slice(pre, a.length - post),
                            b.slice(pre, b.length - post))) ops.push(op);
  for (let i = a.length - post; i < a.length; i++) ops.push({ t: ' ', text: a[i] });
  return hunkLines(ops);
}

const ops = {
  async init(args) {
    await git.init({ fs, dir: projectDir(args), defaultBranch: 'main' });
    return true;
  },

  async status(args) {
    const matrix = await git.statusMatrix({ fs, dir: projectDir(args) });
    const entries = [];
    for (const row of matrix) {
      const status = classifyRow(row);
      if (status) entries.push({ path: row[0], status });
    }
    return entries;
  },

  // Unified line diff of working tree vs HEAD for one file. Either side that
  // does not exist (unborn HEAD, untracked file, deleted file) diffs as ''.
  async diff(args) {
    const dir = projectDir(args);
    let workText = '';
    try {
      workText = await fsPromises.readFile(dir + '/' + args.path, 'utf8');
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
    let headText = '';
    try {
      const oid = await git.resolveRef({ fs, dir, ref: 'HEAD' });
      const { blob } = await git.readBlob({ fs, dir, oid, filepath: args.path });
      headText = utf8Decoder.decode(blob);
    } catch (_) { /* no commits yet, or file not in the HEAD tree */ }
    if (headText.includes('\0') || workText.includes('\0')) {
      return { binary: true, lines: [] };
    }
    if (headText === workText) return { binary: false, lines: [] };
    return { binary: false, lines: diffLines(headText, workText) };
  },

  async commit(args) {
    const dir = projectDir(args);
    const matrix = await git.statusMatrix({ fs, dir });
    let changed = 0;
    for (const row of matrix) {
      const [filepath, head, workdir, stage] = row;
      if (head === 1 && workdir === 1 && stage === 1) continue; // unmodified
      if (workdir === 0) await git.remove({ fs, dir, filepath });
      else await git.add({ fs, dir, filepath });
      changed++;
    }
    if (changed === 0) return { nothing: true };
    const oid = await git.commit({
      fs, dir, message: args.message,
      author: { name: args.name, email: args.email },
    });
    return { oid };
  },

  async log(args) {
    const commits = await git.log({ fs, dir: projectDir(args), depth: args.depth ?? 20 });
    return commits.map((c) => ({
      oid: c.oid,
      short: c.oid.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author.name,
      timestamp: c.commit.author.timestamp,
    }));
  },

  async branches(args) {
    const dir = projectDir(args);
    return {
      current: await git.currentBranch({ fs, dir, fullname: false }),
      all: await git.listBranches({ fs, dir }),
    };
  },

  async branch(args) {
    await git.branch({ fs, dir: projectDir(args), ref: args.name, checkout: true });
    return true;
  },

  async checkout(args) {
    await git.checkout({ fs, dir: projectDir(args), ref: args.ref });
    return true;
  },

  async set_remote(args) {
    await git.addRemote({
      fs, dir: projectDir(args), remote: 'origin', url: args.url, force: true,
    });
    return true;
  },

  async clone(args) {
    const dir = projectDir(args);
    // Remember whether we are the ones creating it: a clone that dies
    // half-way leaves a directory that is neither a project nor empty, and
    // the next attempt with the same name would trip over it.
    const preexisting = await directoryExists(dir);
    try {
      await git.clone({
        fs, http: GitHttp, dir, url: args.url,
        ...(corsProxy ? { corsProxy } : {}),
        singleBranch: true, depth: 50,
        onAuth: onAuthFor(args.token),
        onProgress: progressFor(args.id),
        onMessage: (message) => report(args.id, { note: String(message).trim() }),
      });
    } catch (e) {
      if (!preexisting) {
        try { await fsPromises.rmdir(dir, { recursive: true }); } catch (_) {}
      }
      throw e;
    }
    return true;
  },

  async pull(args) {
    await git.pull({
      fs, http: GitHttp, dir: projectDir(args),
      ...(corsProxy ? { corsProxy } : {}),
      author: { name: args.name, email: args.email },
      onAuth: onAuthFor(args.token),
      onProgress: progressFor(args.id),
    });
    return true;
  },

  async push(args) {
    return await git.push({
      fs, http: GitHttp, dir: projectDir(args),
      ...(corsProxy ? { corsProxy } : {}),
      onAuth: onAuthFor(args.token),
      onProgress: progressFor(args.id),
    });
  },
};

/// Whether a directory exists. `stat` cannot answer this: it opens a file
/// handle, and a directory comes back as TypeMismatchError, which the
/// adapter reports as ENOENT.
async function directoryExists(path) {
  const parts = segments(path);
  try {
    let dir = await opfsRoot();
    for (const part of parts) dir = await dir.getDirectoryHandle(part);
    return true;
  } catch (_) {
    return false;
  }
}

// Progress is what tells the page the worker is alive: a network clone can
// be slow for minutes, and silence is indistinguishable from a hang.
function report(id, body) {
  if (id != null) self.postMessage({ id, progress: body });
}

function progressFor(id) {
  return (event) => report(id, {
    phase: event.phase,
    loaded: event.loaded,
    total: event.total,
  });
}

self.onmessage = async (event) => {
  const m = event.data;
  if (m.op === 'configure' && m.id == null) {
    corsProxy = m.corsProxy ?? null;
    return;
  }
  try {
    const op = ops[m.op];
    if (!op) throw new Error('unknown git op: ' + m.op);
    self.postMessage({ id: m.id, ok: true, result: await op(m) });
  } catch (e) {
    self.postMessage({
      id: m.id,
      ok: false,
      error: String(e && e.stack ? e.stack : e),
    });
  }
};

// An error that escapes the message handler (an async library callback, say)
// would otherwise leave the page waiting forever.
self.onerror = (message, filename, lineno) => {
  self.postMessage({
    fatal: `git worker: ${message} (${filename ?? '?'}:${lineno ?? 0})`,
  });
};
self.onunhandledrejection = (event) => {
  self.postMessage({ fatal: `git worker: unhandled ${event.reason}` });
};
