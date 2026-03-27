CREATE TABLE `pedestrian_directions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyPoint` varchar(255) NOT NULL,
	`label` varchar(128) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`order` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pedestrian_directions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pedestrian_passes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`encuestadorId` int NOT NULL,
	`encuestadorName` varchar(255),
	`encuestadorIdentifier` varchar(32),
	`surveyPoint` varchar(255) NOT NULL,
	`directionId` int,
	`directionLabel` varchar(128),
	`count` int NOT NULL,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`gpsAccuracy` decimal(8,2),
	`recordedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pedestrian_passes_id` PRIMARY KEY(`id`)
);
