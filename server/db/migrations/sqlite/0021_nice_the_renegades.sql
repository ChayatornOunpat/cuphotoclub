ALTER TABLE `collection_links` ADD `album_id` text;--> statement-breakpoint
ALTER TABLE `collection_submissions` ADD `review` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `collection_submissions` ADD `reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `collection_submissions` ADD `reviewed_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `collection_submissions` ADD `album_key` text;--> statement-breakpoint
CREATE INDEX `collection_submissions_link_review_idx` ON `collection_submissions` (`link_id`,`review`);--> statement-breakpoint
-- Backfill: rows consolidated before review existed are already in an album,
-- so they are approved, not pending. album_key stays null for them — the
-- membership check treats a null key as "approved, membership unknown" and
-- leaves them out of divergence detection rather than guessing a path.
UPDATE `collection_submissions` SET `review` = 'approved' WHERE `published_to` IS NOT NULL;
