"""Double-entry accounting engine — SNC (PT) Chart of Accounts."""

import datetime
import logging
from decimal import Decimal
from typing import Any

logger = logging.getLogger(__name__)

# ── SNC PT Chart of Accounts (Plano de Contas Normalizado) ────────────

SNC_ACCOUNTS: list[dict[str, str]] = [
    # Classe 1 — Meios financeiros líquidos
    {"code": "11", "name": "Caixa", "type": "asset", "parent_code": ""},
    {"code": "111", "name": "Caixa A", "type": "asset", "parent_code": "11"},
    {"code": "12", "name": "Depósitos à ordem", "type": "asset", "parent_code": ""},
    {"code": "121", "name": "Banco — Conta 1", "type": "asset", "parent_code": "12"},
    {"code": "13", "name": "Outros depósitos bancários", "type": "asset", "parent_code": ""},
    {"code": "14", "name": "Outros instrumentos financeiros", "type": "asset", "parent_code": ""},
    # Classe 2 — Contas a receber e a pagar
    {"code": "21", "name": "Clientes", "type": "asset", "parent_code": ""},
    {"code": "211", "name": "Clientes — Conta corrente", "type": "asset", "parent_code": "21"},
    {"code": "212", "name": "Clientes — Títulos a receber", "type": "asset", "parent_code": "21"},
    {"code": "218", "name": "Clientes — Adiantamentos", "type": "asset", "parent_code": "21"},
    {"code": "219", "name": "Clientes — Perdas por imparidade", "type": "asset", "parent_code": "21"},
    {"code": "22", "name": "Fornecedores", "type": "liability", "parent_code": ""},
    {"code": "221", "name": "Fornecedores — Conta corrente", "type": "liability", "parent_code": "22"},
    {"code": "222", "name": "Fornecedores — Títulos a pagar", "type": "liability", "parent_code": "22"},
    {"code": "228", "name": "Fornecedores — Adiantamentos", "type": "liability", "parent_code": "22"},
    {"code": "229", "name": "Fornecedores — Perdas por imparidade", "type": "liability", "parent_code": "22"},
    {"code": "23", "name": "Pessoal", "type": "liability", "parent_code": ""},
    {"code": "231", "name": "Remunerações a pagar", "type": "liability", "parent_code": "23"},
    {"code": "232", "name": "Adiantamentos ao pessoal", "type": "asset", "parent_code": "23"},
    {"code": "24", "name": "Estado e outros entes públicos", "type": "liability", "parent_code": ""},
    {"code": "2411", "name": "IVA — Suportado", "type": "asset", "parent_code": "24"},
    {"code": "2412", "name": "IVA — Dedutível", "type": "asset", "parent_code": "24"},
    {"code": "2413", "name": "IVA — Liquidado", "type": "liability", "parent_code": "24"},
    {"code": "2414", "name": "IVA — Regularizações", "type": "liability", "parent_code": "24"},
    {"code": "2415", "name": "IVA — Apuramento", "type": "liability", "parent_code": "24"},
    {"code": "2416", "name": "IVA — A pagar", "type": "liability", "parent_code": "24"},
    {"code": "2417", "name": "IVA — A recuperar", "type": "asset", "parent_code": "24"},
    {"code": "242", "name": "Retenção de impostos sobre rendimentos", "type": "liability", "parent_code": "24"},
    {"code": "243", "name": "IRC — Imposto estimado", "type": "liability", "parent_code": "24"},
    {"code": "245", "name": "Contribuições para a Segurança Social", "type": "liability", "parent_code": "24"},
    {"code": "25", "name": "Financiamentos obtidos", "type": "liability", "parent_code": ""},
    {"code": "251", "name": "Instituições de crédito — Empréstimos", "type": "liability", "parent_code": "25"},
    {"code": "26", "name": "Acionistas / Sócios", "type": "equity", "parent_code": ""},
    {"code": "261", "name": "Acionistas — Capital subscrito", "type": "equity", "parent_code": "26"},
    {"code": "27", "name": "Outras contas a receber e a pagar", "type": "asset", "parent_code": ""},
    {"code": "271", "name": "Devedores por acréscimos de rendimentos", "type": "asset", "parent_code": "27"},
    {"code": "272", "name": "Credores por acréscimos de gastos", "type": "liability", "parent_code": "27"},
    {"code": "273", "name": "Gastos diferidos", "type": "asset", "parent_code": "27"},
    {"code": "274", "name": "Rendimentos diferidos", "type": "liability", "parent_code": "27"},
    {"code": "278", "name": "Outros devedores e credores", "type": "asset", "parent_code": "27"},
    {"code": "28", "name": "Diferimentos", "type": "asset", "parent_code": ""},
    {"code": "29", "name": "Provisões", "type": "liability", "parent_code": ""},
    # Classe 3 — Inventários e ativos biológicos
    {"code": "31", "name": "Compras", "type": "expense", "parent_code": ""},
    {"code": "311", "name": "Compras — Matérias-primas", "type": "expense", "parent_code": "31"},
    {"code": "312", "name": "Compras — Mercadorias", "type": "expense", "parent_code": "31"},
    {"code": "32", "name": "Mercadorias", "type": "asset", "parent_code": ""},
    {"code": "33", "name": "Matérias-primas", "type": "asset", "parent_code": ""},
    {"code": "34", "name": "Produtos acabados", "type": "asset", "parent_code": ""},
    {"code": "35", "name": "Subprodutos, desperdícios e refugos", "type": "asset", "parent_code": ""},
    {"code": "36", "name": "Ativos biológicos", "type": "asset", "parent_code": ""},
    {"code": "38", "name": "Reclassificação e regularização inventários", "type": "asset", "parent_code": ""},
    {"code": "39", "name": "Adiantamentos por conta de compras", "type": "asset", "parent_code": ""},
    # Classe 4 — Investimentos
    {"code": "41", "name": "Investimentos financeiros", "type": "asset", "parent_code": ""},
    {"code": "42", "name": "Propriedades de investimento", "type": "asset", "parent_code": ""},
    {"code": "43", "name": "Ativos fixos tangíveis", "type": "asset", "parent_code": ""},
    {"code": "431", "name": "Terrenos e recursos naturais", "type": "asset", "parent_code": "43"},
    {"code": "432", "name": "Edifícios e outras construções", "type": "asset", "parent_code": "43"},
    {"code": "433", "name": "Equipamento básico", "type": "asset", "parent_code": "43"},
    {"code": "434", "name": "Equipamento de transporte", "type": "asset", "parent_code": "43"},
    {"code": "435", "name": "Equipamento administrativo", "type": "asset", "parent_code": "43"},
    {"code": "436", "name": "Equipamentos biológicos", "type": "asset", "parent_code": "43"},
    {"code": "437", "name": "Outros ativos fixos tangíveis", "type": "asset", "parent_code": "43"},
    {"code": "438", "name": "Depreciações acumuladas", "type": "asset", "parent_code": "43"},
    {"code": "44", "name": "Ativos intangíveis", "type": "asset", "parent_code": ""},
    {"code": "45", "name": "Investimentos em curso", "type": "asset", "parent_code": ""},
    {"code": "46", "name": "Ativos não correntes detidos para venda", "type": "asset", "parent_code": ""},
    # Classe 5 — Capital, reservas e resultados transitados
    {"code": "51", "name": "Capital", "type": "equity", "parent_code": ""},
    {"code": "52", "name": "Ações / Quotas próprias", "type": "equity", "parent_code": ""},
    {"code": "53", "name": "Outros instrumentos de capital próprio", "type": "equity", "parent_code": ""},
    {"code": "54", "name": "Prémios de emissão", "type": "equity", "parent_code": ""},
    {"code": "55", "name": "Reservas", "type": "equity", "parent_code": ""},
    {"code": "551", "name": "Reservas legais", "type": "equity", "parent_code": "55"},
    {"code": "56", "name": "Resultados transitados", "type": "equity", "parent_code": ""},
    {"code": "57", "name": "Ajustamentos em ativos financeiros", "type": "equity", "parent_code": ""},
    {"code": "58", "name": "Excedentes de revalorização", "type": "equity", "parent_code": ""},
    {"code": "59", "name": "Outras variações no capital próprio", "type": "equity", "parent_code": ""},
    # Classe 6 — Gastos
    {"code": "61", "name": "CMVMC", "type": "expense", "parent_code": ""},
    {"code": "62", "name": "Fornecimentos e serviços externos", "type": "expense", "parent_code": ""},
    {"code": "621", "name": "Subcontratos", "type": "expense", "parent_code": "62"},
    {"code": "622", "name": "Serviços especializados", "type": "expense", "parent_code": "62"},
    {"code": "623", "name": "Materiais", "type": "expense", "parent_code": "62"},
    {"code": "624", "name": "Energia e fluidos", "type": "expense", "parent_code": "62"},
    {"code": "625", "name": "Deslocações, estadas e transportes", "type": "expense", "parent_code": "62"},
    {"code": "626", "name": "Serviços diversos", "type": "expense", "parent_code": "62"},
    {"code": "63", "name": "Gastos com o pessoal", "type": "expense", "parent_code": ""},
    {"code": "631", "name": "Remunerações dos órgãos sociais", "type": "expense", "parent_code": "63"},
    {"code": "632", "name": "Remunerações do pessoal", "type": "expense", "parent_code": "63"},
    {"code": "633", "name": "Benefícios pós-emprego", "type": "expense", "parent_code": "63"},
    {"code": "634", "name": "Indemnizações", "type": "expense", "parent_code": "63"},
    {"code": "635", "name": "Encargos sobre remunerações", "type": "expense", "parent_code": "63"},
    {"code": "636", "name": "Seguros acidentes trabalho", "type": "expense", "parent_code": "63"},
    {"code": "637", "name": "Gastos de ação social", "type": "expense", "parent_code": "63"},
    {"code": "638", "name": "Outros gastos com o pessoal", "type": "expense", "parent_code": "63"},
    {"code": "64", "name": "Gastos de depreciação e de amortização", "type": "expense", "parent_code": ""},
    {"code": "641", "name": "Depreciações — Ativos fixos tangíveis", "type": "expense", "parent_code": "64"},
    {"code": "642", "name": "Amortizações — Ativos intangíveis", "type": "expense", "parent_code": "64"},
    {"code": "65", "name": "Perdas por imparidade", "type": "expense", "parent_code": ""},
    {"code": "66", "name": "Perdas por redução de justo valor", "type": "expense", "parent_code": ""},
    {"code": "67", "name": "Provisões do período", "type": "expense", "parent_code": ""},
    {"code": "68", "name": "Outros gastos e perdas", "type": "expense", "parent_code": ""},
    {"code": "681", "name": "Impostos (exceto IRC)", "type": "expense", "parent_code": "68"},
    {"code": "688", "name": "Outros gastos", "type": "expense", "parent_code": "68"},
    {"code": "69", "name": "Gastos e perdas de financiamento", "type": "expense", "parent_code": ""},
    {"code": "691", "name": "Juros suportados", "type": "expense", "parent_code": "69"},
    # Classe 7 — Rendimentos
    {"code": "71", "name": "Vendas", "type": "revenue", "parent_code": ""},
    {"code": "711", "name": "Vendas — Mercadorias", "type": "revenue", "parent_code": "71"},
    {"code": "712", "name": "Vendas — Produtos acabados", "type": "revenue", "parent_code": "71"},
    {"code": "72", "name": "Prestações de serviços", "type": "revenue", "parent_code": ""},
    {"code": "73", "name": "Variações nos inventários da produção", "type": "revenue", "parent_code": ""},
    {"code": "74", "name": "Trabalhos para a própria entidade", "type": "revenue", "parent_code": ""},
    {"code": "75", "name": "Subsídios à exploração", "type": "revenue", "parent_code": ""},
    {"code": "76", "name": "Reversões", "type": "revenue", "parent_code": ""},
    {"code": "77", "name": "Ganhos por aumentos de justo valor", "type": "revenue", "parent_code": ""},
    {"code": "78", "name": "Outros rendimentos e ganhos", "type": "revenue", "parent_code": ""},
    {"code": "781", "name": "Rendimentos suplementares", "type": "revenue", "parent_code": "78"},
    {"code": "782", "name": "Descontos de pronto pagamento obtidos", "type": "revenue", "parent_code": "78"},
    {"code": "788", "name": "Outros rendimentos", "type": "revenue", "parent_code": "78"},
    {"code": "79", "name": "Juros, dividendos e outros rendimentos", "type": "revenue", "parent_code": ""},
    {"code": "791", "name": "Juros obtidos", "type": "revenue", "parent_code": "79"},
    # Classe 8 — Resultados
    {"code": "81", "name": "Resultado líquido do período", "type": "equity", "parent_code": ""},
    {"code": "811", "name": "Resultado antes de impostos", "type": "equity", "parent_code": "81"},
    {"code": "812", "name": "Imposto sobre o rendimento", "type": "equity", "parent_code": "81"},
    {"code": "818", "name": "Resultado líquido", "type": "equity", "parent_code": "81"},
]

