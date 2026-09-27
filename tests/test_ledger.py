"""Verify review-credit identities and complete issue-list retrieval."""
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import reciprocity


def submission(number, author):
    return {"number": number, "user": {"login": author}, "labels": [{"name": "submission"}]}


def review(number, author, target):
    return {"number": number, "user": {"login": author, "type": "User"}, "labels": [{"name": "review"}],
            "body": f"### Submission issue number\n\n{target}\n\n### First pass, before reading the author's explanation\n\nA recorded finding.\n\n### What you did not check\n\nRuntime behaviour."}


class LedgerTests(unittest.TestCase):
    def test_first_submission_stays_free_when_later_submissions_owe_reviews(self):
        rows = [submission(3, "alice"), submission(1, "alice"), submission(2, "alice")]
        state = reciprocity.ledger(rows)["alice"]
        self.assertFalse(state["ok"])
        self.assertEqual(state["eligible_submissions"], [1])

    def test_review_unlocks_only_the_next_submission(self):
        rows = [submission(1, "alice"), submission(2, "alice"), submission(3, "alice"), submission(4, "bob"), review(5, "alice", 4)]
        self.assertEqual(reciprocity.ledger(rows)["alice"]["eligible_submissions"], [1, 2])

    def test_distinct_other_author_review_clears_second_submission(self):
        rows = [submission(1, "alice"), submission(2, "alice"), submission(3, "bob"), review(4, "alice", 3)]
        self.assertTrue(reciprocity.ledger(rows)["alice"]["ok"])

    def test_self_missing_and_duplicate_reviews_do_not_inflate_credit(self):
        rows = [submission(1, "Alice"), submission(2, "alice"), submission(3, "alice"), submission(4, "bob"),
                review(5, "alice", 1), review(6, "alice", 999), review(7, "alice", 4), review(8, "ALICE", 4)]
        state = reciprocity.ledger(rows)["alice"]
        self.assertEqual(state["reviews_given"], 1)
        self.assertFalse(state["ok"])

    def test_in_progress_bot_pull_request_and_empty_review_do_not_count(self):
        for variation in ("progress", "bot", "pull", "empty"):
            with self.subTest(variation=variation):
                item = review(4, "alice", 3)
                if variation == "progress": item["labels"].append({"name": "review-in-progress"})
                if variation == "bot": item["user"]["type"] = "Bot"
                if variation == "pull": item["pull_request"] = {}
                if variation == "empty": item["body"] = "### Submission issue number\n\n3"
                state = reciprocity.ledger([submission(1, "alice"), submission(2, "alice"), submission(3, "bob"), item])["alice"]
                self.assertEqual(state["reviews_given"], 0)

    def test_deleting_or_breaking_review_revokes_available_credit(self):
        rows = [submission(1, "alice"), submission(2, "alice"), submission(3, "bob")]
        self.assertFalse(reciprocity.ledger(rows)["alice"]["ok"])
        self.assertTrue(reciprocity.ledger(rows + [review(4, "alice", 3)])["alice"]["ok"])

    def test_pagination_retrieves_all_pages(self):
        batches = [io.BytesIO(json.dumps([submission(i, "alice") for i in range(100)]).encode()), io.BytesIO(b"[]")]
        with patch.object(reciprocity.urllib.request, "urlopen", side_effect=batches) as fetch:
            self.assertEqual(len(reciprocity.fetch_issues("owner/project", "fixture")), 100)
            self.assertEqual(fetch.call_count, 2)

    def test_failed_fetch_does_not_return_partial_ledger(self):
        with patch.object(reciprocity.urllib.request, "urlopen", side_effect=OSError("fixture refusal")):
            with self.assertRaises(OSError): reciprocity.fetch_issues("owner/project", "fixture")

    def test_invalid_repository_never_contacts_network(self):
        with patch.object(reciprocity.urllib.request, "urlopen") as fetch:
            for repo in ("owner/..", "owner/project/extra", "https://example.com"):
                with self.assertRaises(ValueError): reciprocity.fetch_issues(repo, "fixture")
            fetch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
