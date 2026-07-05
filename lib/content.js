'use strict';
const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const { readJson } = require('./store');

let cache = null;
let cacheTs = 0;
let cacheLang = null;

// 설명 언어 오버레이 로드: content/i18n/<lang>.json + ~/.cccat/i18n/<lang>.json
// 오버레이 항목: { id, meaning, example_trans, nuance? }
function loadOverlay(lang) {
  const map = {};
  if (!lang || lang === 'ko') return map; // ko는 코어 팩에 내장
  const files = [path.join(paths.repoRoot(), 'content', 'i18n', `${lang}.json`)];
  try {
    const dir = path.join(paths.home(), 'i18n');
    for (const f of fs.readdirSync(dir)) {
      if (f === `${lang}.json`) files.push(path.join(dir, f));
    }
  } catch { /* 사용자 i18n 디렉터리 없음 — 무시 */ }
  for (const f of files) {
    const pack = readJson(f, null);
    if (!pack || !Array.isArray(pack.items)) continue;
    for (const it of pack.items) {
      if (it && it.id) map[it.id] = it;
    }
  }
  return map;
}

// 항목을 언어 중립 형태로 정규화한다.
// 원본 ko/example_ko/nuance는 하위 호환을 위해 그대로 두고,
// meaning/example_trans/nuance_text 를 표시용으로 채운다.
function normalize(item, lang, overlay) {
  const tr = lang !== 'ko' ? overlay[item.id] : null;
  return {
    ...item,
    meaning: (tr && tr.meaning) || item.ko,
    example_trans: (tr && tr.example_trans) || item.example_ko,
    nuance_text: (tr && tr.nuance) || item.nuance,
  };
}

// 코어 팩(ko) + ~/.cccat/packs/*.json 사용자 팩을 합쳐 로드하고,
// 설정 언어에 맞게 정규화한다.
function loadAll(langArg) {
  const lang = langArg || (() => {
    try { return require('./config').load().language || 'ko'; } catch { return 'ko'; }
  })();
  const now = Date.now();
  if (cache && cacheLang === lang && now - cacheTs < 5000) return cache;

  const items = [];
  const ids = new Set();
  const packs = [paths.corePack()];
  try {
    for (const f of fs.readdirSync(paths.packsDir())) {
      if (f.endsWith('.json')) packs.push(path.join(paths.packsDir(), f));
    }
  } catch { /* packs dir 없음 — 무시 */ }

  const overlay = loadOverlay(lang);
  for (const p of packs) {
    const pack = readJson(p, null);
    if (!pack || !Array.isArray(pack.items)) continue;
    for (const it of pack.items) {
      if (!it || !it.id || !it.en || !it.ko || ids.has(it.id)) continue;
      ids.add(it.id);
      items.push(normalize(it, lang, overlay));
    }
  }
  cache = items;
  cacheTs = now;
  cacheLang = lang;
  return items;
}

function byId(id, lang) {
  return loadAll(lang).find((i) => i.id === id) || null;
}

// 오버레이가 존재하는(= 지원되는) 설명 언어 목록
function availableLanguages() {
  const langs = ['ko'];
  try {
    const dir = path.join(paths.repoRoot(), 'content', 'i18n');
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json')) langs.push(f.replace(/\.json$/, ''));
    }
  } catch { /* i18n 디렉터리 없음 */ }
  return [...new Set(langs)];
}

module.exports = { loadAll, byId, availableLanguages };
