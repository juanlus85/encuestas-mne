ALTER TABLE `users`
  ADD COLUMN `platformRole` enum('supervisor','user') NOT NULL DEFAULT 'user';--> statement-breakpoint

CREATE TABLE `studies` (
  `id` int AUTO_INCREMENT NOT NULL,
  `code` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `status` enum('draft','active','paused','archived') NOT NULL DEFAULT 'active',
  `clientName` varchar(255),
  `defaultLanguage` enum('es','en') NOT NULL DEFAULT 'en',
  `startDate` varchar(10),
  `endDate` varchar(10),
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `studies_id` PRIMARY KEY(`id`),
  CONSTRAINT `studies_code_unique` UNIQUE(`code`)
);--> statement-breakpoint

CREATE TABLE `study_users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `studyId` int NOT NULL,
  `userId` int NOT NULL,
  `studyRole` enum('administrator','interviewer','reviewer') NOT NULL,
  `isActive` boolean NOT NULL DEFAULT true,
  `assignmentNotes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `study_users_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

CREATE TABLE `study_settings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `studyId` int NOT NULL,
  `projectName` varchar(255) NOT NULL,
  `exportProjectName` varchar(255) NOT NULL,
  `mapPrimaryPointCode` varchar(32),
  `surveyTargetTotal` int NOT NULL DEFAULT 0,
  `surveyTargetResidents` int NOT NULL DEFAULT 0,
  `surveyTargetVisitors` int NOT NULL DEFAULT 0,
  `surveyWeeklyTargetTotal` int NOT NULL DEFAULT 0,
  `surveyWeeklyTargetResidents` int NOT NULL DEFAULT 0,
  `surveyWeeklyTargetVisitors` int NOT NULL DEFAULT 0,
  `quotasEnabled` boolean NOT NULL DEFAULT true,
  `residentQuotaTotal` int NOT NULL DEFAULT 0,
  `visitorQuotaTotal` int NOT NULL DEFAULT 0,
  `enabledCharts` json,
  `openAiApiKey` text,
  `brandLogoLight` varchar(512),
  `brandLogoDark` varchar(512),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `study_settings_id` PRIMARY KEY(`id`),
  CONSTRAINT `study_settings_studyId_unique` UNIQUE(`studyId`)
);--> statement-breakpoint

ALTER TABLE `survey_templates` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `survey_responses` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `photos` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `field_metrics` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `pedestrian_sessions` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `pedestrian_directions` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `pedestrian_passes` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `counting_sessions` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `survey_rejections` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `shifts` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `shift_closures` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `survey_answers` ADD COLUMN `studyId` int;--> statement-breakpoint
ALTER TABLE `survey_responses_flat` ADD COLUMN `studyId` int;--> statement-breakpoint

ALTER TABLE `study_users`
  ADD CONSTRAINT `study_users_studyId_studies_id_fk` FOREIGN KEY (`studyId`) REFERENCES `studies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `study_users`
  ADD CONSTRAINT `study_users_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `study_settings`
  ADD CONSTRAINT `study_settings_studyId_studies_id_fk` FOREIGN KEY (`studyId`) REFERENCES `studies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX `study_users_unique_membership` ON `study_users` (`studyId`,`userId`);--> statement-breakpoint
CREATE INDEX `survey_templates_study_idx` ON `survey_templates` (`studyId`);--> statement-breakpoint
CREATE INDEX `questions_study_idx` ON `questions` (`studyId`);--> statement-breakpoint
CREATE INDEX `survey_responses_study_idx` ON `survey_responses` (`studyId`);--> statement-breakpoint
CREATE INDEX `photos_study_idx` ON `photos` (`studyId`);--> statement-breakpoint
CREATE INDEX `field_metrics_study_idx` ON `field_metrics` (`studyId`);--> statement-breakpoint
CREATE INDEX `pedestrian_sessions_study_idx` ON `pedestrian_sessions` (`studyId`);--> statement-breakpoint
CREATE INDEX `pedestrian_directions_study_idx` ON `pedestrian_directions` (`studyId`);--> statement-breakpoint
CREATE INDEX `pedestrian_passes_study_idx` ON `pedestrian_passes` (`studyId`);--> statement-breakpoint
CREATE INDEX `counting_sessions_study_idx` ON `counting_sessions` (`studyId`);--> statement-breakpoint
CREATE INDEX `survey_rejections_study_idx` ON `survey_rejections` (`studyId`);--> statement-breakpoint
CREATE INDEX `shifts_study_idx` ON `shifts` (`studyId`);--> statement-breakpoint
CREATE INDEX `shift_closures_study_idx` ON `shift_closures` (`studyId`);--> statement-breakpoint
CREATE INDEX `survey_answers_study_idx` ON `survey_answers` (`studyId`);--> statement-breakpoint
CREATE INDEX `survey_responses_flat_study_idx` ON `survey_responses_flat` (`studyId`);--> statement-breakpoint

INSERT INTO `studies` (`code`, `name`, `description`, `status`, `defaultLanguage`, `createdAt`, `updatedAt`)
VALUES ('study-001', 'Study 001', 'Auto-generated study created during multi-study migration.', 'active', 'en', NOW(), NOW());--> statement-breakpoint

INSERT INTO `study_settings` (`studyId`, `projectName`, `exportProjectName`, `createdAt`, `updatedAt`)
SELECT `id`, 'Study 001', 'study-001', NOW(), NOW()
FROM `studies`
WHERE `code` = 'study-001';--> statement-breakpoint

UPDATE `survey_templates`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `questions`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `survey_responses`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `photos`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `field_metrics`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `pedestrian_sessions`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `pedestrian_directions`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `pedestrian_passes`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `counting_sessions`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `survey_rejections`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `shifts`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `shift_closures`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `survey_answers`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint
UPDATE `survey_responses_flat`
SET `studyId` = (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1)
WHERE `studyId` IS NULL;--> statement-breakpoint

INSERT INTO `study_users` (`studyId`, `userId`, `studyRole`, `isActive`, `createdAt`, `updatedAt`)
SELECT
  (SELECT `id` FROM `studies` WHERE `code` = 'study-001' LIMIT 1),
  `id`,
  CASE
    WHEN `role` = 'admin' THEN 'administrator'
    WHEN `role` = 'revisor' THEN 'reviewer'
    ELSE 'interviewer'
  END,
  true,
  NOW(),
  NOW()
FROM `users`
WHERE `role` IN ('admin', 'revisor', 'encuestador');
