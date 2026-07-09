CREATE TABLE `r2_trash` (
	`object_key` text PRIMARY KEY NOT NULL,
	`content_type` text,
	`size` integer,
	`referenced` integer DEFAULT false NOT NULL,
	`references_json` text,
	`deleted_by` integer,
	`deleted_by_email` text,
	`deleted_by_name` text,
	`deleted_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `r2_trash_deleted_at_idx` ON `r2_trash` (`deleted_at`);
