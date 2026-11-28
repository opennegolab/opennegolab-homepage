# AGENTS.md — 오선빈 타자연습 인계 문서

이 문서는 ChatGPT·Claude 같은 AI 개발 도우미가 **오선빈 타자연습** 앱을 이어서 개발할 수 있도록
정리한 것입니다. 사람이 읽는 운영 안내는 `README.md` 에 있습니다. 둘이 다르면 **코드가 기준**입니다.

> 이 파일에는 API 키·비밀번호 같은 비밀 값을 적지 않습니다.
> 저장소가 **공개(public)** 라서 여기 적은 내용은 누구나 볼 수 있습니다.
> 이 파일은 사이트에서는 열리지 않습니다 (`server.js` 의 `HIDDEN` 목록).

---

## 0. 한눈에 보기

- **무엇**: 초등 저학년(특수교육 포함)이 설치·회원가입 없이 링크만 열어 쓰는 한글 **타자·받아쓰기 연습** 웹앱
- **어디**: 열린협상연구소 홈페이지 저장소 안의 하위 앱 — `https://www.opennegolab.com/typing`
- **앞으로**: **생활 자립 학습 앱**으로 확장 예정 (키오스크 연습 등, 아래 9번)
- **원칙**: 기존 기능·주소 유지, 빌드 도구 없는 순수 HTML/CSS/JS + Node 서버, 유료·외부 서비스 없음

## 1. GitHub 저장소

- 주소: https://github.com/opennegolab/opennegolab-homepage
- 공개 여부: **공개(public)**
- 이 저장소에는 **회사 홈페이지와 타자연습이 함께** 들어 있습니다. 타자연습 관련 파일은 `typing/` 폴더와 `typing-api.js` 입니다
- 별도 저장소(이 앱과 무관): `opennegolab/8-block-simulator`, `opennegolab/8-block-agent` (비공개, 협상 시뮬레이터)

## 2. 서비스 주소 (바꾸지 마세요)

| 주소 | 내용 |
|---|---|
| https://www.opennegolab.com/typing | 하루랑 타자 연습으로 이동 |
| https://www.opennegolab.com/haru/start | 하루랑 시작 화면 — 보호자 로그인 → 공부할 아이 고르기 (또는 둘러보기) |
| https://www.opennegolab.com/haru/stars | 아이의 별·꾸미기·도장 |
| https://www.opennegolab.com/haru/typing | 하루랑 한글 공부 — 공개 기본 문제집 + 로그인한 보호자의 문제집 |
| https://www.opennegolab.com/typing/admin | **문제 설정** — 보호자 로그인 후 내 문제집·문제 관리 |
| https://www.opennegolab.com/api/typing/… | 타자연습 서버 API (아래 6번) |
| https://www.opennegolab.com | 열린협상연구소 홈페이지 (같은 서버) |

## 3. 배포 (Cloudtype)

- 플랫폼: **Cloudtype** / 템플릿 **Node.js** / 설치 `npm install --omit=dev` / 시작 `npm start`
- 포트: Cloudtype 이 넣는 `PORT` 환경변수 (없으면 3000)
- 도메인: `www.opennegolab.com` — DNS 는 Cloudflare (CNAME, DNS only)
- **배포 브랜치: `main`**
- **Cloudtype 프로젝트(서비스) 이름: 저장소에 기록이 없습니다** — Cloudtype 대시보드에서 확인하세요
- **자동 배포: 확실하지 않습니다.** `README.md` 에는 "main 에 push 하면 자동 배포"라고 되어 있지만,
  운영자가 대시보드에서 **배포 버튼을 직접 눌러야** 반영된 적이 있습니다.
  `main` 에 반영한 뒤에는 대시보드에서 최신 커밋이 배포됐는지 꼭 확인하세요
- 홈페이지와 타자연습은 **한 서비스**로 함께 배포됩니다. 타자연습을 고쳐도 홈페이지가 다시 배포됩니다

## 4. 기술 스택

