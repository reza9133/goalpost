"""
The web client re-implements the contract's input rules so a visitor sees mistakes before
spending a multi-minute transaction. These tests run both implementations on the same inputs
and require identical answers. They need Node 22.18+ (built-in TypeScript type stripping)
and are skipped, with a clear reason, where that is unavailable.
"""

import json
import shutil
import subprocess
import unittest

from support import ROOT, load_contract_module

M = load_contract_module()

URLS = [
    'https://example.com/',
    'https://Example.COM/a/b?x=1',
    'https://reports.example.co.uk/path/',
    'https://a.b.c.example.org',
    'http://example.com/',
    'ftp://example.com/',
    'https://localhost/',
    'https://intranet/',
    'https://192.168.0.1/',
    'https://127.0.0.1/x',
    'https://10.0.0.1',
    'https://0x7f.0.0.1/x',
    'https://127.0.0.0x1/',
    'https://127.1/',
    'https://1.2.3.0x4/',
    'https://example.123/',
    'https://0x7f000001.com/',
    'https://1a.2/',
    'https://[::1]/',
    'https://example.com:8443/',
    'https://user:pw@example.com/',
    'https://user@example.com/',
    'https://example.com/a#frag',
    'https://example.com/a b',
    'https://example.com/a\\b',
    'https://example.com/r/../pledge.html',
    'https://example.com/r/./report.html',
    'https://example.com/r/..',
    'https://example.com/r/..;/pledge.html',
    'https://example.com/r/%2e%2e/pledge.html',
    'https://example.com/r/%2E%2E/pledge.html',
    'https://example.com/r/.%2e/pledge.html',
    'https://example.com/r/a%2fb.html',
    'https://example.com/r/a%5Cb.html',
    'https://example.com?x/../y',
    'https://example.com/r/x?next=/../y',
    'https://example.com/r/x?next=%2e%2e',
    'https://example.com/r/report.v2.html',
    'https://example.com/r/.well-known/x',
    'https://example.com/r/a..b.html',
    'https://printer.local/',
    'https://svc.internal/',
    'https://box.lan/',
    'https://nas.home.arpa/',
    'https:///path',
    'https://-bad.example.com/',
    'https://bad-.example.com/',
    'https://exa_mple.com/',
    'https://example..com/',
    'https://.example.com/',
    'https://xn--bcher-kva.example/',
    'https://b\u00fccher.example/',
    '',
    'example.com',
    'https://' + 'a' * 600 + '.com/',
    'https://example.com/' + 'p' * 470,
    'https://example.com/' + 'p' * 490,
]

TEXTS = [
    'Cut  \u201cabsolute\u201d\n emissions \u2014 40%',
    'It\u2019s a \u2018test\u2019 of the \u2013 dash \u2212 rule',
    '  leading and trailing  ',
    'Scope\u00a01\u2009and\u202f2',
    'MiXeD CaSe',
    'tab\tseparated\nlines',
]

SCOPE_URLS = [
    'https://acme.example/a/b.html',
    'https://www.acme.example/x',
    'https://gist.githubusercontent.com/Alice/abc/raw/pledge.txt',
    'https://gist.githubusercontent.com/alice/',
    'https://gist.githubusercontent.com/',
    'https://github.com',
    'https://github.com/acme/repo/blob/main/p.md',
    'https://www.github.com/Acme/x',
    'https://raw.githubusercontent.com/acme/pledges/main/p.md',
    'https://medium.com/@acme/post',
    'https://sites.google.com/view/acme/home',
    'https://sites.google.com/view/',
    'https://pastebin.com/raw/abc',
    'https://docs.google.com/document/d/1',
    'https://www.dropbox.com/s/x',
    'https://gitlab.com/acme/',
]

TS_TIMEOUT = 60


