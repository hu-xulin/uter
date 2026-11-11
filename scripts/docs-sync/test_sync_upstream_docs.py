#!/usr/bin/env python3
"""Regression tests for local API-reference deprecation filters."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).with_name("sync-upstream-docs.py")
SPEC = importlib.util.spec_from_file_location("sync_upstream_docs", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class RemovedApiPathTests(unittest.TestCase):
    def test_confirmed_legacy_paths_are_suppressed(self) -> None:
        self.assertTrue(MODULE.should_skip_api_path("/api/oauth/wechat/bind"))
        self.assertTrue(MODULE.should_skip_api_path("/api/verify/status"))

    def test_current_paths_are_not_suppressed(self) -> None:
        self.assertFalse(MODULE.should_skip_api_path("/api/oauth/state"))
        self.assertFalse(MODULE.should_skip_api_path("/api/verify/methods"))
        self.assertFalse(MODULE.should_skip_api_path("/api/verify"))


if __name__ == "__main__":
    unittest.main()