- **Node.js 18 이상**, 프레임워크 없음 — `http` 모듈 서버 하나(`server.js`)
- **빌드 단계 없음** — TypeScript·React·번들러 없음. HTML 안에 CSS·JS 를 직접 씁니다
- 의존성: `pg`(PostgreSQL), `nodemailer`(홈페이지 문의 메일) — 이 둘뿐
- DB: **PostgreSQL** (`DATABASE_URL`, 홈페이지 통계·협상 시뮬레이터와 같은 DB)
- 음성: 브라우저 내장 **Web Speech API** (`speechSynthesis`, 기기에 깔린 한국어 음성)
- 글꼴: Pretendard (jsDelivr CDN)
- 공유 미리보기: Open Graph (`typing/og.png`)

## 5. 프로젝트 구조

콘텐츠 파일을 **저장소 루트**에 둡니다 (예전 Vercel 배포와 구조를 맞춘 것 — 옮기지 마세요).

```
server.js            정적 파일 서버 + 라우트. 타자연습 관련:
                       /api/typing/*  → typing-api.js
                       /typing, /typing/admin → typing/index.html, typing/admin.html
                       /typing 은 /haru/typing 으로 이동
                       HIDDEN: 사이트에 내보내지 않을 파일 목록
typing-api.js        타자연습 서버 — 문제집·문제 저장 API, 표 만들기(prepare), 공개 기본 문제집
typing/
  index.html         학습 화면 (한 파일, 약 1100줄): 처음 화면 → 문제 풀기 → 결과
  admin.html         문제 설정 화면: 문제집 만들기·이름 바꾸기·삭제, 문제 등록·수정·삭제·검색·페이지
  store.js           브라우저 쪽 공용 코드: 서버 API 부르기, 채점(Levenshtein), 섞기
  og.png             공유 미리보기 이미지 (1200×630)
  icon-32/64/180/192.png  전용 아이콘

(홈페이지 쪽 — 타자연습과 별개)
index.html privacy.html haru/ chatgpt-plugin/  홈페이지 화면
inquiry.js stats.js stats.html hit.js                        문의 메일·방문 통계
```

## 6. 기존 기능과 구현 방식

### 6-1. 학습 화면 `typing/index.html`

한 HTML 파일 안에 세 화면(`<section>`)이 있고 `show(id)` 로 하나만 보입니다.

| 화면 | id | 내용 |
|---|---|---|
| 처음 화면 | `home` | ① 문제집 고르기 ② 문제 수(10·20·전체) → 연습 시작. 연습 종류 버튼은 없음(2026-11 제거) |
| 문제 풀기 | `play` | 진행 칸·평균 점수, 문제 영역(`#stage`), 답 입력칸(`#answer`) |
| 결과 | `result` | 평균 점수 원, 100점·부분·0점 수, 문제별 비교, 다시 풀기 |

- **문제 종류 (`item.mode`)** — 문제집의 받아쓰기·질문을 **섞어서** 내고, 문제마다 자기 종류의 화면으로 나옴
  (`store.pick(set, "all", …)`). 소리를 못 내는 곳에서는 질문만(`practiceMode()`)
  - `dictation` 받아쓰기: 문장을 화면에 안 보이고 **소리로만** 읽어 줌. 다시 듣기(버튼·Esc)
  - `qa` 질문에 답하기: 질문을 크게 보여 주고 읽어 줌. **허용 정답 여러 개** 중 가장 높은 점수로 채점
- **진행 상태**는 객체 `S` 하나에 있습니다 — `phase`: `idle → loading → answer → grading → feedback → …`
  한 단계에서만 다음으로 넘어가게 해서 Enter 연타·중복 채점을 막습니다
- **흐름**: `begin(req)` 문제 받아 오기 → `showQuestion()` → Enter → `submit()` 채점 → `showFeedback()` →
  1.8초 뒤(또는 버튼·Enter) `next()` → 마지막이면 `finish()`
