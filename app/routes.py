from fastapi import APIRouter

from app.routes_accounting import router as accounting_router
from app.routes_admin import router as admin_router
from app.routes_bank import router as bank_router
from app.routes_customers import router as customers_router
from app.routes_documents import router as documents_router
from app.routes_finance import router as finance_router
from app.routes_inventory import router as inventory_router
from app.routes_invoices import router as invoices_router

router = APIRouter()
router.include_router(documents_router)
router.include_router(bank_router)
router.include_router(finance_router)
router.include_router(inventory_router)
router.include_router(admin_router)
router.include_router(accounting_router)
router.include_router(customers_router)
router.include_router(invoices_router)
