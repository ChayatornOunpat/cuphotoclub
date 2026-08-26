ALTER TABLE `content_albums` ADD `auto_cover_src` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `content_albums` ADD `photo_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill the two derived columns from the existing `rows_json` blobs. Both
-- mirror what the list endpoints used to compute in JS on every request:
-- photo_count = image cells that actually have a src; auto_cover_src = the
-- first such cell (json_each walks arrays in index order, so LIMIT 1 is the
-- same "first image" the old `.find()` picked). From here on writeAlbum keeps
-- them in sync, so no list query has to read rows_json again.
UPDATE `content_albums` SET `photo_count` = (
  SELECT count(*)
  FROM json_each(`content_albums`.`rows_json`) AS r,
       json_each(json_extract(r.value, '$.cells')) AS c
  WHERE json_extract(c.value, '$.type') = 'image'
    AND coalesce(json_extract(c.value, '$.src'), '') <> ''
);--> statement-breakpoint
UPDATE `content_albums` SET `auto_cover_src` = coalesce((
  SELECT json_extract(c.value, '$.src')
  FROM json_each(`content_albums`.`rows_json`) AS r,
       json_each(json_extract(r.value, '$.cells')) AS c
  WHERE json_extract(c.value, '$.type') = 'image'
    AND coalesce(json_extract(c.value, '$.src'), '') <> ''
  LIMIT 1
), '');