DEFAULT_JOURNALS: list[dict[str, str]] = [
    {"code": "DIV", "name": "Diário Diversos", "type": "general"},
    {"code": "CMP", "name": "Diário de Compras", "type": "purchase"},
    {"code": "VND", "name": "Diário de Vendas", "type": "sale"},
    {"code": "BNK", "name": "Diário de Bancos", "type": "bank"},
    {"code": "OPS", "name": "Diário de Operações", "type": "operations"},
]


def seed_chart_of_accounts(tenant_id: str, conn: Any) -> int:
    existing = conn.execute(
        "SELECT code FROM accounts WHERE tenant_id = %s", (tenant_id,)
    ).fetchall() # type: ignore[no-any-return]
    existing_codes = {r["code"] for r in existing}
    count = 0
    for acct in SNC_ACCOUNTS:
        if acct["code"] in existing_codes:
            continue
        conn.execute(
            """INSERT INTO accounts (tenant_id, code, name, type, parent_code)
               VALUES (%s, %s, %s, %s, %s)""",
            (tenant_id, acct["code"], acct["name"], acct["type"], acct["parent_code"]),
        )
        count += 1
    return count


def seed_journals(tenant_id: str, conn: Any) -> int:
    existing = conn.execute(
        "SELECT code FROM accounting_journals WHERE tenant_id = %s", (tenant_id,)
    ).fetchall() # type: ignore[no-any-return]
    existing_codes = {r["code"] for r in existing}
    count = 0
    for jnl in DEFAULT_JOURNALS:
        if jnl["code"] in existing_codes:
            continue
        conn.execute(
            """INSERT INTO accounting_journals (tenant_id, code, name, type)
               VALUES (%s, %s, %s, %s)""",
            (tenant_id, jnl["code"], jnl["name"], jnl["type"]),
        )
        count += 1
    return count


