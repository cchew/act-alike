# Act Alike

_Blog post: [Act Alike: Are Terms Defined Consistently Across Legislation?](https://www.herdmentality.xyz/blog/act-alike)_

Shows how ordinary legal terms (e.g. "personal information", "australian resident") are defined across Commonwealth Acts, with citations. Started as an entry for Innovation Month 2026's "Build a Bureaucrat Bot" challenge — originally coded and deployed under the working name `term-comparison`, renamed to `act-alike` throughout to match its public "Act Alike" branding.

> [!NOTE]
> [search.gov.au](https://search.gov.au)'s Align stream ("Common Ground", Dept of Finance, alpha — see [Government content is AI food](https://www.youtube.com/watch?v=X5UAWFl7-FE), APS Digital Profession Innovation Month, July 2026) does this at whole-of-government scale and routes real divergences to SES for resolution.

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

## State and territory Acts

When the graph also holds state or territory Acts (built with [lex-au-privacy](https://github.com/cchew/lex-au-privacy)), the API and UI adapt:

- Each definition carries `jurisdiction` (`Cth`, `NSW`, `Vic`, ...) and `scope`. `act_title` gains the jurisdiction for anything that is not Commonwealth ("Privacy and Data Protection Act 2014 (Vic)"), so same-named Acts are distinguishable in the cards and in the LLM comparison.
- `GET /definitions?term=...&include_local=true` (also `/definitions/quick`) adds meanings that apply only inside one section, Part or Division. The default is Act-wide meanings only. The UI shows a checkbox for this once the corpus has more than one jurisdiction, and labels such a card "local to ...".
- Duplicate-looking cards are tidied per Act: an internal pointer ("has the meaning given by section 5") is dropped when the Act has the real definition, and an "includes ..." supplement is merged into the "means ..." definition of the same section. Genuinely different meanings in different sections or Parts stay separate.
- `GET /stats` also returns `jurisdictions`; the page wording says "Commonwealth" for a Commonwealth-only corpus and "Australian" otherwise.
- Cards for non-Commonwealth Acts have no legislation.gov.au link.

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
act-alike serve
```

## Tests

    pytest

## Known limits

- A term returns `404 Not Found` if lex-au's extraction missed its definition upstream, not just if the term genuinely isn't defined anywhere. lex-au currently misses an estimated 46% of dictionary-style definitions where the defined term itself is bold/italic-formatted in the source DOCX - see [lex-au-graph's Known limits](https://github.com/cchew/lex-au-graph#known-limits-v072). A "no results" response does not mean the term is undefined in AU legislation, only that it isn't tagged in the corpus yet.

## Versions

- **v0.2.2** - Renamed repo/package/CLI/deploy identifiers from `term-comparison` to `act-alike` to match the public branding. No functional change.
- **v0.2.1** - Backlog round: grounding-flag caveat badge surfaced in the UI (was backend-log-only), "most divergent terms" sidebar list ranked by verified-difference/Act ratio, term-browser-toggle analytics event.
- **v0.2.0** - Growth features: lazy per-term LLM summary cache, Umami analytics (tour, search, citation clicks, feedback), shareable per-term permalinks, thumbs up/down feedback widget, footer version display. Reframed IM2026 as the project's origin, not its primary purpose.
- **v0.1.4** - IM2026 competition submission. Review fixes on the polish pass: stable-height corpus stats placeholder (fixes guided-tour first-highlight misalignment), "Legend:" label, browse panel no longer overflows the viewport with no search results.
- **v0.1.3** - Polish pass: guided first-visit tour, progressive quick/full results split, corpus-coverage warning banner, panel-style legend, sticky footer, build-pipeline diagram, GitHub repo link.
- **v0.1.2** - Trust/reliability pass: deterministic fallback summary, persistent disclaimer, "How this works" trust modal, e2e/a11y coverage.
- **v0.1.1** - Search UX pass: instructional copy, hidden-by-default term browser, flagship shortcuts, reflowing browse panel, verification fallback messaging.
- **v0.1.0** - First tagged release. Renamed "Act Alike". Corpus stats bar, term browser, quote-verified highlighting, citations, accessibility scan + fixes.

## License

MIT - see [LICENSE](LICENSE).
