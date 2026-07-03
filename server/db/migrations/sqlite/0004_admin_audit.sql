ALTER TABLE `posts` ADD `updated_by` integer REFERENCES `users`(`id`);
--> statement-breakpoint
ALTER TABLE `content_posts` ADD `created_by` integer REFERENCES `users`(`id`);
--> statement-breakpoint
ALTER TABLE `content_posts` ADD `updated_by` integer REFERENCES `users`(`id`);
--> statement-breakpoint
CREATE TABLE `admin_audit_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `actor_id` integer,
  `actor_email` text NOT NULL,
  `actor_name` text,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `entity_title` text,
  `metadata` text DEFAULT '{}' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
