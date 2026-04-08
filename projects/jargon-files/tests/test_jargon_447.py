from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
SCRIPT = PROJECT_DIR / "jargon_447.py"
SOURCE = PROJECT_DIR / "jargon-file.org" / "jargon-4.4.7.dos.txt"

sys.path.insert(0, str(PROJECT_DIR))
import jargon_447  # noqa: E402


class Jargon447Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = SOURCE.read_text(encoding="cp1252")
        cls.entries = jargon_447.parse_entries(cls.text)

    def test_entry_count_matches_revision_history(self) -> None:
        self.assertEqual(len(self.entries), 2308)

    def test_first_and_last_entries_are_stable(self) -> None:
        self.assertEqual(self.entries[0].headword, "(TM)")
        self.assertEqual(self.entries[-1].headword, "zorkmid")

    def test_automagically_is_parsed_cleanly(self) -> None:
        entry = next(entry for entry in self.entries if entry.headword == "automagically")
        self.assertEqual(entry.header, "/aw·toh·maj´i·klee/, adv.")
        self.assertIn("Automatically, but in a way", entry.body)
        self.assertIn("C-INTERCAL compiler generates C", entry.body)

    def test_last_entry_does_not_run_into_appendix(self) -> None:
        entry = self.entries[-1]
        self.assertIn("canonical unit of currency", entry.body)
        self.assertNotIn("Appendix A. Hacker Folklore", entry.body)

    def test_build_command_writes_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            output = Path(tmpdir) / "jargon-4.4.7.json"
            subprocess.run(
                [sys.executable, str(SCRIPT), "build", "--output", str(output)],
                check=True,
                cwd=PROJECT_DIR.parents[2],
            )
            document = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(document["version"], "4.4.7")
        self.assertEqual(document["entry_count"], 2308)
        self.assertEqual(document["entries"][0]["headword"], "(TM)")


if __name__ == "__main__":
    unittest.main()