def list_accounts(tenant_id: str, conn: Any, account_type: str | None = None, active_only: bool = True) -> list[dict]:
    sql = "SELECT id, code, name, type, parent_code, active FROM accounts WHERE tenant_id = %s"
    params: list[object] = [tenant_id]
    if account_type:
        sql += " AND type = %s"
        params.append(account_type)
    if active_only:
        sql += " AND active = true"
    sql += " ORDER BY code"
    return conn.execute(sql, tuple(params)).fetchall() # type: ignore[no-any-return]


def create_account(tenant_id: str, conn: Any, code: str, name: str, account_type: str, parent_code: str = "") -> dict:
    row = conn.execute(
        """INSERT INTO accounts (tenant_id, code, name, type, parent_code)
           VALUES (%s, %s, %s, %s, %s)
           RETURNING id, code, name, type, parent_code, active""",
        (tenant_id, code, name, account_type, parent_code),
    ).fetchone()
    conn.commit()
    return dict(row)


def patch_account(tenant_id: str, conn: Any, account_id: int, name: str | None = None, active: bool | None = None) -> dict:
    row = conn.execute(
        "SELECT id, code, name, type, parent_code, active FROM accounts WHERE id = %s AND tenant_id = %s",
        (account_id, tenant_id),
    ).fetchone()
    if not row:
        raise ValueError("Account not found")
    updates: list[str] = []
    params: list[object] = []
    if name is not None:
        updates.append("name = %s")
        params.append(name)
    if active is not None:
        updates.append("active = %s")
        params.append(active)
    if not updates:
        return dict(row)
    params.extend([account_id, tenant_id])
    conn.execute(
        f"UPDATE accounts SET {', '.join(updates)} WHERE id = %s AND tenant_id = %s",
        tuple(params),
    )
    conn.commit()
    updated = conn.execute(
        "SELECT id, code, name, type, parent_code, active FROM accounts WHERE id = %s AND tenant_id = %s",
        (account_id, tenant_id),
    ).fetchone()
    return dict(updated)


