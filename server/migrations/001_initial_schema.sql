-- =============================================================================
-- FairShift Production PostgreSQL Schema
-- Migration 001: Initial Schema
-- Designed for Cloud SQL (PostgreSQL) / Google Cloud Run Deployment
-- =============================================================================

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(64) NOT NULL CHECK (industry IN ('construction', 'healthcare')),
    code VARCHAR(32) NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(32) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('worker', 'manager', 'admin')),
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    industry VARCHAR(64) NOT NULL CHECK (industry IN ('construction', 'healthcare')),
    designation VARCHAR(255) NOT NULL,
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
    overtime_rate_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    industry VARCHAR(64) NOT NULL CHECK (industry IN ('construction', 'healthcare')),
    title VARCHAR(255) NOT NULL,
    start_time VARCHAR(16) NOT NULL,
    end_time VARCHAR(16) NOT NULL,
    duration_hours NUMERIC(4, 2) NOT NULL DEFAULT 8.00,
    is_overnight BOOLEAN NOT NULL DEFAULT FALSE,
    required_role VARCHAR(255) NOT NULL,
    site_location VARCHAR(255) NOT NULL,
    qr_code_token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shifts_org ON shifts(organization_id);

-- Attendance Records
CREATE TABLE IF NOT EXISTS attendance (
    id VARCHAR(64) PRIMARY KEY,
    worker_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    worker_name VARCHAR(255) NOT NULL,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    industry VARCHAR(64) NOT NULL CHECK (industry IN ('construction', 'healthcare')),
    shift_id VARCHAR(64) NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    shift_title VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out_time TIMESTAMP WITH TIME ZONE,
    regular_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    overtime_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'disputed')),
    verification_method VARCHAR(32) NOT NULL DEFAULT 'qr',
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_worker ON attendance(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org ON attendance(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- Payslips
CREATE TABLE IF NOT EXISTS payslips (
    id VARCHAR(64) PRIMARY KEY,
    worker_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    worker_name VARCHAR(255) NOT NULL,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    industry VARCHAR(64) NOT NULL CHECK (industry IN ('construction', 'healthcare')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    regular_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    overtime_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    regular_rate NUMERIC(10, 2) NOT NULL,
    overtime_rate NUMERIC(10, 2) NOT NULL,
    gross_pay NUMERIC(12, 2) NOT NULL,
    total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_pay NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT '₹',
    status VARCHAR(32) NOT NULL DEFAULT 'estimate' CHECK (status IN ('estimate', 'approved', 'disbursed')),
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payslips_worker ON payslips(worker_id);
CREATE INDEX IF NOT EXISTS idx_payslips_org ON payslips(organization_id);

-- Safety Hazard Reports
CREATE TABLE IF NOT EXISTS safety_reports (
    id VARCHAR(64) PRIMARY KEY,
    reference_code VARCHAR(64) NOT NULL UNIQUE,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    industry VARCHAR(64) NOT NULL CHECK (industry IN ('construction', 'healthcare')),
    category VARCHAR(255) NOT NULL,
    severity VARCHAR(32) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    reporter_mode VARCHAR(32) NOT NULL CHECK (reporter_mode IN ('named', 'confidential', 'anonymous')),
    worker_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL, -- Null if anonymous
    reporter_display_name VARCHAR(255),
    has_photo BOOLEAN NOT NULL DEFAULT FALSE,
    photo_data_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'action_required', 'resolved')),
    assigned_person VARCHAR(255),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_safety_org ON safety_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_safety_status ON safety_reports(status);

-- Anonymous Workplace Feedback
-- Strictly detached: No worker_id or user_id column is created!
CREATE TABLE IF NOT EXISTS workplace_feedback (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    industry VARCHAR(64) NOT NULL CHECK (industry IN ('construction', 'healthcare')),
    category VARCHAR(64) NOT NULL,
    mode VARCHAR(32) NOT NULL DEFAULT 'anonymous',
    sentiment VARCHAR(32) NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'concern')),
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_org ON workplace_feedback(organization_id);

-- Fatigue & Rest Warnings
CREATE TABLE IF NOT EXISTS fatigue_alerts (
    id VARCHAR(64) PRIMARY KEY,
    worker_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    worker_name VARCHAR(255) NOT NULL,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    industry VARCHAR(64) NOT NULL CHECK (industry IN ('construction', 'healthcare')),
    trigger_type VARCHAR(64) NOT NULL,
    metric_value VARCHAR(255) NOT NULL,
    explanation TEXT NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'moderate',
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reviewed')),
    reviewed_by VARCHAR(255),
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fatigue_org ON fatigue_alerts(organization_id);

-- Skill Passport
CREATE TABLE IF NOT EXISTS skills (
    id VARCHAR(64) PRIMARY KEY,
    worker_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_title VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    years_experience INT NOT NULL DEFAULT 1,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verifier_name VARCHAR(255),
    verifier_designation VARCHAR(255),
    verified_at DATE,
    certificate_ref VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_skills_worker ON skills(worker_id);
