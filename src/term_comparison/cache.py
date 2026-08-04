# src/term_comparison/cache.py
from __future__ import annotations
from dataclasses import asdict
from datetime import datetime, timezone
import hashlib
import json
import re
from pathlib import Path

from term_comparison.llm import DifferenceSummary, VerifiedDifference
from term_comparison.models import DefinitionOut


def _slugify(term: str) -> str:
    """Filesystem-safe cache key for a term: lowercase, non-alphanumerics -> hyphen."""
    slug = re.sub(r"[^a-z0-9]+", "-", term.lower()).strip("-")
    return slug or "term"


def content_hash(definitions: list[DefinitionOut]) -> str:
    """Hash of this term's own (act, definition text) pairs, order-independent.

    Deliberately scoped to a single term's own definitions, not a global corpus
    version — a corpus update that changes other terms' definitions must not
    invalidate this term's cache entry.
    """
    pairs = sorted((d.act_frbr_uri, d.definition_text) for d in definitions)
    payload = json.dumps(pairs, sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def load_cached(cache_dir: Path, term: str, current_hash: str) -> DifferenceSummary | None:
    """Return the cached summary for `term` iff it exists and matches `current_hash`."""
    path = cache_dir / f"{_slugify(term)}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None
    if data.get("content_hash") != current_hash:
        return None
    return DifferenceSummary(
        summary=data["summary"],
        differences=[VerifiedDifference(**d) for d in data["differences"]],
    )


def store_cached(cache_dir: Path, term: str, current_hash: str, result: DifferenceSummary) -> None:
    """Write (or overwrite) the cache entry for `term`. Caller commits the Volume, if any."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_dir / f"{_slugify(term)}.json"
    payload = {
        "content_hash": current_hash,
        "summary": result.summary,
        "differences": [asdict(d) for d in result.differences],
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
    path.write_text(json.dumps(payload))
