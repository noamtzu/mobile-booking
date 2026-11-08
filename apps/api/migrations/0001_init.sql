-- Initial schema. All instants are timestamptz and are stored as UTC.

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  role        text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  code_hash    text NOT NULL,
  expires_at   timestamptz NOT NULL,
  attempts     integer NOT NULL DEFAULT 0,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_codes_email_idx ON login_codes (email, created_at DESC);

CREATE TABLE services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  description       text NOT NULL DEFAULT '',
  duration_minutes  integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
  price_cents       integer NOT NULL CHECK (price_cents >= 0),
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  uuid NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slots_valid_range CHECK (ends_at > starts_at),
  -- One provider cannot be in two places at once: no two slots may overlap.
  -- (For several providers, add provider_id WITH = and the btree_gist extension.)
  CONSTRAINT slots_no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
);
CREATE INDEX slots_service_starts_idx ON slots (service_id, starts_at);

CREATE TABLE bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id       uuid NOT NULL REFERENCES slots (id) ON DELETE RESTRICT,
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  cancelled_at  timestamptz
);
-- The double-booking guarantee: at most one confirmed booking per slot.
-- Cancelled rows are kept for history and do not block rebooking.
CREATE UNIQUE INDEX bookings_one_confirmed_per_slot ON bookings (slot_id) WHERE status = 'confirmed';
CREATE INDEX bookings_user_idx ON bookings (user_id);
