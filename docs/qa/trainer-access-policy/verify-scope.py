"""Read-only git scope audit for the dedicated #958 worktree."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[3]
qa = "docs/qa/trainer-access-policy/"
products = {
    "lib/types/trainer-access.ts",
    "lib/util/trainer-access-policy.ts",
    "tests/util/trainer-access-policy.test.ts",
}
owned = products | {
    "docs/domains/data-model.md",
    "docs/plans/active/trainer-access-policy.md",
} | {qa + name for name in [
    "README.md", "verify-scope.py", "scope.log", "build.log", "check.log", "check-final.log",
    "red-1.log", "red-1-assertion.log", "green-1.log", "red-2.log", "green-2.log",
    "red-3.log", "red-3-assertion.log", "green-3.log", "red-4.log", "green-4.log",
    "red-5.log", "green-5.log", "structural-red.log", "structural-green.log",
]}

def git(*args):
    return subprocess.check_output(["git", *args], cwd=root).decode("utf-8")

records = [record for record in git("status", "--porcelain=v1", "-z", "--untracked-files=all").split("\0") if record]
assert all(record[:2] not in {"R ", "C "} for record in records), "Unexpected rename/copy"
changed = {record[3:] for record in records}
outside = changed - owned
assert not outside, f"Out-of-scope changes: {sorted(outside)}"
assert products <= changed, "Missing expected policy implementation"
head = git("rev-parse", "HEAD").strip()
branch = git("branch", "--show-current").strip()
assert head == "c781febca94c9b476409d6f9db0da8ac512bb49a", "Unexpected commit/base"
assert branch == "feat/trainer-access-policy", "Wrong worktree branch"
assert git("diff", "--check") == "", "Whitespace errors"
result = {
    "result": "PASS", "base_head": head, "branch": branch,
    "changed_count": len(changed), "owned_count": len(owned),
    "outside_owned": sorted(outside), "changed_paths": sorted(changed),
    "product_sha256": {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in sorted(products)},
    "products_line_counts": {name: len((root / name).read_text(encoding="utf-8").splitlines()) for name in sorted(products)},
    "no_commit_created": True,
}
print(json.dumps(result, ensure_ascii=False, indent=2))
