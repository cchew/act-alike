# src/term_comparison/llm.py
from __future__ import annotations
from dataclasses import dataclass
import json
import logging
import os
import re

import anthropic

from term_comparison.models import DefinitionOut

_LOGGER = logging.getLogger(__name__)
_NUMBER_RE = re.compile(r"\d+")


@dataclass
class VerifiedDifference:
    act_title: str
    quote: str
    note: str


@dataclass
class DifferenceSummary:
    summary: str
    differences: list[VerifiedDifference]  # only the ones that verified
    has_unverified_span: bool = False

_SYSTEM_PROMPT = (
    "You are assisting a legislative research tool that compares how a legal term is "
    "defined across different Commonwealth Acts of Parliament. "
    "Describe ONLY observable differences already present in the definition text provided "
    "(different thresholds, different tests, different reference points, different scope). "
    "Do NOT speculate on legislative intent, drafting history, or policy rationale. "
    "Do NOT draw any eligibility or compliance conclusion. "
    "Quote evidence verbatim from the definition text you were given. "
    "Return ONLY valid JSON — no markdown fences, no commentary."
)

_JSON_SCHEMA_HINT = (
    '{"summary": "one paragraph, plain language, describing the observable textual differences", '
    '"differences": [{"act_title": "exact Act title as given", '
    '"quote": "verbatim quoted passage from the corresponding Act definition text", '
    '"note": "short description of what is different about this Act version"}, ...], '
    '"confidence": "high|medium|low"}'
)


def _normalise(text: str) -> str:
    """Lowercase, collapse whitespace, strip punctuation for substring matching."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def verify_quote(quote: str, source_text: str) -> bool:
    """Check a quoted passage exists (whitespace/punctuation-insensitive) in source_text."""
    normalised_quote = _normalise(quote)
    return bool(normalised_quote) and normalised_quote in _normalise(source_text)


def _summary_has_unverified_span(summary: str, differences: list[VerifiedDifference]) -> bool:
    """True if `summary` asserts a number that no verified difference's quote supports.

    `summary` is a free-text synthesis of `differences` and is never itself
    quote-verified the way each `differences[].quote` is — this is a cheap,
    number-focused check for that gap (FUTURE.md "Summary-field grounding
    gap"). It does not prove `summary` is fully grounded, only that it hasn't
    invented a figure (age, dollar amount, date) absent from every verified quote.
    """
    summary_numbers = set(_NUMBER_RE.findall(summary))
    if not summary_numbers:
        return False
    quoted_numbers: set[str] = set()
    for d in differences:
        quoted_numbers.update(_NUMBER_RE.findall(d.quote))
    return not summary_numbers.issubset(quoted_numbers)


def _default_model() -> str:
    return os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")


def build_difference_prompt(term: str, definitions: list[DefinitionOut]) -> str:
    parts = [
        f"## Term: {term}",
        "",
        "### Definitions retrieved from Commonwealth Acts",
    ]
    for d in definitions:
        parts += [
            "",
            f"**{d.act_title}** ({d.section_eid}):",
            d.definition_text,
        ]
    parts += [
        "",
        "### Task",
        f"Compare these {len(definitions)} definitions of '{term}' and describe only the "
        "observable differences in the text itself. Quote verbatim from each definition as evidence.",
        "Return ONLY this JSON schema:",
        _JSON_SCHEMA_HINT,
    ]
    return "\n".join(parts)


def summarise_differences(
    term: str,
    definitions: list[DefinitionOut],
    client: anthropic.Anthropic,
) -> DifferenceSummary | None:
    """Return a plain-language, quote-verified summary of observable differences.

    Returns None if there's nothing to compare (fewer than 2 definitions), the LLM
    call fails, the response isn't valid JSON, or none of the claimed differences'
    quotes verify against their Act's definition text — never surface an unverified
    claim to the user. On success, `DifferenceSummary.differences` contains only the
    claims that verified — an unverified claim is dropped from the list, not the
    whole summary.
    """
    if len(definitions) < 2:
        return None

    by_act = {d.act_title: d for d in definitions}
    prompt = build_difference_prompt(term, definitions)

    try:
        response = client.messages.create(
            model=_default_model(),
            max_tokens=1024,
            temperature=0,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError:
        return None

    raw = response.content[0].text.strip()
    raw = re.sub(r"^```json\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None

    verified: list[VerifiedDifference] = []
    for diff in data.get("differences", []):
        source = by_act.get(diff.get("act_title", ""))
        quote = diff.get("quote", "")
        if source and verify_quote(quote, source.definition_text):
            verified.append(VerifiedDifference(
                act_title=diff.get("act_title", ""),
                quote=quote,
                note=diff.get("note", ""),
            ))

    if not verified:
        return None

    summary = data.get("summary")
    if not summary:
        return None

    unverified_span = _summary_has_unverified_span(summary, verified)
    if unverified_span:
        _LOGGER.warning(
            "unverified numeric span in summary for term=%r: %r", term, summary
        )

    return DifferenceSummary(summary=summary, differences=verified, has_unverified_span=unverified_span)
