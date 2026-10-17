-- Leer notas como hábito: una fila de `habits` con `tracks = 'reads'`. Su log NO se escribe en
-- habit_log — se deriva de read_log (derive.ts), que ya es el registro de cada repaso.
alter table habits add column tracks text check (tracks in ('reads'));

-- Uno vivo por usuario: el onboarding en dos pestañas no crea dos.
create unique index habits_one_reads on habits (user_id) where tracks = 'reads' and deleted_at is null;
