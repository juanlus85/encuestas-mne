CREATE TABLE `pedestrian_intervals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`intervalStart` timestamp NOT NULL,
	`intervalEnd` timestamp NOT NULL,
	`intervalMinute` int NOT NULL,
	`countIn` int NOT NULL DEFAULT 0,
	`countOut` int NOT NULL DEFAULT 0,
	`photoUrl` text,
	`photoKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pedestrian_intervals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pedestrian_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`encuestadorId` int NOT NULL,
	`encuestadorName` varchar(255),
	`encuestadorIdentifier` varchar(32),
	`surveyPoint` varchar(255) NOT NULL,
	`timeSlot` enum('manana','tarde','noche','fin_semana'),
	`date` varchar(10) NOT NULL,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`gpsAccuracy` decimal(8,2),
	`startedAt` timestamp NOT NULL,
	`finishedAt` timestamp,
	`totalIn` int NOT NULL DEFAULT 0,
	`totalOut` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pedestrian_sessions_id` PRIMARY KEY(`id`)
);
