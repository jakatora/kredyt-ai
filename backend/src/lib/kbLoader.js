/**
 * KB loader z cache. Każdy plik JSON ładowany TYLKO raz przy pierwszym wywołaniu.
 * Po nim wszystkie kolejne wywołania = lookup w Map (instant, 0 fs syscalls).
 */
const fs = require("fs");
const path = require("path");
const { resolveKbDir } = require("./kbDir");

const cache = new Map();

function load(name) {
  if (cache.has(name)) return cache.get(name);
  const full = path.join(resolveKbDir(), name);
  const data = JSON.parse(fs.readFileSync(full, "utf8"));
  cache.set(name, data);
  return data;
}

function clear() { cache.clear(); }

function preload(names = []) {
  for (const n of names) load(n);
}

module.exports = { load, clear, preload };
