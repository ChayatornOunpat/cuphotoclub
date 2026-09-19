CREATE TABLE `r2_objects` (
	`object_key` text PRIMARY KEY NOT NULL,
	`folder` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`content_type` text,
	`uploaded_at` integer NOT NULL,
	`order_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `r2_objects_folder_idx` ON `r2_objects` (`folder`);--> statement-breakpoint
CREATE INDEX `r2_objects_size_idx` ON `r2_objects` (`size`);