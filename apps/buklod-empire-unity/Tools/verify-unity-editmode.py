#!/usr/bin/env python3
"""Validate Unity NUnit XML without allowing empty/skipped/failed test runs."""
import argparse, pathlib, xml.etree.ElementTree as ET, json

def validate(path):
    p=pathlib.Path(path)
    if not p.is_file() or p.stat().st_size>32*1024*1024:
        raise ValueError("Missing or oversized Unity result")
    root=ET.parse(p).getroot()
    if root.tag!="test-run" or root.get("result")!="Passed":
        raise ValueError("Unity test run did not pass")
    rows=list(root.iter("test-case"))
    if not rows or any(row.get("result")!="Passed" for row in rows):
        raise ValueError("Empty, failed, skipped or inconclusive test run")
    counts={k:int(root.get(k,"-1")) for k in ("total","passed","failed","skipped","inconclusive")}
    if counts["total"]!=len(rows) or counts["passed"]!=len(rows) or any(counts[k]!=0 for k in ("failed","skipped","inconclusive")):
        raise ValueError("Inconsistent Unity test counts")
    if not any("LocalPracticeStoreTests" in row.get("fullname","") for row in rows):
        raise ValueError("Mandatory local practice tests absent")
    if not any("OfflineMatchRulesTests" in row.get("fullname","") for row in rows):
        raise ValueError("Mandatory offline gameplay tests absent")
    return counts
if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("result");args=parser.parse_args()
    print("BUKLOD_EDITMODE_PASS",json.dumps(validate(args.result),sort_keys=True))
