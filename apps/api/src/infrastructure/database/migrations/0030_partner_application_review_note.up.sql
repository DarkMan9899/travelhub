-- P1.2 (Master Roadmap): partner self-service onboarding. An admin
-- requesting changes on an application (verification_status =
-- NEEDS_CHANGES) needs a way to tell the applicant what to fix — this is
-- that one field, cleared whenever the applicant resubmits (a stale note
-- from a prior review round must never linger against a freshly
-- resubmitted application).

ALTER TABLE partners ADD COLUMN review_note TEXT NULL AFTER moderation_status_id;
