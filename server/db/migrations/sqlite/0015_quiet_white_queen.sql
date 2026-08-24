CREATE TABLE `event_contributors` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`display_name` text,
	`contact` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer,
	FOREIGN KEY (`link_id`) REFERENCES `event_upload_links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_contributors_code_idx` ON `event_contributors` (`code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_contributors_link_code_unq` ON `event_contributors` (`link_id`,`code_hash`);--> statement-breakpoint
CREATE TABLE `event_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`event_id` integer NOT NULL,
	`contributor_id` text NOT NULL,
	`caption` text,
	`r2_key` text NOT NULL,
	`hash` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`type` text NOT NULL,
	`published_to` text,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `event_upload_links`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contributor_id`) REFERENCES `event_contributors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_submissions_link_idx` ON `event_submissions` (`link_id`);--> statement-breakpoint
CREATE INDEX `event_submissions_event_idx` ON `event_submissions` (`event_id`);--> statement-breakpoint
CREATE INDEX `event_submissions_contributor_idx` ON `event_submissions` (`contributor_id`);--> statement-breakpoint
CREATE INDEX `event_submissions_key_idx` ON `event_submissions` (`r2_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_submissions_contributor_key_unq` ON `event_submissions` (`contributor_id`,`r2_key`);--> statement-breakpoint
CREATE TABLE `event_upload_links` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` integer NOT NULL,
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
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_upload_links_event_idx` ON `event_upload_links` (`event_id`);--> statement-breakpoint
ALTER TABLE `upload_sessions` ADD `kind` text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_sessions` ADD `contributor_id` text;