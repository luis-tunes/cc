"""Data-aware assistant that answers accounting questions in Portuguese.

No LLM required — works by intent matching + live DB queries.
"""

import datetime
import logging
import re
from decimal import Decimal
from typing import Any

from app.db import get_conn

logger = logging.getLogger(__name__)


# ── Intent patterns ────────────────────────────────────────────────────────

_INTENTS = [
    # Inventory — checked first so "como está o inventário" doesn't fall to dashboard
    ("inventory",      r"invent[aá]rio|\bstock\b|existências|rup?tura|ingredientes?"),
    # Dashboard / summary
    ("dashboard",      r"resumo|painel|dashboard|estado geral|como est[aáã]\b"),
    # Documents
    ("docs_count",     r"quantos documentos|n[uú]mero de documentos|total de documentos"),
    ("docs_pending",   r"documentos? pendente|por rever|por aprovar|pendente de revis"),
    ("docs_this_month",r"documentos? (d?este|do) m[eê]s|este m[eê]s.*documentos?"),
    ("docs_total_value",r"valor total|montante total|total faturad"),
    # Bank
    ("bank_count",     r"movimentos? bancári|quantos movimentos|transa[cç][oõ]es"),
    ("bank_balance",   r"saldo banc[aá]ri|total movimentos|total de entradas|total de sa[íi]das"),
    # Reconciliation
    ("recon_status",   r"reconcilia[cç][aãõ]|reconciliad|por reconciliar|match"),
    # Alerts
    ("alerts",         r"alertas?|avisos?|problemas?|compliance"),
    # Assets
    ("assets",         r"ativos?|imobilizad|bens|deprecia[cç]"),
    # IVA / Tax
    ("tax_iva",        r"\biva\b|imposto sobre valor|taxa de iva|declara[cç][aã]o de iva"),
    # Suppliers
    ("suppliers",      r"fornecedor|fornecedores|parceiros"),
    # Help / greetings
    ("help",           r"ajuda|o que (podes|sabes|consegues)|o que posso|como funcion"),
    ("greeting",       r"^(ol[aá]|bom dia|boa tarde|boa noite|hey|hi\b|oi\b)"),
]

_COMPILED = [(intent, re.compile(pat, re.IGNORECASE)) for intent, pat in _INTENTS]


def _detect_intent(question: str) -> str:
    for intent, pattern in _COMPILED:
        if pattern.search(question):
            return intent
    return "unknown"


# ── Query handlers ─────────────────────────────────────────────────────────

def _fmt_eur(value) -> str:
    try:
        return f"€{Decimal(str(value)):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return str(value)


def _handle_dashboard(conn, tid: str | None) -> str:
    tf = " WHERE tenant_id = %s" if tid else ""
    tp = [tid] if tid else []
    docs = conn.execute(f"SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM documents{tf}", tp).fetchone()
    txs = conn.execute(f"SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM bank_transactions{tf}", tp).fetchone()
    recs = conn.execute(f"SELECT COUNT(*) as count FROM reconciliations{tf}", tp).fetchone()
    pending = conn.execute(
        f"SELECT COUNT(*) as count FROM documents WHERE status = 'pendente'{' AND tenant_id = %s' if tp else ''}",
        tp,
    ).fetchone()
    return (
        f"Aqui está o resumo da sua conta:\n\n"
        f"📄 **Documentos**: {docs['count']} ({_fmt_eur(docs['total'])} em faturação)\n"
        f"🏦 **Movimentos bancários**: {txs['count']} ({_fmt_eur(txs['total'])} total)\n"
        f"✅ **Reconciliações**: {recs['count']}\n"
        f"⏳ **Pendentes de revisão**: {pending['count']}"
    )


def _handle_docs_count(conn, tid: str | None) -> str:
    tf = " WHERE tenant_id = %s" if tid else ""
    tp = [tid] if tid else []
    row = conn.execute(f"SELECT COUNT(*) as count FROM documents{tf}", tp).fetchone()
    return f"Tem **{row['count']} documentos** registados no sistema."


def _handle_docs_pending(conn, tid: str | None) -> str:
    tp = [tid] if tid else []
    where = "WHERE status = 'pendente'" + (" AND tenant_id = %s" if tid else "")
    row = conn.execute(f"SELECT COUNT(*) as count FROM documents {where}", tp).fetchone()
    if row["count"] == 0:
        return "Não tem documentos pendentes de revisão. Tudo em dia! ✅"
    return (
        f"Tem **{row['count']} documentos pendentes** de revisão. "
        "Aceda a **Documentos** para os rever e aprovar."
    )


