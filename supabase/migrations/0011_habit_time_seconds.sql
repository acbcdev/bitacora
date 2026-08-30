-- Habit time: minutes → seconds. Nunca tuvo que ser minutos (ver fix de timer 19:30→20).
-- `amount` y `target` en `habit_log`, y `target` en `habits`, para metric='time', pasan a segundos.
-- Es "más simple" porque la view ya no redondea: `Math.floor((now - startedAt)/1000)` son segundos nativos.
-- La conversión en la form (minutes*60) mantiene los adapters recibiendo int sin cambios.

-- 1) habit_log primero, antes de tocar habits (si no, el WHERE por metric ya no matchea)
update habit_log set
  amount = amount * 60,
  target = target * 60
where habit_id in (select id from habits where metric = 'time');

-- 2) habits.target para los time existentes
update habits set target = target * 60 where metric = 'time';

-- Comentario: a partir de acá, para metric='time', amount/target son segundos. Para check/count siguen siendo count.
comment on column habits.target is 'good=piso bad=techo; en time son segundos, en count/check es count';
comment on column habit_log.amount is 'total del día; en time son segundos, en count/check es count';
comment on column habit_log.target is 'meta congelada ese día; en time son segundos';
