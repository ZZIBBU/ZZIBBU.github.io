-- ============================================
-- 다이어리 앱 데이터베이스 스키마
-- ============================================

-- 1. 일기 테이블 (diary_entries)
CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT, -- 이미지 URL (Supabase Storage URL 또는 base64)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date) -- 같은 날짜에 하나의 일기만 허용 (필요시 제거 가능)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_diary_entries_date ON diary_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_diary_entries_created ON diary_entries(created_at DESC);

-- 2. 캘린더 이벤트 테이블 (calendar_events)
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  assignee TEXT, -- 의뢰자
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  notes TEXT, -- 내용
  image_url TEXT, -- 이미지 URL (선택사항)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_priority ON calendar_events(priority);

-- 3. 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_diary_entries_updated_at
  BEFORE UPDATE ON diary_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (Row Level Security) 설정
-- ============================================

-- RLS 활성화
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능하도록 정책 설정 (공개 앱인 경우)
-- 프로덕션에서는 인증된 사용자만 접근하도록 수정 필요

-- 일기 테이블 정책
CREATE POLICY "Allow all operations on diary_entries"
  ON diary_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 캘린더 이벤트 테이블 정책
CREATE POLICY "Allow all operations on calendar_events"
  ON calendar_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Supabase Storage 버킷 생성 (수동으로 실행)
-- ============================================
-- 
-- Supabase 대시보드에서 Storage > Create bucket 실행:
-- - Bucket name: diary-images
-- - Public bucket: Yes (이미지를 공개적으로 접근 가능하게 하려면)
-- 
-- 또는 SQL로 실행:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('diary-images', 'diary-images', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- Storage 정책 설정:
-- CREATE POLICY "Allow public read access"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'diary-images');
--
-- CREATE POLICY "Allow public upload"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'diary-images');
--
-- CREATE POLICY "Allow public update"
--   ON storage.objects FOR UPDATE
--   USING (bucket_id = 'diary-images');
--
-- CREATE POLICY "Allow public delete"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'diary-images');

-- ============================================
-- 샘플 데이터 (선택사항)
-- ============================================

-- INSERT INTO diary_entries (entry_date, title, content)
-- VALUES 
--   (CURRENT_DATE, '첫 번째 일기', '오늘의 일기를 기록합니다.'),
--   (CURRENT_DATE - INTERVAL '1 day', '어제의 일기', '어제 있었던 일을 기록합니다.');

-- INSERT INTO calendar_events (event_date, title, priority, status, notes)
-- VALUES 
--   (CURRENT_DATE, '샘플 일정', 'medium', 'todo', '이것은 샘플 일정입니다.'),
--   (CURRENT_DATE + INTERVAL '1 day', '내일 일정', 'high', 'todo', '중요한 일정입니다.');
