-- ============================================================
--  CAMPUS EVENT TRACKER — FULL DATABASE
-- ============================================================

CREATE DATABASE IF NOT EXISTS campus_events;
USE campus_events;

-- USERS TABLE
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  college VARCHAR(200) NOT NULL,
  department VARCHAR(100),
  phone VARCHAR(20),
  role ENUM('student','college_admin','admin') DEFAULT 'student',
  profile_pic VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EVENTS TABLE
CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category ENUM('hackathon','workshop','ideathon','seminar','cultural','sports','tech_talk','bootcamp','other') NOT NULL,
  college VARCHAR(200) NOT NULL,
  venue VARCHAR(200) NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  last_date DATE,
  total_seats INT DEFAULT 100,
  filled_seats INT DEFAULT 0,
  poster VARCHAR(255),
  registration_link VARCHAR(255),
  prize_pool VARCHAR(100),
  team_size VARCHAR(50),
  is_free TINYINT(1) DEFAULT 1,
  fee DECIMAL(10,2) DEFAULT 0.00,
  organizer_id INT,
  status ENUM('pending','approved','rejected','cancelled') DEFAULT 'approved',
  featured TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- REGISTRATIONS TABLE
CREATE TABLE registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  team_name VARCHAR(100),
  members TEXT,
  status ENUM('registered','waitlist','cancelled') DEFAULT 'registered',
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE KEY unique_reg (user_id, event_id)
);

-- NOTIFICATIONS TABLE
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  title VARCHAR(200),
  message TEXT,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ADMIN TABLE
CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SITE STATS TABLE
CREATE TABLE site_visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(50),
  page VARCHAR(100),
  visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DEFAULT ADMIN (password: admin@123)
INSERT INTO admins (username, email, password) VALUES
('superadmin', 'admin@campus.com', '$2b$10$YourHashedPasswordHere');

-- SAMPLE EVENTS
INSERT INTO events (title, description, category, college, venue, event_date, event_time, last_date, total_seats, prize_pool, team_size, is_free, organizer_id, featured) VALUES
('National Hackathon 2025','Build innovative solutions for real-world problems in 24 hours!','hackathon','IIT Delhi','Tech Auditorium, Block A','2025-05-10','09:00:00','2025-05-05',200,'₹1,00,000','2-4','1',NULL,1),
('AI & ML Workshop','Hands-on workshop on Deep Learning and Neural Networks.','workshop','NIT Trichy','CS Lab 3','2025-05-15','10:00:00','2025-05-12',60,NULL,'1','0',NULL,0),
('Ideathon Spring 2025','Present your innovative idea and win exciting prizes!','ideathon','VIT Vellore','Main Hall','2025-05-20','09:30:00','2025-05-18',150,'₹50,000','1-3','1',NULL,1),
('Cloud Computing Bootcamp','3-day intensive bootcamp on AWS and Azure.','bootcamp','BITS Pilani','Room 204','2025-05-25','09:00:00','2025-05-22',40,NULL,'1','0',NULL,0),
('Tech Talk: Future of AI','Industry experts share insights on AI trends.','tech_talk','IIT Bombay','Open Air Theatre','2025-06-01','17:00:00','2025-05-28',300,NULL,'1','1',NULL,0),
('Inter-College Cricket','Annual inter-college cricket championship.','sports','Delhi University','Main Ground','2025-06-05','08:00:00','2025-06-01',200,'₹25,000','11','1',NULL,0);