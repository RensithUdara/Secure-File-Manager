const path = require('path');

function normalizeRelPath(input = '') {
  const cleaned = String(input).replace(/\\/g, '/');
  const normalized = path.posix.normalize(cleaned);
  const noParents = normalized.replace(/^(\.\.\/)+/, '');
  const stripped = noParents.replace(/^\/+/, '').replace(/^\.\//, '');
  return stripped === '.' ? '' : stripped;
}

function resolveUserPath(root, relPath = '') {
  const safeRel = normalizeRelPath(relPath);
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, safeRel);

  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + path.sep)) {
    throw new Error('Invalid path.');
  }

  return { fullPath: resolvedPath, relPath: safeRel };
}

function toPosixPath(input = '') {
  return String(input).replace(/\\/g, '/');
}

module.exports = { normalizeRelPath, resolveUserPath, toPosixPath };
