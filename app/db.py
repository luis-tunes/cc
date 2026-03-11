import os
from contextlib import contextmanager
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

DATABASE_URL = os.environ.get("DATABASE_URL", "")
_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            DATABASE_URL, min_size=2, max_size=10, kwargs={"row_factory": dict_row}
        )
    return _pool


@contextmanager
def get_conn():
    with get_pool().connection() as conn:
        yield conn


def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id            SERIAL PRIMARY KEY,
                tenant_id     TEXT,
                supplier_nif  VARCHAR(9) NOT NULL DEFAULT '',
                client_nif    VARCHAR(9) NOT NULL DEFAULT '',
                total         NUMERIC(12,2) NOT NULL DEFAULT 0,
                vat           NUMERIC(12,2) NOT NULL DEFAULT 0,
                date          DATE,
                type          VARCHAR(32) NOT NULL DEFAULT 'outro',
                filename      TEXT,
                raw_text      TEXT,
                status        VARCHAR(32) NOT NULL DEFAULT 'pendente',
                paperless_id  INTEGER UNIQUE,
                created_at    TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS bank_transactions (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT,
                date        DATE NOT NULL,
                description TEXT NOT NULL,
                amount      NUMERIC(12,2) NOT NULL,
                created_at  TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS reconciliations (
                id                  SERIAL PRIMARY KEY,
                tenant_id           TEXT,
                document_id         INTEGER NOT NULL REFERENCES documents(id),
                bank_transaction_id INTEGER NOT NULL REFERENCES bank_transactions(id),
                match_confidence    NUMERIC(5,4) NOT NULL,
                created_at          TIMESTAMPTZ DEFAULT now(),
                UNIQUE(document_id, bank_transaction_id)
            );
        """)
        # Add columns if they don't exist yet (migration for existing DBs)
        for col, typ in [
            ("tenant_id", "TEXT"),
            ("filename", "TEXT"),
            ("raw_text", "TEXT"),
            ("status", "VARCHAR(32) DEFAULT 'pendente'"),
        ]:
            conn.execute(f"""
                DO $$ BEGIN
                    ALTER TABLE documents ADD COLUMN {col} {typ};
                EXCEPTION WHEN duplicate_column THEN NULL;
                END $$;
            """)
        for tbl in ("bank_transactions", "reconciliations"):
            conn.execute(f"""
                DO $$ BEGIN
                    ALTER TABLE {tbl} ADD COLUMN tenant_id TEXT;
                EXCEPTION WHEN duplicate_column THEN NULL;
                END $$;
            """)
        conn.commit()


def close_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
