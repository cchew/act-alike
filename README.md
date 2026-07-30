# Act Alike

Innovation Month 2026 "Build a Bureaucrat Bot" entry (repo name `term-comparison`, deployed as "Act Alike"). 

Shows how ordinary legal terms (e.g. "personal information", "australian resident") are defined across Commonwealth Acts, with citations.

[search.gov.au](https://search.gov.au)'s Align stream ("Common Ground", Dept of Finance, alpha — see [Government content is AI food](https://www.youtube.com/watch?v=X5UAWFl7-FE), APS Digital Profession Innovation Month, July 2026) does this at whole-of-government scale and routes real divergences to SES for resolution.

## Uses

- **Depends on:** [lex-au-graph](https://github.com/cchew/lex-au-graph) (allows cross Act querying using [lex-au](https://github.com/cchew/lex-au) AKN 3.0 XML)

## Example

```
GET /definitions?term=personal+information
```

```json
{
  "term": "personal information",
  "definitions": [
    {
      "display_term": "personal information",
      "definition_text": "information or an opinion about an identified individual, or an individual who is reasonably identifiable:",
      "act_title": "Privacy Act 1988",
      "act_frbr_uri": "/akn/au/act/1988/119",
      "section_eid": "part-II__dvs-1__sec-6"
    },
    {
      "display_term": "personal information",
      "definition_text": "in the Private Health Insurance Act 2007.",
      "act_title": "Ombudsman Act 1976",
      "act_frbr_uri": "/akn/au/act/1976/181",
      "section_eid": "part-I__sec-3"
    }
  ],
  "difference_summary": "..."
}
```

Most Acts that use "personal information" defer to the Privacy Act 1988's definition. The Ombudsman Act 1976 is the interesting case above - it defers to the Private Health Insurance Act 2007 instead, a different Act to what every other consumer of the term points to. Surfacing exactly this kind of divergence, with citations, is what this tool is for.

## Setup

Clone this repo and lex-au-graph as siblings:

```bash
git clone https://github.com/cchew/act-alike.git
git clone https://github.com/cchew/lex-au-graph.git
```

Install both:

```bash
cd act-alike
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pip install -e ../lex-au-graph
```

Build lex-au-graph's `graph.json` (needs a lex-au corpus - download pre-built XML from Hugging Face, no lex-au clone needed):

```bash
cd ../lex-au-graph
pip install huggingface_hub
python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='cchew/lex-au', repo_type='dataset', local_dir='corpus', allow_patterns='xml/*')"
lexaugraph build --corpus-dir corpus/
cd ../act-alike
```

## Run locally
```bash
term-comparison serve
```

## Tests

    pytest

## Known limits

- A term returns `404 Not Found` if lex-au's extraction missed its definition upstream, not just if the term genuinely isn't defined anywhere. lex-au currently misses an estimated 46% of dictionary-style definitions where the defined term itself is bold/italic-formatted in the source DOCX - see [lex-au-graph's Known limits](https://github.com/cchew/lex-au-graph#known-limits-v072). A "no results" response does not mean the term is undefined in AU legislation, only that it isn't tagged in the corpus yet.

## Versions

- **v0.1.4** - IM2026 competition submission. Review fixes on the polish pass: stable-height corpus stats placeholder (fixes guided-tour first-highlight misalignment), "Legend:" label, browse panel no longer overflows the viewport with no search results.
- **v0.1.3** - Polish pass: guided first-visit tour, progressive quick/full results split, corpus-coverage warning banner, panel-style legend, sticky footer, build-pipeline diagram, GitHub repo link.
- **v0.1.2** - Trust/reliability pass: deterministic fallback summary, persistent disclaimer, "How this works" trust modal, e2e/a11y coverage.
- **v0.1.1** - Search UX pass: instructional copy, hidden-by-default term browser, flagship shortcuts, reflowing browse panel, verification fallback messaging.
- **v0.1.0** - First tagged release. Renamed "Act Alike". Corpus stats bar, term browser, quote-verified highlighting, citations, accessibility scan + fixes.

## License

MIT - see [LICENSE](LICENSE).
