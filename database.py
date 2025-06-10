import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
from contextlib import contextmanager

# Update these with your actual PostgreSQL credentials
DB_CONFIG = {
    "dbname": "user_management",
    "user": "postgres",
    "password": "admin",
    "host": "localhost",   # e.g., "localhost" or "192.168.1.10"
    "port": 5432                 # default PostgreSQL port
}

@contextmanager
def pg_connection():
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with pg_connection() as conn:
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """)

        # Create sessions table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Create new table for prompts
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_prompts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            prompt TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Create new table for user history
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            action_type VARCHAR(50) NOT NULL,
            description TEXT NOT NULL,
            details JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        conn.commit()

# Run this function to reset the database with the correct schema
def reset_db():
    print("Resetting database...")
    with pg_connection() as conn:
        cursor = conn.cursor()
        
        # Drop tables in reverse order of dependencies
        print("Dropping existing tables...")
        cursor.execute("DROP TABLE IF EXISTS user_prompts CASCADE")
        cursor.execute("DROP TABLE IF EXISTS sessions CASCADE")
        cursor.execute("DROP TABLE IF EXISTS users CASCADE")
        
        conn.commit()
    
    # Recreate tables
    print("Recreating tables...")
    init_db()
    print("Database reset complete.")

def inspect_db_schema():
    with pg_connection() as conn:
        cursor = conn.cursor()
        
        # Get column names for users table
        cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        """)
        
        columns = cursor.fetchall()
        print("Users table columns:")
        for col in columns:
            print(f"  - {col[0]}: {col[1]}")
        
        # Check if tables exist
        cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        """)
        
        tables = cursor.fetchall()
        print("\nExisting tables:")
        for table in tables:
            print(f"  - {table[0]}")

init_db()
inspect_db_schema()

def alter_users_table_add_fields():
    with pg_connection() as conn:
        cursor = conn.cursor()
        # Add first_name column if not exists
        cursor.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='first_name'
            ) THEN
                ALTER TABLE users ADD COLUMN first_name VARCHAR(255);
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='last_name'
            ) THEN
                ALTER TABLE users ADD COLUMN last_name VARCHAR(255);
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='email'
            ) THEN
                ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE;
            END IF;
        END
        $$;
        """)
        conn.commit()
        cursor.close()

alter_users_table_add_fields()
inspect_db_schema()

if __name__ == "__main__":
    print("Current database schema:")
    inspect_db_schema()
    
    # Uncomment the next line to reset the database
    reset_db()
    
    # Check schema after reset
    inspect_db_schema()
