import copy
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'skills/design-to-handoff/scripts/verify_delivery.py'
spec = importlib.util.spec_from_file_location('delivery', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

skills = sorted((ROOT / 'skills').iterdir())
assert len(skills) == 1
for skill in skills:
    meta = yaml.safe_load((skill / 'agents/openai.yaml').read_text())['interface']
    assert 25 <= len(meta['short_description']) <= 64, (skill.name, len(meta['short_description']))
    assert '$' + skill.name in meta['default_prompt']
    text = (skill / 'SKILL.md').read_text()
    assert '\ufffd' not in text
    assert yaml.safe_load(text.split('---')[1])['name'] == skill.name
for path in (ROOT / 'skills').rglob('*.md'):
    for link in re.findall(r'\]\(([^)]+)\)', path.read_text()):
        if not link.startswith(('http:', 'https:', '#')):
            assert (path.parent / link.split('#')[0]).exists(), (path, link)

good = {
    'schema_version': 1, 'platform': 'figma',
    'url': 'https://www.figma.com/design/example/test',
    'expected_views': ['home-default-desktop'],
    'views': [{
        'id': 'home-default-desktop', 'root_id': '12:1', 'native_layers': True,
        'full_ui_raster': False, 'requires_text': True,
        'elements': [
            {'remote_id': '12:2', 'kind': 'text', 'editable': True,
             'properties': {'fontFamily': 'Noto Sans', 'fontSize': 16,
                            'fontWeight': 400, 'lineHeight': 24, 'color': '#222'}},
            {'remote_id': '12:3', 'kind': 'container', 'editable': True,
             'properties': {'width': 320, 'height': 80, 'radius': 8, 'fill': '#fff',
                            'spacing': {'padding': [16,16,16,16], 'gap': 8, 'source': 'remote-readback'}}}
        ]
    }],
    'checks': {name: {'status': 'passed', 'evidence': 'Synthetic test evidence, not a live verification'} for name in module.CHECKS}
}

cases = []

def case(name, mutate, expected):
    data = copy.deepcopy(good)
    mutate(data)
    result, code = module.validate(data)
    assert code == expected, (name, code, result)
    cases.append({'name': name, 'exit_code': code, 'status': result['status']})

case('complete_record', lambda d: None, 0)
case('penpot_self_host_record', lambda d: d.update(platform='penpot', url='https://design.example.org/#/workspace?file-id=123'), 0)
case('second_viewer_pending', lambda d: d['checks']['viewer_access'].update(status='pending', evidence=''), 2)
case('code_copy_pending', lambda d: d['checks']['code_inspection'].update(status='pending', evidence=''), 2)
case('missing_required_screen', lambda d: d['expected_views'].append('home-error-desktop'), 1)
case('duplicate_screen', lambda d: d['views'].append(copy.deepcopy(d['views'][0])), 1)
case('flattened_complete_ui', lambda d: d['views'][0].update(full_ui_raster=True), 1)
case('text_converted_to_paths', lambda d: d['views'][0]['elements'][0].update(kind='vector'), 1)
case('missing_font_metrics', lambda d: d['views'][0]['elements'][0]['properties'].pop('fontSize'), 1)
case('negative_spacing', lambda d: d['views'][0]['elements'][1]['properties']['spacing'].update(gap=-8), 1)
case('spacing_documented_only', lambda d: d['views'][0]['elements'][1]['properties']['spacing'].update(source='documented', note='Conversion did not preserve padding'), 2)
case('false_pass_without_evidence', lambda d: d['checks']['visual'].update(evidence=''), 1)
case('failed_visual', lambda d: d['checks']['visual'].update(status='failed'), 1)
case('credential_url', lambda d: d.update(url='https://www.figma.com/design/example/test?userToken=secret'), 1)
case('local_preview_is_not_remote', lambda d: d.update(url='http://localhost:8000'), 1)
case('code_layer_is_not_design', lambda d: d.update(url='https://www.figma.com/make/example/test'), 1)
case('nan_font_metric', lambda d: d['views'][0]['elements'][0]['properties'].update(fontSize=float('nan')), 1)
case('malformed_expected_views', lambda d: d.update(expected_views=[{}]), 1)
for data in ([], None, '', 8):
    assert module.validate(data)[1] == 1

with tempfile.TemporaryDirectory() as td:
    evidence = Path(td) / 'evidence.json'
    evidence.write_text(json.dumps(good))
    cli = subprocess.run([sys.executable, str(SCRIPT), str(evidence)], capture_output=True, text=True)
    assert cli.returncode == 0 and json.loads(cli.stdout)['status'] == 'COMPLETE_RECORDED'
    evidence.write_text('{broken')
    cli = subprocess.run([sys.executable, str(SCRIPT), str(evidence)], capture_output=True, text=True)
    assert cli.returncode == 1 and json.loads(cli.stdout)['status'] == 'INVALID'

report = {'skills_validated': len(skills), 'relative_links': 'passed',
          'ui_metadata': 'passed', 'encoding': 'passed',
          'evidence_cases': cases, 'invalid_roots': 4, 'cli_cases': 2,
          'live_figma': 'not_run', 'live_penpot': 'not_run', 'second_account': 'not_run'}
print(json.dumps({'skills_validated': 1, 'scenario_checks': len(cases)+6, 'status': 'passed'}))
