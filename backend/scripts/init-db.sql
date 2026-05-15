-- 智能合约安全教学与实训平台 数据库初始化
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS xcr_system DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE xcr_system;

-- 用户表
CREATE TABLE IF NOT EXISTS user (
  userId INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(20) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL DEFAULT '',
  role ENUM('student','teacher','admin') NOT NULL DEFAULT 'student',
  email VARCHAR(100) NOT NULL,
  createTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastLoginTime DATETIME NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0-正常 1-禁用 2-锁定',
  failCount INT NOT NULL DEFAULT 0,
  lockUntil DATETIME NULL,
  KEY idx_role (role),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 课程表
CREATE TABLE IF NOT EXISTS course (
  courseId INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  cover VARCHAR(255) DEFAULT '',
  teacherId INT NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  difficulty VARCHAR(20) DEFAULT 'beginner',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '0-未发布 1-已发布',
  orderNo INT NOT NULL DEFAULT 0,
  createTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_teacher (teacherId),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 课程模块表（章节）
CREATE TABLE IF NOT EXISTS course_module (
  moduleId INT PRIMARY KEY AUTO_INCREMENT,
  courseId INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content MEDIUMTEXT,
  type ENUM('text','video','code') NOT NULL DEFAULT 'text',
  orderNo INT NOT NULL DEFAULT 0,
  createTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_course (courseId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 漏洞案例表
CREATE TABLE IF NOT EXISTS vulnerability_case (
  caseId INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  vulnType VARCHAR(40) NOT NULL COMMENT 'reentrancy / overflow / frontrunning / shortaddr / dos',
  swcId VARCHAR(20) DEFAULT '',
  difficulty TINYINT NOT NULL DEFAULT 1 COMMENT '1-easy 2-medium 3-hard',
  description TEXT,
  attackGoal TEXT,
  vulnerableCode MEDIUMTEXT NOT NULL,
  attackTemplate MEDIUMTEXT,
  referenceFix MEDIUMTEXT,
  scoreWeight INT NOT NULL DEFAULT 100,
  status TINYINT NOT NULL DEFAULT 1,
  createTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_type (vulnType),
  KEY idx_difficulty (difficulty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 实验提交记录表
CREATE TABLE IF NOT EXISTS experiment_record (
  recordId INT PRIMARY KEY AUTO_INCREMENT,
  studentId INT NOT NULL,
  caseId INT NOT NULL,
  mode ENUM('attack','fix') NOT NULL DEFAULT 'attack',
  code MEDIUMTEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  result VARCHAR(50) NOT NULL DEFAULT 'pending',
  detail JSON NULL,
  submitTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_student (studentId),
  KEY idx_case (caseId),
  KEY idx_submit (submitTime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 学习进度表
CREATE TABLE IF NOT EXISTS learning_progress (
  progressId INT PRIMARY KEY AUTO_INCREMENT,
  studentId INT NOT NULL,
  courseId INT NOT NULL,
  moduleId INT NOT NULL,
  completedTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_progress (studentId, moduleId),
  KEY idx_student_course (studentId, courseId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 任务公告表
CREATE TABLE IF NOT EXISTS assignment (
  assignmentId INT PRIMARY KEY AUTO_INCREMENT,
  teacherId INT NOT NULL,
  courseId INT NULL,
  caseId INT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  deadline DATETIME NULL,
  createTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_teacher (teacherId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 通知表
CREATE TABLE IF NOT EXISTS notification (
  notiId BIGINT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  type VARCHAR(40) NOT NULL COMMENT 'assignment_due / system / ...',
  title VARCHAR(200) NOT NULL,
  content TEXT,
  link VARCHAR(200),
  refId INT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0-未读 1-已读',
  createTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_ref (userId, type, refId),
  KEY idx_user_status (userId, status, createTime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 操作日志表
CREATE TABLE IF NOT EXISTS op_log (
  logId BIGINT PRIMARY KEY AUTO_INCREMENT,
  userId INT NULL,
  action VARCHAR(80) NOT NULL,
  detail TEXT,
  ip VARCHAR(64) DEFAULT '',
  createTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (userId),
  KEY idx_action (action),
  KEY idx_time (createTime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
