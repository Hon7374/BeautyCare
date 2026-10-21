#!/usr/bin/env python3
"""Fail-closed policy gate for Semgrep JSON and scan-scope evidence."""

import argparse
import json
import sys
from pathlib import Path


SCHEMA = "semgrep-json-gate/v2"


def normalize_path(value):
    return str(value).replace("\\", "/").lstrip("./")


def load_json(path, label):
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle), []
    except FileNotFoundError:
        return None, [f"{label} file does not exist: {path}"]
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        return None, [f"cannot parse {label}: {error}"]


def load_expected_scope(path):
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return None, [f"expected scope file does not exist: {path}"]
    except (OSError, UnicodeDecodeError) as error:
        return None, [f"cannot read expected scope file: {error}"]

    values = [normalize_path(line.strip()) for line in lines if line.strip()]
    if not values:
        return set(), ["expected scope is empty"]
    if any(value.startswith("../") or value == ".." for value in values):
        return None, ["expected scope contains a path outside the repository"]
    if len(values) != len(set(values)):
        return None, ["expected scope contains duplicate targets"]
    return set(values), []


def validate_configuration(path, expected_ruleset, expected_scope_path):
    payload, issues = load_json(path, "Semgrep invocation metadata")
    if issues:
        return None, issues
    if not isinstance(payload, dict):
        return None, ["Semgrep invocation metadata must be an object"]
    ruleset = payload.get("ruleset")
    if not isinstance(ruleset, str) or not ruleset.strip():
        return None, ["Semgrep invocation metadata has no valid ruleset"]
    if expected_ruleset and ruleset != expected_ruleset:
        return None, [f"ruleset mismatch: expected {expected_ruleset}, got {ruleset}"]
    scope_file = payload.get("scope_file")
    if not isinstance(scope_file, str) or not scope_file.strip():
        return None, ["Semgrep invocation metadata has no valid scope_file"]
    declared_scope = normalize_path(scope_file)
    allowed_scope_names = {
        normalize_path(expected_scope_path.name),
        normalize_path(str(expected_scope_path)),
    }
    if declared_scope not in allowed_scope_names:
        return None, [f"scope file mismatch: expected {expected_scope_path.name}, got {scope_file}"]
    return payload, []


