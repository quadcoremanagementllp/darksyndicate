CREATE TABLE `staff_alert_dismissals` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `resource_id` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `dismissed_by_user_id` VARCHAR(191) NOT NULL,
    `dismissed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `staff_alert_dismissals_kind_resource_id_idx`(`kind`, `resource_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
