CREATE TABLE `survey_rejections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`encuestadorId` int NOT NULL,
	`encuestadorName` varchar(255),
	`encuestadorIdentifier` varchar(32),
	`surveyType` enum('residentes','visitantes') NOT NULL,
	`surveyPoint` varchar(255),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`gpsAccuracy` decimal(8,2),
	`rejectedAt` timestamp NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `survey_rejections_id` PRIMARY KEY(`id`)
);
