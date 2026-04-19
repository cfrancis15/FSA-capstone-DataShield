DROP TABLE IF EXISTS acxiom_opt_out_submissions;
DROP TABLE IF EXISTS deletion_requests;
DROP TABLE IF EXISTS user_pii;
DROP TABLE IF EXISTS brokers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS greetings;

CREATE TABLE greetings (
    id SERIAL PRIMARY KEY,
    message text
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

CREATE TABLE user_pii (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    suffix TEXT,
    phone_number TEXT NOT NULL,
    email_address TEXT NOT NULL,
    street TEXT NOT NULL,
    apt TEXT,
    city TEXT NOT NULL,
    us_state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    dob DATE NOT NULL
);

CREATE TABLE brokers(
    id SERIAL PRIMARY KEY,
    firm_name TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE deletion_requests(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    broker_id INTEGER REFERENCES brokers(id),
    sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE acxiom_opt_out_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);