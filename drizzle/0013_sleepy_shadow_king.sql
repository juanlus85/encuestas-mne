ALTER TABLE `pedestrian_sessions` MODIFY COLUMN `startedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `pedestrian_sessions` MODIFY COLUMN `finishedAt` timestamp DEFAULT (now());--> statement-breakpoint
ALTER TABLE `survey_responses` MODIFY COLUMN `startedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `survey_responses` MODIFY COLUMN `finishedAt` timestamp DEFAULT (now());--> statement-breakpoint
ALTER TABLE `survey_responses_flat` MODIFY COLUMN `startedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `survey_responses_flat` MODIFY COLUMN `finishedAt` timestamp DEFAULT (now());