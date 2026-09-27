# Review rubric

Purpose: guide evidence-based peer review of projects made with AI.

Use this for every review. It is short on purpose.

## Choose a project

Choosing something in your domain is encouraged, but optional. An outside perspective can be useful too. State what you can assess and what you cannot.

Open a "Start a review" issue with the submission number so others can see who has picked it up. Multiple reviewers are welcome. Close that notice when you post your review or stop working on it; the notice itself earns no credit.

You may describe your relevant domain experience in the review form. Readers can use that context when assessing your opinion, alongside the evidence and limits of the review. It is self-described, not a verified qualification or an automatic weight.

## Match the review to the work

Agree on a bounded question and name the version reviewed. State what evidence would be needed to answer it.

- **Research protocol:** does the proposed method answer the question? Check the population, definitions, planned analysis, access to evidence, uncertainty and stopping conditions. A protocol describes a plan; do not score it as though results already exist.
- **Research findings:** do the sources support the claims, do definitions and periods match, and can the stated calculations be reproduced?
- **Software or a tool:** does the documented behaviour match what you can inspect or safely test? Name the tested environment and untested paths.
- **Design or another artefact:** assess its stated purpose and audience. Distinguish observed problems from personal preferences.

Use the [review steps](README.md#review-steps) for evidence, reproducibility, existing alternatives and limits. If the work needs expertise you do not have, say so. A scoped peer review is not professional certification.

## Before you read the author's explanation

1. Open the repository and its sources first.
2. For each claim listed in the submission, record your own finding before reading the author's reasoning, known issues or earlier reviews. Save that first pass as your first comment. If the claim or evidence already exposed the proposed conclusion, record that exposure; do not call the review blind.
3. Only then read the rest, and add anything that changes as a separate note.

## For each claim

Give one verdict:

- **supported**: the repository or a cited source shows it, and you quote the words or give the file and line.
- **partly supported**: some of it holds; say which part does not.
- **not supported**: you looked and could not find support; say where you looked.
- **contradicted**: something in the repository or a source says otherwise; quote it.
- **not checked**: you did not get to it; say why.

A quote that matches only proves the words exist. Say whether it supports every part of the claim.

## Then

- **Blocking problems**: anything that makes the project unsafe or its main claim false.
- **Other problems**: worth fixing, not blocking.
- **What you did not check.**
- **Tools you used**, including any AI and its vendor.

## Keep the status

If you summarise another review, keep its verdicts. "Reviewed" is not a verdict.
