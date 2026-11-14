-- PostgreSQL schema proposal. This is NOT applied by the browser demo.
-- Identity, school tenancy and all authorization must be enforced by a trusted API.
create table schools (
  id uuid primary key,
  display_label text not null,
  created_at timestamptz not null default now()
);

create table educators (
  id uuid primary key,
  school_id uuid not null references schools(id),
  identity_subject text not null,
  created_at timestamptz not null default now(),
  unique (school_id, identity_subject)
);

create table classes (
  id uuid primary key,
  school_id uuid not null references schools(id),
  display_label text not null,
  age_band text not null check (age_band in ('9-11','12-13','14-15')),
  created_at timestamptz not null default now()
);

create table class_educators (
  class_id uuid not null references classes(id) on delete cascade,
  educator_id uuid not null references educators(id) on delete cascade,
  primary key (class_id, educator_id)
);

-- Use a school-issued pseudonymous identifier; do not store full birth dates or home details.
create table learners (
  id uuid primary key,
  school_id uuid not null references schools(id),
  external_learner_ref text not null,
  created_at timestamptz not null default now(),
  retention_until date,
  unique (school_id, external_learner_ref)
);

create table class_memberships (
  class_id uuid not null references classes(id) on delete cascade,
  learner_id uuid not null references learners(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, learner_id)
);

create table mission_assignments (
  id uuid primary key,
  school_id uuid not null references schools(id),
  class_id uuid not null references classes(id) on delete cascade,
  created_by uuid not null references educators(id),
  mission_key text not null,
  age_band text not null check (age_band in ('9-11','12-13','14-15')),
  status text not null check (status in ('draft','published','closed')),
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table learner_mission_attempts (
  id uuid primary key,
  school_id uuid not null references schools(id),
  class_id uuid not null references classes(id),
  learner_id uuid not null references learners(id),
  assignment_id uuid references mission_assignments(id) on delete set null,
  mission_key text not null,
  progress_percent smallint not null check (progress_percent between 0 and 100),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table concept_evidence (
  id uuid primary key,
  school_id uuid not null references schools(id),
  attempt_id uuid not null references learner_mission_attempts(id) on delete cascade,
  concept_key text not null,
  evidence_score smallint not null check (evidence_score between 0 and 100),
  evidence_note_code text,
  created_at timestamptz not null default now()
);

create table audit_events (
  id uuid primary key,
  school_id uuid not null references schools(id),
  actor_subject text not null,
  action_key text not null,
  target_type text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

create index class_memberships_learner_idx on class_memberships(learner_id);
create index assignments_class_status_idx on mission_assignments(class_id, status);
create index attempts_class_created_idx on learner_mission_attempts(class_id, created_at desc);
create index concept_evidence_attempt_idx on concept_evidence(attempt_id);