def _handle_docs_this_month(conn, tid: str | None) -> str:
    today = datetime.date.today()
    first = today.replace(day=1)
    tp: list = [str(first), str(today)]
    where = "WHERE date >= %s AND date <= %s"
    if tid:
        where += " AND tenant_id = %s"
        tp.append(tid)
    row = conn.execute(f"SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM documents {where}", tp).fetchone()
    return (
        f"Este mês ({today.strftime('%B %Y')}): "
        f"**{row['count']} documentos** com um total de **{_fmt_eur(row['total'])}**."
    )


def _handle_docs_total_value(conn, tid: str | None) -> str:
    tf = " WHERE tenant_id = %s" if tid else ""
    tp = [tid] if tid else []
    row = conn.execute(f"SELECT COALESCE(SUM(total),0) as total, COALESCE(SUM(vat),0) as vat FROM documents{tf}", tp).fetchone()
    return (
        f"Valor total de documentos: **{_fmt_eur(row['total'])}** "
        f"(IVA incluído: {_fmt_eur(row['vat'])})."
    )


def _handle_bank_count(conn, tid: str | None) -> str:
    tf = " WHERE tenant_id = %s" if tid else ""
    tp = [tid] if tid else []
    row = conn.execute(f"SELECT COUNT(*) as count FROM bank_transactions{tf}", tp).fetchone()
    return f"Tem **{row['count']} movimentos bancários** registados."


def _handle_bank_balance(conn, tid: str | None) -> str:
    tf = " WHERE tenant_id = %s" if tid else ""
    tp = [tid] if tid else []
    row = conn.execute(f"SELECT COALESCE(SUM(amount),0) as total FROM bank_transactions{tf}", tp).fetchone()
    entradas = conn.execute(
        f"SELECT COALESCE(SUM(amount),0) as total FROM bank_transactions WHERE amount > 0{' AND tenant_id = %s' if tid else ''}",
        tp,
    ).fetchone()
    saidas = conn.execute(
        f"SELECT COALESCE(SUM(amount),0) as total FROM bank_transactions WHERE amount < 0{' AND tenant_id = %s' if tid else ''}",
        tp,
    ).fetchone()
    return (
        f"Saldo líquido dos movimentos bancários: **{_fmt_eur(row['total'])}**\n"
        f"↑ Entradas: {_fmt_eur(entradas['total'])} | ↓ Saídas: {_fmt_eur(saidas['total'])}"
    )


def _handle_recon_status(conn, tid: str | None) -> str:
    tf = " WHERE tenant_id = %s" if tid else ""
    tp = [tid] if tid else []
    recs = conn.execute(f"SELECT COUNT(*) as count FROM reconciliations{tf}", tp).fetchone()
    docs = conn.execute(f"SELECT COUNT(*) as count FROM documents{tf}", tp).fetchone()
    unmatched_tp = tp.copy()
    unmatched = conn.execute(
        f"SELECT COUNT(*) as count FROM documents WHERE id NOT IN (SELECT document_id FROM reconciliations){' AND tenant_id = %s' if tid else ''}",
        unmatched_tp,
    ).fetchone()
    pct = round(recs["count"] / docs["count"] * 100) if docs["count"] > 0 else 0
    return (
        f"**{recs['count']} reconciliações** confirmadas ({pct}% dos documentos).\n"
        f"📋 {unmatched['count']} documentos ainda por reconciliar."
    )


def _handle_alerts(conn, tid: str | None) -> str:
    tf = " WHERE tenant_id = %s AND read = false" if tid else " WHERE read = false"
    tp = [tid] if tid else []
    row = conn.execute(f"SELECT COUNT(*) as count FROM alerts{tf}", tp).fetchone()
    if row["count"] == 0:
        return "Sem alertas ativos. Está tudo em conformidade. ✅"
    rows = conn.execute(
        f"SELECT severity, title FROM alerts WHERE read = false{ ' AND tenant_id = %s' if tid else ''} ORDER BY created_at DESC LIMIT 5",
        tp,
    ).fetchall()
    lines = [f"Tem **{row['count']} alertas activos**:\n"]
    emoji = {"urgente": "🔴", "atencao": "🟡", "info": "🔵"}
    for a in rows:
        lines.append(f"{emoji.get(a['severity'], '⚪')} {a['title']}")
    lines.append("\nAceda a **Alertas** para ver detalhes.")
    return "\n".join(lines)


def _handle_assets(conn, tid: str | None) -> str:
    tf = " WHERE tenant_id = %s AND status = 'ativo'" if tid else " WHERE status = 'ativo'"
    tp = [tid] if tid else []
    row = conn.execute(
        f"SELECT COUNT(*) as count, COALESCE(SUM(acquisition_cost),0) as cost FROM assets{tf}",
        tp,
    ).fetchone()
    return (
        f"**{row['count']} ativos** registados, valor de aquisição total: {_fmt_eur(row['cost'])}.\n"
        "Aceda a **Ativos** para ver depreciações e valores atuais."
    )


