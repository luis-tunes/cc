"""Adapter registry — type-specific prompt overlays for document extraction.

Each adapter provides additional instructions for the LLM prompt tailored
to a specific document type family. The registry maps SAF-T codes to adapters.
"""

from __future__ import annotations

from typing import Protocol


class Adapter(Protocol):
    """Protocol for document type adapters."""

    saft_codes: list[str]

    def get_overlay(self) -> str:
        """Return prompt overlay text for this document type."""
        ...

    def get_required_fields(self) -> list[str]:
        """Return list of fields that MUST be extracted for this type."""
        ...


# Registry populated by adapter modules
_ADAPTERS: dict[str, Adapter] = {}


def register_adapter(adapter: Adapter) -> None:
    for code in adapter.saft_codes:
        _ADAPTERS[code] = adapter


def get_adapter(saft_code: str) -> Adapter | None:
    return _ADAPTERS.get(saft_code.upper()) if saft_code else None


def get_overlay_for_type(saft_code: str) -> str:
    """Get prompt overlay text for a SAF-T code, or empty string if no adapter."""
    adapter = get_adapter(saft_code)
    return adapter.get_overlay() if adapter else ""


def get_required_fields(saft_code: str) -> list[str]:
    adapter = get_adapter(saft_code)
    return adapter.get_required_fields() if adapter else []