def run_probe():
    node = shutil.which('node')
    if node is None:
        return None, 'node is not installed'
    try:
        result = subprocess.run(
            [node, str(ROOT / 'tests' / 'client_probe.mjs')],
            input=json.dumps({'urls': URLS, 'texts': TEXTS, 'scopes': SCOPE_URLS}),
            capture_output=True,
            text=True,
            timeout=TS_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return None, 'node timed out'
    if result.returncode != 0:
        return None, 'this Node cannot strip TypeScript types: ' + result.stderr.strip().splitlines()[-1][:160]
    return json.loads(result.stdout), ''


PROBE, SKIP_REASON = run_probe()


def contract_accepts(url):
    try:
        M._validate_public_https_url(url, 'u')
        return True
    except Exception:
        return False


@unittest.skipIf(PROBE is None, SKIP_REASON)
class ClientParityTests(unittest.TestCase):
    def test_url_rules_agree_with_the_contract_on_every_input(self):
        for url, client_accepts in zip(URLS, PROBE['urls']):
            with self.subTest(url=url[:80]):
                self.assertEqual(client_accepts, contract_accepts(url))

    def test_publisher_scope_rules_agree_with_the_contract_on_every_input(self):
        for address, client_scope in zip(SCOPE_URLS, PROBE['scopes']):
            with self.subTest(url=address):
                try:
                    contract_scope = M._publisher_scope(address, 'u')
                except Exception:
                    contract_scope = None
                self.assertEqual(client_scope, contract_scope)

    def test_publisher_authority_tables_agree_with_the_contract(self):
        self.assertEqual(PROBE['tenantHosts'], M._PATH_TENANT_HOSTS)
        self.assertEqual(PROBE['flatHosts'], list(M._FLAT_SHARED_HOSTS))
        self.assertEqual(PROBE['declarationName'], M.DECLARATION_NAME)

    def test_text_normalisation_agrees_with_the_contract(self):
        for text, client_value in zip(TEXTS, PROBE['normalized']):
            with self.subTest(text=text):
                self.assertEqual(client_value, M._norm(text))

    def test_enumerations_agree(self):
        self.assertEqual(PROBE['kinds'], list(M.KINDS))
        self.assertEqual(PROBE['dimensions'], list(M.DIMENSIONS))
        self.assertEqual(sorted(PROBE['kindLabels']), sorted(M.KINDS))
        self.assertEqual(sorted(PROBE['dimensionLabels']), sorted(M.DIMENSIONS))
        self.assertEqual(sorted(PROBE['verdictLabels']), sorted(M._ALL_VERDICTS))
        self.assertEqual(sorted(PROBE['statusLabels']), sorted(M._ALL_STATUSES))
        standings = set(M._STANDING_BY_VERDICT.values()) | {M.STANDING_UNAUDITED}
        self.assertEqual(sorted(PROBE['standingLabels']), sorted(standings))

    def test_every_flag_and_failure_reason_the_contract_can_emit_has_a_client_explanation(self):
        source = M.__dict__
        emitted = {
            'unusable_status',
            'report_excerpt_not_in_source',
            'anchor_missing_from_kept_excerpt',
            'disclosure_not_in_source',
            'anchors_intact_silent_claim_rejected',
            'excerpt_unrelated_to_pledge',
            'disclosure_not_about_a_change',
            'report_truncated_absence_unproven',
        }
        text = (ROOT / 'contracts' / 'goalpost.py').read_text()
        for flag in emitted:
            self.assertIn("'" + flag + "'", text, 'flag no longer emitted by the contract: ' + flag)
        self.assertEqual(set(PROBE['flagLabels']), emitted)
        reasons = {source['REASON_UNREACHABLE'], source['REASON_HTTP_4XX'], source['REASON_HTTP_5XX'], source['REASON_EMPTY']}
        self.assertEqual(set(PROBE['failureLabels']), reasons)

    def test_client_default_limits_match_the_contract_constants(self):
        limits = PROBE['limits']
        expected = {
            'max_elements': M.MAX_ELEMENTS,
            'min_quote_chars': M.MIN_QUOTE_CHARS,
            'max_quote_chars': M.MAX_QUOTE_CHARS,
            'max_anchors': M.MAX_ANCHORS,
            'max_anchor_chars': M.MAX_ANCHOR_CHARS,
            'max_title_chars': M.MAX_TITLE_CHARS,
            'max_url_chars': M.MAX_URL_CHARS,
            'max_period_chars': M.MAX_PERIOD_CHARS,
            'max_audits_per_pledge': M.MAX_AUDITS_PER_PLEDGE,
            'max_report_chars': M.MAX_REPORT_CHARS,
        }
        self.assertEqual(limits, expected)

    def test_contract_info_exposes_the_same_limits_the_client_assumes(self):
        from support import World

        info = World().jview('contract_info')
        self.assertEqual(info['limits'], PROBE['limits'])
        self.assertEqual(info['kinds'], PROBE['kinds'])
        self.assertEqual(info['dimensions'], PROBE['dimensions'])


if __name__ == '__main__':
    unittest.main()
