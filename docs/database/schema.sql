-- MITRA DRISHTI – PREVENT • DETECT • PROTECT
-- PostgreSQL Relational Schema Blueprint (26 Entities)
-- Ready for Phase 5 Cloud SQL (PostgreSQL) / Drizzle / SQLAlchemy Migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Roles
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE CHECK (code IN ('patient', 'doctor', 'admin')),
  label VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role_id INT NOT NULL REFERENCES roles(id),
  facility_name VARCHAR(160),
  preferred_language VARCHAR(8) NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ta', 'hi')),
  is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Patients
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  mrn VARCHAR(32) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  age INT NOT NULL CHECK (age BETWEEN 12 AND 120),
  sex VARCHAR(16) NOT NULL,
  phone VARCHAR(32),
  district VARCHAR(100) NOT NULL,
  village_or_ward VARCHAR(120),
  preferred_language VARCHAR(8) NOT NULL DEFAULT 'en',
  diabetes_status VARCHAR(32) NOT NULL CHECK (diabetes_status IN ('at_risk', 'prediabetes_lab', 'diagnosed_t2d')),
  assigned_doctor_id UUID REFERENCES users(id),
  assigned_health_worker VARCHAR(120),
  is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_patients_district ON patients(district);
CREATE INDEX idx_patients_doctor ON patients(assigned_doctor_id);

-- 4. Consent Records
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  screening_consent BOOLEAN NOT NULL,
  data_storage_consent BOOLEAN NOT NULL,
  offline_cache_consent BOOLEAN NOT NULL,
  clinical_boundary_acknowledged BOOLEAN NOT NULL,
  language VARCHAR(8) NOT NULL DEFAULT 'en',
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Lifestyle Assessments (9-input)
CREATE TABLE lifestyle_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  age INT NOT NULL,
  diet_quality VARCHAR(40) NOT NULL,
  sleep_hours NUMERIC(4,1) NOT NULL,
  daily_steps INT NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL,
  height_cm NUMERIC(5,2) NOT NULL,
  waist_cm NUMERIC(5,2) NOT NULL,
  family_history VARCHAR(40) NOT NULL,
  smoking_status VARCHAR(24) NOT NULL,
  alcohol_use VARCHAR(24) NOT NULL,
  recorded_offline BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_key VARCHAR(140) UNIQUE,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_assessments_patient ON lifestyle_assessments(patient_id, assessed_at DESC);

-- 6. Risk Assessment Results
CREATE TABLE risk_assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL UNIQUE REFERENCES lifestyle_assessments(id) ON DELETE CASCADE,
  scoring_model_label VARCHAR(160) NOT NULL,
  experimental_score INT NOT NULL CHECK (experimental_score BETWEEN 0 AND 100),
  risk_category VARCHAR(24) NOT NULL CHECK (risk_category IN ('Low', 'Moderate', 'Elevated')),
  top_modifiable_factors JSONB NOT NULL,
  contributions JSONB NOT NULL,
  explanation TEXT NOT NULL,
  recommendations JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Laboratory Results (Clinician Recorded)
CREATE TABLE laboratory_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  recorded_by_doctor_id UUID NOT NULL REFERENCES users(id),
  tested_at DATE NOT NULL,
  hba1c_percent NUMERIC(4,2),
  fasting_glucose_mg_dl NUMERIC(6,2),
  guideline_interpretation TEXT NOT NULL,
  clinical_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Prevention Programmes (12-Month)
CREATE TABLE prevention_programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_month INT NOT NULL DEFAULT 1 CHECK (current_month BETWEEN 1 AND 12),
  phase VARCHAR(48) NOT NULL,
  adherence_percent INT NOT NULL DEFAULT 50,
  baseline_weight_kg NUMERIC(5,2),
  current_weight_kg NUMERIC(5,2),
  baseline_waist_cm NUMERIC(5,2),
  current_waist_cm NUMERIC(5,2)
);

-- 9. Weekly Lessons
CREATE TABLE weekly_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES prevention_programmes(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  phase INT NOT NULL CHECK (phase IN (1, 2)),
  title VARCHAR(180) NOT NULL,
  title_ta VARCHAR(180),
  category VARCHAR(48) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ
);

-- 10. Habit Logs
CREATE TABLE habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  healthy_indian_diet BOOLEAN NOT NULL,
  steps_achieved INT NOT NULL,
  sleep_hours NUMERIC(4,1) NOT NULL,
  weight_kg NUMERIC(5,2),
  waist_cm NUMERIC(5,2),
  barrier_reported TEXT,
  recorded_offline BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_key VARCHAR(140) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Intervention Records
CREATE TABLE intervention_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  trigger_rule VARCHAR(180) NOT NULL,
  ladder_step INT NOT NULL CHECK (ladder_step BETWEEN 1 AND 5),
  action_type VARCHAR(48) NOT NULL,
  recommended_message TEXT NOT NULL,
  experimental_bandit_arm TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Retinal Images
