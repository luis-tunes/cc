"""SAF-T PT XML export — Portaria 302/2016 compliant."""

import datetime
import xml.etree.ElementTree as ET
from decimal import Decimal
from typing import Any


def generate_saft_xml(tenant_id: str, conn: Any, year: int, month: int | None = None) -> bytes:
    if month:
        date_from = f"{year}-{month:02d}-01"
        date_to = f"{year}-12-31" if month == 12 else f"{year}-{month + 1:02d}-01"
    else:
        date_from = f"{year}-01-01"
        date_to = f"{year + 1}-01-01"

    end_date = date_to if month else f"{year}-12-31"

    root = ET.Element("AuditFile", xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01")

    header = ET.SubElement(root, "Header")
    ET.SubElement(header, "AuditFileVersion").text = "1.04_01"
    ET.SubElement(header, "CompanyID").text = tenant_id
    ET.SubElement(header, "TaxRegistrationNumber").text = _get_tenant_nif(conn, tenant_id)
    ET.SubElement(header, "TaxAccountingBasis").text = "C"
    ET.SubElement(header, "CompanyName").text = _get_tenant_name(conn, tenant_id)
    ET.SubElement(header, "FiscalYear").text = str(year)
    ET.SubElement(header, "StartDate").text = date_from
    ET.SubElement(header, "EndDate").text = end_date
    ET.SubElement(header, "CurrencyCode").text = "EUR"
    ET.SubElement(header, "DateCreated").text = datetime.date.today().isoformat()
    ET.SubElement(header, "TaxEntity").text = "Global"
    ET.SubElement(header, "ProductCompanyTaxID").text = "999999999"
    ET.SubElement(header, "SoftwareCertificateNumber").text = "0"
    ET.SubElement(header, "ProductID").text = "TIM/xtim.ai"
    ET.SubElement(header, "ProductVersion").text = "1.0"

    master = ET.SubElement(root, "MasterFiles")

    accounts = conn.execute(
        "SELECT code, name, type FROM accounts WHERE tenant_id = %s AND active = true ORDER BY code",
        (tenant_id,),
    ).fetchall()
    for acct in accounts:
        ga = ET.SubElement(master, "GeneralLedgerAccounts")
        ET.SubElement(ga, "AccountID").text = acct["code"]
        ET.SubElement(ga, "AccountDescription").text = acct["name"]
        gc = "GR" if len(acct["code"]) <= 2 else "GM"
        ET.SubElement(ga, "GroupingCategory").text = gc

    customers = conn.execute(
        "SELECT id, name, nif, address, postal_code, city, country FROM customers WHERE tenant_id = %s ORDER BY id",
        (tenant_id,),
    ).fetchall()
    for cust in customers:
        ct = ET.SubElement(master, "Customer")
        ET.SubElement(ct, "CustomerID").text = str(cust["id"])
        ET.SubElement(ct, "AccountID").text = "211"
        ET.SubElement(ct, "CustomerTaxID").text = cust["nif"] or "999999990"
        ET.SubElement(ct, "CompanyName").text = cust["name"]
        addr = ET.SubElement(ct, "BillingAddress")
        ET.SubElement(addr, "AddressDetail").text = cust["address"] or "Desconhecido"
        ET.SubElement(addr, "City").text = cust["city"] or "Desconhecido"
        ET.SubElement(addr, "PostalCode").text = cust["postal_code"] or "0000-000"
        ET.SubElement(addr, "Country").text = cust["country"] or "PT"
        ET.SubElement(ct, "SelfBillingIndicator").text = "0"

    source = ET.SubElement(root, "SourceDocuments")
    sales = ET.SubElement(source, "SalesInvoices")

    invoices = conn.execute(
        """SELECT i.*, s.series_code FROM invoices i
           JOIN invoice_series s ON s.id = i.series_id
           WHERE i.tenant_id = %s AND i.issue_date >= %s AND i.issue_date < %s
             AND i.status IN ('emitida', 'anulada')
           ORDER BY i.issue_date, i.id""",
        (tenant_id, date_from, date_to),
    ).fetchall()

    total_credit = Decimal("0")
    n_entries = 0

    for inv in invoices:
        n_entries += 1
        invoice_el = ET.SubElement(sales, "Invoice")
        sc = inv.get("series_code", "FT")
        inv_no = f"{sc} {sc}/{inv['number']}"
        ET.SubElement(invoice_el, "InvoiceNo").text = inv_no
        ET.SubElement(invoice_el, "ATCUD").text = inv.get("atcud") or "0"

        status_el = ET.SubElement(invoice_el, "DocumentStatus")
        saft_status = "N" if inv["status"] == "emitida" else "A"
        ET.SubElement(status_el, "InvoiceStatus").text = saft_status
        ET.SubElement(status_el, "InvoiceStatusDate").text = str(inv.get("finalized_at") or inv.get("created_at", ""))[:19]
        ET.SubElement(status_el, "SourceID").text = tenant_id
        ET.SubElement(status_el, "SourceBilling").text = "P"

        ET.SubElement(invoice_el, "Hash").text = "0"
        ET.SubElement(invoice_el, "HashControl").text = "0"
        issue = inv["issue_date"]
        period_num = issue.month if hasattr(issue, "month") else int(str(issue)[5:7])
        ET.SubElement(invoice_el, "Period").text = str(period_num)
        ET.SubElement(invoice_el, "InvoiceDate").text = str(issue)
        ET.SubElement(invoice_el, "InvoiceType").text = inv.get("document_type", "FT")
        ET.SubElement(invoice_el, "SourceID").text = tenant_id
        ET.SubElement(invoice_el, "SystemEntryDate").text = str(inv.get("created_at", ""))[:19]
        ET.SubElement(invoice_el, "CustomerID").text = str(inv.get("customer_id") or 0)

        lines = conn.execute(
            "SELECT * FROM invoice_lines WHERE invoice_id = %s AND tenant_id = %s ORDER BY line_number",
            (inv["id"], tenant_id),
        ).fetchall()
        for ln in lines:
            line_el = ET.SubElement(invoice_el, "Line")
            ET.SubElement(line_el, "LineNumber").text = str(ln["line_number"])
            ET.SubElement(line_el, "ProductCode").text = ln.get("snc_account") or "SRV"
            ET.SubElement(line_el, "ProductDescription").text = ln["description"]
            ET.SubElement(line_el, "Quantity").text = str(ln["quantity"])
            ET.SubElement(line_el, "UnitOfMeasure").text = "UN"
            ET.SubElement(line_el, "UnitPrice").text = str(ln["unit_price"])
            ET.SubElement(line_el, "CreditAmount").text = str(ln["subtotal"])
            total_credit += Decimal(str(ln["subtotal"]))

            tax = ET.SubElement(line_el, "Tax")
            ET.SubElement(tax, "TaxType").text = "IVA"
            ET.SubElement(tax, "TaxCountryRegion").text = "PT"
            vr = Decimal(str(ln["vat_rate"]))
            tc = "NOR" if vr == Decimal("23") else "RED" if vr == Decimal("6") else "INT"
            ET.SubElement(tax, "TaxCode").text = tc
            ET.SubElement(tax, "TaxPercentage").text = str(ln["vat_rate"])

        totals = ET.SubElement(invoice_el, "DocumentTotals")
        ET.SubElement(totals, "TaxPayable").text = str(inv["vat_total"])
        ET.SubElement(totals, "NetTotal").text = str(inv["subtotal"])
        ET.SubElement(totals, "GrossTotal").text = str(inv["total"])

    ET.SubElement(sales, "NumberOfEntries").text = str(n_entries)
    ET.SubElement(sales, "TotalDebit").text = "0"
    ET.SubElement(sales, "TotalCredit").text = str(total_credit)

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)  # type: ignore[no-any-return]


def _get_tenant_nif(conn: Any, tenant_id: str) -> str:
    row = conn.execute(
        "SELECT data FROM tenant_settings WHERE tenant_id = %s AND key = 'entity_profile'",
        (tenant_id,),
    ).fetchone()
    if row and isinstance(row.get("data"), dict):
        return str(row["data"].get("nif", "999999999"))
    return "999999999"


def _get_tenant_name(conn: Any, tenant_id: str) -> str:
    row = conn.execute(
        "SELECT data FROM tenant_settings WHERE tenant_id = %s AND key = 'entity_profile'",
        (tenant_id,),
    ).fetchone()
    if row and isinstance(row.get("data"), dict):
        return str(row["data"].get("name", tenant_id))
    return tenant_id
