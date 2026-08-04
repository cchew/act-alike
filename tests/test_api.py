# tests/test_api.py
from __future__ import annotations

import json
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from lexaugraph.graph import LexAuGraph
from lexaugraph.models import ActData, ActNode, DefinedTermNode, SectionNode
from lexaugraph.resolver import DefinitionResolver

from term_comparison.api import create_app


def _build_test_resolver() -> DefinitionResolver:
    graph = LexAuGraph()

    act_a = ActData(
        act_node=ActNode(frbr_uri="/akn/au/act/1991/46", title="Social Security Act 1991", year=1991),
        sections=[
            SectionNode(
                eid="sec-1020",
                act_frbr_uri="/akn/au/act/1991/46",
                heading="Income support payment",
                text="income support payment means a social security benefit or a social security pension.",
            ),
        ],
        defined_terms=[
            DefinedTermNode(
                term="income support payment",
                display_term="income support payment",
                act_frbr_uri="/akn/au/act/1991/46",
                section_eid="sec-1020",
                definition_text="a social security benefit or a social security pension.",
            ),
        ],
        ref_edges=[],
    )

    act_b = ActData(
        act_node=ActNode(
            frbr_uri="/akn/au/act/1993/78",
            title="Superannuation Industry (Supervision) Act 1993",
            year=1993,
        ),
        sections=[
            SectionNode(
                eid="sec-10",
                act_frbr_uri="/akn/au/act/1993/78",
                heading="Definitions",
                text="income support payment has the same meaning as in the Social Security Act 1991.",
            ),
        ],
        defined_terms=[
            DefinedTermNode(
                term="income support payment",
                display_term="income support payment",
                act_frbr_uri="/akn/au/act/1993/78",
                section_eid="sec-10",
                definition_text="has the same meaning as in the Social Security Act 1991.",
            ),
        ],
        ref_edges=[],
    )

    graph.add_act_data(act_a)
    graph.add_act_data(act_b)
    return DefinitionResolver(graph)


def _build_fragment_test_resolver() -> DefinitionResolver:
    """Two Acts whose definition_text is a bare, content-free lead-in fragment —
    the corpus-truncation artifact documented in FUTURE.md."""
    graph = LexAuGraph()

    act_a = ActData(
        act_node=ActNode(frbr_uri="/akn/au/act/1997/38", title="Income Tax Assessment Act 1997", year=1997),
        sections=[
            SectionNode(
                eid="sec-995-1",
                act_frbr_uri="/akn/au/act/1997/38",
                heading="Definitions",
                text="entity means any of the following:",
            ),
        ],
        defined_terms=[
            DefinedTermNode(
                term="entity",
                display_term="entity",
                act_frbr_uri="/akn/au/act/1997/38",
                section_eid="sec-995-1",
                definition_text="any of the following:",
            ),
        ],
        ref_edges=[],
    )

    act_b = ActData(
        act_node=ActNode(frbr_uri="/akn/au/act/1999/85", title="A New Tax System (Goods and Services Tax) Act 1999", year=1999),
        sections=[
            SectionNode(
                eid="sec-195-1",
                act_frbr_uri="/akn/au/act/1999/85",
                heading="Dictionary",
                text="entity means the following:",
            ),
        ],
        defined_terms=[
            DefinedTermNode(
                term="entity",
                display_term="entity",
                act_frbr_uri="/akn/au/act/1999/85",
                section_eid="sec-195-1",
                definition_text="the following:",
            ),
        ],
        ref_edges=[],
    )

    graph.add_act_data(act_a)
    graph.add_act_data(act_b)
    return DefinitionResolver(graph)


def _build_single_act_resolver() -> DefinitionResolver:
    """One Act only — nothing to compare, fallback must stay None."""
    graph = LexAuGraph()

    act_a = ActData(
        act_node=ActNode(frbr_uri="/akn/au/act/1991/46", title="Social Security Act 1991", year=1991),
        sections=[
            SectionNode(
                eid="sec-1020",
                act_frbr_uri="/akn/au/act/1991/46",
                heading="Income support payment",
                text="income support payment means a social security benefit or a social security pension.",
            ),
        ],
        defined_terms=[
            DefinedTermNode(
                term="income support payment",
                display_term="income support payment",
                act_frbr_uri="/akn/au/act/1991/46",
                section_eid="sec-1020",
                definition_text="a social security benefit or a social security pension.",
            ),
        ],
        ref_edges=[],
    )

    graph.add_act_data(act_a)
    return DefinitionResolver(graph)


