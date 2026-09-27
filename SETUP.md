# Repository setup

Purpose: document the GitHub settings required by the review exchange.

Repository: NMAIResearch/crossreview. Enable public Issues, Actions and Pages. Serve Pages from main /docs.

Create these labels before opening the forms: submission, review, review-in-progress, precheck-pending, precheck-passed, precheck-failed, credit-cleared, credit-pending, needs-review-credit.

The workflows use the repository-scoped GITHUB_TOKEN with contents:read and issues:write. Submitted repository code is never executed. Keep checkout credentials unpersisted and the LFS-smudge and hooks protections in the clone step.

After an operational outage, rerun the review-credit workflow manually. Edit or reopen a submission to rerun its pre-check. Test the actual hosted forms, labels and queue after deployment; local fixture checks do not establish live GitHub integration.
