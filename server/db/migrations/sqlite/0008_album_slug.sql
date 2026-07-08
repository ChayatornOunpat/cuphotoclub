ALTER TABLE `content_albums` ADD `slug` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `content_albums` SET `slug` = `id`;
--> statement-breakpoint
CREATE UNIQUE INDEX `content_albums_slug_unique` ON `content_albums` (`slug`);
