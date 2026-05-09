"""
Run deterministic local quality checks and write timestamped logs.

Usage:
  python scripts/run_local_quality_checks.py
"""
from __future__ import annotations

import os
import subprocess
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRATCH = ROOT / "scratch"
SCRATCH.mkdir(parents=True, exist_ok=True)
STAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_PATH = SCRATCH / f"local_quality_checks_{STAMP}.log"


def run_step(name: str, cmd: list[str], cwd: Path) -> int:
    with LOG_PATH.open("a", encoding="utf-8") as log:
        log.write(f"\n=== {name} ===\n")
        log.write(f"cwd: {cwd}\n")
        log.write(f"cmd: {' '.join(cmd)}\n\n")
        p = subprocess.run(
            cmd,
            cwd=str(cwd),
            text=True,
            capture_output=True,
            env=os.environ.copy(),
        )
        log.write(p.stdout or "")
        if p.stderr:
            log.write("\n[stderr]\n")
            log.write(p.stderr)
        log.write(f"\n[exit_code] {p.returncode}\n")
        return p.returncode


def main() -> int:
    with LOG_PATH.open("w", encoding="utf-8") as log:
        log.write(f"Local quality checks started: {datetime.now().isoformat()}\n")
        log.write(f"Repo root: {ROOT}\n")

    steps = [
        ("Backend tests", ["pytest", "-q"], ROOT / "backend"),
        ("Frontend tests", ["npm", "test"], ROOT / "frontend"),
        ("Full dataset benchmark", ["python", "scratch/full_dataset_analysis.py"], ROOT),
    ]

    failed = []
    for name, cmd, cwd in steps:
        code = run_step(name, cmd, cwd)
        if code != 0:
            failed.append((name, code))

    with LOG_PATH.open("a", encoding="utf-8") as log:
        log.write(f"\nCompleted at: {datetime.now().isoformat()}\n")
        if failed:
            log.write("Result: FAILED\n")
            for name, code in failed:
                log.write(f"- {name}: exit {code}\n")
        else:
            log.write("Result: PASSED\n")

    print(f"Quality checks complete. Log file: {LOG_PATH}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
