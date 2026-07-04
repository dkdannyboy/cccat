'use strict';
// 원자적 JSON 읽기/쓰기. 실패해도 절대 throw로 Claude Code를 방해하지 않는 안전 계층.
const fs = require('fs');
const path = require('path');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

module.exports = { readJson, writeJson };
