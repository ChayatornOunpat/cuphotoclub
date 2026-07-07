CREATE TABLE `r2_delete_session_items` (
	`session_id` text NOT NULL,
	`object_key` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`referenced` integer DEFAULT false NOT NULL,
	`error` text,
	PRIMARY KEY(`session_id`, `object_key`),
	FOREIGN KEY (`session_id`) REFERENCES `r2_delete_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `r2_delete_session_items_session_idx` ON `r2_delete_session_items` (`session_id`);--> statement-breakpoint
CREATE TABLE `r2_delete_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` integer NOT NULL,
	`force` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upload_session_items` (
	`session_id` text NOT NULL,
	`id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`hash` text NOT NULL,
	`ext` text NOT NULL,
	`r2_key` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	PRIMARY KEY(`session_id`, `id`),
	FOREIGN KEY (`session_id`) REFERENCES `upload_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `upload_session_items_session_idx` ON `upload_session_items` (`session_id`);--> statement-breakpoint
CREATE TABLE `upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` integer NOT NULL,
	`prefix` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
