ALTER TABLE `survey_responses` MODIFY COLUMN `seccion037` int;--> statement-breakpoint
ALTER TABLE `survey_responses` MODIFY COLUMN `seccion037` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `survey_responses_flat` MODIFY COLUMN `seccion037` int;--> statement-breakpoint
ALTER TABLE `survey_responses_flat` MODIFY COLUMN `seccion037` int DEFAULT 0;