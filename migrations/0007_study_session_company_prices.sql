alter table if exists study_session_companies
  add column if not exists target_price numeric(20,6) null,
  add column if not exists reference_price numeric(20,6) null,
  add column if not exists reference_price_date date null,
  add column if not exists current_price numeric(20,6) null,
  add column if not exists currency text null;

alter table if exists study_session_companies
  drop constraint if exists chk_study_session_company_currency;

alter table if exists study_session_companies
  add constraint chk_study_session_company_currency
  check (currency is null or currency in ('KRW', 'USD'));
