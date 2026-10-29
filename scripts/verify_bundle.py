#!/usr/bin/env python3
"""Validate the portable skill pack without knowing its checkout directory."""
import re
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
NAMES = {'design-to-handoff'}


def main():
    skill_root = ROOT / 'skills'
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    assert json.loads((skill_root / 'design-to-handoff/version.json').read_text(encoding='utf-8'))['version'] == version
    assert {p.name for p in skill_root.iterdir() if p.is_dir()} == NAMES
    for name in sorted(NAMES):
        path = skill_root / name
        text = (path / 'SKILL.md').read_text(encoding='utf-8')
        match = re.match(r'^---\n(.*?)\n---', text, re.S)
        assert match, name
        data = yaml.safe_load(match.group(1))
        assert data['name'] == name and isinstance(data['description'], str) and data['description'].strip(), name
        assert len(data['description']) <= 1024, name
        assert '[TODO:' not in text and '\ufffd' not in text, name
        interface = yaml.safe_load((path / 'agents/openai.yaml').read_text(encoding='utf-8'))['interface']
        assert 25 <= len(interface['short_description']) <= 64, name
        assert '$' + name in interface['default_prompt'], name
    for path in ROOT.rglob('*.md'):
        if {'.git', 'node_modules', '.venv'} & set(path.parts):
            continue
        text = path.read_text(encoding='utf-8')
        assert not re.search(r'/Users/[^/]+|[A-Z]:\\Users\\', text), path
        for target in re.findall(r'\]\(([^)]+)\)', text):
            if not target.startswith(('http:', 'https:', '#')):
                assert (path.parent / target.split('#')[0]).exists(), (path, target)
    manifests = [p for p in skill_root.rglob('*') if p.name.lower() == 'skill.md']
    assert manifests == [skill_root / 'design-to-handoff/SKILL.md'], manifests
    print('Validated one skill entry, metadata, internal modules, portable paths and Markdown links.')


if __name__ == '__main__':
    main()
