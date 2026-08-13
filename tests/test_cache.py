# tests/test_cache.py
from __future__ import annotations

import json

from term_comparison.cache import content_hash, list_cached, load_cached, store_cached
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
    store_cached(tmp_path, "term", h, result, act_count=2)

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
    store_cached(tmp_path, "term", "old-hash", result, act_count=2)

    assert load_cached(tmp_path, "term", "new-hash") is None


def test_store_then_load_cached_round_trips_has_unverified_span(tmp_path):
    result = DifferenceSummary(
        summary="They differ.",
        differences=[VerifiedDifference(act_title="Act A", quote="means A", note="scope")],
        has_unverified_span=True,
    )
    h = content_hash([DEF_A, DEF_B])
    store_cached(tmp_path, "term", h, result, act_count=2)

    loaded = load_cached(tmp_path, "term", h)
    assert loaded is not None
    assert loaded.has_unverified_span is True


def test_load_cached_defaults_has_unverified_span_false_for_legacy_entries(tmp_path):
    # Entries written before this field existed have no "has_unverified_span" key.
    path = tmp_path / "term.json"
    path.write_text(json.dumps({
        "content_hash": "h",
        "summary": "They differ.",
        "differences": [{"act_title": "Act A", "quote": "means A", "note": "scope"}],
    }))

    loaded = load_cached(tmp_path, "term", "h")
    assert loaded is not None
    assert loaded.has_unverified_span is False


def test_store_cached_slugifies_term_for_filename(tmp_path):
    result = DifferenceSummary(
        summary="s", differences=[VerifiedDifference(act_title="A", quote="q", note="n")]
    )
    store_cached(tmp_path, "Australian resident", "h", result, act_count=2)

    files = list(tmp_path.glob("*.json"))
    assert len(files) == 1
    assert files[0].name == "australian-resident.json"


def test_store_cached_persists_term_and_act_count(tmp_path):
    result = DifferenceSummary(
        summary="s", differences=[VerifiedDifference(act_title="A", quote="q", note="n")]
    )
    store_cached(tmp_path, "Australian resident", "h", result, act_count=4)

    data = json.loads((tmp_path / "australian-resident.json").read_text())
    assert data["term"] == "Australian resident"
    assert data["act_count"] == 4


def test_list_cached_ranks_by_difference_count_over_act_count_ratio(tmp_path):
    # "child": 2 verified differences across 2 Acts -> ratio 1.0
    store_cached(
        tmp_path, "child", "h1",
        DifferenceSummary(summary="s", differences=[
            VerifiedDifference(act_title="A", quote="q", note="n"),
            VerifiedDifference(act_title="B", quote="q", note="n"),
        ]),
        act_count=2,
    )
    # "quarter": 2 verified differences across 6 Acts -> ratio 0.33
    store_cached(
        tmp_path, "quarter", "h2",
        DifferenceSummary(summary="s", differences=[
            VerifiedDifference(act_title="A", quote="q", note="n"),
            VerifiedDifference(act_title="B", quote="q", note="n"),
        ]),
        act_count=6,
    )

    entries = list_cached(tmp_path)

    assert [e["term"] for e in entries] == ["child", "quarter"]
    assert entries[0]["difference_count"] == 2
    assert entries[0]["act_count"] == 2


def test_list_cached_falls_back_to_deslugified_term_for_legacy_entries(tmp_path):
    path = tmp_path / "personal-information.json"
    path.write_text(json.dumps({
        "content_hash": "h",
        "summary": "s",
        "differences": [{"act_title": "A", "quote": "q", "note": "n"}],
    }))

    entries = list_cached(tmp_path)

    assert len(entries) == 1
    assert entries[0]["term"] == "personal information"
    assert entries[0]["act_count"] == 1  # unknown for legacy entries -> falls back to 1 (no inflated ratio)


def test_list_cached_skips_feedback_jsonl(tmp_path):
    (tmp_path / "feedback.jsonl").write_text('{"term": "x", "vote": "up"}\n')

    assert list_cached(tmp_path) == []


def test_list_cached_returns_empty_list_for_missing_dir(tmp_path):
    assert list_cached(tmp_path / "does-not-exist") == []
