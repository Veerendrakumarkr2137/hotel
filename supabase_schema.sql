-- Supabase PostgreSQL Schema for Ashok Inn Booking App

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users Table
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null unique,
  password text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  password_reset_token_hash text default null,
  password_reset_expires_at timestamp with time zone default null,
  created_at timestamp with time zone default now()
);

-- 2. Rooms Table
create table if not exists rooms (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null,
  price numeric not null,
  images text[] default array[]::text[],
  room_type text not null,
  capacity integer not null,
  amenities text[] default array[]::text[],
  available_rooms integer not null,
  created_at timestamp with time zone default now()
);

-- 3. Bookings Table
create table if not exists bookings (
  id uuid primary key default uuid_generate_v4(),
  booking_ref text not null unique,
  user_id uuid not null references users(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null,
  check_in_date timestamp with time zone not null,
  check_out_date timestamp with time zone not null,
  guests integer not null,
  total_price numeric not null,
  transaction_id text,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'submitted', 'paid', 'failed')),
  booking_status text not null default 'pending' check (booking_status in ('pending', 'pending_payment', 'confirmed', 'checked_in', 'cancelled', 'completed')),
  payment_method text not null default 'card' check (payment_method in ('card', 'upi', 'wallet', 'manual_upi', 'pay_at_hotel', 'PhonePe')),
  payment_id text,
  order_id text,
  signature text,
  payment_submitted_at timestamp with time zone default null,
  payment_verified_at timestamp with time zone default null,
  booking_confirmed_at timestamp with time zone default null,
  checked_in_at timestamp with time zone default null,
  checked_out_at timestamp with time zone default null,
  cancelled_at timestamp with time zone default null,
  created_at timestamp with time zone default now()
);

-- Indexing for lookup speed
create index if not exists idx_bookings_user_id on bookings(user_id);
create index if not exists idx_bookings_room_id on bookings(room_id);
create index if not exists idx_bookings_transaction_id on bookings(transaction_id);
create index if not exists idx_users_email on users(email);
create index if not exists idx_bookings_ref_email on bookings(booking_ref, email);

-- 4. Gallery Table
create table if not exists gallery (
  id uuid primary key default uuid_generate_v4(),
  url text not null,
  caption text,
  created_at timestamp with time zone default now()
);
