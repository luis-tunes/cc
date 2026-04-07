import logging
import os
import time
from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

__fingerprint__ = "TIM-LT-3b8e5a1d-c947-4f2b-8d6a-e9f1c3a7b524"

logger = logging.getLogger(__name__)

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


_DB_RETRY_ATTEMPTS = 5
_DB_RETRY_DELAY = 2  # seconds


def init_db():
    """Initialize database schema with retries for cold boot resilience."""
    for attempt in range(1, _DB_RETRY_ATTEMPTS + 1):
        try:
            _init_db_schema()
            return
        except Exception as e:
            if attempt == _DB_RETRY_ATTEMPTS:
                logger.error("DB init failed after %d attempts: %s", _DB_RETRY_ATTEMPTS, e)
                raise
            logger.warning("DB init attempt %d/%d failed: %s — retrying in %ds", attempt, _DB_RETRY_ATTEMPTS, e, _DB_RETRY_DELAY)
            time.sleep(_DB_RETRY_DELAY)


def _init_db_schema():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id            SERIAL PRIMARY KEY,
                tenant_id     TEXT NOT NULL,
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
                id                    SERIAL PRIMARY KEY,
                tenant_id             TEXT NOT NULL,
                date                  DATE NOT NULL,
                description           TEXT NOT NULL,
                amount                NUMERIC(12,2) NOT NULL,
                category              TEXT,
                snc_account           VARCHAR(16),
                entity_nif            VARCHAR(9),
                classification_source VARCHAR(16),
                created_at            TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS reconciliations (
                id                  SERIAL PRIMARY KEY,
                tenant_id           TEXT NOT NULL,
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
        # Bank transactions classification columns (migration)
        for col, typ in [
            ("category", "TEXT"),
            ("snc_account", "VARCHAR(16)"),
            ("entity_nif", "VARCHAR(9)"),
            ("classification_source", "VARCHAR(16)"),
        ]:
            conn.execute(f"""
                DO $$ BEGIN
                    ALTER TABLE bank_transactions ADD COLUMN {col} {typ};
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

        # Extraction data JSONB column (rich structured extraction output)
        for col, typ in [
            ("extraction_data", "JSONB"),
        ]:
            conn.execute(f"""
                DO $$ BEGIN
                    ALTER TABLE documents ADD COLUMN {col} {typ};
                EXCEPTION WHEN duplicate_column THEN NULL;
                END $$;
            """)

        # Soft-delete column for documents (undo support)
        conn.execute("""
            DO $$ BEGIN
                ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
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

        # Counterparty registry — NIF → name/IBAN/address cache built from extractions
        conn.execute("""
            CREATE TABLE IF NOT EXISTS counterparties (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                nif         VARCHAR(9) NOT NULL,
                name        TEXT NOT NULL DEFAULT '',
                iban        TEXT,
                address     TEXT,
                doc_count   INTEGER NOT NULL DEFAULT 1,
                last_seen   TIMESTAMPTZ DEFAULT now(),
                created_at  TIMESTAMPTZ DEFAULT now(),
                UNIQUE(tenant_id, nif)
            );
            CREATE INDEX IF NOT EXISTS idx_counterparties_tenant_nif
                ON counterparties(tenant_id, nif);
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

        # ── Audit Log ─────────────────────────────────────────────────

        conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                entity_type VARCHAR(32) NOT NULL,
                entity_id   INTEGER,
                action      VARCHAR(32) NOT NULL,
                detail      TEXT NOT NULL DEFAULT '',
                created_at  TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(tenant_id, created_at DESC);
        """)

        # ── Accounting: Chart of Accounts ─────────────────────────────

        conn.execute("""
            CREATE TABLE IF NOT EXISTS accounts (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                code        VARCHAR(16) NOT NULL,
                name        TEXT NOT NULL,
                type        VARCHAR(16) NOT NULL,
                parent_code VARCHAR(16),
                active      BOOLEAN NOT NULL DEFAULT true,
                created_at  TIMESTAMPTZ DEFAULT now(),
                UNIQUE(tenant_id, code)
            );
            CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON accounts(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(tenant_id, type);
        """)

        # ── Accounting: Fiscal Periods ────────────────────────────────

        conn.execute("""
            CREATE TABLE IF NOT EXISTS fiscal_periods (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                name        TEXT NOT NULL,
                start_date  DATE NOT NULL,
                end_date    DATE NOT NULL,
                status      VARCHAR(16) NOT NULL DEFAULT 'open',
                lock_date   DATE,
                created_at  TIMESTAMPTZ DEFAULT now(),
                UNIQUE(tenant_id, name)
            );
            CREATE INDEX IF NOT EXISTS idx_fiscal_periods_tenant ON fiscal_periods(tenant_id);
        """)

        # ── Accounting: Journals ──────────────────────────────────────

        conn.execute("""
            CREATE TABLE IF NOT EXISTS accounting_journals (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                code        VARCHAR(8) NOT NULL,
                name        TEXT NOT NULL,
                type        VARCHAR(16) NOT NULL,
                active      BOOLEAN NOT NULL DEFAULT true,
                created_at  TIMESTAMPTZ DEFAULT now(),
                UNIQUE(tenant_id, code)
            );
            CREATE INDEX IF NOT EXISTS idx_accounting_journals_tenant
                ON accounting_journals(tenant_id);
        """)

        # ── Accounting: Journal Entries ───────────────────────────────

        conn.execute("""
            CREATE TABLE IF NOT EXISTS journal_entries (
                id              SERIAL PRIMARY KEY,
                tenant_id       TEXT NOT NULL,
                journal_id      INTEGER NOT NULL REFERENCES accounting_journals(id),
                period_id       INTEGER REFERENCES fiscal_periods(id),
                entry_date      DATE NOT NULL,
                reference       TEXT NOT NULL DEFAULT '',
                description     TEXT NOT NULL DEFAULT '',
                source_type     VARCHAR(32),
                source_id       INTEGER,
                status          VARCHAR(16) NOT NULL DEFAULT 'draft',
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant
                ON journal_entries(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_journal_entries_date
                ON journal_entries(tenant_id, entry_date);
            CREATE INDEX IF NOT EXISTS idx_journal_entries_source
                ON journal_entries(tenant_id, source_type, source_id);
        """)

        # ── Accounting: Journal Entry Lines ───────────────────────────

        conn.execute("""
            CREATE TABLE IF NOT EXISTS journal_entry_lines (
                id          SERIAL PRIMARY KEY,
                entry_id    INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
                account_id  INTEGER NOT NULL REFERENCES accounts(id),
                debit       NUMERIC(15,2) NOT NULL DEFAULT 0,
                credit      NUMERIC(15,2) NOT NULL DEFAULT 0,
                description TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry
                ON journal_entry_lines(entry_id);
            CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account
                ON journal_entry_lines(account_id);

            CREATE TABLE IF NOT EXISTS customers (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                name        TEXT NOT NULL,
                nif         VARCHAR(20) NOT NULL DEFAULT '',
                email       TEXT NOT NULL DEFAULT '',
                phone       TEXT NOT NULL DEFAULT '',
                address     TEXT NOT NULL DEFAULT '',
                postal_code TEXT NOT NULL DEFAULT '',
                city        TEXT NOT NULL DEFAULT '',
                country     VARCHAR(2) NOT NULL DEFAULT 'PT',
                notes       TEXT NOT NULL DEFAULT '',
                active      BOOLEAN NOT NULL DEFAULT TRUE,
                created_at  TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_customers_tenant
                ON customers(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_customers_nif
                ON customers(tenant_id, nif);
        """)

        # ── Invoice series & invoices ─────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS invoice_series (
                id                      SERIAL PRIMARY KEY,
                tenant_id               TEXT NOT NULL,
                series_code             VARCHAR(20) NOT NULL,
                document_type           VARCHAR(30) NOT NULL DEFAULT 'FT',
                current_number          INTEGER NOT NULL DEFAULT 0,
                atcud_validation_code   VARCHAR(50) NOT NULL DEFAULT '',
                active                  BOOLEAN NOT NULL DEFAULT TRUE,
                created_at              TIMESTAMPTZ DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_series_code
                ON invoice_series(tenant_id, series_code);
            CREATE INDEX IF NOT EXISTS idx_invoice_series_tenant
                ON invoice_series(tenant_id);
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS invoices (
                id              SERIAL PRIMARY KEY,
                tenant_id       TEXT NOT NULL,
                series_id       INTEGER NOT NULL REFERENCES invoice_series(id),
                number          INTEGER NOT NULL,
                document_type   VARCHAR(30) NOT NULL DEFAULT 'FT',
                atcud           VARCHAR(80) NOT NULL DEFAULT '',
                customer_id     INTEGER REFERENCES customers(id),
                customer_name   TEXT NOT NULL DEFAULT '',
                customer_nif    VARCHAR(20) NOT NULL DEFAULT '',
                issue_date      DATE NOT NULL,
                due_date        DATE,
                subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
                vat_total       NUMERIC(15,2) NOT NULL DEFAULT 0,
                total           NUMERIC(15,2) NOT NULL DEFAULT 0,
                withholding_tax NUMERIC(15,2) NOT NULL DEFAULT 0,
                net_total       NUMERIC(15,2) NOT NULL DEFAULT 0,
                currency        VARCHAR(3) NOT NULL DEFAULT 'EUR',
                notes           TEXT NOT NULL DEFAULT '',
                status          VARCHAR(20) NOT NULL DEFAULT 'rascunho',
                finalized_at    TIMESTAMPTZ,
                voided_at       TIMESTAMPTZ,
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_series_number
                ON invoices(tenant_id, series_id, number);
            CREATE INDEX IF NOT EXISTS idx_invoices_tenant
                ON invoices(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_customer
                ON invoices(tenant_id, customer_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_date
                ON invoices(tenant_id, issue_date);
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS invoice_lines (
                id              SERIAL PRIMARY KEY,
                invoice_id      INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                tenant_id       TEXT NOT NULL,
                line_number     INTEGER NOT NULL DEFAULT 1,
                description     TEXT NOT NULL DEFAULT '',
                quantity        NUMERIC(12,4) NOT NULL DEFAULT 1,
                unit_price      NUMERIC(15,4) NOT NULL DEFAULT 0,
                discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
                vat_rate        NUMERIC(5,2) NOT NULL DEFAULT 23,
                subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
                vat_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
                total           NUMERIC(15,2) NOT NULL DEFAULT 0,
                snc_account     VARCHAR(20) NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice
                ON invoice_lines(invoice_id);
        """)

        # ── Unique constraints (safe to run repeatedly) ───────────────
        conn.execute("""
            DO $$ BEGIN
                ALTER TABLE products ADD CONSTRAINT uq_products_tenant_code UNIQUE (tenant_id, code);
            EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
            END $$;
        """)

        # ── CHECK constraints (data integrity) ────────────────────────
        for _constraint, sql in [
            ("chk_documents_total_positive", "ALTER TABLE documents ADD CONSTRAINT chk_documents_total_positive CHECK (total >= 0)"),
            ("chk_documents_vat_positive", "ALTER TABLE documents ADD CONSTRAINT chk_documents_vat_positive CHECK (vat >= 0)"),
            ("chk_reconciliations_confidence", "ALTER TABLE reconciliations ADD CONSTRAINT chk_reconciliations_confidence CHECK (match_confidence BETWEEN 0 AND 1)"),
            ("chk_assets_useful_life", "ALTER TABLE assets ADD CONSTRAINT chk_assets_useful_life CHECK (useful_life_years > 0)"),
            ("uq_unit_families_tenant_name", "ALTER TABLE unit_families ADD CONSTRAINT uq_unit_families_tenant_name UNIQUE (tenant_id, name)"),
            ("chk_stock_events_type", "ALTER TABLE stock_events ADD CONSTRAINT chk_stock_events_type CHECK (type IN ('entrada', 'saída', 'desperdício', 'ajuste'))"),
            ("chk_stock_events_qty", "ALTER TABLE stock_events ADD CONSTRAINT chk_stock_events_qty CHECK (qty > 0)"),
            ("chk_price_history_price", "ALTER TABLE price_history ADD CONSTRAINT chk_price_history_price CHECK (price >= 0)"),
            ("chk_ingredients_min_threshold", "ALTER TABLE ingredients ADD CONSTRAINT chk_ingredients_min_threshold CHECK (min_threshold >= 0)"),
        ]:
            conn.execute(f"""
                DO $$ BEGIN
                    {sql};
                EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
                END $$;
            """)

        # ── Additional indexes for query performance ──────────────────
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_documents_supplier_nif ON documents(tenant_id, supplier_nif);
            CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(tenant_id, type);
        """)

        # ── CHECK constraints (idempotent — skip if already exists) ──
        for _constraint, ddl in [
            ("chk_documents_total_gte_0", "ALTER TABLE documents ADD CONSTRAINT chk_documents_total_gte_0 CHECK (total >= 0)"),
            ("chk_documents_vat_gte_0", "ALTER TABLE documents ADD CONSTRAINT chk_documents_vat_gte_0 CHECK (vat >= 0)"),
            ("chk_reconciliations_confidence", "ALTER TABLE reconciliations ADD CONSTRAINT chk_reconciliations_confidence CHECK (match_confidence BETWEEN 0 AND 1)"),
            ("chk_assets_useful_life", "ALTER TABLE assets ADD CONSTRAINT chk_assets_useful_life CHECK (useful_life_years > 0)"),
        ]:
            conn.execute(f"""
                DO $$ BEGIN
                    {ddl};
                EXCEPTION WHEN duplicate_object THEN NULL;
                END $$;
            """)

        conn.commit()


def close_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def log_activity(
    conn,
    tenant_id: str,
    entity_type: str,
    entity_id: int | None,
    action: str,
    detail: str = "",
) -> None:
    """Insert an audit log entry (call inside an open connection context)."""
    conn.execute(
        "INSERT INTO audit_log (tenant_id, entity_type, entity_id, action, detail) VALUES (%s, %s, %s, %s, %s)",
        (tenant_id, entity_type, entity_id, action, detail),
    )