CREATE TABLE retinal_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  eye VARCHAR(16) NOT NULL CHECK (eye IN ('Left (OS)', 'Right (OD)')),
  camera_source VARCHAR(180) NOT NULL,
  storage_uri TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Image Quality Assessments
CREATE TABLE image_quality_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retinal_image_id UUID NOT NULL UNIQUE REFERENCES retinal_images(id) ON DELETE CASCADE,
  sharpness_score NUMERIC(5,2) NOT NULL,
  brightness_mean NUMERIC(5,2) NOT NULL,
  exposure_clip_percent NUMERIC(5,2) NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  gradable BOOLEAN NOT NULL,
  rejection_reason TEXT,
  recapture_guidance TEXT
);

-- 14. Model Versions
CREATE TABLE model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_tag VARCHAR(80) NOT NULL UNIQUE,
  architecture VARCHAR(120) NOT NULL,
  dataset_provenance TEXT NOT NULL,
  is_illustrative BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Model Predictions
CREATE TABLE model_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retinal_image_id UUID NOT NULL REFERENCES retinal_images(id) ON DELETE CASCADE,
  model_version_id UUID NOT NULL REFERENCES model_versions(id),
  icdr_grade INT CHECK (icdr_grade BETWEEN 0 AND 4),
  grade_label VARCHAR(180) NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  uncertainty NUMERIC(4,3) NOT NULL,
  ood_flag BOOLEAN NOT NULL DEFAULT FALSE,
  grade_withheld BOOLEAN NOT NULL DEFAULT FALSE,
  withhold_reason TEXT,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Grad-CAM Records
CREATE TABLE gradcam_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL UNIQUE REFERENCES model_predictions(id) ON DELETE CASCADE,
  heatmap_uri TEXT,
  hotspots JSONB NOT NULL,
  limitation_notice TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Screening Reports
CREATE TABLE screening_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  retinal_image_id UUID NOT NULL REFERENCES retinal_images(id),
  prediction_id UUID REFERENCES model_predictions(id),
  human_review_status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
  summary_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Doctor Reviews
CREATE TABLE doctor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_report_id UUID NOT NULL REFERENCES screening_reports(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id),
  decision VARCHAR(32) NOT NULL,
  clinician_grade VARCHAR(160) NOT NULL,
  triage_category VARCHAR(64) NOT NULL,
  clinical_notes TEXT NOT NULL,
  recommended_next_steps TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. Referrals
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  screening_report_id UUID REFERENCES screening_reports(id),
  created_by_doctor_id UUID NOT NULL REFERENCES users(id),
  target_facility VARCHAR(180) NOT NULL,
  specialty VARCHAR(64) NOT NULL,
  urgency VARCHAR(24) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'Pending',
  specialist_findings TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 20. Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  facility VARCHAR(160) NOT NULL,
  clinician_name VARCHAR(120) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time VARCHAR(32) NOT NULL,
  appointment_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Pending Confirmation',
  reminder_note TEXT,
  escalated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. Follow-Ups
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  health_worker_name VARCHAR(120) NOT NULL,
  due_date DATE NOT NULL,
  channel VARCHAR(32) NOT NULL,
  status VARCHAR(24) NOT NULL,
  outcome_notes TEXT,
  next_screening_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  role_targets JSONB NOT NULL,
  severity VARCHAR(16) NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  read_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 23. Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  role_code VARCHAR(32) NOT NULL,
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(120) NOT NULL,
  outcome VARCHAR(24) NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_time ON audit_logs(created_at DESC);

-- 24. Offline Synchronisation Records
CREATE TABLE offline_sync_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(140) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(64) NOT NULL,
  target_resource_id VARCHAR(120),
  outcome VARCHAR(32) NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 25. District Resources
CREATE TABLE district_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_name VARCHAR(160) NOT NULL,
  facility_type VARCHAR(48) NOT NULL,
  fundus_cameras INT NOT NULL DEFAULT 0,
  ophthalmologists INT NOT NULL DEFAULT 0,
  health_workers INT NOT NULL DEFAULT 0,
  daily_capacity INT NOT NULL DEFAULT 0,
  connectivity_profile VARCHAR(48) NOT NULL
);

-- 26. Simulation Scenarios & Results
CREATE TABLE simulation_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key VARCHAR(48) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE simulation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES simulation_scenarios(id),
  source_type VARCHAR(80) NOT NULL,
  daily_patient_arrivals INT NOT NULL,
  cameras_available INT NOT NULL,
  screening_capacity_per_day INT NOT NULL,
  image_throughput_per_hour INT NOT NULL,
  ophthalmologists_available INT NOT NULL,
  health_worker_workload_pct INT NOT NULL,
  referral_demand_per_week INT NOT NULL,
  avg_queue_length INT NOT NULL,
  avg_wait_time_minutes INT NOT NULL,
  resource_utilization_pct INT NOT NULL,
  estimated_monthly_cost_inr INT NOT NULL,
  bottleneck TEXT,
  hourly_queue_curve JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
