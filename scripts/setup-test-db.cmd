@echo off
rem Разовая подготовка базы для интеграционных тестов.
rem
rem Отдельная база нужна, чтобы прогон тестов не стирал данные
rem разработчика: helpers.ts чистит таблицы между тестами.
rem
rem Отдельная роль — чтобы .env.test оставался портируемым
rem и не тянул за собой случайный пароль конкретной машины.

setlocal

set "CONTAINER=subwise-postgres-1"
set "TEST_DB=subwise_test"
set "TEST_USER=subwise_test"
set "TEST_PASSWORD=subwise_test_local"

echo [setup-test-db] Создаю базу и роль...

docker exec %CONTAINER% psql -U subwise -d postgres -tAc "select 1 from pg_database where datname='%TEST_DB%'" | findstr /r "1" >nul
if errorlevel 1 (
  docker exec %CONTAINER% psql -U subwise -d postgres -c "create database %TEST_DB%"
) else (
  echo [setup-test-db] База %TEST_DB% уже существует
)

docker exec %CONTAINER% psql -U subwise -d postgres -c "do $$ begin if not exists (select 1 from pg_roles where rolname='%TEST_USER%') then create role %TEST_USER% login password '%TEST_PASSWORD%'; end if; end $$;"
docker exec %CONTAINER% psql -U subwise -d postgres -c "alter database %TEST_DB% owner to %TEST_USER%"
docker exec %CONTAINER% psql -U subwise -d %TEST_DB% -c "grant all on schema public to %TEST_USER%"

echo [setup-test-db] Накатываю миграции...

cd /d "%~dp0.."
set "DATABASE_URL=postgresql://%TEST_USER%:%TEST_PASSWORD%@localhost:5432/%TEST_DB%"
call npx prisma migrate deploy

echo [setup-test-db] Готово.
endlocal
