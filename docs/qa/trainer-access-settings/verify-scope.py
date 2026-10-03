"""#958 read-only source boundary and verification snapshot equivalence."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[3]
snapshot = Path('C:/Users/Public/Documents/ESTsoft/CreatorTemp/trainer-access-settings-verify')
products = {
    'lib/types/trainer-access.ts', 'lib/util/trainer-access-policy.ts',
    'lib/repo/db/trainer-access-settings.ts', 'lib/service/trainer-access-settings.ts',
    'app/api/admin/trainer-access/route.ts', 'components/auth/TrainerAccessEditor.tsx',
    'lib/repo/db/migrations/0007_trainer_access.sql',
}
tests = {
    'tests/util/trainer-access-policy.test.ts',
    'tests/api/trainer-access-settings.test.ts', 'tests/service/trainer-access-settings.test.ts',
    'tests/repo/trainer-access-settings.test.ts', 'tests/repo/trainer-access-settings.postgres.mjs',
    'tests/components/trainer-access-settings-fixture.tsx', 'tests/components/trainer-access-settings.browser.mjs',
}
documents = {'docs/domains/data-model.md', 'docs/design/components.md', 'docs/plans/active/trainer-access-policy.md'}
allowed = products | tests | documents
qa_prefixes = ('docs/qa/trainer-access-policy/', 'docs/qa/trainer-access-settings/')

def git(*args):
    return subprocess.check_output(['git', *args], cwd=root).decode('utf-8')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

records = [r for r in git('status', '--porcelain=v1', '-z', '--untracked-files=all').split('\0') if r]
assert all(r[:2] not in {'R ', 'C '} for r in records), 'Unexpected rename/copy'
changed = {r[3:] for r in records}
outside = {p for p in changed if p not in allowed and not p.startswith(qa_prefixes)}
assert not outside, sorted(outside)
assert not git('diff', '--check'), 'Whitespace errors'
assert git('rev-parse', 'HEAD').strip() == 'c781febca94c9b476409d6f9db0da8ac512bb49a'
assert git('branch', '--show-current').strip() == 'feat/trainer-access-policy'
equivalent = products | tests | {'scripts/check.sh', '.githooks/pre-commit', 'package.json', 'package-lock.json', 'vitest.config.ts', 'tsconfig.json', 'eslint.config.mjs'}
mismatches = [p for p in sorted(equivalent) if not (snapshot / p).is_file() or sha(root / p) != sha(snapshot / p)]
assert not mismatches, mismatches
historical = json.loads((root / 'docs/qa/trainer-access-policy/scope.log').read_text(encoding='utf-8-sig'))
for p in ['lib/util/trainer-access-policy.ts', 'tests/util/trainer-access-policy.test.ts']:
    assert sha(root / p) == historical['product_sha256'][p], 'Inherited pure policy changed'
print(json.dumps({
    'result': 'PASS', 'outside_allowed': sorted(outside), 'outside_count': len(outside),
    'changed_paths': sorted(changed), 'snapshot_mismatches': mismatches,
    'verified_snapshot_files': len(equivalent), 'inherited_policy_unchanged': True,
    'source_sha256': {p: sha(root / p) for p in sorted(products | tests)},
    'protected_gate_sha256': {p: sha(root / p) for p in ['scripts/check.sh', '.githooks/pre-commit']},
    'production_changes': False, 'commits_created': False,
}, ensure_ascii=False, indent=2))