def test_get_definitions_returns_all_acts_for_term():
    resolver = _build_test_resolver()
    app = create_app(resolver)
    client = TestClient(app)

    response = client.get("/definitions", params={"term": "income support payment"})

    assert response.status_code == 200
    data = response.json()
    assert data["term"] == "income support payment"
    assert len(data["definitions"]) == 2
    act_titles = {d["act_title"] for d in data["definitions"]}
    assert act_titles == {
        "Social Security Act 1991",
        "Superannuation Industry (Supervision) Act 1993",
    }
    assert data["difference_summary"] == "2 distinct definition texts found across 2 Acts — see below."


def test_get_definitions_quick_returns_definitions_without_summary():
    resolver = _build_test_resolver()
    mock_client = MagicMock()  # must not be called — quick path skips the LLM entirely
    app = create_app(resolver, client=mock_client)
    client = TestClient(app)

    response = client.get("/definitions/quick", params={"term": "income support payment"})

    assert response.status_code == 200
    data = response.json()
    assert len(data["definitions"]) == 2
    assert data["difference_summary"] is None
    assert data["differences"] == []
    mock_client.messages.create.assert_not_called()


def test_get_definitions_quick_404_for_unknown_term():
    resolver = _build_test_resolver()
    app = create_app(resolver)
    client = TestClient(app)

    response = client.get("/definitions/quick", params={"term": "nonexistent term"})

    assert response.status_code == 404


def test_get_definitions_404_for_unknown_term():
    resolver = _build_test_resolver()
    app = create_app(resolver)
    client = TestClient(app)

    response = client.get("/definitions", params={"term": "nonexistent term"})

    assert response.status_code == 404


def test_get_definitions_populates_difference_summary_with_client():
    resolver = _build_test_resolver()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json.dumps({
        "summary": "The Acts describe the same payment concept in different words.",
        "differences": [
            {
                "act_title": "Social Security Act 1991",
                "quote": "a social security benefit or a social security pension",
                "note": "defines the concept directly",
            },
        ],
        "confidence": "high",
    }))]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    app = create_app(resolver, client=mock_client)
    client = TestClient(app)

    response = client.get("/definitions", params={"term": "income support payment"})

    assert response.status_code == 200
    data = response.json()
    assert data["difference_summary"] == "The Acts describe the same payment concept in different words."


def test_get_definitions_fallback_summary_without_client():
    resolver = _build_test_resolver()
    app = create_app(resolver)  # no client configured
    client = TestClient(app)

    response = client.get("/definitions", params={"term": "income support payment"})

    assert response.json()["difference_summary"] == "2 distinct definition texts found across 2 Acts — see below."


def test_get_definitions_survives_unexpected_llm_exception():
    """A summary-layer failure must still surface a deterministic fallback headline, not a bare null.

    llm.py's summarise_differences only catches anthropic.APIError internally. This
    test raises a bare ValueError from the mocked client — something llm.py does NOT
    catch — to prove the defensive catch added at the API boundary (not inside
    llm.py) actually works, rather than merely re-exercising llm.py's own handling.
    """
    resolver = _build_test_resolver()
    mock_client = MagicMock()
    mock_client.messages.create.side_effect = ValueError("unexpected failure, not an APIError")

    app = create_app(resolver, client=mock_client)
    client = TestClient(app)

    response = client.get("/definitions", params={"term": "income support payment"})

    assert response.status_code == 200
    data = response.json()
    assert len(data["definitions"]) == 2
    act_titles = {d["act_title"] for d in data["definitions"]}
    assert act_titles == {
        "Social Security Act 1991",
        "Superannuation Industry (Supervision) Act 1993",
    }
    assert data["difference_summary"] == "2 distinct definition texts found across 2 Acts — see below."


def test_get_definitions_populates_differences_with_client():
    resolver = _build_test_resolver()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json.dumps({
        "summary": "The Acts describe the same payment concept in different words.",
        "differences": [
            {
                "act_title": "Social Security Act 1991",
                "quote": "a social security benefit or a social security pension",
                "note": "defines the concept directly",
            },
        ],
        "confidence": "high",
    }))]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    app = create_app(resolver, client=mock_client)
    client = TestClient(app)

    response = client.get("/definitions", params={"term": "income support payment"})

    assert response.status_code == 200
    data = response.json()
    assert data["differences"] == [
        {
            "act_title": "Social Security Act 1991",
            "quote": "a social security benefit or a social security pension",
            "note": "defines the concept directly",
        }
    ]


