'use strict';
// cccat 데이터 디렉터리 경로. CCCAT_HOME 으로 재정의 가능(테스트/제거 검증용).
const os = require('os');
const path = require('path');
const fs = require('fs');

function home() {
  return process.env.CCCAT_HOME || path.join(os.homedir(), '.cccat');
}

function claudeDir() {
  return process.env.CCCAT_CLAUDE_DIR || path.join(os.homedir(), '.claude');
}

function ensureHome() {
  const h = home();
  fs.mkdirSync(path.join(h, 'backup'), { recursive: true });
  fs.mkdirSync(path.join(h, 'packs'), { recursive: true });
  return h;
}

module.exports = {
  home,
  claudeDir,
  ensureHome,
  configFile: () => path.join(home(), 'config.json'),
  stateFile: () => path.join(home(), 'state.json'),
  historyFile: () => path.join(home(), 'history.json'),
  backupDir: () => path.join(home(), 'backup'),
  packsDir: () => path.join(home(), 'packs'),
  repoRoot: () => path.join(__dirname, '..'),
  corePack: () => path.join(__dirname, '..', 'content', 'pack-core.json'),
  settingsFile: () => path.join(claudeDir(), 'settings.json'),
};
