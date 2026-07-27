-- Icono del curso: preset de lucide ('lucide:Book') o URL pública de una imagen subida.
-- Una sola columna text — discriminar por prefijo es más barato que dos columnas + check.
alter table courses add column icon text;

-- Bucket público: la URL lleva un uuid, no se adivina. Privado obligaría a firmar URLs en
-- cada render (async, expiran) para un icono de 20px.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-icons',
  'course-icons',
  true,
  1048576,  -- 1MB. Es un icono, no una portada.
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']  -- sin svg: script inline
)
on conflict (id) do nothing;

-- Escritura solo en la carpeta propia: 'course-icons/<user_id>/<uuid>.<ext>'. La lectura la
-- da el bucket público.
create policy course_icons_owner on storage.objects
  for all to authenticated
  using (bucket_id = 'course-icons' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'course-icons' and (storage.foldername(name))[1] = auth.uid()::text);
