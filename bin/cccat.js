#!/usr/bin/env node
'use strict';
// cccat — Claude Code Cat CLI
const configMod = require('../lib/config');
const stateMod = require('../lib/state');

const [, , cmd, ...args] = process.argv;

function println(s = '') { process.stdout.write(s + '\n'); }

async function main() {
  switch (cmd) {
    case 'statusline':
      return require('../lib/statusline').run();
    case 'hook':
      return require('../lib/hook').run(args[0]);

    case 'install': {
      const r = require('../lib/install').install();
      r.log.forEach((l) => println('• ' + l));
      println('\n(=^･ω･^=) cccat 설치 완료! Claude Code를 다시 시작하면 고양이가 나타납니다.');
      return;
    }
    case 'uninstall': {
      const purge = args.includes('--purge');
      const r = require('../lib/install').uninstall({ purge });
      r.log.forEach((l) => println('• ' + l));
      return;
    }
    case 'doctor':
      return require('../lib/install').doctor().forEach((l) => println(l));

    case 'adopt': {
      const r = require('../lib/adopt').adopt(process.cwd());
      r.log.forEach((l) => println('• ' + l));
      return;
    }
    case 'unadopt': {
      const r = require('../lib/adopt').unadopt(process.cwd());
      r.log.forEach((l) => println('• ' + l));
      return;
    }

    case 'on': case 'off': {
      configMod.set('enabled', cmd === 'on');
      println(cmd === 'on' ? '(=^･ω･^=) cccat 켜짐' : '(=－ω－=)zZ cccat 꺼짐');
      return;
    }
    case 'pause': {
      const min = Number(args[0]) || 30;
      const st = stateMod.load();
      st.paused_until = Date.now() + min * 60000;
      stateMod.save(st);
      println(`(=－ω－=)zZ ${min}분 동안 일시 정지`);
      return;
    }
    case 'resume': {
      const st = stateMod.load();
      st.paused_until = 0;
      stateMod.save(st);
      println('(=^･ω･^=) 다시 시작!');
      return;
    }

    case 'config': {
      const [sub, key, ...rest] = args;
      if (!sub || sub === 'list') {
        const cfg = configMod.load();
        for (const [k, v] of Object.entries(cfg)) println(`${k} = ${v}`);
        return;
      }
      if (sub === 'get') return println(String(configMod.load()[key]));
      if (sub === 'set') {
        const r = configMod.set(key, rest.join(' '));
        return println(r.ok ? `${key} = ${r.value}` : `오류: ${r.error}`);
      }
      return println('사용법: cccat config [list|get <key>|set <key> <value>]');
    }

    case 'stats': {
      const review = require('../lib/review');
      const s = review.stats(review.load());
      const st = stateMod.load();
      println('── cccat 학습 통계 ──');
      println(`오늘 본 표현: ${(st.today && st.today.shown) || 0}개 (새 표현 ${(st.today && st.today.new) || 0}, 복습 ${(st.today && st.today.review) || 0})`);
      println(`누적: 본 표현 ${s.total}개 · 학습 중 ${s.learning} · 마스터 ${s.mastered} · 저장 ${s.saved}`);
      return;
    }
    case 'today': {
      const st = stateMod.load();
      const content = require('../lib/content');
      const ids = (st.today && st.today.ids) || [];
      println(`오늘 본 표현 ${ids.length}개:`);
      for (const id of ids) {
        const it = content.byId(id);
        if (it) println(`  • ${it.en} — ${it.ko}`);
      }
      return;
    }
    case 'save': {
      const st = stateMod.load();
      if (!st.current) return println('표시 중인 표현이 없습니다.');
      const review = require('../lib/review');
      const h = review.load();
      review.markSaved(h, st.current.id);
      review.save(h);
      const it = require('../lib/content').byId(st.current.id);
      println(`저장됨: ${it ? it.en + ' — ' + it.ko : st.current.id}`);
      return;
    }
    case 'saved': {
      const review = require('../lib/review');
      const content = require('../lib/content');
      const h = review.load();
      const saved = Object.entries(h.items).filter(([, e]) => e.saved);
      println(`저장한 표현 ${saved.length}개:`);
      for (const [id] of saved) {
        const it = content.byId(id);
        if (it) println(`  • ${it.en} — ${it.ko}`);
      }
      return;
    }

    case 'reset': {
      const fs = require('fs');
      const paths = require('../lib/paths');
      if (args.includes('--all')) {
        for (const f of [paths.historyFile(), paths.stateFile()]) {
          try { fs.unlinkSync(f); } catch { /* 없음 */ }
        }
        println('학습 기록과 상태를 초기화했습니다.');
      } else {
        try { fs.unlinkSync(paths.historyFile()); } catch { /* 없음 */ }
        println('학습 기록을 초기화했습니다. (상태까지: cccat reset --all)');
      }
      return;
    }

    case 'privacy': {
      const paths = require('../lib/paths');
      println('cccat 개인정보 안내');
      println('• 모든 데이터는 로컬에만 저장됩니다: ' + paths.home());
      println('• 외부 서버 전송: 없음 (네트워크 요청 0회)');
      println('• 저장하는 것: 도구 종류, 파일 확장자, 명령 카테고리, 학습 기록');
      println('• 저장하지 않는 것: 프롬프트 원문, 파일 내용, 전체 경로, 환경변수, 비밀키');
      println('• 삭제: cccat reset --all 또는 rm -rf ' + paths.home());
      return;
    }

    case 'demo': {
      // 설치 없이 렌더링 미리보기 (실제 회전 엔진 사용)
      const engine = require('../lib/engine');
      const { render } = require('../lib/render');
      const cfg = configMod.load();
      const st = stateMod.load();
      st.activity = args[0] || 'thinking';
      st.activity_ts = Date.now();
      st.current = null;
      engine.maybeRotate(st, cfg);
      for (let i = 0; i < 4; i++) {
        const lines = render(st, cfg, { now: Date.now() + i * 700 });
        lines.forEach((l) => println(l));
        println('');
      }
      return;
    }

    case 'version': case '-v': case '--version':
      return println('cccat v' + require('../package.json').version);

    default:
      println('cccat — Claude Code Cat: 대기 시간을 영어 학습으로');
      println('');
      println('사용법: cccat <command>');
      println('  install            Claude Code에 설치 (백업 자동 생성)');
      println('  uninstall [--purge] 제거 및 기존 설정 복원');
      println('  doctor             설치 상태 진단');
      println('  adopt | unadopt    자체 statusline이 있는 프로젝트에서 공존 설정/해제');
      println('  on | off           기능 켜기/끄기');
      println('  pause [분] | resume 일시 정지 / 재개');
      println('  config ...         설정 (list/get/set)');
      println('  stats | today      학습 통계 / 오늘 본 표현');
      println('  save | saved       현재 표현 저장 / 저장 목록');
      println('  reset [--all]      학습 기록 초기화');
      println('  privacy            개인정보 안내');
      println('  demo [state]       설치 없이 미리보기');
  }
}

main().catch(() => process.exit(0)); // 어떤 경우에도 Claude Code를 방해하지 않음