def list_fiscal_periods(tenant_id: str, conn: Any) -> list[dict]:
    return conn.execute(  # type: ignore[no-any-return]
        "SELECT id, name, start_date, end_date, status, lock_date FROM fiscal_periods WHERE tenant_id = %s ORDER BY start_date DESC",
        (tenant_id,),
    ).fetchall()


def create_fiscal_period(tenant_id: str, conn: Any, name: str, start_date: str, end_date: str) -> dict:
    row = conn.execute(
        """INSERT INTO fiscal_periods (tenant_id, name, start_date, end_date)
           VALUES (%s, %s, %s, %s)
           RETURNING id, name, start_date, end_date, status, lock_date""",
        (tenant_id, name, start_date, end_date),
    ).fetchone()
    conn.commit()
    return dict(row)


def close_fiscal_period(tenant_id: str, conn: Any, period_id: int) -> dict:
    row = conn.execute(
        "SELECT id, name, start_date, end_date, status, lock_date FROM fiscal_periods WHERE id = %s AND tenant_id = %s",
        (period_id, tenant_id),
    ).fetchone()
    if not row:
        raise ValueError("Fiscal period not found")
    if row["status"] == "closed":
        raise ValueError("Period already closed")
    conn.execute(
        "UPDATE fiscal_periods SET status = %s, lock_date = %s WHERE id = %s AND tenant_id = %s",
        ("closed", datetime.date.today().isoformat(), period_id, tenant_id),
    )
    conn.commit()
    updated = conn.execute(
        "SELECT id, name, start_date, end_date, status, lock_date FROM fiscal_periods WHERE id = %s AND tenant_id = %s",
        (period_id, tenant_id),
    ).fetchone()
    return dict(updated)


