-- 0012: Correct the seeded industry presentation dates and presenters to match
-- actual study sessions. Idempotent: updates by industry_name match.

update study_sessions set presented_at = '2025-08-26', presenter = '스터디',  title = '방산 산업 발표'       where industry_name = '방산';
update study_sessions set presented_at = '2025-10-27', presenter = '이동훈',  title = '조선 산업 발표'       where industry_name = '조선';
update study_sessions set presented_at = '2025-12-29', presenter = '한주영',  title = '반도체 산업 발표'     where industry_name = '반도체';
update study_sessions set presented_at = '2026-02-09', presenter = '스터디',  title = '소프트웨어 산업 발표' where industry_name = '소프트웨어';
update study_sessions set presented_at = '2026-03-30', presenter = '스터디',  title = '화장품 산업 발표'     where industry_name = '화장품';
