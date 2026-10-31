#!/usr/bin/env python3
"""Validate recorded delivery evidence, not the live website or its truthfulness."""
import json
import math
import sys
from pathlib import Path
from urllib.parse import urlsplit, parse_qsl

CHECKS = ("coverage", "native_layers", "properties", "visual", "viewer_access", "code_inspection")
SECRET_KEYS = {"usertoken", "access_token", "refresh_token", "api_key", "apikey", "authorization", "cookie"}


def numeric(value, positive=False):
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value) and (value > 0 if positive else value >= 0))


def validate(data):
    errors, pending = [], []
    if not isinstance(data, dict):
        return {"status": "INVALID", "errors": ["Root must be an object"], "pending": []}, 1
    if data.get("schema_version") != 1:
        errors.append("schema_version must be 1")
    platform = data.get("platform")
    if platform not in ("figma", "ardot"):
        errors.append("platform must be figma or ardot")
    url = data.get("url", "")
    try:
        parsed = urlsplit(url) if isinstance(url, str) else urlsplit("")
        if parsed.scheme not in ("https", "http") or not parsed.hostname or parsed.hostname in ("localhost", "127.0.0.1", "::1"):
            errors.append("url must be an actual remote design link")
        if parsed.username or parsed.password:
            errors.append("url must not contain credentials")
        if platform == "figma" and (parsed.hostname not in ("figma.com", "www.figma.com") or not parsed.path.startswith("/design/")):
            errors.append("Figma delivery must link to a Design file")
        # Ardot file URL formats are not a stable public contract. Check the
        # official host and reject known non-file destinations; live readback
        # still establishes the actual file/node identity.
        if platform == "ardot" and (parsed.hostname != "ardot.tencent.com" or parsed.path.rstrip("/") in ("", "/mcp")):
            errors.append("Ardot delivery must link to a remote file on ardot.tencent.com")
    except ValueError:
        errors.append("url is malformed")

    def scan(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if str(key).lower() in SECRET_KEYS:
                    errors.append("Evidence contains a credential field")
                scan(child)
        elif isinstance(value, list):
            for child in value:
                scan(child)
        elif isinstance(value, str) and "://" in value:
            try:
                link = urlsplit(value)
                pairs = parse_qsl(link.query) + parse_qsl(link.fragment.partition("?")[2])
                if any(key.lower() in SECRET_KEYS for key, _ in pairs):
                    errors.append("Evidence contains a credential URL")
            except ValueError:
                pass
    scan(data)

    expected, views = data.get("expected_views"), data.get("views")
    if not isinstance(expected, list) or not expected or not all(isinstance(x, str) and x.strip() for x in expected):
        errors.append("expected_views must be a nonempty string list")
        expected = []
    if len(expected) != len(set(expected)):
        errors.append("expected_views contains duplicates")
    if not isinstance(views, list):
        errors.append("views must be a list")
        views = []
    ids = []
    for view in views:
        if not isinstance(view, dict):
            errors.append("Each view must be an object")
            continue
        name = view.get("id")
        if not isinstance(name, str) or not name.strip():
            errors.append("Every view needs an id")
            name = "<missing>"
        ids.append(name)
        if not isinstance(view.get("root_id"), str) or not view["root_id"].strip():
            errors.append(f"{name}: missing remote root_id")
        if view.get("native_layers") is not True or view.get("full_ui_raster") is not False:
            errors.append(f"{name}: native layers required; complete UI rasters forbidden")
        if not isinstance(view.get("requires_text"), bool):
            errors.append(f"{name}: requires_text must be explicit")
        elements = view.get("elements")
        if not isinstance(elements, list) or not elements:
            errors.append(f"{name}: missing element readback")
            elements = []
        kinds, remote_ids = [], []
        for element in elements:
            if not isinstance(element, dict):
                errors.append(f"{name}: element must be an object")
                continue
            kind, props = element.get("kind"), element.get("properties")
            kinds.append(kind)
            rid = element.get("remote_id")
            if not isinstance(rid, str) or not rid.strip():
                errors.append(f"{name}: missing remote element id")
            else:
                remote_ids.append(rid)
            if element.get("editable") is not True:
                errors.append(f"{name}: element must be editable")
            if not isinstance(props, dict):
                errors.append(f"{name}: missing properties")
                continue
            if kind == "text":
                if any(not isinstance(props.get(k), str) or not props[k].strip() for k in ("fontFamily", "color")):
                    errors.append(f"{name}: text fontFamily/color missing")
                if any(not numeric(props.get(k), True) for k in ("fontSize", "fontWeight", "lineHeight")):
                    errors.append(f"{name}: text metrics must be finite positive numbers")
            elif kind == "container":
                if any(not numeric(props.get(k), True) for k in ("width", "height")) or not numeric(props.get("radius")):
                    errors.append(f"{name}: invalid container geometry")
                if not isinstance(props.get("fill"), str) or not props["fill"].strip():
                    errors.append(f"{name}: container fill missing")
                spacing = props.get("spacing", {})
                if not isinstance(spacing, dict):
                    spacing = {}
                padding = spacing.get("padding")
                if not isinstance(padding, list) or len(padding) != 4 or not all(numeric(x) for x in padding) or not numeric(spacing.get("gap")):
                    errors.append(f"{name}: padding[4]/gap must be finite nonnegative numbers")
                if spacing.get("source") not in ("remote-readback", "measured", "documented"):
                    errors.append(f"{name}: spacing requires a readback source")
                elif spacing["source"] == "documented":
                    if not isinstance(spacing.get("note"), str) or not spacing["note"].strip():
                        errors.append(f"{name}: documented spacing needs a limitation note")
                    else:
                        pending.append(f"{name}: spacing only documented, remote measurement pending")
            elif kind not in ("icon", "image", "vector"):
                errors.append(f"{name}: unknown element kind")
        if len(remote_ids) != len(set(remote_ids)):
            errors.append(f"{name}: duplicate element ids")
        if "container" not in kinds or (view.get("requires_text") is True and "text" not in kinds):
            errors.append(f"{name}: container and required text readbacks missing")
    if len(ids) != len(set(ids)):
        errors.append("Duplicate view ids")
    if set(ids) != set(expected):
        errors.append("Uploaded view ids do not exactly cover expected_views")
    checks = data.get("checks", {})
    if not isinstance(checks, dict):
        checks = {}
        errors.append("checks must be an object")
    for name in CHECKS:
        check = checks.get(name, {})
        if not isinstance(check, dict):
            check = {}
        status = check.get("status")
        if status not in ("passed", "pending", "failed"):
            errors.append(f"{name}: invalid or missing status")
        elif status == "failed":
            errors.append(f"{name}: failed")
        elif status == "pending":
            pending.append(name)
        elif not isinstance(check.get("evidence"), str) or not check["evidence"].strip():
            errors.append(f"{name}: passed requires evidence")
    status = "INVALID_OR_FAILED" if errors else "VERIFICATION_PENDING" if pending else "COMPLETE_RECORDED"
    return {"status": status, "errors": errors, "pending": pending,
            "scope": "Record validation only; no live website verification"}, 1 if errors else 2 if pending else 0


def main():
    if len(sys.argv) != 2:
        print("Usage: verify_delivery.py <evidence.json>", file=sys.stderr)
        return 1
    try:
        data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        result, code = validate(data)
    except (OSError, ValueError, TypeError) as exc:
        # Do not echo file contents or credential-bearing values.
        print(json.dumps({"status": "INVALID", "error": type(exc).__name__}))
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return code


if __name__ == "__main__":
    sys.exit(main())
