"""
Update resin profile JSON files from an XML config.

Usage:
    python scripts/update_resin_profiles.py <xml_path> [--dry-run]

The script reads printer profiles from the XML, maps each XML printer name
to an existing JSON file, then overwrites that file with the new data.
Printers in the XML that have no mapping are skipped (with a warning).

Printer-name mapping notes
--------------------------
XML printer names map to matching JSON printer profiles, except
"Sonic LS+ Standard Plate", which is stored as "Sonic LS+".
"""

import json
import os
import sys
from pathlib import Path

# Allow importing parsing helpers from sibling script
sys.path.insert(0, str(Path(__file__).parent))
from generate_resin_profiles import (  # noqa: E402
    parse_resin_config,
    get_text,
)
from xml.etree import ElementTree as ET

PROFILES_DIR = Path(__file__).parent.parent / "src" / "data" / "resin_profiles"

# Maps XML <PrinterName> → [(json_file_stem, display_printer_name), ...]
# display_printer_name is the value stored in the JSON's top-level "printer_name"
# field (and overrides each profile's printer_name when it differs from XML).
PRINTER_MAP: dict[str, list[tuple[str, str]]] = {
    "Sonic XL 4K 2022": [
        ("sonic_xl_4k_2022", "Sonic XL 4K 2022"),
    ],
    "Sonic 4K 2022": [
        ("sonic_4k_2022", "Sonic 4K 2022"),
    ],
    "Sonic XL 4K": [
        ("sonic_xl_4k", "Sonic XL 4K"),
    ],
    "Lumii DLP 2K": [
        ("lumii_dlp_2k", "Lumii DLP 2K"),
    ],
    "Lumii DLP 2K Mini Plate": [
        ("lumii_dlp_2k_mini_plate", "Lumii DLP 2K Mini Plate"),
    ],
    "Sonic XL 4K Plus": [
        ("sonic_xl_4k_plus", "Sonic XL 4K Plus"),
    ],
    "Sonic CS+": [
        ("sonic_cs_plus", "Sonic CS+"),
    ],
    "Sonic CS+ Mini Plate": [
        ("sonic_cs_plus_mini_plate", "Sonic CS+ Mini Plate"),
    ],
    "Sonic LS+ Large Plate": [
        ("sonic_ls_plus_large_plate", "Sonic LS+ Large Plate"),
    ],
    # XML Standard Plate is the source for the existing Sonic LS+ profile.
    "Sonic LS+ Standard Plate": [
        ("sonic_ls_plus", "Sonic LS+"),
    ],
}

SKIP_PRINTERS = {}


def load_xml(xml_path: str) -> ET.Element:
    with open(xml_path, "rb") as f:
        data = f.read()
    return ET.fromstring(data)


def parse_xml_printers(root: ET.Element) -> dict[str, list[dict]]:
    """Return {xml_printer_name: [profile_dict, ...]}."""
    printing_params = root.find("PrintingParameters")
    if printing_params is None:
        raise RuntimeError("Missing <PrintingParameters> in XML")
    grouped: dict[str, list[dict]] = {}
    for pc_el in printing_params.findall("PrinterConfig"):
        for rc_el in pc_el.findall("ResinConfig"):
            profile = parse_resin_config(rc_el)
            xml_name = profile.get("printer_name") or "Unknown"
            grouped.setdefault(xml_name, []).append(profile)
    return grouped


def write_printer_file(
    file_path: Path,
    display_name: str,
    profiles: list[dict],
    dry_run: bool,
) -> None:
    # Normalise printer_name inside each profile to match the display name
    for p in profiles:
        p["printer_name"] = display_name

    payload = {"printer_name": display_name, "profiles": profiles}

    if dry_run:
        print(f"  [dry-run] would write {len(profiles)} profiles → {file_path.name}")
        return

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"  wrote {len(profiles)} profiles → {file_path.name}")


def update_index(
    profiles_dir: Path,
    dry_run: bool,
    allowed_slugs: set[str] | None = None,
) -> None:
    index_path = profiles_dir / "index.json"
    try:
        existing_index = json.loads(index_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        existing_index = {}

    index = {} if allowed_slugs is not None else dict(existing_index)
    for json_file in sorted(profiles_dir.glob("*.json")):
        if json_file.name == "index.json":
            continue
        if allowed_slugs is not None and json_file.stem not in allowed_slugs:
            continue
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
        except Exception:
            continue
        printer_name = data.get("printer_name")
        profiles = data.get("profiles", [])
        if not printer_name:
            continue
        entry = {
            "slug": json_file.stem,
            "file": json_file.name,
            "profile_count": len(profiles),
        }
        index[printer_name] = entry

    if list(index.items()) == list(existing_index.items()):
        print("  index.json unchanged")
        return

    if dry_run:
        print("  [dry-run] would update index.json")
        return

    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print("  updated index.json")


def main() -> None:
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    args = [a for a in args if not a.startswith("--")]

    if not args:
        print("Usage: python scripts/update_resin_profiles.py <xml_path> [--dry-run]")
        sys.exit(1)

    xml_path = args[0]
    print(f"Parsing {xml_path} …")
    root = load_xml(xml_path)
    grouped = parse_xml_printers(root)

    print(f"Found {len(grouped)} printer group(s) in XML\n")

    for xml_name, profiles in grouped.items():
        mappings = PRINTER_MAP.get(xml_name)
        if mappings is None:
            skip_reason = SKIP_PRINTERS.get(xml_name)
            if skip_reason:
                print(f"  SKIP  {xml_name!r} — {skip_reason} ({len(profiles)} profiles)")
                continue
            print(f"  SKIP  {xml_name!r} — no mapping defined ({len(profiles)} profiles)")
            continue

        for slug, display_name in mappings:
            file_path = PROFILES_DIR / f"{slug}.json"
            print(f"  {xml_name!r} → {file_path.name} ({len(profiles)} profiles)")
            write_printer_file(file_path, display_name, profiles, dry_run)

    print("\nUpdating index.json …")
    allowed_slugs = {slug for mappings in PRINTER_MAP.values() for slug, _ in mappings}
    update_index(PROFILES_DIR, dry_run, allowed_slugs)
    print("\nDone.")


if __name__ == "__main__":
    main()
