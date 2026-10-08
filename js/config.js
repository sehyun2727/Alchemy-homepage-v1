/* =========================================================
   ALCHEMY 홈페이지 설정 — 이 파일만 수정하면 됩니다.
   ========================================================= */
window.ALCHEMY_CONFIG = {
  links: {
    instagram: "https://www.instagram.com/jnu_alchemy/",
    instagramHandle: "@jnu_alchemy",
    youtube: "https://www.youtube.com/@jnualchemy",
    youtubeHandle: "@jnualchemy",
    googleForm: "",      // 신입부원 지원서 구글폼 URL (비우면 Instagram 모집글로 안내)
    kakaoOpenChat: ""    // 카카오톡 오픈채팅 URL (비우면 카카오 버튼 숨김)
  },

  /* 모집 일정 — 날짜에 따라 '모집 중 → 면접 중 → 마감' 상태가 자동으로 바뀝니다.
     테스트: index.html?now=2026-09-01 처럼 날짜를 붙여 열면 그 날짜 기준으로 보입니다. */
  recruit: {
    applyDeadline: "2026-09-04T20:00:00+09:00",
    interviewEnd:  "2026-09-12T00:00:00+09:00"
  },

  /* 다가오는 무대 — 날짜가 지나면 자동으로 숨겨집니다. */
  events: [
    { name: "GNU NIGHT", date: "2026-10-31", dateLabel: "2026.10.31 (토)", place: "하멜아트홀", teams: ["AKG", "관측불가"] }
  ],

  /* 활동 사진 — assets/photos/ 에 파일을 넣고 경로를 맞춰주세요. 없으면 자리표시 이미지가 보입니다. */
  photos: [
    { src: "assets/photos/photo1.jpg", caption: "STAGE",    alt: "공연 후 무대 위 ALCHEMY 단체 사진" },
    { src: "assets/photos/photo2.jpg", caption: "LIVE",     alt: "라이브 무대 위 ALCHEMY 단체 사진" },
    { src: "assets/photos/photo3.jpg", caption: "MT",       alt: "MT에서의 ALCHEMY 부원들" },
    { src: "assets/photos/photo4.jpg", caption: "TOGETHER", alt: "야외 ALCHEMY 단체 사진" }
  ],

  /* 공식 로고 이미지가 있으면 경로 입력 (예: "assets/logo.png"). 비우면 CSS로 재현한 로고 사용 */
  logoSrc: ""
};