def list_journals(tenant_id: str, conn: Any) -> list[dict]:
    return conn.execute(  # type: ignore[no-any-return]
        "SELECT id, code, name, type, active FROM accounting_journals WHERE tenant_id = %s ORDER BY code",
        (tenant_id,),
    ).fetchall()


def create_journal_entry(
    tenant_id: str, conn: Any, journal_id: int, entry_date: str,
    lines: list[dict], reference: str = "", description: str = "",
    period_id: int | None = None, source_type: str | None = None, source_id: int | None = None,
) -> dict:
    total_debit = sum(Decimal(str(ln.get("debit", "0"))) for ln in lines)
    total_credit = sum(Decimal(str(ln.get("credit", "0"))) for ln in lines)
    if total_debit != total_credit:
        raise ValueError(f"Entry not balanced: debit={total_debit}, credit={total_credit}")
    if not lines:
        raise ValueError("At least one line is required")

    entry = conn.execute(
        """INSERT INTO journal_entries
           (tenant_id, journal_id, period_id, entry_date, reference, description, source_type, source_id)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
           RETURNING id, tenant_id, journal_id, period_id, entry_date, reference, description,
                     source_type, source_id, status, created_at""",
        (tenant_id, journal_id, period_id, entry_date, reference, description, source_type, source_id),
    ).fetchone()
    entry_id = entry["id"]

    for ln in lines:
        account_code = ln["account_code"]
        acct = conn.execute(
            "SELECT id FROM accounts WHERE tenant_id = %s AND code = %s",
            (tenant_id, account_code),
        ).fetchone()
        if not acct:
            raise ValueError(f"Account {account_code} not found")
        conn.execute(
            """INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
               VALUES (%s, %s, %s, %s, %s)""",
            (entry_id, acct["id"], Decimal(str(ln.get("debit", "0"))), Decimal(str(ln.get("credit", "0"))), ln.get("description", "")),
        )
    conn.commit()
    return _fetch_entry_with_lines(tenant_id, conn, entry_id)


