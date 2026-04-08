#!/usr/bin/env -S uv run --script

from __future__ import annotations

import argparse
import json
import random
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import quote

ENCODING = "cp1252"
DEFAULT_SOURCE = Path(__file__).with_name("jargon-file.org") / "jargon-4.4.7.dos.txt"
DEFAULT_OUTPUT = Path(__file__).with_name("build") / "jargon-4.4.7.json"
LEXICON_START_MARKER = "Glossary\n\n"
LEXICON_END_MARKER = "\nAppendices\n"
ENTRY_RE = re.compile(r"^:([^\n:]+):(.*)$", re.MULTILINE)


@dataclass(slots=True)
class Entry:
    headword: str
    url_key: str
    header: str
    body: str
    body_raw: str
    line_start: int


def read_source(path: Path) -> str:
    return path.read_text(encoding=ENCODING)


def extract_lexicon(text: str) -> tuple[str, int]:
    start = text.find(LEXICON_START_MARKER)
    if start == -1:
        raise ValueError("Could not find glossary start marker in jargon file.")
    end = text.find(LEXICON_END_MARKER, start)
    if end == -1:
        raise ValueError("Could not find glossary end marker in jargon file.")
    return text[start:end], start


def _normalize_lines(block: str) -> list[str]:
    lines = []
    for line in block.splitlines():
        cleaned = line.rstrip()
        if cleaned.startswith("   "):
            cleaned = cleaned[3:]
        lines.append(cleaned)
    return lines


def normalize_body(block: str) -> str:
    paragraphs: list[str] = []
    current: list[str] = []

    for line in _normalize_lines(block):
        stripped = line.strip()
        if not stripped:
            if current:
                paragraphs.append(re.sub(r"[ \t]+", " ", " ".join(current)).strip())
                current = []
            continue
        current.append(stripped)

    if current:
        paragraphs.append(re.sub(r"[ \t]+", " ", " ".join(current)).strip())

    return "\n\n".join(paragraphs)


def raw_body(block: str) -> str:
    return "\n".join(_normalize_lines(block)).strip()


def parse_entries(text: str) -> list[Entry]:
    lexicon, lexicon_offset = extract_lexicon(text)
    matches = list(ENTRY_RE.finditer(lexicon))
    if not matches:
        raise ValueError("Could not find any lexicon entries in jargon file.")

    entries: list[Entry] = []
    for index, match in enumerate(matches):
        body_start = match.end()
        body_end = matches[index + 1].start() if index + 1 < len(matches) else len(lexicon)
        entry_body_block = lexicon[body_start:body_end].strip("\n")
        entries.append(
            Entry(
                headword=match.group(1).strip(),
                url_key=quote(match.group(1).strip(), safe=""),
                header=match.group(2).strip(),
                body=normalize_body(entry_body_block),
                body_raw=raw_body(entry_body_block),
                line_start=text.count("\n", 0, lexicon_offset + match.start()) + 1,
            )
        )
    return entries


def build_document(entries: list[Entry], source: Path) -> dict:
    return {
        "version": "4.4.7",
        "source_file": source.name,
        "entry_count": len(entries),
        "entries": [asdict(entry) for entry in entries],
    }


def load_entries(source: Path) -> list[Entry]:
    return parse_entries(read_source(source))


def search_entries(entries: list[Entry], query: str, limit: int) -> list[Entry]:
    needle = query.casefold()
    scored: list[tuple[int, Entry]] = []

    for entry in entries:
        headword = entry.headword.casefold()
        haystack = f"{entry.headword}\n{entry.header}\n{entry.body}".casefold()
        if needle == headword:
            score = 0
        elif needle in headword:
            score = 1
        elif needle in haystack:
            score = 2
        else:
            continue
        scored.append((score, entry))

    scored.sort(key=lambda item: (item[0], item[1].headword.casefold()))
    return [entry for _, entry in scored[:limit]]


def format_entry(entry: Entry) -> str:
    parts = [entry.headword]
    if entry.header:
        parts.append(entry.header)
    if entry.body:
        parts.append("")
        parts.append(entry.body)
    return "\n".join(parts)


def command_build(args: argparse.Namespace) -> int:
    entries = load_entries(args.source)
    document = build_document(entries, args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {document['entry_count']} entries to {args.output}")
    return 0


def command_search(args: argparse.Namespace) -> int:
    entries = load_entries(args.source)
    matches = search_entries(entries, args.query, args.limit)
    if not matches:
        print(f"No matches for {args.query!r}.")
        return 1

    for index, entry in enumerate(matches):
        if index:
            print("\n" + ("-" * 72) + "\n")
        print(format_entry(entry))
    return 0


def command_random(args: argparse.Namespace) -> int:
    entries = load_entries(args.source)
    rng = random.Random(args.seed)
    print(format_entry(rng.choice(entries)))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Parse and query the Jargon File 4.4.7."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    build_parser = subparsers.add_parser(
        "build",
        help="Parse jargon-4.4.7.dos.txt and write a JSON export.",
    )
    build_parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    build_parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    build_parser.set_defaults(func=command_build)

    search_parser = subparsers.add_parser(
        "search",
        help="Search the parsed entries by headword or body text.",
    )
    search_parser.add_argument("query")
    search_parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    search_parser.add_argument("--limit", type=int, default=5)
    search_parser.set_defaults(func=command_search)

    random_parser = subparsers.add_parser(
        "random",
        help="Print a random jargon entry.",
    )
    random_parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    random_parser.add_argument("--seed", type=int)
    random_parser.set_defaults(func=command_random)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
