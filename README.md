# 열린협상연구소 홈페이지

www.opennegolab.com 에 올라가는 정적 사이트입니다.

## 파일 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 홈페이지 전체 (HTML·CSS·JS·이미지가 한 파일에) |
| `grade1-learning.html` | 초등 1학년 공부방 (별도 페이지, `/grade1-learning.html`) |
| `baeumteo-icon.png` `baeumteo-og.png` | 위 페이지가 쓰는 이미지 |
| `privacy.html` | 개인정보처리방침 (`/privacy` 로 열립니다) |
| `stats.html` `stats.js` | 방문 통계 화면과 집계 (`/stats`) |
| `hit.js` | 방문 기록을 서버로 보내는 조각. 모든 페이지가 불러갑니다 |
| `robots.txt` `sitemap.xml` | 검색엔진 안내. 내용을 크게 고치면 sitemap 의 lastmod 를 갱신합니다 |
| `favicon.ico` `favicon-*.png` | 파비콘. 512 원본에서 만든 것들이며 ico 에는 16·32·48 이 들어 있습니다 |
| `server.js` | 이 폴더를 그대로 내보내는 정적 서버 + 문의 접수 라우트 |
| `inquiry.js` | 문의 폼 내용을 SMTP로 메일 발송 |
| `package.json` | 의존성(nodemailer)과 `npm start` 정의 |

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
- 설치 명령어: `npm install --omit=dev`
- 시작 명령어: `npm start`
- 포트: `3000` (Cloudtype이 넣어 주는 `PORT` 환경변수를 그대로 씁니다)
- 환경변수 (문의 폼 메일 발송용 — 시뮬레이터와 같은 값을 그대로 쓰면 됩니다)

  | 이름 | 설명 |
  |---|---|
  | `SMTP_HOST` | 메일 서버 주소 (필수) |
  | `SMTP_USER` | 계정 (필수) |
  | `SMTP_PASS` | 비밀번호 (필수) |
  | `SMTP_PORT` | 기본 465 |
  | `SMTP_FROM` | 보내는 사람. 기본은 `SMTP_USER` |
  | `INQUIRY_MAIL_TO` | 받는 사람(실제 수신함). 기본 `negomaster@opennegolab.com`<br>홈페이지에 표기하고 방문자에게 안내하는 주소는 `admin@opennegolab.com` 로 따로 관리 |

  넣지 않으면 사이트는 정상 동작하되, 문의 버튼을 누른 방문자에게
  "이메일로 보내달라"는 안내가 뜹니다.
- 도메인: Cloudtype 도메인 메뉴에서 `www.opennegolab.com` 연결 →
  안내되는 CNAME 값을 **Cloudflare** DNS에 등록 (프록시는 회색 구름 / DNS only 유지)

## 수정할 때

1. 이 폴더에서 파일을 고친다
2. `npm start` 로 확인한다
3. `git add -A && git commit -m "무엇을 바꿨는지" && git push`
4. 배포가 자동으로 갱신된다 (보통 1~2분)

되돌리려면 `git log` 로 시점을 찾아 `git revert <커밋>` 하면 됩니다.

## 방문 통계에 남기는 이벤트

Google Analytics 로 아래 세 가지를 따로 보냅니다. GA4 화면에서
**관리 → 이벤트** 에 들어가면 목록에 나오고, 그중 `generate_lead` 를
**주요 이벤트로 표시**해 두면 전환수로 집계됩니다.

| 이벤트 | 언제 |
|---|---|
| `inquiry_open` | 문의하기 버튼을 눌러 창을 열었을 때 |
| `generate_lead` | 문의가 **실제로 접수된** 때 (전송 실패는 세지 않습니다) |
| `simulator_click` | 시뮬레이터로 나가는 링크를 눌렀을 때 |

`generate_lead` 에는 `inquiry_type`(협상 교육 / AI 시뮬레이터 / 기타),
`simulator_click` 에는 `link_text` 가 함께 담깁니다. 이 값을 보고서에서
쪼개 보려면 GA4 의 **관리 → 맞춤 정의** 에서 맞춤 측정기준으로 등록해야 합니다.

## 방문 통계 보기 — `/stats`

GA4 는 화면이 복잡해서, 매일 열어 볼 용도로 따로 만든 화면입니다.
`https://www.opennegolab.com/stats` 로 들어가 비밀번호를 넣으면 됩니다.
한 번 넣으면 30일 동안 다시 묻지 않습니다.

보이는 것 — 오늘 / 최근 7일 / 최근 30일의 방문자·조회수·문의 접수·시뮬레이터 클릭,
문의 전환율, 30일 방문자 추이 그래프, 유입 경로, 기기 종류.

### 환경변수

| 이름 | 설명 |
|---|---|
| `STATS_PASSWORD` | **필수.** 없으면 통계 화면이 열리지 않습니다 |
| `DATABASE_URL` | 시뮬레이터가 쓰는 그 PostgreSQL 주소를 그대로 넣습니다.<br>**넣지 않으면 기록이 메모리에만 남아 재배포할 때 전부 사라집니다** (화면 위에 경고가 뜹니다) |
| `STATS_USER` | 지금은 쓰지 않습니다 (비밀번호만 물어봅니다) |
| `STATS_SALT` | 선택. 방문자를 구분하는 값에 섞는 소금.<br>비워 두면 서버가 뜰 때마다 새로 만들어져, 재시작한 날의 순방문자가 다시 세어집니다 |

### 개인정보

IP 주소는 저장하지 않습니다. 날짜·IP·브라우저를 한 덩어리로 해시해 16자만 남기므로
같은 사람이 하루에 몇 번 왔는지는 셀 수 있지만 되짚을 수는 없고, 날짜가 바뀌면 값도 바뀝니다.
검색엔진 수집기는 방문자에서 제외하고, 기록은 400일 뒤 자동으로 지웁니다.

`opennegolab.com` 에서만 기록합니다 — 로컬이나 미리보기 주소에서 시험한 것은 섞이지 않습니다.

## 연결된 것들

| 무엇 | 어디서 관리 |
|---|---|
| 문의 폼 | 우리 서버가 직접 받아 SMTP로 발송 (`inquiry.js`). 외부 서비스 안 씀 |
| 방문 통계 | Google Analytics `G-Z0XNVJ5PRD`, 네이버 애널리틱스 `4429ba2e580cf`<br>`opennegolab.com` 에서만 켜집니다. 로컬·미리보기 주소에서는 기록되지 않습니다 |
| 자체 방문 통계 | `/stats` (비밀번호 필요). 기록은 시뮬레이터와 같은 PostgreSQL 에 `hp_hits` 표로 |
| DNS | Cloudflare (`opennegolab.com`) |
| 협상 시뮬레이터 | 별도 저장소 `opennegolab/8-block-simulator` (Cloudtype 별도 서비스) |

시뮬레이터 주소를 나중에 `sim.opennegolab.com` 등으로 바꾸면
`index.html` 의 `SIMULATOR` 섹션 주석에 적힌 두 곳만 고치면 됩니다.
