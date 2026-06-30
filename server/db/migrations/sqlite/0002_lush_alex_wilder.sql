CREATE TABLE `content_albums` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`date` text NOT NULL,
	`published` text NOT NULL,
	`location` text,
	`excerpt` text NOT NULL,
	`style` text NOT NULL,
	`placement` text NOT NULL,
	`cover_src` text DEFAULT '' NOT NULL,
	`rows_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`tag` text NOT NULL,
	`date` text NOT NULL,
	`published` text NOT NULL,
	`image` text NOT NULL,
	`excerpt` text NOT NULL,
	`body` text DEFAULT '[]' NOT NULL,
	`hero_style` text DEFAULT 'standard' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`author_bio` text DEFAULT '' NOT NULL,
	`author_avatar` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
