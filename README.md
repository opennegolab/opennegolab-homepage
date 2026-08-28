# 열린협상연구소 홈페이지

www.opennegolab.com 에 올라가는 정적 사이트입니다.

## 파일 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 홈페이지 전체 (HTML·CSS·JS·이미지가 한 파일에) |
| `grade1-learning.html` | 초등 1학년 공부방 (별도 페이지, `/grade1-learning.html`) |
| `baeumteo-icon.png` `baeumteo-og.png` | 위 페이지가 쓰는 이미지 |
| `server.js` | 이 폴더를 그대로 내보내는 정적 서버 (외부 패키지 없음) |
| `package.json` | Cloudtype이 실행할 `npm start` 정의 |

콘텐츠 파일을 **저장소 루트**에 두는 이유는 기존 Vercel 배포와 구조가 같아,
도메인을 옮기는 동안 Vercel과 Cloudtype 어느 쪽에서도 똑같이 동작하기 때문입니다.

## 로컬에서 보기

```
npm start
```

브라우저에서 http://localhost:3000

## 배포 (Cloudtype)

`main` 브랜치에 push하면 자동으로 다시 배포됩니다.

- 템플릿: **Node.js**
- 설치 명령어: 없음 (의존성 없음)
- 시작 명령어: `npm start`
- 포트: `3000` (Cloudtype이 넣어 주는 `PORT` 환경변수를 그대로 씁니다)
- 환경변수: 없음
- 도메인: Cloudtype 도메인 메뉴에서 `www.opennegolab.com` 연결 →
  안내되는 CNAME 값을 **Cloudflare** DNS에 등록 (프록시는 회색 구름 / DNS only 유지)

## 수정할 때

1. 이 폴더에서 파일을 고친다
2. `npm start` 로 확인한다
3. `git add -A && git commit -m "무엇을 바꿨는지" && git push`
4. 배포가 자동으로 갱신된다 (보통 1~2분)

되돌리려면 `git log` 로 시점을 찾아 `git revert <커밋>` 하면 됩니다.

## 연결된 것들

| 무엇 | 어디서 관리 |
|---|---|
| 문의 폼 | Formspree `https://formspree.io/f/xqeowezk` — 수신 메일은 Formspree 대시보드 |
| 방문 통계 | Google Analytics `G-Z0XNVJ5PRD`, 네이버 애널리틱스 `4429ba2e580cf` |
| DNS | Cloudflare (`opennegolab.com`) |
| 협상 시뮬레이터 | 별도 저장소 `opennegolab/8-block-simulator` (Cloudtype 별도 서비스) |

시뮬레이터 주소를 나중에 `sim.opennegolab.com` 등으로 바꾸면
`index.html` 의 `SIMULATOR` 섹션 주석에 적힌 두 곳만 고치면 됩니다.
