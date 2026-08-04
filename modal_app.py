# modal_app.py
from __future__ import annotations
from pathlib import Path

import modal

REPO_ROOT = Path(__file__).resolve().parent
LEX_AU_GRAPH_REPO = REPO_ROOT.parent.parent / "lex-au-graph" / "repo"
GRAPH_JSON = LEX_AU_GRAPH_REPO / "graph.json"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi>=0.115", "networkx>=3.3", "lxml>=5.3", "anthropic>=0.40.0")
    .add_local_python_source("lexaugraph")
    .add_local_python_source("term_comparison")
    .add_local_file(str(GRAPH_JSON), "/root/graph.json")
)

app = modal.App("term-comparison", image=image)

# Persists LLM-summary cache entries and feedback records (cache.py) across
# container restarts/redeploys. Populated lazily by real requests — no
# pre-warming or separate ingest step needed here.
cache_volume = modal.Volume.from_name("term-comparison-cache", create_if_missing=True)


@app.function(
    min_containers=1,
    secrets=[modal.Secret.from_name("anthropic-api-key")],
    volumes={"/cache": cache_volume},
)
@modal.asgi_app(label="term-comparison-api")
def fastapi_app():
    import os
    from pathlib import Path as _Path
    import anthropic
    from lexaugraph.graph import LexAuGraph
    from lexaugraph.resolver import DefinitionResolver
    from term_comparison.api import create_app

    graph = LexAuGraph.load(_Path("/root/graph.json"))
    resolver = DefinitionResolver(graph)
    client = anthropic.Anthropic() if os.environ.get("ANTHROPIC_API_KEY") else None
    return create_app(
        resolver,
        client=client,
        cache_dir=_Path("/cache"),
        cache_commit=cache_volume.commit,
    )
