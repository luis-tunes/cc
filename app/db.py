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
                status              VARCHAR(16) NOT NULL DEFAULT 'pendente',
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
            ("notes", "TEXT"),
            ("snc_account", "VARCHAR(16)"),
            ("classification_source", "VARCHAR(16)"),
        ]:
            conn.execute(f"""
                DO $$ BEGIN
                    ALTER TABLE documents ADD COLUMN {col} {typ};
                EXCEPTION WHEN duplicate_column THEN NULL;
                END $$;
            """)
        # Reconciliation status column (migration)
        conn.execute("""
            DO $$ BEGIN
                ALTER TABLE reconciliations ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'pendente';
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
        """)
        # Make date nullable and set defaults (old DBs had NOT NULL without defaults)
        conn.execute("""
            ALTER TABLE documents ALTER COLUMN date DROP NOT NULL;
            ALTER TABLE documents ALTER COLUMN supplier_nif SET DEFAULT '';
            ALTER TABLE documents ALTER COLUMN client_nif SET DEFAULT '';
            ALTER TABLE documents ALTER COLUMN total SET DEFAULT 0;
            ALTER TABLE documents ALTER COLUMN vat SET DEFAULT 0;
            ALTER TABLE documents ALTER COLUMN type SET DEFAULT 'outro';
        """)
        for tbl in ("bank_transactions", "reconciliations"):
            conn.execute(f"""
                DO $$ BEGIN
                    ALTER TABLE {tbl} ADD COLUMN tenant_id TEXT;
                EXCEPTION WHEN duplicate_column THEN NULL;
                END $$;
            """)

        # Key-value settings per tenant (entity profile, preferences, etc.)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tenant_settings (
                tenant_id   TEXT NOT NULL,
                key         TEXT NOT NULL,
                data        JSONB NOT NULL DEFAULT '{}',
                updated_at  TIMESTAMPTZ DEFAULT now(),
                PRIMARY KEY (tenant_id, key)
            );
        """)

        # ── Classification rules ──────────────────────────────────────

        conn.execute("""
            CREATE TABLE IF NOT EXISTS classification_rules (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                name        TEXT NOT NULL DEFAULT '',
                field       VARCHAR(32) NOT NULL,
                operator    VARCHAR(16) NOT NULL,
                value       TEXT NOT NULL,
                account     VARCHAR(16) NOT NULL,
                label       TEXT NOT NULL DEFAULT '',
                priority    INTEGER NOT NULL DEFAULT 0,
                active      BOOLEAN NOT NULL DEFAULT true,
                created_at  TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_classification_rules_tenant
                ON classification_rules(tenant_id);
        """)

        # ── Inventory / Operations ────────────────────────────────────

        conn.execute("""
            CREATE TABLE IF NOT EXISTS unit_families (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                name        TEXT NOT NULL,
                base_unit   TEXT NOT NULL,
                created_at  TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS unit_conversions (
                id              SERIAL PRIMARY KEY,
                unit_family_id  INTEGER NOT NULL REFERENCES unit_families(id) ON DELETE CASCADE,
                from_unit       TEXT NOT NULL,
                to_unit         TEXT NOT NULL,
                factor          NUMERIC(12,6) NOT NULL,
                UNIQUE(unit_family_id, from_unit, to_unit)
            );

            CREATE TABLE IF NOT EXISTS suppliers (
                id                SERIAL PRIMARY KEY,
                tenant_id         TEXT NOT NULL,
                name              TEXT NOT NULL,
                nif               VARCHAR(9) NOT NULL DEFAULT '',
                category          TEXT NOT NULL DEFAULT '',
                avg_delivery_days INTEGER NOT NULL DEFAULT 3,
                reliability       NUMERIC(5,2) NOT NULL DEFAULT 80.0,
                created_at        TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS ingredients (
                id              SERIAL PRIMARY KEY,
                tenant_id       TEXT NOT NULL,
                name            TEXT NOT NULL,
                category        TEXT NOT NULL DEFAULT '',
                unit            TEXT NOT NULL DEFAULT 'kg',
                min_threshold   NUMERIC(12,4) NOT NULL DEFAULT 0,
                supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
                last_cost       NUMERIC(12,4) NOT NULL DEFAULT 0,
                avg_cost        NUMERIC(12,4) NOT NULL DEFAULT 0,
                created_at      TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS stock_events (
                id              SERIAL PRIMARY KEY,
                tenant_id       TEXT NOT NULL,
                type            VARCHAR(16) NOT NULL,
                ingredient_id   INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
                qty             NUMERIC(12,4) NOT NULL,
                unit            TEXT NOT NULL,
                date            DATE NOT NULL DEFAULT CURRENT_DATE,
                source          VARCHAR(16) NOT NULL DEFAULT 'manual',
                reference       TEXT NOT NULL DEFAULT '',
                cost            NUMERIC(12,4),
                created_at      TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS products (
                id              SERIAL PRIMARY KEY,
                tenant_id       TEXT NOT NULL,
                code            TEXT NOT NULL,
                name            TEXT NOT NULL,
                category        TEXT NOT NULL DEFAULT '',
                recipe_version  TEXT NOT NULL DEFAULT 'v1',
                estimated_cost  NUMERIC(12,4) NOT NULL DEFAULT 0,
                pvp             NUMERIC(12,4) NOT NULL DEFAULT 0,
                margin          NUMERIC(5,2) NOT NULL DEFAULT 0,
                active          BOOLEAN NOT NULL DEFAULT true,
                created_at      TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS recipe_ingredients (
                id              SERIAL PRIMARY KEY,
                product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                ingredient_id   INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
                qty             NUMERIC(12,4) NOT NULL,
                unit            TEXT NOT NULL,
                wastage_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
                UNIQUE(product_id, ingredient_id)
            );

            CREATE TABLE IF NOT EXISTS price_history (
                id              SERIAL PRIMARY KEY,
                tenant_id       TEXT NOT NULL,
                ingredient_id   INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
                supplier_id     INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
                price           NUMERIC(12,4) NOT NULL,
                date            DATE NOT NULL DEFAULT CURRENT_DATE,
                created_at      TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS supplier_ingredients (
                supplier_id     INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
                ingredient_id   INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
                PRIMARY KEY (supplier_id, ingredient_id)
            );
        """)

        # ── Indexes for query performance ─────────────────────────────
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_ingredients_tenant ON ingredients(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_stock_events_tenant ON stock_events(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_stock_events_ingredient ON stock_events(ingredient_id);
            CREATE INDEX IF NOT EXISTS idx_stock_events_date ON stock_events(tenant_id, date);
            CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_products_code_tenant ON products(tenant_id, code);
            CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_product ON recipe_ingredients(product_id);
            CREATE INDEX IF NOT EXISTS idx_price_history_ingredient ON price_history(ingredient_id);
            CREATE INDEX IF NOT EXISTS idx_price_history_supplier ON price_history(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_price_history_tenant ON price_history(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(tenant_id, status);
            CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(tenant_id, date);
            CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant ON bank_transactions(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(tenant_id, date);
        """)

        # ── Alerts ────────────────────────────────────────────────────

        conn.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                type        VARCHAR(32) NOT NULL,
                severity    VARCHAR(16) NOT NULL DEFAULT 'info',
                title       TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                action_url  TEXT,
                read        BOOLEAN NOT NULL DEFAULT false,
                created_at  TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(tenant_id, read);
        """)

        # ── Assets ────────────────────────────────────────────────────

        conn.execute("""
            CREATE TABLE IF NOT EXISTS assets (
                id                    SERIAL PRIMARY KEY,
                tenant_id             TEXT NOT NULL,
                name                  TEXT NOT NULL,
                category              VARCHAR(32) NOT NULL DEFAULT 'equipamento',
                acquisition_date      DATE NOT NULL,
                acquisition_cost      NUMERIC(12,2) NOT NULL,
                useful_life_years     INTEGER NOT NULL DEFAULT 5,
                depreciation_method   VARCHAR(32) NOT NULL DEFAULT 'linha-reta',
                current_value         NUMERIC(12,2) NOT NULL DEFAULT 0,
                status                VARCHAR(16) NOT NULL DEFAULT 'ativo',
                supplier              TEXT,
                invoice_ref           TEXT,
                notes                 TEXT,
                created_at            TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_assets_tenant ON assets(tenant_id);
        """)

        # ── Movement Rules ────────────────────────────────────────────

        conn.execute("""
            CREATE TABLE IF NOT EXISTS movement_rules (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                name        TEXT NOT NULL DEFAULT '',
                pattern     TEXT NOT NULL,
                category    TEXT NOT NULL DEFAULT '',
                snc_account VARCHAR(16) NOT NULL DEFAULT '',
                entity_nif  VARCHAR(9),
                priority    INTEGER NOT NULL DEFAULT 0,
                active      BOOLEAN NOT NULL DEFAULT true,
                created_at  TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_movement_rules_tenant ON movement_rules(tenant_id);
        """)

        # ── Unique constraints (safe to run repeatedly) ───────────────
        conn.execute("""
            DO $$ BEGIN
                ALTER TABLE products ADD CONSTRAINT uq_products_tenant_code UNIQUE (tenant_id, code);
            EXCEPTION WHEN duplicate_table THEN NULL;
            END $$;
        """)
        conn.commit()


def close_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
