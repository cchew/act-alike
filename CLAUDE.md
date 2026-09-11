# Act Alike

Backend for the IM2026 "Build a Bureaucrat Bot" entry. Wraps `lex-au-graph`'s
`DefinitionResolver` in a FastAPI service — see `README.md` for setup.

## Stack position

Depends on `../../lex-au-graph/repo` (retrieval layer of the AU Legislative Intelligence
Stack) — installed editable, not vendored. Its `graph.json` must be built first. Peer to
ClauseKit (`../../clause-kit/repo`) in the stack's applications layer — both are
consumer-facing tools built on the same corpus, ClauseKit via rule extraction, this project
directly on graph-based definition resolution.

## Running locally

    source .venv/bin/activate
    act-alike serve

## Tests

    pytest
