ALTER TABLE `members` ADD `bio` text;
ALTER TABLE `members` ADD `interests` text DEFAULT '[]' NOT NULL;
ALTER TABLE `members` ADD `featured_links` text DEFAULT '[]' NOT NULL;