- **채점** (`store.js` 의 `grade`/`compare`): Levenshtein 편집거리
  `점수 = max(0, 1 - 거리 / max(정답 글자 수, 입력 글자 수)) × 100` (반올림),
  NFC 정규화, 앞뒤 공백 제거·연속 공백 하나로, 띄어쓰기·문장부호도 반영,
  틀린 글자(sub)·빠진 글자(del)·더 쓴 글자(ins)를 표시
- **한글 입력(IME)**: 조합 중 Enter(`isComposing`, keyCode 229)는 조합이 끝난 뒤 제출 — 마지막 글자 빠짐·두 번 제출 방지
- **음성** (`tts` 객체): 기기의 한국어 음성 중 자연스러운 것 자동 선택, 빠르기 0.9 고정.
  안드로이드는 목소리를 직접 지정하지 않음(소리 안 나는 문제 회피). 소리가 안 나면 4초 뒤 확인 안내.
  `speakable()` 이 계산 문제(`9 + 6 = ?`)만 '9 더하기 6은?' 처럼 말로 바꿔 읽음
- **뒤로가기**: 연습·결과 화면에 들어갈 때 `history.pushState` → 뒤로가기 시 처음 화면으로
- **브라우저에 남기는 것**: 마지막에 고른 문제집·문제 수(`localStorage` `typing.settings`)뿐.
  학습 기록·개인정보는 저장하지 않음 (학생 이름·회원가입 없음)
- **카카오톡·앱 안 브라우저**: 음성이 안 되므로 '크롬으로 열기' 안내
- 테스트용으로 `window.__typing = { S, tts, settings }` 를 열어 둠

### 6-2. 문제 설정 `typing/admin.html`

- 문제집 고르기·만들기·이름 바꾸기·삭제(안의 문제도 함께)
- 받아쓰기 / 질문에 답하기 탭 → **한 문제 등록** / **여러 문제 등록** 탭
  - 여러 문제: 한 줄에 하나. 질문은 `질문 / 정답 / 다른 정답` (엑셀 탭 구분도 됨)
  - 허용 정답은 `/` 로 구분, 정답 칸에서 Enter 로 바로 등록
- 목록: 최신순, 10개씩 페이지, 검색, 수정·삭제·선택 삭제(확인 창)
- **보호자 로그인** — 계정별로 자기 문제집만 관리. **링크 공유 기능은 없음**(2026-11 운영자 요청으로 제거)
- 보호자가 로그인한 **같은 브라우저**에서 한글 공부(`/haru/typing`)를 열면, 그 보호자의 문제집이
  나옵니다 (`/haru/practice-data/*`, 보호자 문제집 번호는 음수 `-DB번호`). 공개 '기본 문제'는 **언제나** 함께 보입니다
  (보호자 문제집이 앞). 로그인하지 않은 사람에게는 '기본 문제'만 보입니다
- 로그인 세션은 **30일**, DB 표 `typing_sessions` 에 쿠키 값의 SHA-256 만 저장 — 배포해도 로그인이 유지됩니다
  (`typing-auth.js`, DB 가 없으면 서버 메모리). 세션에는 지금 고른 아이(`child_id`)도 적습니다

### 6-3. 서버 `typing-api.js`

- **표** (서버가 처음 DB 에 붙을 때 `prepare()` 가 만듦):
  - `typing_sets(id, name, created_at)` — 문제집, 이름 중복 불가(대소문자 무시)
  - `typing_items(id, set_id, mode, prompt, answers JSONB, created_at, updated_at)` — 문제. 문제집 삭제 시 함께 삭제
  - `typing_guardians` — 보호자 계정 및 비밀번호 해시
  - `typing_sessions(key, username, child_id, expires_at)` — 로그인 세션 (30일)
  - `haru_children(id, guardian, name, rewards JSONB, created_at)` — 하루랑 아이 프로필. 별·도장·꾸미기를 아이마다 저장. 보호자 한 명당 8명까지
  - `typing_meta` — 한 번만 하는 일의 기록 (`reset:guardian-data-2026-11`: 보호자 문제집·공유 링크 삭제, `reset:guardian-accounts-2026-11`: 보호자 계정 전부 삭제)
  - (`typing_practice_links` 는 공유 기능 제거 때 삭제됨)
