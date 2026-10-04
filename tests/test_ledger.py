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


def review(number, author, target, report_type="Human report"):
    return {"number": number, "user": {"login": author, "type": "User"}, "labels": [{"name": "review"}],
            "body": f"### Submission issue number\n\n{target}\n\n### First pass, before reading the author's explanation\n\nA recorded finding.\n\n### What you did not check\n\nRuntime behaviour.\n\n### Supporting report type\n\n{report_type}\n\n### Supporting report\n\nA recorded account."}


class LedgerTests(unittest.TestCase):
    def test_final_report_preserves_markdown_headings(self):
        for report in ("### What I checked\n\nI read the README.",
                       "I read the README.\n\n### Evidence\n\nREADME.md, introduction."):
            with self.subTest(report=report):
                item = review(2, "reader", 1)
                item["body"] = item["body"].split("### Supporting report\n", 1)[0] + "### Supporting report\n\n" + report
                self.assertEqual(reciprocity.issue_field(item["body"], "Supporting report", final=True), report)
                self.assertEqual(reciprocity.ledger([submission(1, "maker"), submission(3, "reader"), item])["reader"]["reviews_given"], 1)

    def test_final_report_still_rejects_empty_and_no_response(self):
        for report in ("", " \n ", "_No response_"):
            with self.subTest(report=report):
                item = review(2, "reader", 1)
                item["body"] = item["body"].split("### Supporting report\n", 1)[0] + "### Supporting report\n\n" + report
                self.assertEqual(reciprocity.issue_field(item["body"], "Supporting report", final=True), "")
                self.assertEqual(reciprocity.ledger([submission(1, "maker"), submission(3, "reader"), item])["reader"]["reviews_given"], 0)

    def test_one_report_of_either_type_is_sufficient(self):
        for report_type in ("Human report", "Agent report"):
            with self.subTest(report_type=report_type):
                rows = [submission(1, "alice"), submission(2, "alice"), submission(3, "bob"),
                        review(4, "alice", 3, report_type)]
                state = reciprocity.ledger(rows)["alice"]
                self.assertEqual(state["reviews_given"], 1)
                self.assertEqual(state["eligible_submissions"], [1, 2])

    def test_missing_unknown_or_empty_report_does_not_earn_credit(self):
        for variation in ("missing_type", "unknown_type", "missing_report", "empty_report"):
            with self.subTest(variation=variation):
                item = review(4, "alice", 3)
                if variation == "missing_type":
                    item["body"] = item["body"].replace("Human report", "_No response_")
                if variation == "unknown_type":
                    item["body"] = item["body"].replace("Human report", "Other report")
                if variation == "missing_report":
                    item["body"] = item["body"].split("### Supporting report\n")[0]
                if variation == "empty_report":
                    item["body"] = item["body"].replace("A recorded account.", "_No response_")
                state = reciprocity.ledger([submission(1, "alice"), submission(2, "alice"),
                                            submission(3, "bob"), item])["alice"]
                self.assertEqual(state["reviews_given"], 0)

    def test_both_report_types_for_one_submission_still_earn_one_credit(self):
        rows = [submission(1, "alice"), submission(2, "alice"), submission(3, "bob"),
                review(4, "alice", 3, "Human report"), review(5, "alice", 3, "Agent report")]
        state = reciprocity.ledger(rows)["alice"]
        self.assertEqual(state["reviews_given"], 1)

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
