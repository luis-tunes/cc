"""Entity resolver — match extracted NIFs/names against owner entities, determine direction.

Scoring weights for entity matching:
  NIF exact match:        1.00
  IBAN match:             0.85
  Legal name exact match: 0.75
  Name fuzzy match:       0.45
  Address match:          0.35
  Lexical context:        0.25

Direction determination:
  - issued_by_user: owner entity is the issuer (supplier_nif matches owner)
  - received_by_user: owner entity is the recipient (client_nif matches owner)
  - internal: both NIFs match owner entities
  - unknown: no match found
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.schemas.extraction import Direction, EntityRole

log = logging.getLogger(__name__)

# Scoring weights
SCORE_NIF_EXACT = 1.00
SCORE_IBAN = 0.85
SCORE_NAME_LEGAL = 0.75
SCORE_NAME_FUZZY = 0.45
SCORE_ADDRESS = 0.35
SCORE_LEXICAL = 0.25


@dataclass
class OwnerEntity:
    """A known entity belonging to the tenant."""
    nif: str
    name: str = ""
    ibans: list[str] = field(default_factory=list)
    aliases: list[str] = field(default_factory=list)
    address: str = ""
    is_primary: bool = False


@dataclass
class ResolvedEntities:
    """Result of entity resolution: identified issuer, recipient, direction."""
    issuer: EntityRole
    recipient: EntityRole
    direction: Direction
    issuer_match_score: float = 0.0
    recipient_match_score: float = 0.0


def resolve_entities(
    supplier_nif: str,
    client_nif: str,
    supplier_name: str,
    client_name: str,
    extracted_ibans: list[str],
    owner_entities: list[OwnerEntity],
    doc_type_direction_hint: str = "either",
) -> ResolvedEntities:
    """Resolve extracted entities against owner entities and determine direction.

    Args:
        supplier_nif: NIF extracted as document issuer
        client_nif: NIF extracted as document recipient
        supplier_name: Name extracted as issuer
        client_name: Name extracted as recipient
        extracted_ibans: IBANs found in document
        owner_entities: Tenant's known entities
        doc_type_direction_hint: From taxonomy — "emitted", "received", or "either"

    Returns:
        ResolvedEntities with direction and entity roles.
    """
    if not owner_entities:
        return ResolvedEntities(
            issuer=EntityRole(nif=supplier_nif, name=supplier_name),
            recipient=EntityRole(nif=client_nif, name=client_name),
            direction=Direction.unknown,
        )

    # Score supplier against owner entities
    supplier_score, supplier_match = _best_match(
        nif=supplier_nif,
        name=supplier_name,
        ibans=extracted_ibans,
        owner_entities=owner_entities,
    )

    # Score client against owner entities
    client_score, client_match = _best_match(
        nif=client_nif,
        name=client_name,
        ibans=extracted_ibans,
        owner_entities=owner_entities,
    )

    # Determine direction
    direction = _determine_direction(
        supplier_score=supplier_score,
        client_score=client_score,
        doc_type_hint=doc_type_direction_hint,
    )

    issuer = EntityRole(
        nif=supplier_nif,
        name=supplier_name,
        match_confidence=supplier_score,
        is_owner=supplier_score >= SCORE_NAME_FUZZY,
    )
    recipient = EntityRole(
        nif=client_nif,
        name=client_name,
        match_confidence=client_score,
        is_owner=client_score >= SCORE_NAME_FUZZY,
    )

    if supplier_match:
        issuer.iban = supplier_match.ibans[0] if supplier_match.ibans else None
    if client_match:
        recipient.iban = client_match.ibans[0] if client_match.ibans else None

    return ResolvedEntities(
        issuer=issuer,
        recipient=recipient,
        direction=direction,
        issuer_match_score=supplier_score,
        recipient_match_score=client_score,
    )


def _best_match(
    nif: str,
    name: str,
    ibans: list[str],
    owner_entities: list[OwnerEntity],
) -> tuple[float, OwnerEntity | None]:
    """Find the best-matching owner entity for the given NIF/name/IBANs."""
    best_score = 0.0
    best_entity = None

    for entity in owner_entities:
        score = _score_entity_match(nif, name, ibans, entity)
        if score > best_score:
            best_score = score
            best_entity = entity

    return best_score, best_entity


def _score_entity_match(
    nif: str,
    name: str,
    ibans: list[str],
    entity: OwnerEntity,
) -> float:
    """Score how well extracted data matches a known entity."""
    score = 0.0

    # NIF exact match (strongest signal)
    if nif and nif != "000000000" and entity.nif and nif == entity.nif:
        score = max(score, SCORE_NIF_EXACT)
        return score  # NIF match is definitive

    # IBAN match
    if ibans and entity.ibans:
        for iban in ibans:
            if iban in entity.ibans:
                score = max(score, SCORE_IBAN)
                break

    # Legal name exact match (case-insensitive)
    if name and entity.name:
        name_lower = name.lower().strip()
        entity_lower = entity.name.lower().strip()
        if name_lower == entity_lower:
            score = max(score, SCORE_NAME_LEGAL)
        elif _fuzzy_name_match(name_lower, entity_lower):
            score = max(score, SCORE_NAME_FUZZY)

    # Check aliases
    if name and entity.aliases:
        name_lower = name.lower().strip()
        for alias in entity.aliases:
            if name_lower == alias.lower().strip():
                score = max(score, SCORE_NAME_LEGAL)
                break
            elif _fuzzy_name_match(name_lower, alias.lower().strip()):
                score = max(score, SCORE_NAME_FUZZY)

    return score


def _fuzzy_name_match(a: str, b: str) -> bool:
    """Simple fuzzy name match — one name contains the other or word overlap >= 60%."""
    if not a or not b:
        return False
    if a in b or b in a:
        return True
    words_a = set(a.split())
    words_b = set(b.split())
    if not words_a or not words_b:
        return False
    overlap = len(words_a & words_b)
    min_len = min(len(words_a), len(words_b))
    return min_len > 0 and overlap / min_len >= 0.6


def _determine_direction(
    supplier_score: float,
    client_score: float,
    doc_type_hint: str,
) -> Direction:
    """Determine document direction based on entity match scores and type hint."""
    threshold = SCORE_NAME_FUZZY  # 0.45 — must at least fuzzy-match a name

    supplier_is_owner = supplier_score >= threshold
    client_is_owner = client_score >= threshold

    if supplier_is_owner and client_is_owner:
        return Direction.internal

    if supplier_is_owner:
        return Direction.issued_by_user

    if client_is_owner:
        return Direction.received_by_user

    # No match — use type hint as fallback
    if doc_type_hint == "emitted":
        return Direction.issued_by_user
    if doc_type_hint == "received":
        return Direction.received_by_user

    return Direction.unknown


def owner_entities_from_settings(entity_profile: dict | None) -> list[OwnerEntity]:
    """Build OwnerEntity list from tenant_settings entity_profile JSON.

    Supports both single-entity format (current) and multi-entity format (future).
    """
    if not entity_profile:
        return []

    # Multi-entity format: {"entities": [...]}
    entities_list = entity_profile.get("entities")
    if entities_list and isinstance(entities_list, list):
        result = []
        for i, e in enumerate(entities_list):
            if not isinstance(e, dict):
                continue
            result.append(OwnerEntity(
                nif=str(e.get("nif", "")),
                name=str(e.get("legal_name", e.get("name", ""))),
                ibans=[str(ib) for ib in e.get("ibans", [])],
                aliases=[str(a) for a in e.get("aliases", [])],
                address=str(e.get("address", "")),
                is_primary=i == 0 or e.get("is_primary", False),
            ))
        return result

    # Single-entity format (current EntityProfile page)
    nif = str(entity_profile.get("nif", ""))
    name = str(entity_profile.get("legal_name", ""))
    if not nif and not name:
        return []

    return [OwnerEntity(
        nif=nif,
        name=name,
        is_primary=True,
    )]