- **API** (`/api/typing/…`, JSON)

  | 요청 | 하는 일 |
  |---|---|
  | `GET /status` | 저장 방식(db/memory) |
  | `GET /sets` | 문제집 목록 + 종류별 문제 수 |
  | `GET /items?set=&mode=` | 문제집의 문제 (정답 포함) |
  | `POST /sets` `{name}` / `PUT /sets/:id` / `DELETE /sets/:id` | 문제집 만들기·이름 바꾸기·삭제 |
  | `POST /items` `{set, mode, items, skipDuplicates}` | 문제 등록 (하나라도 잘못되면 전부 취소) |
  | `PUT /items/:id` / `POST /delete {ids}` | 문제 수정·삭제 |
  | `GET /me` | 지금 누가 쓰나 — 보호자·고른 아이(별 포함)·아이 목록. 로그인 안 했으면 `guardian: null` |
  | `POST /children {name, rewards?}` / `PUT /children/:id` / `DELETE /children/:id` | 아이 만들기(둘러보기 별 옮겨 오기)·이름 바꾸기·지우기 |
  | `POST /child {id}` | 이 세션에서 공부할 아이 고르기 |
  | `POST /rewards {action:"award", place}` / `{action:"wear", item}` | 고른 아이에게 별 주기·꾸미기 입고 벗기 (규칙은 `haru/rewards.js`) |

- 변경 요청 보호: 다른 사이트 Origin 거절, JSON 만 받음, IP 당 1분 60회 제한, 보호자 세션 필요
- `DATABASE_URL` 이 없으면 **메모리 모드**(재시작하면 사라짐, 문제 설정 화면에 경고)
- **공개 기본 문제집** (코드에 정의된 읽기 전용 자료):
  `기본 문제` 한 세트 — 예시 문장·낱말 받아쓰기(60)와 상식 질문·한자리 산수(36)를 합친 것 (`publicSeeds`)

### 6-4. 하루랑 보상 — 별·도장·꾸미기 (`haru/rewards.js`, `/haru/stars`)

- 학습을 끝까지 하면 별 1개 (점수와 상관없이): 한글 공부 한 판, 돈 공부 한 문제 정답, 키오스크·패스트푸드·ATM '문제를 해결했어요'
- 장소(한글 공부·돈 공부·마트·카페·음식점·ATM·패스트푸드)에서 처음 성공하면 도장
- 별이 모이면 하루 꾸미기가 열림 (별을 쓰지 않고, 모은 수로 열림). 자리마다 하나씩 입음:
  모자(리본 1·꽃 3·야구 모자 8·왕관 10·털모자 22), 안경(안경 5·선글라스 13), 목도리(빨간 4·하늘색 18),
  옷(멜빵바지 6·꽃무늬 치마 16), 신발(빨간 운동화 2·초록 장화 12), 배경(반짝이 15·무지개 20)
- 별을 받으면 화면 아래에 알림, '내 별 보기'로 `/haru/stars` (꾸미기·10칸 스티커판·도장 수첩)
- **하루랑은 로그인으로 시작** — `/haru` 를 열면 아이를 고르지 않았고 둘러보기도 누르지 않은 경우 `/haru/start` 로 감.
  보호자 로그인(아이디 + 숫자 4자리) → 아이 고르기·추가·이름 바꾸기·지우기. 학습 화면 주소로 바로 들어오면 막지 않음
- 저장: 아이를 골랐으면 **서버**(`haru_children.rewards`) — 다른 기기에서도 같은 별.
  둘러보기(로그인 없음)는 **이 기기에만** (`localStorage` `haru.rewards.v1`, 둘러보기 표시는 `sessionStorage` `haru.guest`).
  둘러보기 별은 보호자가 새 아이를 만들 때 그 아이에게 옮겨짐
- `haru/rewards.js` 는 브라우저와 서버(`typing-api.js`)가 같이 씀 — 별·도장·꾸미기 규칙(`applyAward`, `applyWear`, `normalize`)을 한곳에 둠.
  화면용 기억: `haru.profile.v1`(누가 쓰나), `haru.child-rewards.v1`(고른 아이 별의 사본). `/api/typing/me` 로 늘 바로잡음
