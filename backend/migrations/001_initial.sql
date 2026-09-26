CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(32) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('passenger', 'driver') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  driver_id CHAR(36) NOT NULL,
  label VARCHAR(80) NOT NULL,
  plate_number VARCHAR(24) NOT NULL UNIQUE,
  capacity TINYINT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_vehicle_capacity CHECK (capacity BETWEEN 1 AND 8),
  CONSTRAINT fk_vehicle_driver FOREIGN KEY (driver_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pools (
  id CHAR(36) NOT NULL PRIMARY KEY,
  vehicle_id CHAR(36) NOT NULL,
  pickup_zone VARCHAR(40) NOT NULL,
  status ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pool_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  INDEX idx_pool_vehicle_status (vehicle_id, status),
  INDEX idx_pool_pickup_status (pickup_zone, status)
);

CREATE TABLE IF NOT EXISTS ride_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  passenger_id CHAR(36) NOT NULL,
  pickup_zone VARCHAR(40) NOT NULL,
  destination_zone VARCHAR(40) NOT NULL,
  seat_count TINYINT UNSIGNED NOT NULL DEFAULT 1,
  distance_km SMALLINT UNSIGNED NOT NULL,
  estimated_fare_paisa INT UNSIGNED NOT NULL,
  fare_paisa INT UNSIGNED NULL,
  status ENUM('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_ride_seats CHECK (seat_count BETWEEN 1 AND 8),
  CONSTRAINT chk_ride_route CHECK (pickup_zone <> destination_zone),
  CONSTRAINT fk_ride_passenger FOREIGN KEY (passenger_id) REFERENCES users(id),
  INDEX idx_ride_passenger_created (passenger_id, created_at),
  INDEX idx_ride_request_match (status, pickup_zone)
);

CREATE TABLE IF NOT EXISTS pool_memberships (
  id CHAR(36) NOT NULL PRIMARY KEY,
  pool_id CHAR(36) NOT NULL,
  ride_request_id CHAR(36) NOT NULL UNIQUE,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_membership_pool FOREIGN KEY (pool_id) REFERENCES pools(id),
  CONSTRAINT fk_membership_ride FOREIGN KEY (ride_request_id) REFERENCES ride_requests(id),
  INDEX idx_membership_pool (pool_id)
);

CREATE TABLE IF NOT EXISTS ride_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ride_request_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NULL,
  from_status VARCHAR(24) NULL,
  to_status VARCHAR(24) NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_event_ride FOREIGN KEY (ride_request_id) REFERENCES ride_requests(id),
  CONSTRAINT fk_event_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  INDEX idx_event_ride_created (ride_request_id, created_at)
);