def test_get_definitions_differences_empty_without_client():
    resolver = _build_test_resolver()
    app = create_app(resolver)
    client = TestClient(app)

    response = client.get("/definitions", params={"term": "income support payment"})

    assert response.json()["differences"] == []


def test_get_stats_returns_live_counts():
    resolver = _build_test_resolver()
    app = create_app(resolver)
    client = TestClient(app)

    response = client.get("/stats")

    assert response.status_code == 200
    data = response.json()
    assert data["acts"] == 2
    assert data["defined_terms"] == 2
    assert data["multi_act_terms"] == 0  # "income support payment" is defined in 2 Acts, below the min_acts=3 default


def test_get_terms_returns_multi_act_terms_above_threshold():
    resolver = _build_test_resolver()
    app = create_app(resolver)
    client = TestClient(app)

    response = client.get("/terms", params={"min_acts": 2})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["term"] == "income support payment"
    assert data[0]["act_count"] == 2


def test_get_terms_default_min_acts_excludes_two_act_term():
    resolver = _build_test_resolver()
    app = create_app(resolver)
    client = TestClient(app)

    response = client.get("/terms")

    assert response.status_code == 200
    assert response.json() == []


def test_get_definitions_fallback_summary_all_fragments():
    resolver = _build_fragment_test_resolver()
    app = create_app(resolver)  # no client configured
    client = TestClient(app)

    response = client.get("/definitions", params={"term": "entity"})

    assert response.status_code == 200
    data = response.json()
    assert data["difference_summary"] == "Definitions found in 2 Acts, but full text wasn't extracted for this term — see Known limitations."


def test_fallback_summary_no_longer_fires_for_completed_definitions():
    """Regression for the list-definition-truncation fix: once definition_text
    is complete (contains real list content, not just a bare colon-terminated
    lead-in), _fallback_summary must return the normal distinct-count message,
    not the 'wasn't extracted' fallback. _is_bare_fragment's regex only matches
    the exact bare fragment shape ("the following:" / "any of the following:"),
    so this is a pure-function test proving no term-comparison code change is
    needed once the upstream corpus fix lands -- no live corpus/graph needed."""
    from term_comparison.api import _fallback_summary
    from term_comparison.models import DefinitionOut

    definitions = [
        DefinitionOut(
            display_term="entity",
            definition_text=(
                "any of the following: (a) an individual; (b) a body corporate; "
                "(c) a body politic; (d) a partnership;"
            ),
            act_title="Income Tax Assessment Act 1997",
            act_frbr_uri="/akn/au/act/1997/38",
            section_eid="sec-995-1",
        ),
        DefinitionOut(
            display_term="entity",
            definition_text=(
                "the following: (a) an individual; (b) a body corporate; (c) a trust;"
            ),
            act_title="A New Tax System (Goods and Services Tax) Act 1999",
            act_frbr_uri="/akn/au/act/1999/85",
            section_eid="sec-195-1",
        ),
    ]

    summary = _fallback_summary(definitions)
    assert summary == "2 distinct definition texts found across 2 Acts — see below."


def test_get_definitions_no_fallback_for_single_definition():
    resolver = _build_single_act_resolver()
    app = create_app(resolver)  # no client configured
    client = TestClient(app)

    response = client.get("/definitions", params={"term": "income support payment"})

    assert response.status_code == 200
    assert response.json()["difference_summary"] is None


def _build_multi_meaning_resolver() -> DefinitionResolver:
    """One Act, one term, two genuinely different meanings -- the node_id MVP
    scenario (e.g. ITAA 1936's real 'exempt income', which has 4 distinct
    meanings in the live corpus). Requires lex-au-graph's occurrence-
    disambiguated node_id for both DefinedTermNodes to survive as separate
    graph nodes -- this fixture directly exercises that."""
    graph = LexAuGraph()
    act = ActData(
        act_node=ActNode(frbr_uri="/akn/au/act/1936/27", title="Income Tax Assessment Act 1936", year=1936),
        sections=[
            SectionNode(
                eid="part-III__sec-23",
                act_frbr_uri="/akn/au/act/1936/27",
                heading="Exemptions",
                text="exempt income means ...",
            ),
        ],
        defined_terms=[
            DefinedTermNode(
                term="exempt income",
                display_term="exempt income",
                act_frbr_uri="/akn/au/act/1936/27",
                section_eid="part-III__sec-23",
                definition_text="income derived from a source outside Australia by a resident.",
            ),
            DefinedTermNode(
                term="exempt income",
                display_term="exempt income",
                act_frbr_uri="/akn/au/act/1936/27",
                section_eid="part-III__sec-23",
                definition_text="a pension, allowance or benefit specified in Schedule 5.",
            ),
        ],
        ref_edges=[],
    )
    graph.add_act_data(act)
    return DefinitionResolver(graph)