def list_journal_entries(
    tenant_id: str, conn: Any, journal_id: int | None = None,
    date_from: str | None = None, date_to: str | None = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    sql = """SELECT je.id, je.entry_date, je.reference, je.description,
                    je.source_type, je.source_id, je.status,
                    aj.code AS journal_code, aj.name AS journal_name,
                    fp.name AS period_name
               FROM journal_entries je
               JOIN accounting_journals aj ON aj.id = je.journal_id
               LEFT JOIN fiscal_periods fp ON fp.id = je.period_id
              WHERE je.tenant_id = %s"""
    params: list[object] = [tenant_id]
    if journal_id is not None:
        sql += " AND je.journal_id = %s"
        params.append(journal_id)
    if date_from:
        sql += " AND je.entry_date >= %s"
        params.append(date_from)
    if date_to:
        sql += " AND je.entry_date <= %s"
        params.append(date_to)
    sql += " ORDER BY je.entry_date DESC, je.id DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])
    return conn.execute(sql, tuple(params)).fetchall() # type: ignore[no-any-return]


def get_journal_entry(tenant_id: str, conn: Any, entry_id: int) -> dict:
    entry = _fetch_entry_with_lines(tenant_id, conn, entry_id)
    if not entry:
        raise ValueError("Journal entry not found")
    return entry


def _fetch_entry_with_lines(tenant_id: str, conn: Any, entry_id: int) -> dict:
    row = conn.execute(
        """SELECT je.id, je.entry_date, je.reference, je.description,
                  je.source_type, je.source_id, je.status,
                  aj.code AS journal_code, aj.name AS journal_name,
                  fp.name AS period_name
             FROM journal_entries je
             JOIN accounting_journals aj ON aj.id = je.journal_id
             LEFT JOIN fiscal_periods fp ON fp.id = je.period_id
            WHERE je.id = %s AND je.tenant_id = %s""",
        (entry_id, tenant_id),
    ).fetchone()
    if not row:
        raise ValueError("Journal entry not found")
    entry = dict(row)
    lines = conn.execute(
        """SELECT jel.id, a.code AS account_code, a.name AS account_name,
                  jel.debit, jel.credit, jel.description
             FROM journal_entry_lines jel
             JOIN accounts a ON a.id = jel.account_id
            WHERE jel.entry_id = %s
            ORDER BY jel.id""",
        (entry_id,),
    ).fetchall() # type: ignore[no-any-return]
    entry["lines"] = [dict(ln) for ln in lines]
    return entry


def trial_balance(tenant_id: str, conn: Any, date_from: str | None = None, date_to: str | None = None) -> dict:
    sql = """SELECT a.code, a.name, a.type,
                    COALESCE(SUM(jel.debit), 0) AS total_debit,
                    COALESCE(SUM(jel.credit), 0) AS total_credit
               FROM accounts a
               LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
               LEFT JOIN journal_entries je ON je.id = jel.entry_id AND je.tenant_id = %s
              WHERE a.tenant_id = %s AND a.active = true"""
    params: list[object] = [tenant_id, tenant_id]
    if date_from:
        sql += " AND (je.entry_date >= %s OR je.entry_date IS NULL)"
        params.append(date_from)
    if date_to:
        sql += " AND (je.entry_date <= %s OR je.entry_date IS NULL)"
        params.append(date_to)
    sql += " GROUP BY a.code, a.name, a.type HAVING COALESCE(SUM(jel.debit), 0) != 0 OR COALESCE(SUM(jel.credit), 0) != 0 ORDER BY a.code"
    rows = conn.execute(sql, tuple(params)).fetchall() # type: ignore[no-any-return]

    total_debit = Decimal("0")
    total_credit = Decimal("0")
    result_rows = []
    for r in rows:
        d = Decimal(str(r["total_debit"]))
        c = Decimal(str(r["total_credit"]))
        result_rows.append({
            "code": r["code"], "name": r["name"], "type": r["type"],
            "total_debit": str(d), "total_credit": str(c), "balance": str(d - c),
        })
        total_debit += d
        total_credit += c

    return {
        "rows": result_rows, "total_debit": str(total_debit),
        "total_credit": str(total_credit), "balanced": total_debit == total_credit,
    }


def general_ledger(tenant_id: str, conn: Any, account_code: str, date_from: str | None = None, date_to: str | None = None) -> list[dict]:
    sql = """SELECT jel.id, je.entry_date, je.reference, je.description AS entry_description,
                    jel.debit, jel.credit, jel.description AS line_description,
                    aj.code AS journal_code
               FROM journal_entry_lines jel
               JOIN journal_entries je ON je.id = jel.entry_id
               JOIN accounts a ON a.id = jel.account_id
               JOIN accounting_journals aj ON aj.id = je.journal_id
              WHERE je.tenant_id = %s AND a.code = %s"""
    params: list[object] = [tenant_id, account_code]
    if date_from:
        sql += " AND je.entry_date >= %s"
        params.append(date_from)
    if date_to:
        sql += " AND je.entry_date <= %s"
        params.append(date_to)
    sql += " ORDER BY je.entry_date, je.id, jel.id"
    rows = conn.execute(sql, tuple(params)).fetchall() # type: ignore[no-any-return]

    running = Decimal("0")
    result = []
    for r in rows:
        d = Decimal(str(r["debit"]))
        c = Decimal(str(r["credit"]))
        running += d - c
        result.append({
            "id": r["id"], "entry_date": str(r["entry_date"]),
            "reference": r["reference"], "entry_description": r["entry_description"],
            "debit": str(d), "credit": str(c), "balance": str(running),
            "line_description": r["line_description"], "journal_code": r["journal_code"],
        })
    return result


def balance_sheet(tenant_id: str, conn: Any, as_of: str | None = None) -> dict:
    sql = """SELECT a.code, a.name, a.type,
                    COALESCE(SUM(jel.debit), 0) AS total_debit,
                    COALESCE(SUM(jel.credit), 0) AS total_credit
               FROM accounts a
               LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
               LEFT JOIN journal_entries je ON je.id = jel.entry_id AND je.tenant_id = %s
              WHERE a.tenant_id = %s AND a.active = true"""
    params: list[object] = [tenant_id, tenant_id]
    if as_of:
        sql += " AND (je.entry_date <= %s OR je.entry_date IS NULL)"
        params.append(as_of)
    sql += " GROUP BY a.code, a.name, a.type ORDER BY a.code"
    rows = conn.execute(sql, tuple(params)).fetchall() # type: ignore[no-any-return]

    assets_total = Decimal("0")
    liabilities_total = Decimal("0")
    equity_total = Decimal("0")
    revenue_total = Decimal("0")
    expense_total = Decimal("0")
    detail: dict[str, list[dict]] = {"assets": [], "liabilities": [], "equity": []}

    for r in rows:
        d = Decimal(str(r["total_debit"]))
        c = Decimal(str(r["total_credit"]))
        balance = d - c
        if balance == 0:
            continue
        item = {"code": r["code"], "name": r["name"], "balance": str(balance)}
        if r["type"] == "asset":
            assets_total += balance
            detail["assets"].append(item)
        elif r["type"] == "liability":
            liabilities_total += balance
            detail["liabilities"].append(item)
        elif r["type"] == "equity":
            equity_total += balance
            detail["equity"].append(item)
        elif r["type"] == "revenue":
            revenue_total += balance
        elif r["type"] == "expense":
            expense_total += balance

    net_income = revenue_total - expense_total
    eq_plus_liab = liabilities_total + equity_total + net_income
    return {
        "as_of": as_of or datetime.date.today().isoformat(),
        "assets": str(assets_total), "liabilities": str(liabilities_total),
        "equity": str(equity_total), "net_income": str(net_income),
        "equity_plus_liabilities": str(eq_plus_liab),
        "balanced": assets_total == eq_plus_liab, "detail": detail,
    }


def profit_loss(tenant_id: str, conn: Any, year: int | None = None, date_from: str | None = None, date_to: str | None = None) -> dict:
    if year and not date_from:
        date_from = f"{year}-01-01"
    if year and not date_to:
        date_to = f"{year}-12-31"
    if not year and not date_from:
        year = datetime.date.today().year
        date_from = f"{year}-01-01"
        date_to = f"{year}-12-31"

    sql = """SELECT a.code, a.name, a.type,
                    COALESCE(SUM(jel.debit), 0) AS total_debit,
                    COALESCE(SUM(jel.credit), 0) AS total_credit
               FROM accounts a
               JOIN journal_entry_lines jel ON jel.account_id = a.id
               JOIN journal_entries je ON je.id = jel.entry_id AND je.tenant_id = %s
              WHERE a.tenant_id = %s AND a.type IN ('revenue', 'expense')"""
    params: list[object] = [tenant_id, tenant_id]
    if date_from:
        sql += " AND je.entry_date >= %s"
        params.append(date_from)
    if date_to:
        sql += " AND je.entry_date <= %s"
        params.append(date_to)
    sql += " GROUP BY a.code, a.name, a.type ORDER BY a.code"
    rows = conn.execute(sql, tuple(params)).fetchall() # type: ignore[no-any-return]

    rendimentos: list[dict] = []
    gastos: list[dict] = []
    total_rendimentos = Decimal("0")
    total_gastos = Decimal("0")

    for r in rows:
        d = float(r["total_debit"])
        c = float(r["total_credit"])
        balance = d - c
        item = {"code": r["code"], "name": r["name"], "debit": d, "credit": c, "balance": balance}
        if r["type"] == "revenue":
            rendimentos.append(item)
            total_rendimentos += Decimal(str(c)) - Decimal(str(d))
        elif r["type"] == "expense":
            gastos.append(item)
            total_gastos += Decimal(str(d)) - Decimal(str(c))

    return {
        "year": year or datetime.date.today().year,
        "date_from": date_from, "date_to": date_to,
        "rendimentos": rendimentos, "gastos": gastos,
        "total_rendimentos": float(total_rendimentos),
        "total_gastos": float(total_gastos),
        "resultado_liquido": float(total_rendimentos - total_gastos),
    }


def iva_declaration(tenant_id: str, conn: Any, year: int, quarter: int | None = None, month: int | None = None) -> dict:
    if month:
        date_from = f"{year}-{month:02d}-01"
        date_to = f"{year}-12-31" if month == 12 else f"{year}-{month + 1:02d}-01"
        period = f"{year}-{month:02d}"
    elif quarter:
        m_start = (quarter - 1) * 3 + 1
        m_end = quarter * 3
        date_from = f"{year}-{m_start:02d}-01"
        date_to = f"{year}-12-31" if m_end == 12 else f"{year}-{m_end + 1:02d}-01"
        period = f"{year}-Q{quarter}"
    else:
        date_from = f"{year}-01-01"
        date_to = f"{year}-12-31"
        period = str(year)

    sql = """SELECT a.code, a.name,
                    COALESCE(SUM(jel.debit), 0) AS total_debit,
                    COALESCE(SUM(jel.credit), 0) AS total_credit
               FROM accounts a
               JOIN journal_entry_lines jel ON jel.account_id = a.id
               JOIN journal_entries je ON je.id = jel.entry_id AND je.tenant_id = %s
              WHERE a.tenant_id = %s AND a.code LIKE '24%%'
                AND je.entry_date >= %s AND je.entry_date < %s
              GROUP BY a.code, a.name ORDER BY a.code"""
    rows = conn.execute(sql, (tenant_id, tenant_id, date_from, date_to)).fetchall() # type: ignore[no-any-return]

    iva_dedutivel = Decimal("0")
    iva_liquidado = Decimal("0")
    accounts_detail: dict[str, dict] = {}

    for r in rows:
        d = Decimal(str(r["total_debit"]))
        c = Decimal(str(r["total_credit"]))
        balance = d - c
        code = r["code"]
        accounts_detail[code] = {
            "code": code, "name": r["name"],
            "total_debit": str(d), "total_credit": str(c), "balance": str(balance),
        }
        if code.startswith("2412"):
            iva_dedutivel += balance
        elif code.startswith("2413"):
            iva_liquidado += abs(balance)

    iva_apurado = iva_liquidado - iva_dedutivel
    return {
        "period": period, "date_from": date_from, "date_to": date_to,
        "iva_dedutivel": str(iva_dedutivel), "iva_liquidado": str(iva_liquidado),
        "iva_apurado": str(iva_apurado),
        "a_pagar": str(max(Decimal("0"), iva_apurado)),
        "a_recuperar": str(max(Decimal("0"), -iva_apurado)),
        "accounts": accounts_detail,
    }
