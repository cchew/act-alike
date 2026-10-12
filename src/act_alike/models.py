# src/act_alike/models.py
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class DefinitionOut(BaseModel):
    display_term: str
    definition_text: str
    act_title: str  # Act title; non-Commonwealth Acts carry the jurisdiction, e.g. "... Act 2014 (Vic)"
    act_frbr_uri: str
    section_eid: str
    jurisdiction: str = "Cth"
    scope: str = "act"  # "act", or the container a local definition applies to (only with include_local)


class DifferenceOut(BaseModel):
    act_title: str
    quote: str
    note: str


class ComparisonResponse(BaseModel):
    term: str
    definitions: list[DefinitionOut]
    difference_summary: str | None = None
    differences: list[DifferenceOut] = []
    summary_unverified: bool = False


class StatsOut(BaseModel):
    acts: int
    defined_terms: int
    multi_act_terms: int
    jurisdictions: list[str] = ["Cth"]


class MultiActTermOut(BaseModel):
    term: str
    display_term: str
    act_count: int


class DivergentTermOut(BaseModel):
    term: str
    difference_count: int
    act_count: int


class FeedbackIn(BaseModel):
    term: str
    vote: Literal["up", "down"]
    summary: str | None = None
    differences: list[DifferenceOut] = []
