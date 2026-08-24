PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- Links created before the label was required may hold NULL; the rebuilt table
-- is NOT NULL, so backfill with an empty string rather than lose the row.
UPDATE `collection_links` SET `label` = '' WHERE `label` IS NULL;--> statement-breakpoint
CREATE TABLE `__new_collection_links` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`description` text,
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
INSERT INTO `__new_collection_links`("id", "label", "status", "passcode_hash", "require_name", "max_per_contributor", "max_total", "compress", "compress_max_dim", "compress_quality", "max_bytes_per_photo", "expires_at", "created_by", "created_at", "updated_at") SELECT "id", "label", "status", "passcode_hash", "require_name", "max_per_contributor", "max_total", "compress", "compress_max_dim", "compress_quality", "max_bytes_per_photo", "expires_at", "created_by", "created_at", "updated_at" FROM `collection_links`;--> statement-breakpoint
DROP TABLE `collection_links`;--> statement-breakpoint
ALTER TABLE `__new_collection_links` RENAME TO `collection_links`;--> statement-breakpoint
PRAGMA foreign_keys=ON;