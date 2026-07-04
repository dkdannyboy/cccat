# cccat E2E 검증 기록 (2026-07-04, Claude Code 2.1.201, macOS/tmux 140x40)

실제 Claude Code TUI에서 캡처한 화면 (tmux capture-pane):

```
[대기 상태]
  e2e [Fable 5]
  (=^･ω･^=) 대기 중  clean build — 캐시 없이 처음부터 다시 빌드하는 것
  “Try a clean build before you file a bug.” 버그 등록하기 전에 클린 빌드부터 한번 해보세요. · 오늘 3개

[프롬프트 제출 후 — 생각 중 + 애니메이션 프레임 변화]
  ⠙ (=˘ω˘=)? 생각 중  clean build — 캐시 없이 처음부터 다시 빌드하는 것
  ⠇ (=˘ω˘=)! 생각 중  clean build — 캐시 없이 처음부터 다시 빌드하는 것

[응답 완료(Stop) 후 — 성공 상태 + 표현 회전]
  ∩(=^･ω･^=)∩ 성공!  cover the edge case — 엣지 케이스를 테스트로 커버하다
  “Make sure to cover the edge case where the list is empty.” · 오늘 5개
  ヽ(=^･ω･^=)ﾉ 성공!  cover the edge case — 엣지 케이스를 테스트로 커버하다
```

검증 항목: 실제 설치(백업 자동), TUI 내 표시, 캐릭터 애니메이션, 상태 전환(대기→생각→성공), 맥락 기반 표현, 한국어 뜻/예문, 회전, 기존 statusline 보존, wrapper 지연 174ms.
