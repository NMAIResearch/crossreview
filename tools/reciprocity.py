#!/usr/bin/env python3
"""Review-credit rule: the first submission is free; each later one needs one review given.

Library use: credit_status(submissions, reviews_given) and parse_repo_url(issue_body).

Command use, inside a GitHub Action:
  reciprocity.py AUTHOR
Reads GITHUB_REPOSITORY and GITHUB_TOKEN from the environment, counts the author's
issues labelled "submission" and "review", and prints JSON with the decision.
"""

import json
import os
import re
import sys
import urllib.parse
import urllib.request

FREE_SUBMISSIONS = 1
REPO_URL_RE = re.compile(r"https://github\.com/([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100})(?:\.git)?/?(?=\s|$)")
LOGIN_RE = re.compile(r"^[A-Za-z0-9-]{1,39}$")
REPOSITORY_RE = re.compile(r"^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$")


def credit_status(submissions, reviews_given, free=FREE_SUBMISSIONS):
    """Return the credit decision for an author, counting the submission being checked."""
    if submissions < 0 or reviews_given < 0:
        raise ValueError("counts cannot be negative")
    needed = max(0, submissions - free)
    balance = reviews_given - needed
    return {"submissions": submissions, "reviews_given": reviews_given, "free": free,
            "reviews_needed": needed, "balance": balance, "ok": balance >= 0}


def parse_repo_url(body):
    """Return the first public GitHub repository URL in an issue body, or None."""
    if not body:
        return None
    match = REPO_URL_RE.search(body)
    if not match:
        return None
    owner, name = match.group(1), match.group(2)
    if name.endswith(".git"):
        name = name[:-4]
    if name in {".", ".."}:
        return None
    return f"https://github.com/{owner}/{name}"


def issue_field(body, label):
    """Read one GitHub issue-form field without interpreting its content."""
    for section in str(body or "").split("\n### "):
        heading, separator, value = section.removeprefix("### ").partition("\n")
        if separator and heading.strip() == label:
            value = value.strip()
            return "" if value == "_No response_" else value
    return ""


def labels_of(issue):
    return {label if isinstance(label, str) else label.get("name")
            for label in issue.get("labels", [])}


def ledger(issues):
    """Count distinct, linked reviews of other authors; content quality remains manual."""
    submissions = {item["number"]: item for item in issues
                   if "pull_request" not in item and "submission" in labels_of(item)}
    authored, reviewed = {}, {}
    for item in submissions.values():
        author = item.get("user", {}).get("login", "").lower()
        authored.setdefault(author, []).append(item["number"])
    for item in issues:
        if "pull_request" in item or "review" not in labels_of(item) or "review-in-progress" in labels_of(item):
            continue
        user = item.get("user", {})
        author = user.get("login", "").lower()
        if user.get("type") == "Bot" or not LOGIN_RE.fullmatch(author):
            continue
        reference = issue_field(item.get("body"), "Submission issue number").removeprefix("#")
        if not re.fullmatch(r"[1-9][0-9]{0,14}", reference):
            continue
        target = submissions.get(int(reference))
        if not target or target.get("user", {}).get("login", "").lower() == author:
            continue
        if not issue_field(item.get("body"), "First pass, before reading the author's explanation"):
            continue
        if not issue_field(item.get("body"), "What you did not check"):
            continue
        reviewed.setdefault(author, set()).add(int(reference))
    result = {}
    for author, numbers in authored.items():
        numbers.sort()
        given = len(reviewed.get(author, set()))
        state = credit_status(len(numbers), given)
        state["eligible_submissions"] = numbers[:FREE_SUBMISSIONS + given]
        result[author] = state
    return result


def fetch_issues(repo, token):
    """Read the complete issue inventory or fail without issuing a partial ledger."""
    if not REPOSITORY_RE.fullmatch(repo) or repo.split("/")[1] in {".", ".."}:
        raise ValueError("invalid GitHub repository")
    result = []
    for page in range(1, 101):
        url = f"https://api.github.com/repos/{repo}/issues?state=all&per_page=100&page={page}"
        request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json",
                                                       "Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(request, timeout=30) as response:
            items = json.load(response)
        if not isinstance(items, list):
            raise ValueError("unexpected GitHub issue response")
        result.extend(items)
        if len(items) < 100:
            return result
    raise ValueError("issue inventory exceeded the complete-read limit")


def count_issues(repo, token, author, label):
    query = f"repo:{repo} is:issue author:{author} label:{label}"
    url = "https://api.github.com/search/issues?" + urllib.parse.urlencode({"q": query, "per_page": 1})
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json",
                                                   "Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return int(json.load(response)["total_count"])


def main(argv):
    if len(argv) == 2 and argv[1] == "--ledger":
        repo, token = os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_TOKEN")
        if not repo or not token:
            print("GITHUB_REPOSITORY and GITHUB_TOKEN are required", file=sys.stderr)
            return 2
        print(json.dumps(ledger(fetch_issues(repo, token))))
        return 0
    if len(argv) != 2 or not LOGIN_RE.match(argv[1]):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    repo, token = os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_TOKEN")
    if not repo or not token:
        print("GITHUB_REPOSITORY and GITHUB_TOKEN are required", file=sys.stderr)
        return 2
    author = argv[1]
    status = ledger(fetch_issues(repo, token)).get(author.lower(), credit_status(0, 0))
    print(json.dumps(status))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
