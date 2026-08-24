CREATE TABLE `collection_contributors` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`display_name` text,
	`contact` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer,
	FOREIGN KEY (`link_id`) REFERENCES `collection_links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_contributors_code_idx` ON `collection_contributors` (`code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_contributors_link_code_unq` ON `collection_contributors` (`link_id`,`code_hash`);--> statement-breakpoint
CREATE TABLE `collection_links` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text,
	`status` text DEFAULT 'open' NOT NULL,
	`passcode_hash` text,
	`require_name` integer DEFAULT false NOT NULL,
	`max_per_contributor` integer DEFAULT 100 NOT NULL,
	`max_total` integer DEFAULT 2000 NOT NULL,
	`compress` integer DEFAULT true NOT NULL,
	`compress_max_dim` integer DEFAULT 3040 NOT NULL,
	`compress_quality` integer DEFAULT 85 NOT NULL,
	`max_bytes_per_photo` integer DEFAULT 15728640 NOT NULL,
	`expires_at` integer,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `collection_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`contributor_id` text NOT NULL,
	`caption` text,
	`r2_key` text NOT NULL,
	`hash` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`type` text NOT NULL,
	`published_to` text,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `collection_links`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contributor_id`) REFERENCES `collection_contributors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_submissions_link_idx` ON `collection_submissions` (`link_id`);--> statement-breakpoint
CREATE INDEX `collection_submissions_contributor_idx` ON `collection_submissions` (`contributor_id`);--> statement-breakpoint
CREATE INDEX `collection_submissions_key_idx` ON `collection_submissions` (`r2_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_submissions_contributor_key_unq` ON `collection_submissions` (`contributor_id`,`r2_key`);--> statement-breakpoint
ALTER TABLE `upload_sessions` ADD `kind` text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_sessions` ADD `contributor_id` text;