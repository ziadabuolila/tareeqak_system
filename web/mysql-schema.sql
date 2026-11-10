-- MySQL 8 / MariaDB schema for Tareeqak.
-- Select the target database in phpMyAdmin before importing this file.

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL, phone VARCHAR(255) NOT NULL UNIQUE, email VARCHAR(255) NULL UNIQUE,
  email_verified_at DATETIME NULL, password VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'employee', status VARCHAR(32) NOT NULL DEFAULT 'active',
  employee_number VARCHAR(64) NULL, job_title VARCHAR(120) NULL, department VARCHAR(120) NULL,
  employment_type VARCHAR(32) NULL, hire_date DATE NULL, birth_date DATE NULL, gender VARCHAR(32) NULL,
  national_id VARCHAR(64) NULL, address TEXT NULL, emergency_contact_name VARCHAR(255) NULL,
  emergency_contact_phone VARCHAR(64) NULL, salary DECIMAL(12,2) NULL, notes TEXT NULL,
  remember_token VARCHAR(100) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY users_role_created_idx (role, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citizens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL, email VARCHAR(255) NULL UNIQUE, password VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active', primary_device_id VARCHAR(64) NULL,
  gender VARCHAR(32) NULL, age VARCHAR(32) NULL, address TEXT NULL,
  governorate VARCHAR(100) NOT NULL, city VARCHAR(100) NOT NULL,
  phone VARCHAR(255) NOT NULL UNIQUE, national_id VARCHAR(100) NULL,
  front_of_card TEXT NULL, back_of_card TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT citizens_status_check CHECK (status IN ('active','blocked'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS personal_access_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, tokenable_type VARCHAR(255) NOT NULL,
  tokenable_id BIGINT UNSIGNED NOT NULL, name VARCHAR(255) NOT NULL, token VARCHAR(64) NOT NULL UNIQUE,
  abilities TEXT NULL, last_used_at DATETIME NULL, expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY personal_access_tokens_tokenable_idx (tokenable_type, tokenable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citizen_login_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, request_id VARCHAR(64) NOT NULL UNIQUE,
  citizen_id BIGINT UNSIGNED NOT NULL, device_label VARCHAR(120) NOT NULL DEFAULT 'جهاز جديد',
  device_id VARCHAR(64) NOT NULL DEFAULT '', status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL,
  CONSTRAINT citizen_login_requests_citizen_fk FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE CASCADE,
  CONSTRAINT citizen_login_requests_status_check CHECK (status IN ('pending','approved','rejected','expired','completed')),
  KEY citizen_login_requests_citizen_status_idx (citizen_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citizen_devices (
  citizen_id BIGINT UNSIGNED NOT NULL, device_id VARCHAR(64) NOT NULL,
  device_label VARCHAR(120) NOT NULL DEFAULT 'هاتف محمول', status VARCHAR(16) NOT NULL DEFAULT 'active',
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  blocked_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (citizen_id, device_id),
  CONSTRAINT citizen_devices_citizen_fk FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE CASCADE,
  CONSTRAINT citizen_devices_status_check CHECK (status IN ('active','blocked')),
  KEY citizen_devices_citizen_status_idx (citizen_id, status, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, reference VARCHAR(64) NOT NULL UNIQUE,
  citizen_id BIGINT UNSIGNED NULL, title VARCHAR(255) NOT NULL, category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'pending',
  governorate VARCHAR(100) NOT NULL DEFAULT '', city VARCHAR(100) NOT NULL DEFAULT '',
  location TEXT NOT NULL, image_url TEXT NULL, image_data LONGBLOB NULL, image_type VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT reports_citizen_fk FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE SET NULL,
  KEY reports_status_created_idx (status, created_at), KEY reports_citizen_created_idx (citizen_id, created_at),
  KEY reports_created_idx (created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL, kind VARCHAR(32) NOT NULL DEFAULT 'info', is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY notifications_created_idx (created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(190) NOT NULL PRIMARY KEY, value TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citizen_catalog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, kind VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL, parent_name VARCHAR(255) NULL,
  parent_name_key VARCHAR(255) GENERATED ALWAYS AS (COALESCE(parent_name,'')) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY citizen_catalog_unique_idx (kind, name, parent_name_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citizen_catalog_meta (
  seed_key VARCHAR(80) NOT NULL PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
