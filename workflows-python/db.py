"""Database connection utilities."""

import os

import psycopg2


def get_db_connection():
    """Get a database connection."""
    return psycopg2.connect(os.environ.get("DATABASE_URL"))
