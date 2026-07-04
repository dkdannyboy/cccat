'use strict';
// 안전한 작업 맥락 추출.
// hook 페이로드에서 "도구 종류, 파일 확장자, 명령 카테고리, 키워드 매칭 태그"만 뽑는다.
// 프롬프트 원문, 파일 내용, 경로 전체, 환경변수는 절대 저장하지 않는다.

const path = require('path');

const EXT_TAGS = {
  js: ['frontend'], jsx: ['frontend'], ts: ['frontend'], tsx: ['frontend'],
  vue: ['frontend'], svelte: ['frontend'], css: ['frontend'], scss: ['frontend'], html: ['frontend'],
  py: ['backend'], go: ['backend'], rb: ['backend'], java: ['backend'],
  rs: ['backend'], php: ['backend'], kt: ['backend'], swift: ['backend'], c: ['backend'], cpp: ['backend'],
  sql: ['db'], prisma: ['db'],
  md: ['docs'], mdx: ['docs'], rst: ['docs'],
  yml: ['config'], yaml: ['config'], json: ['config'], toml: ['config'], ini: ['config'], env: ['config'],
  sh: ['build'], bash: ['build'],
  tf: ['deploy'], dockerfile: ['deploy'],
};

// Bash 명령 첫 토큰/패턴 → [activity, tags]
const CMD_RULES = [
  [/^git\s+(merge|rebase|cherry-pick)/, 'git', ['git']],
  [/^git\s+(push|pull|fetch|clone)/, 'git', ['git', 'github']],
  [/^git\b/, 'git', ['git']],
  [/^gh\b/, 'git', ['github']],
  [/(^|\s)(jest|vitest|pytest|go test|cargo test|rspec|phpunit)\b|npm (run )?test|yarn test|pnpm test|bun test/, 'testing', ['test']],
  [/(^|\s)(tsc|webpack|vite build|next build|cargo build|go build|make|gradle|mvn)\b|npm run build/, 'building', ['build']],
  [/(npm|yarn|pnpm|bun|pip|pip3|uv|brew|apt|gem|cargo)\s+(i|install|add)\b/, 'running', ['install']],
  [/(^|\s)(docker|kubectl|helm|terraform|vercel|netlify|flyctl|wrangler)\b/, 'running', ['deploy']],
  [/(^|\s)(psql|mysql|sqlite3|mongosh|redis-cli|prisma|alembic)\b/, 'running', ['db']],
  [/(^|\s)(curl|wget|http)\b/, 'running', ['api']],
  [/(^|\s)(eslint|ruff|prettier|black|golangci-lint|clippy)\b/, 'running', ['review']],
];

// 프롬프트/요약에서 태그만 뽑는 키워드 (원문은 저장 안 함)
const KEYWORD_TAGS = [
  [/버그|에러|오류|고장|안\s?됨|fix|bug|error|crash|broken|exception/i, 'debug'],
  [/테스트|test|coverage|커버리지|flaky/i, 'test'],
  [/리팩터|리팩토링|refactor|정리|clean\s?up|구조\s?개선/i, 'refactor'],
  [/배포|deploy|롤백|rollback|release|출시|ci\b|cd\b/i, 'deploy'],
  [/리뷰|review|\bPR\b|pull request|머지|merge/i, 'review'],
  [/인증|로그인|auth|token|보안|security|취약|vulnerab/i, 'security'],
  [/성능|느려|최적화|perf|optimiz|latency|메모리/i, 'perf'],
  [/데이터베이스|\bdb\b|마이그레이션|migration|스키마|schema|쿼리|query/i, 'db'],
  [/\bapi\b|엔드포인트|endpoint|rest|graphql/i, 'api'],
  [/문서|docs|readme|주석|documentation/i, 'docs'],
  [/일정|계획|기획|요구사항|plan|spec|requirement|roadmap/i, 'planning'],
  [/충돌|conflict|브랜치|branch|커밋|commit|rebase/i, 'git'],
  [/에이전트|agent|\bai\b|프롬프트|prompt|llm|모델/i, 'ai'],
  [/프론트|화면|컴포넌트|component|css|스타일|ui\b|react|vue/i, 'frontend'],
  [/서버|백엔드|backend|서비스 로직/i, 'backend'],
];

function extOf(filePath) {
  if (!filePath) return null;
  const base = path.basename(String(filePath)).toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  const e = path.extname(base).slice(1);
  return e || null;
}

function tagsFromFile(filePath) {
  const tags = [];
  const base = filePath ? path.basename(String(filePath)).toLowerCase() : '';
  if (/\.(test|spec)\.|_test\.|test_/.test(base)) tags.push('test');
  const e = extOf(filePath);
  if (e && EXT_TAGS[e]) tags.push(...EXT_TAGS[e]);
  return tags;
}

function tagsFromText(text) {
  const tags = [];
  const s = String(text || '').slice(0, 2000); // 매칭만 하고 저장하지 않음
  for (const [re, tag] of KEYWORD_TAGS) {
    if (re.test(s)) tags.push(tag);
  }
  return tags;
}

// hook 이벤트 + 페이로드 → { activity, tags }
function classify(event, payload = {}) {
  const tool = payload.tool_name || '';
  const input = payload.tool_input || {};
  let activity = 'thinking';
  let tags = [];

  switch (event) {
    case 'UserPromptSubmit':
      activity = 'thinking';
      tags = tagsFromText(payload.prompt);
      break;
    case 'PreToolUse':
    case 'PostToolUse': {
      if (/^(Read|Glob|NotebookRead)$/.test(tool)) {
        activity = 'reading';
        tags = tagsFromFile(input.file_path || input.pattern);
        if (tool === 'Glob') tags.push('search');
      } else if (/^Grep$/.test(tool)) {
        activity = 'searching';
        tags = ['search', ...tagsFromFile(input.path)];
      } else if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(tool)) {
        activity = 'writing';
        tags = tagsFromFile(input.file_path || input.notebook_path);
      } else if (tool === 'Bash') {
        activity = 'running';
        const cmd = String(input.command || '').slice(0, 500);
        for (const [re, act, t] of CMD_RULES) {
          if (re.test(cmd)) { activity = act; tags = [...t]; break; }
        }
      } else if (/^(WebSearch|WebFetch)$/.test(tool)) {
        activity = 'searching';
        tags = ['search', 'docs'];
      } else if (/^(Agent|Task|Workflow)$/.test(tool)) {
        activity = 'agent';
        tags = ['ai'];
      } else if (tool) {
        activity = 'running';
      }
      break;
    }
    case 'PostToolUseFailure':
      activity = 'error';
      tags = ['error', 'debug'];
      break;
    case 'Notification':
      activity = 'waiting';
      break;
    case 'Stop':
      activity = 'success';
      break;
    case 'SubagentStart':
      activity = 'agent';
      tags = ['ai'];
      break;
    case 'SubagentStop':
      activity = 'agent';
      tags = ['ai'];
      break;
    case 'SessionStart':
      activity = 'idle';
      break;
    case 'SessionEnd':
      activity = 'done';
      break;
    default:
      activity = 'thinking';
  }
  return { activity, tags: [...new Set(tags)] };
}

module.exports = { classify, tagsFromText, tagsFromFile, extOf };
