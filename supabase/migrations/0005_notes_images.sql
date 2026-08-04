-- Imágenes embebidas en notas importadas de Notion (spec .scratch/notion-import). Mismo patrón
-- que course-icons (0004_course_icon.sql): bucket público + policy de escritura por carpeta propia.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notes-images',
  'notes-images',
  true,
  5242880,  -- 5MB. Screenshots de curso, no necesitan más.
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']  -- sin svg: script inline
)
on conflict (id) do nothing;

-- Escritura solo en la carpeta propia: 'notes-images/<user_id>/<uuid>.<ext>'. La lectura la da
-- el bucket público. El import corre con la service_role key (bypassa esta policy) — igual queda
-- para si alguna vez se sube una imagen desde la app.
create policy notes_images_owner on storage.objects
  for all to authenticated
  using (bucket_id = 'notes-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'notes-images' and (storage.foldername(name))[1] = auth.uid()::text);
