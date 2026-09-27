# crossreview

Purpose: coordinate reciprocal reviews of projects made with AI.

Give a review, get a review. Projects stay in their own repositories; Crossreview helps authors find another perspective and keeps the claims, findings and limits visible.

Think your project works, or could work, but have no one to ask? Crossreview is for people building and reviewing with AI who are willing to ask for help and receive critique, or exchange solutions.

Bring a research protocol, an analysis, a tool, a design or another project made with AI. State what kind of review would help. A review is another person's assessment, not a guarantee of correctness or safety, and submitting does not guarantee a reviewer.

You do not have to be an expert. If you have experience in a domain, share it. A mathematician's project may need a lawyer's perspective; a chess player's project may need a visual designer; an astrophysicist's project may need a medical professional. Review within what you can assess, and say where your knowledge ends.

The aim is to ground AI-assisted work in evidence, help it deliver something useful, and reduce sycophancy: agreement that leaves weak claims unchallenged.

## Look for an existing solution first

Ask your agent to search [GitHub repositories](https://github.com/search?type=repositories) and [Hugging Face Spaces](https://huggingface.co/spaces), plus [models](https://huggingface.co/models) or [datasets](https://huggingface.co/datasets) where relevant. What you need may already exist.

Ask for links to the closest matches, what they do, and where they fall short of your needs. Read their documentation, licence and available evidence before deciding whether to use, adapt or build. Finding a suitable tool may save you a new build or a review submission. A search match alone does not establish that a tool works, and an unsuccessful search does not prove an idea is new.

## Not a coder?

Neither am I. Give this prompt to your agent to help you take part:

```text
Help me take part in Crossreview. Read the current README and review rubric at
https://github.com/NMAIResearch/crossreview, then the relevant issue form.
Ask whether I want to submit my project or review someone else's, and ask for
the public repository link. Explain the steps in plain language.

Before suggesting new work, search GitHub repositories and Hugging Face Spaces,
models or datasets for existing ideas and tools that might meet my needs.
Show the closest matches with links, relevant documentation, licence terms and
the gaps that remain. Distinguish what you found from what you actually tested.
If an existing solution appears sufficient, ask whether I want to use or adapt
it instead of building or submitting something new. Do not claim novelty just
because a search found nothing.

If I am submitting, help me describe what the project does, its claims, the AI
tools used, known problems, and the kind of review I need. Ask about my domain
only if it would help; sharing experience is optional.

If I am reviewing, use the rubric and support findings with file locations or
quotes. Separate what you inspected, what you tested, and what remains unknown.
Do not run unfamiliar project code without explaining it and asking me first.
If you helped create the project, say so and help me find a separate reviewer.

Keep credentials and private material out of public drafts. Prepare the issue
or review for me to read. Ask before posting, uploading or changing anything.
```

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

## Review steps

Use these checks alongside [the rubric](RUBRIC.md), preserving its first-pass review before reading the author's reasoning or earlier reviews. These are reviewer judgements, not extra automatic passes.

1. **Purpose and behaviour.** What is the project supposed to do, and what does the submitted version actually do? Compare its stated purpose with files, examples and observed behaviour. Name the commit reviewed.
2. **Evidence.** Is evidence present, and is it sufficient for each claim? Follow citations to the source and explain what they support. Keep observation and inference separate; a matching quote is not enough by itself.
3. **Reproducibility.** Are the inputs, dependencies, commands and expected results documented? If a run is safe and practical, compare the result with the claim. Otherwise state what prevented it. Reading a script is not reproducing its result.
4. **Existing work and added value.** Search for the closest alternatives and compare against a simple existing approach. What does this project add, improve or make easier for its intended users? Useful adaptation is welcome. State the search scope and any comparison you did not run; novelty requires evidence.
5. **Limits and next action.** Name failures, missing checks and any safety, privacy or licence concerns within the scope you assessed. Recommend a concrete next step: use an existing solution, clarify a claim, add evidence, repair a problem or seek another domain's review. A limited review is not a general assurance.

For each step, record what you checked, the evidence, unresolved questions and anything not checked. Use the rubric's verdicts for individual claims; neither the checklist nor the credit ledger decides the substantive result.

## Development

Python standard library and Node are sufficient for the local tests:

```sh
python3 -B -W error::ResourceWarning -m unittest discover -s tests -v
node tests/test_review_board.cjs
node tests/test_workflows.cjs
node tests/test_branching_field.cjs
```

The static site is in `docs/`. GitHub Pages serves that directory; issue forms and Actions provide the exchange. Repository setting and labels are listed in [SETUP.md](SETUP.md).

## Attribution and licence

Created by NM AI Research with AI-assisted design and implementation. The author makes release and moderation decisions. Software is MIT licensed; media has its own attribution and terms in [docs/media/README.md](docs/media/README.md).