def _handle_tax_iva(conn, tid: str | None) -> str:
    today = datetime.date.today()
    quarter = (today.month - 1) // 3 + 1
    q_start = datetime.date(today.year, (quarter - 1) * 3 + 1, 1)
    tp: list = [str(q_start), str(today)]
    where = "WHERE date >= %s AND date <= %s AND type = 'fatura'"
    if tid:
        where += " AND tenant_id = %s"
        tp.append(tid)
    row = conn.execute(
        f"SELECT COALESCE(SUM(vat),0) as vat, COALESCE(SUM(total),0) as total FROM documents {where}",
        tp,
    ).fetchone()
    return (
        f"IVA do {quarter}º trimestre de {today.year}:\n"
        f"💰 IVA liquidado: **{_fmt_eur(row['vat'])}** sobre {_fmt_eur(row['total'])} faturados.\n"
        "Aceda a **Centro Fiscal** para ver o detalhe das declarações."
    )


def _handle_inventory(conn, tid: str | None) -> str:
    tf = " WHERE tenant_id = %s" if tid else ""
    tp = [tid] if tid else []
    total = conn.execute(f"SELECT COUNT(*) as count FROM ingredients{tf}", tp).fetchone()
    return (
        f"Tem **{total['count']} ingredientes** no inventário. "
        "Aceda a **Inventário** para ver stocks, ruturas e lista de compras."
    )


def _handle_suppliers(conn, tid: str | None) -> str:
    tf = " WHERE tenant_id = %s" if tid else ""
    tp = [tid] if tid else []
    row = conn.execute(f"SELECT COUNT(*) as count FROM suppliers{tf}", tp).fetchone()
    return f"Tem **{row['count']} fornecedores** registados. Aceda a **Fornecedores** para gerir."


def _handle_help() -> str:
    return (
        "Posso ajudá-lo a consultar informações da sua conta. Experimente perguntar:\n\n"
        "- *\"Qual é o resumo da minha conta?\"*\n"
        "- *\"Quantos documentos tenho este mês?\"*\n"
        "- *\"Qual é o estado das reconciliações?\"*\n"
        "- *\"Tenho alertas ativos?\"*\n"
        "- *\"Qual é o IVA deste trimestre?\"*\n"
        "- *\"Qual é o saldo bancário?\"*\n"
        "- *\"Quantos ativos tenho?\"*"
    )


def _handle_greeting() -> str:
    hour = datetime.datetime.now().hour
    greeting = "Bom dia" if hour < 12 else "Boa tarde" if hour < 19 else "Boa noite"
    return (
        f"{greeting}! Sou o assistente TIM. Posso consultar os seus dados contabilísticos em tempo real. "
        "Como posso ajudá-lo hoje?"
    )


def _handle_unknown() -> str:
    return (
        "Desculpe, não percebi bem a sua pergunta. Posso responder sobre documentos, "
        "movimentos bancários, reconciliações, IVA, alertas, ativos e inventário. "
        "Escreva *\"ajuda\"* para ver exemplos."
    )


# ── Public API ──────────────────────────────────────────────────────────────

_STATIC_HANDLERS = {
    "help": lambda _c, _t: _handle_help(),
    "greeting": lambda _c, _t: _handle_greeting(),
    "unknown": lambda _c, _t: _handle_unknown(),
}

_DB_HANDLERS: dict[str, Any] = {
    "dashboard":       _handle_dashboard,
    "docs_count":      _handle_docs_count,
    "docs_pending":    _handle_docs_pending,
    "docs_this_month": _handle_docs_this_month,
    "docs_total_value":_handle_docs_total_value,
    "bank_count":      _handle_bank_count,
    "bank_balance":    _handle_bank_balance,
    "recon_status":    _handle_recon_status,
    "alerts":          _handle_alerts,
    "assets":          _handle_assets,
    "tax_iva":         _handle_tax_iva,
    "inventory":       _handle_inventory,
    "suppliers":       _handle_suppliers,
}


def answer_question(question: str, tenant_id: str | None) -> dict:
    """Main entry point. Returns {intent, answer}."""
    intent = _detect_intent(question)

    if intent in _STATIC_HANDLERS:
        return {"intent": intent, "answer": _STATIC_HANDLERS[intent](None, None)}

    handler = _DB_HANDLERS.get(intent)
    if handler is None:
        return {"intent": "unknown", "answer": _handle_unknown()}

    try:
        with get_conn() as conn:
            answer = handler(conn, tenant_id)
        return {"intent": intent, "answer": answer}
    except Exception as exc:
        logger.exception("Assistant query failed for intent=%s: %s", intent, exc)
        return {
            "intent": intent,
            "answer": "Ocorreu um erro ao consultar os dados. Tente novamente mais tarde.",
        }
