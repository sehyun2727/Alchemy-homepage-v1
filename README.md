# ALCHEMY 홈페이지 (v3 — 인터랙티브 원페이지)

전남대학교 J-POP 밴드동아리 ALCHEMY(アルケミ) 소개 + 2026-2 신입부원 모집 사이트.
빌드 없이 정적 파일만으로 동작합니다. `index.html`을 더블클릭하거나 GitHub Pages 등에 그대로 올리면 됩니다.

## 구조
```
index.html        페이지 전체 (01 PLAY → 02 ABOUT → 03 ACTIVITY → 04 IDENTITY → 05 JOIN → CONTACT)
css/style.css     디자인 (모집 포스터 디자인 언어 기반)
js/config.js      ★ 링크·일정·사진·이벤트 설정 — 보통 이 파일만 수정
js/audio.js       Web Audio 신스 (음원 파일 없음)
js/main.js        인터랙션
assets/photos/    활동 사진 넣는 곳 (photo1.jpg ~ photo4.jpg)
```

## 꼭 채울 것 (js/config.js)
| 항목 | 비워두면 |
|---|---|
| `googleForm` | 모집 기간 중 '지원하기' 버튼이 Instagram 모집글로 연결 |
| `kakaoOpenChat` | 카카오 버튼·카드 숨김 |
| `photos` | 파일이 없으면 자리표시 이미지 |
| `logoSrc` | CSS로 재현한 アルケミ 로고 사용 |

## 모집 상태 자동 전환
- 9/4 20:00 전: **모집 중 (D-n)** + 지원 버튼
- 9/4 20:00 ~ 9/11: **지원 마감 · 면접 진행 중**
- 9/12 이후: **2026-2 모집 마감** → Instagram 버튼이 메인
- 미리보기: `index.html?now=2026-09-01`, `?now=2026-09-08`, `?now=2026-10-06`
- 다음 학기에는 `recruit` 날짜와 index.html 05 섹션의 모집 문구만 바꾸면 됩니다.

## 키보드 (첫 화면이 보일 때만 동작, 한/영 상관없음)
- 건반: `A S D F G H J K L ;`(흰 건반) / `W E T Y U O P`(검은 건반)
- 드럼: `Z` 킥 · `X` 스네어 · `C` 하이햇 · `V` `B` 탐 · `N` 플로어 · `M` 크래시
- 기타: `1`~`6` 줄 · `Q` 스트럼 / 베이스: `7`~`0` 개방현

## 참고
- 소리는 첫 클릭/터치 이후에 납니다 (브라우저 정책). iPhone은 무음 모드에서 소리가 안 날 수 있습니다.
- 폰트(Pretendard·Dela Gothic One·DotGothic16·Nanum Pen Script)는 CDN에서 불러옵니다. 오프라인이면 시스템 폰트로 표시됩니다.
- 모집 정보는 2026-2 모집 포스터 내용만 사용했습니다. GNU NIGHT 정보는 config.js `events`에서 수정/삭제하세요 (날짜가 지나면 자동 숨김).