def test_get_definitions_returns_multiple_meanings_same_act():
    """Regression for the node_id MVP fix: a term with 2 genuinely different
    meanings within ONE Act must return both, not silently show only one."""
    resolver = _build_multi_meaning_resolver()
    app = create_app(resolver)
    client = TestClient(app)

    response = client.get("/definitions", params={"term": "exempt income"})

    assert response.status_code == 200
    data = response.json()
    assert len(data["definitions"]) == 2
    act_titles = {d["act_title"] for d in data["definitions"]}
    assert act_titles == {"Income Tax Assessment Act 1936"}
    def_texts = {d["definition_text"] for d in data["definitions"]}
    assert "income derived from a source outside Australia by a resident." in def_texts
    assert "a pension, allowance or benefit specified in Schedule 5." in def_texts


def test_get_definitions_caches_llm_summary_across_requests(tmp_path):
    resolver = _build_test_resolver()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json.dumps({
        "summary": "They differ in scope.",
        "differences": [{
            "act_title": "Social Security Act 1991",
            "quote": "a social security benefit or a social security pension",
            "note": "narrower",
        }],
    }))]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    app = create_app(resolver, client=mock_client, cache_dir=tmp_path)
    client = TestClient(app)

    r1 = client.get("/definitions", params={"term": "income support payment"})
    assert r1.json()["difference_summary"] == "They differ in scope."
    assert mock_client.messages.create.call_count == 1

    r2 = client.get("/definitions", params={"term": "income support payment"})
    assert r2.json()["difference_summary"] == "They differ in scope."
    assert mock_client.messages.create.call_count == 1  # served from cache, not re-called

    assert len(list(tmp_path.glob("*.json"))) == 1


def test_get_definitions_calls_cache_commit_after_writing(tmp_path):
    resolver = _build_test_resolver()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json.dumps({
        "summary": "They differ in scope.",
        "differences": [{
            "act_title": "Social Security Act 1991",
            "quote": "a social security benefit or a social security pension",
            "note": "narrower",
        }],
    }))]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response
    commit_mock = MagicMock()

    app = create_app(resolver, client=mock_client, cache_dir=tmp_path, cache_commit=commit_mock)
    client = TestClient(app)
    client.get("/definitions", params={"term": "income support payment"})

    commit_mock.assert_called_once()


def test_post_feedback_appends_jsonl_and_commits(tmp_path):
    resolver = _build_test_resolver()
    commit_mock = MagicMock()
    app = create_app(resolver, cache_dir=tmp_path, cache_commit=commit_mock)
    client = TestClient(app)

    response = client.post("/feedback", json={
        "term": "income support payment",
        "vote": "up",
        "summary": "They differ in scope.",
        "differences": [{"act_title": "Social Security Act 1991", "quote": "x", "note": "y"}],
    })

    assert response.status_code == 204
    feedback_file = tmp_path / "feedback.jsonl"
    lines = feedback_file.read_text().strip().splitlines()
    assert len(lines) == 1
    record = json.loads(lines[0])
    assert record["term"] == "income support payment"
    assert record["vote"] == "up"
    commit_mock.assert_called_once()


def test_post_feedback_noop_without_cache_dir():
    resolver = _build_test_resolver()
    app = create_app(resolver)  # no cache_dir configured
    client = TestClient(app)

    response = client.post("/feedback", json={"term": "x", "vote": "down"})
    assert response.status_code == 204


def test_post_feedback_rejects_invalid_vote():
    resolver = _build_test_resolver()
    app = create_app(resolver)
    client = TestClient(app)

    response = client.post("/feedback", json={"term": "x", "vote": "sideways"})
    assert response.status_code == 422
