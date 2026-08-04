# tests/test_cache.py
from __future__ import annotations

from term_comparison.cache import content_hash, load_cached, store_cached
from term_comparison.llm import DifferenceSummary, VerifiedDifference
from term_comparison.models import DefinitionOut

DEF_A = DefinitionOut(
    display_term="x", definition_text="means A.",
    act_title="Act A", act_frbr_uri="/akn/au/act/2000/1", section_eid="s1",
)
DEF_B = DefinitionOut(
    display_term="x", definition_text="means B.",
    act_title="Act B", act_frbr_uri="/akn/au/act/2001/2", section_eid="s2",
)


def test_content_hash_is_stable_for_same_definitions():
    assert content_hash([DEF_A, DEF_B]) == content_hash([DEF_A, DEF_B])


def test_content_hash_is_order_independent():
    assert content_hash([DEF_A, DEF_B]) == content_hash([DEF_B, DEF_A])


def test_content_hash_changes_when_definition_text_changes():
    changed = DEF_A.model_copy(update={"definition_text": "means something else."})
    assert content_hash([DEF_A, DEF_B]) != content_hash([changed, DEF_B])


def test_load_cached_returns_none_when_file_missing(tmp_path):
    assert load_cached(tmp_path, "term", "somehash") is None


def test_store_then_load_cached_round_trips(tmp_path):
    result = DifferenceSummary(
        summary="They differ.",
        differences=[VerifiedDifference(act_title="Act A", quote="means A", note="scope")],
    )
    h = content_hash([DEF_A, DEF_B])
    store_cached(tmp_path, "term", h, result)

    loaded = load_cached(tmp_path, "term", h)
    assert loaded is not None
    assert loaded.summary == "They differ."
    assert loaded.differences[0].act_title == "Act A"
    assert loaded.differences[0].quote == "means A"


def test_load_cached_returns_none_when_hash_mismatches(tmp_path):
    result = DifferenceSummary(
        summary="They differ.",
        differences=[VerifiedDifference(act_title="Act A", quote="x", note="y")],
    )
    store_cached(tmp_path, "term", "old-hash", result)

    assert load_cached(tmp_path, "term", "new-hash") is None


def test_store_cached_slugifies_term_for_filename(tmp_path):
    result = DifferenceSummary(
        summary="s", differences=[VerifiedDifference(act_title="A", quote="q", note="n")]
    )
    store_cached(tmp_path, "Australian resident", "h", result)

    files = list(tmp_path.glob("*.json"))
    assert len(files) == 1
    assert files[0].name == "australian-resident.json"
