'use strict';
const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const { readJson } = require('./store');

let cache = null;
let cacheTs = 0;

// 코어 팩 + ~/.cccat/packs/*.json 의 사용자 팩을 합쳐 로드
function loadAll() {
  const now = Date.now();
  if (cache && now - cacheTs < 5000) return cache;
  const items = [];
  const ids = new Set();
  const packs = [paths.corePack()];
  try {
    for (const f of fs.readdirSync(paths.packsDir())) {
      if (f.endsWith('.json')) packs.push(path.join(paths.packsDir(), f));
    }
  } catch { /* packs dir 없음 — 무시 */ }
  for (const p of packs) {
    const pack = readJson(p, null);
    if (!pack || !Array.isArray(pack.items)) continue;
    for (const it of pack.items) {
      if (!it || !it.id || !it.en || !it.ko || ids.has(it.id)) continue;
      ids.add(it.id);
      items.push(it);
    }
  }
  cache = items;
  cacheTs = now;
  return items;
}

function byId(id) {
  return loadAll().find((i) => i.id === id) || null;
}

module.exports = { loadAll, byId };
