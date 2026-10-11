"""
Runs the web client's pure logic tests under Node. They cover the diff engine, formatting,
the form-validation mirror, transaction-receipt parsing and the Cloudflare RPC proxy. None of
them need npm packages: they use Node's built-in TypeScript type stripping (Node 22.18+), so
they run before `npm install` and are skipped, with a reason, where that is unavailable.
"""

import shutil
import subprocess
import unittest

from support import ROOT

NODE = shutil.which('node')
SCRIPTS = sorted((ROOT / 'tests' / 'node').glob('*.mjs'))


def stripping_supported():
    if NODE is None:
        return False, 'node is not installed'
    probe = subprocess.run([NODE, str(ROOT / 'tests' / 'node' / 'receipt.mjs')], capture_output=True, text=True, timeout=60)
    if probe.returncode != 0 and 'ERR_UNKNOWN_FILE_EXTENSION' in probe.stderr:
        return False, 'this Node cannot strip TypeScript types (needs 22.18 or newer)'
    return True, ''


SUPPORTED, REASON = stripping_supported()


@unittest.skipUnless(SUPPORTED, REASON)
class NodeLogicTests(unittest.TestCase):
    def test_every_script_passes(self):
        self.assertGreaterEqual(len(SCRIPTS), 4)
        for script in SCRIPTS:
            with self.subTest(script=script.name):
                result = subprocess.run([NODE, str(script)], capture_output=True, text=True, timeout=120, cwd=str(ROOT))
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn('passed', result.stdout)


if __name__ == '__main__':
    unittest.main()
