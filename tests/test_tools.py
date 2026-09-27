#!/usr/bin/env python3
"""Tests for the static pre-check and the review-credit rule."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import precheck  # noqa: E402
import reciprocity  # noqa: E402


def make_repo(files):
    tmp = tempfile.TemporaryDirectory()
    for rel, content in files.items():
        path = Path(tmp.name) / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            path.write_bytes(content)
        else:
            path.write_text(content, encoding="utf-8")
    return tmp


CLEAN = {"README.md": "# Demo\n", "LICENSE": "MIT\n", "app.py": "print('hi')\n",
         "tests/test_app.py": "def test_ok():\n    assert True\n", "data.json": '{"a": 1}'}


class PrecheckTests(unittest.TestCase):
    def run_check(self, files):
        tmp = make_repo(files)
        self.addCleanup(tmp.cleanup)
        return precheck.check(tmp.name)

    def test_clean_repo_passes_without_warnings(self):
        result = self.run_check(CLEAN)
        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["warnings"], [])

    def test_missing_readme_fails(self):
        files = dict(CLEAN)
        del files["README.md"]
        self.assertEqual(self.run_check(files)["status"], "fail")

    def test_missing_licence_and_tests_only_warn(self):
        result = self.run_check({"README.md": "# x\n", "app.py": "x = 1\n"})
        self.assertEqual(result["status"], "pass")
        self.assertIn("no licence file at the top level", result["warnings"])
        self.assertIn("no tests found", result["warnings"])

    def test_leaked_key_fails(self):
        files = dict(CLEAN, **{"config.py": "KEY = 'AKIA" + "ABCDEFGHIJKLMNOP'\n"})
        result = self.run_check(files)
        self.assertEqual(result["status"], "fail")
        self.assertTrue(any("AWS access key" in f for f in result["failures"]))

    def test_committed_env_file_fails(self):
        result = self.run_check(dict(CLEAN, **{".env": "TOKEN=abc\n"}))
        self.assertTrue(any("environment file" in f for f in result["failures"]))

    def test_python_syntax_error_fails(self):
        result = self.run_check(dict(CLEAN, **{"bad.py": "def broken(:\n"}))
        self.assertTrue(any("Python does not parse: bad.py" in f for f in result["failures"]))

    def test_bad_json_fails(self):
        result = self.run_check(dict(CLEAN, **{"bad.json": "{not json}"}))
        self.assertTrue(any("JSON does not parse: bad.json" in f for f in result["failures"]))

    def test_bidi_control_fails(self):
        result = self.run_check(dict(CLEAN, **{"trick.py": "x = 1  # \u202e hidden\n"}))
        self.assertTrue(any("text-direction" in f for f in result["failures"]))

    def test_symlink_is_not_followed(self):
        tmp = make_repo(CLEAN)
        self.addCleanup(tmp.cleanup)
        outside = make_repo({"secret.py": "KEY = 'AKIA" + "ABCDEFGHIJKLMNOP'\n"})
        self.addCleanup(outside.cleanup)
        (Path(tmp.name) / "link.py").symlink_to(Path(outside.name) / "secret.py")
        self.assertEqual(precheck.check(tmp.name)["status"], "pass")

    def test_git_directory_is_skipped(self):
        files = dict(CLEAN, **{".git/config": "token = ghp_" + "a" * 36 + "\n"})
        self.assertEqual(self.run_check(files)["status"], "pass")

    def test_tool_does_not_flag_itself(self):
        result = precheck.check(ROOT)
        self.assertFalse(any("text-direction" in f for f in result["failures"]), result["failures"])

    def test_command_line_exit_codes(self):
        tmp = make_repo(CLEAN)
        self.addCleanup(tmp.cleanup)
        ok = subprocess.run([sys.executable, str(ROOT / "tools/precheck.py"), tmp.name, "--json"],
                            capture_output=True, text=True)
        self.assertEqual(ok.returncode, 0)
        self.assertEqual(json.loads(ok.stdout)["status"], "pass")
        bad = subprocess.run([sys.executable, str(ROOT / "tools/precheck.py"), "/nonexistent/path"],
                             capture_output=True, text=True)
        self.assertEqual(bad.returncode, 2)


class CreditTests(unittest.TestCase):
    def test_first_submission_is_free(self):
        self.assertTrue(reciprocity.credit_status(1, 0)["ok"])

    def test_second_submission_needs_one_review(self):
        self.assertFalse(reciprocity.credit_status(2, 0)["ok"])
        self.assertTrue(reciprocity.credit_status(2, 1)["ok"])

    def test_balance_counts_owed_reviews(self):
        status = reciprocity.credit_status(4, 1)
        self.assertEqual(status["reviews_needed"], 3)
        self.assertEqual(status["balance"], -2)

    def test_negative_counts_rejected(self):
        with self.assertRaises(ValueError):
            reciprocity.credit_status(-1, 0)


class UrlTests(unittest.TestCase):
    def test_finds_repo_url_in_issue_form_body(self):
        body = "### Repository URL\n\nhttps://github.com/some-user/my.project\n\n### What it claims"
        self.assertEqual(reciprocity.parse_repo_url(body), "https://github.com/some-user/my.project")

    def test_strips_git_suffix(self):
        self.assertEqual(reciprocity.parse_repo_url("https://github.com/a/b.git\n"), "https://github.com/a/b")

    def test_rejects_non_github_and_shell_text(self):
        self.assertIsNone(reciprocity.parse_repo_url("https://gitlab.com/a/b"))
        self.assertIsNone(reciprocity.parse_repo_url("https://github.com/a/b;rm -rf /"))
        self.assertIsNone(reciprocity.parse_repo_url("https://github.com/a/..\n"))
        self.assertIsNone(reciprocity.parse_repo_url(""))


if __name__ == "__main__":
    unittest.main()
