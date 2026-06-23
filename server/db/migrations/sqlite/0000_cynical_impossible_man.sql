CREATE TABLE `albums` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`event_date` integer,
	`cover_photo_id` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_slug_unique` ON `albums` (`slug`);--> statement-breakpoint
CREATE TABLE `contact_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`subject` text,
	`message` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`read_at` integer,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`body` text DEFAULT '' NOT NULL,
	`event_date` integer,
	`location` text,
	`cover_r2_key` text,
	`register_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`updated_by` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_key_unique` ON `pages` (`key`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`album_id` integer NOT NULL,
	`r2_key` text NOT NULL,
	`width` integer,
	`height` integer,
	`placeholder` text,
	`caption` text,
	`alt` text,
	`photographer` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text,
	`body` text DEFAULT '' NOT NULL,
	`cover_r2_key` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`author_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`role` text DEFAULT 'editor' NOT NULL,
	`password_hash` text,
	`google_sub` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);