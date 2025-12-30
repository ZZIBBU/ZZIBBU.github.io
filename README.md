# Haezzi_Notion
귀여운 해찌 노션 위젯

## 개요
- 노션에 임베드해서 쓸 수 있는 **캘린더 / 일기** 위젯입니다.
- Supabase URL + anon/public 키만 넣으면 바로 브라우저에서 저장/조회가 됩니다.
- Supabase 연결이 필수이며, 연결되지 않으면 위젯 입력이 비활성화됩니다.

## 빠른 실행
1. 정적 호스팅으로 `connection-test/index.html`을 열면 됩니다. (예: `python -m http.server 3000` 후 `http://localhost:3000/connection-test`)
2. 상단 "Supabase 연결" 영역에 **프로젝트 URL**과 **anon/public 키**를 넣고 "연결 저장"을 누르면 실데이터 모드로 전환됩니다.
3. 키를 지우고 싶으면 "로컬 초기화" 버튼을 누르면 됩니다.

## Supabase 준비
아래 테이블만 만들면 됩니다. (SQL 에디터에 그대로 실행 가능)

```sql
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  title text not null,
  notes text default ''
);

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  title text not null,
  content text not null
);

-- row level security
alter table public.calendar_events enable row level security;
alter table public.diary_entries enable row level security;

-- 간단한 공개 정책 (익명 쓰기/읽기용)
create policy "anon can read events" on public.calendar_events for select using (true);
create policy "anon can insert events" on public.calendar_events for insert with check (true);

create policy "anon can read diaries" on public.diary_entries for select using (true);
create policy "anon can insert diaries" on public.diary_entries for insert with check (true);
```

> 필요 시 정책을 더 세밀하게 걸어주세요. 익명 키를 쓰는 위젯 특성상 공개 프로젝트나 샘플 DB에서 사용을 권장합니다.

## 기능 요약
- 달력에서 월 이동, 날짜 선택, 일정 표시
- 일정/일기 추가 → Supabase 테이블 insert → 선택한 날짜에 반영
- 캘린더 전용 위젯(`diary/calendar.html`): 일정 추가/삭제 + 날짜별 일기 작성 여부 표시
- Supabase 오류 시 입력이 잠기며 연결을 다시 설정해야 합니다.
- 입력한 Supabase URL/키는 브라우저 `localStorage`에 저장하여 새로고침에도 유지

## 노션 임베드 팁
- 이 저장소를 Vercel/Netlify 등의 정적 호스팅에 올린 뒤 URL을 노션 "임베드" 블록에 붙여 넣으면 됩니다.
- 캔버스 폭에 맞추도록 반응형으로 설계되어 있어 작은 위젯 영역에서도 동작합니다.

즐겁게 사용하세요 🧸
