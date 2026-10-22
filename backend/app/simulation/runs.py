"""
Bounded, persistent store for simulation runs.

Summary JSON is small and cheap to serve; dense fields (saturation, FS, depth,
velocity) are written as a compressed NPZ so overlay frames can be rendered on
demand without recomputing the physics. Older runs are pruned so the data
directory cannot grow without bound.
"""

from __future__ import annotations

import json
import logging
import os
from collections import OrderedDict
from pathlib import Path
from typing import Optional

import numpy as np

from backend.app.core.config import settings

log = logging.getLogger("simulation.runs")

MAX_RUNS = int(os.environ.get("SIM_MAX_RUNS", "40"))
MAX_MEMORY_RUNS = 3


class RunStore:
    def __init__(self, root: Optional[Path] = None):
        self.root = Path(root or settings.SIM_RUN_DIR)
        self.root.mkdir(parents=True, exist_ok=True)
        self._memory: "OrderedDict[str, tuple[dict, dict]]" = OrderedDict()

    def _paths(self, run_id: str) -> tuple[Path, Path]:
        safe = "".join(ch for ch in run_id if ch.isalnum() or ch in "-_")
        if safe != run_id:
            raise ValueError("Invalid run id")
        return self.root / f"{safe}.json", self.root / f"{safe}.npz"

    def save(self, summary: dict, fields: dict, run_id: str) -> None:
        summary_path, fields_path = self._paths(run_id)
        tmp_json = summary_path.with_suffix(".json.tmp")
        tmp_npz = fields_path.with_suffix(".npz.tmp")

        with open(tmp_json, "w", encoding="utf-8") as fh:
            json.dump(summary, fh, default=float, separators=(",", ":"))
        os.replace(tmp_json, summary_path)

        # NOTE: pass an open handle so numpy does not append its own ".npz"
        # suffix to the temporary file name.
        with open(tmp_npz, "wb") as fh:
            np.savez_compressed(
                fh,
                sat=fields["sat"].astype(np.float32, copy=False),
                fs=fields["fs"].astype(np.float32, copy=False),
                fail_hour=fields["fail_hour"].astype(np.int16, copy=False),
                arrival=fields["arrival"].astype(np.float32, copy=False),
                speed=fields["speed"].astype(np.float32, copy=False),
                deposit=fields["deposit"].astype(np.float32, copy=False),
                trail=fields["trail"].astype(np.bool_, copy=False),
                hours=np.asarray(fields["hours"], dtype=np.int16),
            )
        os.replace(tmp_npz, fields_path)

        self._memory[run_id] = (summary, fields)
        self._memory.move_to_end(run_id)
        while len(self._memory) > MAX_MEMORY_RUNS:
            self._memory.popitem(last=False)
        self._prune()

    def load(self, run_id: str) -> Optional[tuple[dict, dict]]:
        if run_id in self._memory:
            self._memory.move_to_end(run_id)
            return self._memory[run_id]

        summary_path, fields_path = self._paths(run_id)
        if not summary_path.exists() or not fields_path.exists():
            return None
        try:
            with open(summary_path, encoding="utf-8") as fh:
                summary = json.load(fh)
            with np.load(fields_path, allow_pickle=False) as data:
                fields = {
                    "sat": data["sat"],
                    "fs": data["fs"],
                    "fail_hour": data["fail_hour"],
                    "arrival": data["arrival"],
                    "speed": data["speed"],
                    "deposit": data["deposit"],
                    "trail": data["trail"],
                    "hours": int(data["hours"]),
                }
        except Exception as exc:  # pragma: no cover - corrupted artefacts
            log.warning("Failed to load simulation run %s: %s", run_id, exc)
            return None

        self._memory[run_id] = (summary, fields)
        self._memory.move_to_end(run_id)
        while len(self._memory) > MAX_MEMORY_RUNS:
            self._memory.popitem(last=False)
        return summary, fields

    def exists(self, run_id: str) -> bool:
        try:
            summary_path, fields_path = self._paths(run_id)
        except ValueError:
            return False
        return summary_path.exists() and fields_path.exists()

    def _prune(self) -> None:
        files = sorted(self.root.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        for stale in files[MAX_RUNS:]:
            stem = stale.with_suffix("")
            for suffix in (".json", ".npz"):
                candidate = Path(str(stem) + suffix)
                try:
                    candidate.unlink(missing_ok=True)
                except OSError:
                    pass


store = RunStore()