- 각 학습 화면은 `<script src="/haru/rewards.js?v=N">` 를 불러 `HaruRewards.award('장소')` 를 부른다.
  키오스크는 `rewardOnce()` 로 같은 완료 화면이 다시 그려져도 한 번만 준다
- 꾸미기 그림은 하루 그림(`haru-base.webp`, 420×508) 위에 얹는 SVG 도형 — 좌표는 `rewards.js` 의 `ART`
  (눈 (165,196)·(262,196), 머리 꼭대기 (220,50), 목도리 y 260~330, 발 (162,440)·(259,440)). 새 아이템은 `ITEMS` 와 `ART` 에 함께 추가

## 7. 로컬 실행·확인

```bash
npm install
```

```bash
npm start
```

- 학습 화면: http://localhost:3000/typing , 문제 설정: http://localhost:3000/typing/admin
- **빌드 단계 없음** — 파일을 고치고 서버를 다시 켜면 끝
- DB 없이 켜면 메모리 모드(예시 문제집이 메모리에 들어감). 실제처럼 확인하려면 로컬 PostgreSQL 에
  `DATABASE_URL=postgres://사용자@localhost:5432/DB이름 npm start` — 표는 서버가 스스로 만듦
- 문법 검사:

```bash
node --check server.js typing-api.js typing/store.js
```

- **자동 테스트는 저장소에 없습니다.** 고친 뒤 PC·휴대폰 크기 브라우저에서 직접 확인하세요.
  Playwright 등으로 확인할 때는 헤드리스 브라우저에 음성이 없으므로 `speechSynthesis` 를 가짜로 넣어야 합니다

### 환경변수 (이름만 — 값은 Cloudtype 에만 있음)

| 이름 | 쓰는 곳 |
|---|---|
| `PORT` | 서버 포트 (Cloudtype 이 넣음) |
| `DATABASE_URL` | PostgreSQL — 타자연습 문제집, 홈페이지 통계 |
| `STATS_PASSWORD` `STATS_SALT` | 홈페이지 `/stats` (타자연습과 무관) |
| `SMTP_*` `INQUIRY_MAIL_TO` | 홈페이지 문의 메일 (타자연습과 무관) |

## 8. 개발할 때 주의사항

1. **비밀 값 금지** — 저장소가 공개. 키·비밀번호·토큰은 Cloudtype 환경변수로만, `.env` 는 커밋 금지
2. **주소 유지** — `/typing` 은 하루랑으로 이동하며, `/typing/admin` 과 문제 관리 API는 보호자 로그인을 확인합니다.
3. **기존 기능 유지** — 받아쓰기·질문에 답하기·문제집·채점 방식·Enter/IME 처리·뒤로가기를 깨뜨리지 마세요
4. **홈페이지와 한 저장소·한 서버** — 홈페이지 파일(`index.html` 등)과 홈페이지 SEO·통계를 건드리지 않습니다.
   타자연습은 검색에 올리지 않고(`noindex`), 홈페이지 메뉴에도 넣지 않으며, 홈페이지 통계(`hit.js`)에서 뺍니다
5. **구조·도구 유지** — 프레임워크·빌드 도구를 들이지 않습니다. 필요한 파일만 고치고 불필요한 리팩터링은 하지 않습니다
6. **서버는 폴더를 그대로 내보냅니다** — 새 내부 파일(메모·스크립트·서버 코드)은 `server.js` 의 `HIDDEN` 에
   **소문자 경로**로 추가해야 사이트에 노출되지 않습니다
