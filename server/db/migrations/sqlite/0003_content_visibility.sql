ALTER TABLE `content_albums` ADD `visibility` text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE `content_posts` ADD `visibility` text DEFAULT 'public' NOT NULL;