def summary_for_payload(payload, source_path, expected_scope=None, configuration=None, scope_issues=None, config_issues=None):
    issues = list(scope_issues or []) + list(config_issues or [])
    if not isinstance(payload, dict):
        issues.append("top-level JSON value is not an object")
        status = "INCONCLUSIVE" if any(
            "cannot parse" in issue or "does not exist" in issue or "cannot read" in issue
            for issue in issues
        ) else "INVALID_EVIDENCE"
        return {
            "schema": SCHEMA,
            "source": str(source_path),
            "status": status,
            "gate_passed": False,
            "issues": issues,
        }

    results = payload.get("results")
    errors = payload.get("errors")
    paths = payload.get("paths")
    timing = payload.get("time")
    skipped_rules = payload.get("skipped_rules")
    version = payload.get("version")

    if not isinstance(results, list) or any(not isinstance(item, dict) for item in results):
        issues.append("missing or invalid results array")
    if not isinstance(errors, list) or any(not isinstance(item, dict) for item in errors):
        issues.append("missing or invalid errors array")
    scanned = paths.get("scanned") if isinstance(paths, dict) else None
    if not isinstance(scanned, list) or any(not isinstance(item, str) or not item.strip() for item in scanned):
        issues.append("missing or invalid paths.scanned string array")
    if isinstance(scanned, list) and len(scanned) != len(set(normalize_path(item) for item in scanned)):
        issues.append("paths.scanned contains duplicate targets")
    if not isinstance(timing, dict):
        issues.append("missing or invalid time object")
    fixpoint_timeouts = timing.get("fixpoint_timeouts") if isinstance(timing, dict) else None
    if not isinstance(fixpoint_timeouts, list) or any(not isinstance(item, dict) for item in fixpoint_timeouts):
        issues.append("missing or invalid time.fixpoint_timeouts object array")
    if not isinstance(skipped_rules, list) or any(not isinstance(item, dict) for item in skipped_rules):
        issues.append("missing or invalid skipped_rules object array")
    if not isinstance(version, str) or not version.strip():
        issues.append("missing or invalid Semgrep version")

    findings_by_severity = {}
    if isinstance(results, list):
        for item in results:
            extra = item.get("extra") if isinstance(item, dict) else None
            severity = extra.get("severity") if isinstance(extra, dict) else "UNKNOWN"
            if not isinstance(severity, str) or not severity.strip():
                issues.append("invalid finding severity")
                severity = "UNKNOWN"
            findings_by_severity[severity.upper()] = findings_by_severity.get(severity.upper(), 0) + 1

    scanned_set = {normalize_path(item) for item in scanned} if isinstance(scanned, list) else set()
    missing_targets = sorted(expected_scope - scanned_set) if expected_scope is not None else []
    unexpected_targets = sorted(scanned_set - expected_scope) if expected_scope is not None else []
    if expected_scope is not None and not scanned_set:
        issues.append("paths.scanned is empty")
    if expected_scope is not None and missing_targets:
        issues.append("expected targets were not scanned: " + ", ".join(missing_targets))
    if expected_scope is not None and unexpected_targets:
        issues.append("unexpected targets were scanned: " + ", ".join(unexpected_targets))

    structural_issues = [
        issue for issue in issues
        if "invalid" in issue or "missing" in issue
    ]
    if issues:
        if config_issues or any(
            "cannot parse" in issue or "does not exist" in issue or "cannot read" in issue
            for issue in issues
        ):
            status = "INCONCLUSIVE"
        elif not structural_issues and not scanned_set:
            status = "EMPTY_SCAN"
        elif structural_issues:
            status = "INVALID_EVIDENCE"
        else:
            status = "INCOMPLETE_SCOPE"
    else:
        findings = len(results)
        scanner_errors = len(errors)
        timeout_count = len(fixpoint_timeouts)
        skipped_count = len(skipped_rules)
        if not scanned_set:
            status = "EMPTY_SCAN"
        elif timeout_count:
            status = "INCOMPLETE_ANALYSIS"
        elif findings or scanner_errors or skipped_count:
            status = "FAIL"
        else:
            status = "PASS"

    return {
        "schema": SCHEMA,
        "source": str(source_path),
        "semgrep_version": version,
        "ruleset": configuration.get("ruleset") if configuration else None,
        "status": status,
        "gate_passed": status == "PASS",
        "findings": len(results) if isinstance(results, list) else None,
        "findings_by_severity": findings_by_severity,
        "scanner_errors": len(errors) if isinstance(errors, list) else None,
        "skipped_rules": len(skipped_rules) if isinstance(skipped_rules, list) else None,
        "fixpoint_timeouts": len(fixpoint_timeouts) if isinstance(fixpoint_timeouts, list) else None,
        "scanned_targets": len(scanned) if isinstance(scanned, list) else None,
        "expected_targets": len(expected_scope) if expected_scope is not None else None,
        "missing_targets": missing_targets,
        "unexpected_targets": unexpected_targets,
        "timeout_locations": [
            item.get("location", {}).get("path")
            for item in (fixpoint_timeouts or [])
            if isinstance(item, dict)
        ],
        "issues": issues,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("json_path", type=Path)
    parser.add_argument("--expected-scope-file", type=Path, required=True)
    parser.add_argument("--configuration-file", type=Path, required=True)
    parser.add_argument("--expected-ruleset", required=True)
    parser.add_argument("--summary-output", type=Path)
    args = parser.parse_args()

    expected_scope, scope_issues = load_expected_scope(args.expected_scope_file)
    configuration, config_issues = validate_configuration(
        args.configuration_file,
        args.expected_ruleset,
        args.expected_scope_file,
    )
    payload, json_issues = load_json(args.json_path, "Semgrep JSON")

    summary = summary_for_payload(
        payload,
        args.json_path,
        expected_scope=expected_scope,
        configuration=configuration,
        scope_issues=scope_issues + json_issues,
        config_issues=config_issues,
    )
    rendered = json.dumps(summary, ensure_ascii=False, sort_keys=True)
    print(rendered)
    if args.summary_output:
        args.summary_output.parent.mkdir(parents=True, exist_ok=True)
        args.summary_output.write_text(rendered + "\n", encoding="utf-8")

    if summary["status"] == "PASS":
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
