# crossreview

Purpose: coordinate reciprocal reviews of projects made with AI.

Give a review, get a review. Projects stay in their own repositories; Crossreview helps authors find another perspective and keeps the claims, findings and limits visible.

## Take part

1. Open a [submission](https://github.com/NMAIResearch/crossreview/issues/new?template=submit-work.yml) with its public repository, claims, AI tools and known problems. Project domain is optional.
2. The static pre-check reads a cloned snapshot without running submitted code. The public queue shows submissions after the pre-check and review-credit checks clear.
3. Pick a project in your domain if you can. This is optional; outside perspectives are welcome. Open a [Start a review](https://github.com/NMAIResearch/crossreview/issues/new?template=start-review.yml) notice so others know you have picked it up. Multiple reviewers may participate.
4. Follow [the rubric](RUBRIC.md), then post your review and close the start notice. You may describe your domain experience; it is self-described context, not a verified credential or an automatic weight.

## Review credit

Your first submission is free. Each later submission needs a review of another author's submission. Submission places are allocated in issue-number order, including closed submissions. Duplicate reviews of the same submission earn one credit, and an in-progress notice earns none. The automatic ledger checks links and required fields. Review quality and abuse require human judgement; a mechanically complete review is not an endorsement.

The board counts distinct GitHub reviewer accounts with open review notices. This is declared activity, not proof that work is underway. Missing or incomplete API data is shown as unavailable. All issue forms, reviews and notices are public on GitHub.

## What the checks cover

The pre-check looks for a README, licence, tests, selected credential patterns, Python/JSON parse errors and hidden text-direction characters. It reports skipped files and size limits. It does not run submitted code, inspect LFS content, establish security or privacy, or judge whether claims are correct. The result applies to the recorded commit; later repository changes require another check.

Credit and pre-check labels are refreshed by GitHub Actions. API failures cannot establish a new pass. Maintainers can investigate and moderate suspicious submissions and reviews. No automated reviewer decides the substantive verdict.

## Development

Python standard library and Node are sufficient for the local tests:

```sh
python3 -B -W error::ResourceWarning -m unittest discover -s tests -v
node tests/test_review_board.cjs
node tests/test_workflows.cjs
```

The static site is in `docs/`. GitHub Pages serves that directory; issue forms and Actions provide the exchange. Repository setting and labels are listed in [SETUP.md](SETUP.md).

## Attribution and licence

Created by NM AI Research with AI-assisted design and implementation. The author makes release and moderation decisions. Software is MIT licensed; media has its own attribution and terms in [docs/media/README.md](docs/media/README.md).
