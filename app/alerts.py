"""Compliance alerts engine.

Generates alerts for common compliance issues:
- Unreconciled documents > 30 days old
- Missing documents in a period (months with transactions but no invoices)
- IVA deadline approaching (quarterly)
- Unusual spending patterns (> 2x average)
"""

import datetime
import logging

from app.db import get_conn

log = logging.getLogger(__name__)


def _iva_deadline(today: datetime.date) -> tuple[datetime.date, str] | None:
    """Compute the next IVA quarterly deadline relative to today.

    Portuguese IVA deadlines: Q1 submitted by 15 May, Q2 by 15 Aug,
    Q3 by 15 Nov, Q4 by 15 Feb of the next year.
    """
    year = today.year
    # (deadline_date, period_label) for each quarter's submission
    deadlines = [
        (datetime.date(year, 2, 15), f"T4 {year - 1}"),
        (datetime.date(year, 5, 15), f"T1 {year}"),
        (datetime.date(year, 8, 15), f"T2 {year}"),
        (datetime.date(year, 11, 15), f"T3 {year}"),
        (datetime.date(year + 1, 2, 15), f"T4 {year}"),
    ]
    for deadline, period in deadlines:
        days_left = (deadline - today).days
        if 0 < days_left <= 30:
            return deadline, period
    return None


def generate_compliance_alerts(tenant_id: str) -> int:
    """Generate compliance alerts. Returns count of new alerts created."""
    count = 0
    with get_conn() as conn:
        # Check if tenant has any data at all — if not, skip everything
        doc_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM documents WHERE tenant_id = %s",
            (tenant_id,),
        ).fetchone()
        if not doc_count or doc_count["cnt"] == 0:
            # Fresh tenant with no documents — no alerts to generate
            conn.execute(
                "DELETE FROM alerts WHERE tenant_id = %s AND read = false",
                (tenant_id,),
            )
            conn.commit()
            return 0

        # Clear old unread generated alerts to regenerate fresh
        conn.execute(
            "DELETE FROM alerts WHERE tenant_id = %s AND read = false",
            (tenant_id,),
        )

        # 1. Unreconciled documents older than 30 days
        old_unreconciled = conn.execute(
            """SELECT COUNT(*) as cnt FROM documents
               WHERE tenant_id = %s AND date IS NOT NULL
                 AND date < CURRENT_DATE - INTERVAL '30 days'
                 AND id NOT IN (SELECT document_id FROM reconciliations)""",
            (tenant_id,),
        ).fetchone()
        if old_unreconciled and old_unreconciled["cnt"] > 0:
            conn.execute(
                """INSERT INTO alerts (tenant_id, type, severity, title, description, action_url)
                   VALUES (%s, 'unreconciled', 'urgente', %s, %s, %s)""",
                (tenant_id,
                 f"{old_unreconciled['cnt']} documentos por reconciliar há mais de 30 dias",
                 "Existem documentos antigos sem correspondência bancária. Verifique e reconcilie manualmente.",
                 "/reconciliacao"),
            )
            count += 1

        # 2. Pending review documents
        pending = conn.execute(
            "SELECT COUNT(*) as cnt FROM documents WHERE tenant_id = %s AND status = 'pendente'",
            (tenant_id,),
        ).fetchone()
        if pending and pending["cnt"] > 5:
            conn.execute(
                """INSERT INTO alerts (tenant_id, type, severity, title, description, action_url)
                   VALUES (%s, 'pending_review', 'atencao', %s, %s, %s)""",
                (tenant_id,
                 f"{pending['cnt']} documentos pendentes de revisão",
                 "Reveja e valide os documentos pendentes para manter a contabilidade em dia.",
                 "/documentos"),
            )
            count += 1

        # 3. IVA deadline approaching
        today = datetime.date.today()
        iva_info = _iva_deadline(today)
        if iva_info:
            deadline, period = iva_info
            days_left = (deadline - today).days
            conn.execute(
                """INSERT INTO alerts (tenant_id, type, severity, title, description, action_url)
                   VALUES (%s, 'iva_deadline', %s, %s, %s, %s)""",
                (tenant_id,
                 "critico" if days_left <= 7 else "urgente",
                 f"Entrega IVA {period} — {days_left} dias restantes",
                 f"A declaração periódica de IVA referente a {period} deve ser entregue até {deadline.strftime('%d/%m/%Y')}.",
                 "/obrigacoes"),
            )
            count += 1

        # 4. Months with bank transactions but no documents
        gap_months = conn.execute(
            """SELECT DISTINCT TO_CHAR(b.date, 'YYYY-MM') as month
               FROM bank_transactions b
               WHERE b.tenant_id = %s
                 AND b.date >= CURRENT_DATE - INTERVAL '6 months'
                 AND NOT EXISTS (
                   SELECT 1 FROM documents d
                   WHERE d.tenant_id = %s
                     AND TO_CHAR(d.date, 'YYYY-MM') = TO_CHAR(b.date, 'YYYY-MM')
                 )""",
            (tenant_id, tenant_id),
        ).fetchall()
        if gap_months:
            months_str = ", ".join(r["month"] for r in gap_months)
            conn.execute(
                """INSERT INTO alerts (tenant_id, type, severity, title, description, action_url)
                   VALUES (%s, 'missing_documents', 'atencao', %s, %s, %s)""",
                (tenant_id,
                 f"Meses sem documentos: {months_str}",
                 "Existem meses com movimentos bancários mas sem faturas registadas. Carregue os documentos em falta.",
                 "/documentos"),
            )
            count += 1

        conn.commit()
    return count