7. **운영 DB 에 실제 문제가 있습니다** — 표를 바꿀 때는 기존 데이터를 지우지 않게(`ADD COLUMN IF NOT EXISTS` 등) `prepare()` 에서 처리
8. **공개 기본 문제** — `typing-api.js`의 공개 기본 목록을 수정합니다. 보호자 문제집은 별도 저장소를 사용합니다.
9. **캐시** — 서버가 `.js`·이미지를 하루 캐시합니다. `typing/store.js` 를 고치면 두 HTML 의 `store.js?v=N` 숫자를 올리세요
10. **휴대폰** — 갤럭시(삼성 인터넷·크롬)가 주 사용 기기. 키보드가 입력칸을 가리지 않게(`body.kbd`), 버튼 누를 때 입력칸 포커스 유지,
    안드로이드 음성은 목소리 지정 금지, 카카오톡 안에서는 음성이 안 됨
11. **유료 API·외부 서비스 추가 금지** (운영자 요청). 음성도 브라우저 내장만
12. **아이를 위한 화면** — 쉬운 말, 큰 글씨, 부담 주지 않는 피드백, 과한 장식·유치한 캐릭터 지양.
    디자인 톤: 따뜻한 아이보리 바탕 + 파스텔(하늘·라일락·민트·살구·꿀색), 둥근 카드, 선 아이콘(이모지 대신)
13. **문서·주석·커밋 메시지는 한국어**로, 무엇을 왜 바꿨는지 쉽게

## 9. 앞으로의 개발 방향 — 생활 자립 학습 앱

> 아직 개발하지 않았습니다. 아래는 계획과, 지금 구조에 맞춘 제안입니다.

**목표**: 타자연습을 **생활 자립 학습 앱**으로 넓힌다.

- 기존 **타자연습·받아쓰기 기능은 그대로 유지**
- **메인 화면에서 학습 종류를 고른다** (예: 타자·받아쓰기 / 키오스크 연습 / …)
- **키오스크 연습** 추가 — 실제 생활 환경을 화면으로 구현:
  은행, 식당, 마트, 카페, 패스트푸드점, 영화관, 수영장, 병원 등
- **기존 배포 주소 유지** (`https://www.opennegolab.com/typing` 과 그 아래 주소)

**지금 구조에서 시작하기 좋은 방법 (제안)**

- 학습 종류 선택은 `typing/index.html` 의 처음 화면(`#home`) 위에 한 단계를 더하거나,
  `/typing` 을 학습 종류 메뉴로 두고 각 학습을 하위 주소로 나누는 방식이 있습니다.
  기존 `/typing` 링크는 하루랑 기본 타자 연습으로 이동합니다.
- 키오스크 연습은 파일이 커질 것이므로 `typing/kiosk/` 처럼 **별도 폴더·파일**로 나누는 것을 권합니다
  (`typing/index.html` 이 이미 1100줄). 새 주소를 열려면 `server.js` 의 `/typing` 라우트를 함께 고쳐야 합니다
- 장소별 키오스크(메뉴·단계·버튼)는 화면 코드와 **데이터(JSON 등)를 나누면** 장소를 늘리기 쉽습니다
- 공용으로 쓸 수 있는 것: 음성(`tts`, `speakable`), 디자인 토큰(`:root` 색 변수), 뒤로가기 처리(`show`/`popstate`),
  카카오톡 외부 브라우저 안내, 화면 준비 뒤 한 번에 보이기(`html.ready`)
- 데이터를 서버에 둬야 하면 `typing-api.js` 에 새 표·API 를 더하되 기존 표·API 는 바꾸지 않습니다
- 실제 기업 키오스크의 상표·로고·화면을 그대로 베끼지 말고, 일반적인 흐름으로 새로 디자인합니다

## 10. 작업 흐름

1. `main` 에서 작업 브랜치를 만든다
2. 고치고 `npm start` 로 PC·휴대폰 크기에서 확인한다
3. 커밋 → push → Pull Request → `main` 에 병합
4. **Cloudtype 대시보드에서 최신 커밋이 배포됐는지 확인** (안 됐으면 배포 버튼)
5. https://www.opennegolab.com/typing 에서 확인. 공유 미리보기를 바꿨다면
   카카오 공유 디버거(https://developers.kakao.com/tool/debugger/sharing)에서 캐시 초기화

되돌리기: `git log` 로 시점을 찾아 `git revert <커밋>` → 다시 배포.
