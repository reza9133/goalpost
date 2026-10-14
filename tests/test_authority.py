"""
Publisher-to-report authority. A hostname is not a publisher: on a shared host any tenant can
publish under the same name. A reporting prefix is only accepted when it lies inside the
pledge's publisher scope AND the pledge page itself (which validators fetch) declares it.
"""

import json
import unittest

from gensim import Env, NoConsensus
from support import ALICE, BOB, CAROL, World, expect_user_error, load_contract_module, url

M = load_contract_module()

QUOTE = 'We promise to publish every audit within thirty days of completion.'
ELEMENTS = json.dumps([{'key': 'promise', 'dimension': 'method', 'quote': QUOTE, 'anchors': ['thirty days']}])
HOST = 'https://acme.example'
PLEDGE = HOST + '/pledges/audit.html'
REPORTS = HOST + '/reports/'


def page(body='', head=''):
    return '<html><head>%s</head><body><main><p>%s</p>%s</main></body></html>' % (head, QUOTE, body)


def world(pages):
    web = {address: (200, text) for address, text in pages.items()}
    return World(web=web)


def register(w, pledge=PLEDGE, prefix=REPORTS, sender=ALICE):
    return w.register('meridian', pledge_url=pledge, report_prefix=prefix, elements_json=ELEMENTS, sender=sender, title='Audit promise')


class ScopeTests(unittest.TestCase):
    def test_plain_hosts_have_one_publisher(self):
        for address in (HOST + '/a/b.html', 'https://www.acme.example/x', HOST + '/'):
            self.assertEqual(M._publisher_scope(address, 'u'), 'acme.example')

    def test_shared_hosts_name_the_publisher_namespace(self):
        cases = {
            'https://gist.githubusercontent.com/Alice/abc/raw/pledge.txt': 'gist.githubusercontent.com/alice',
            'https://gist.githubusercontent.com/alice/': 'gist.githubusercontent.com/alice',
            'https://raw.githubusercontent.com/acme/pledges/main/p.md': 'raw.githubusercontent.com/acme',
            'https://github.com/acme/repo/blob/main/p.md': 'github.com/acme',
            'https://medium.com/@acme/post': 'medium.com/@acme',
            'https://sites.google.com/view/acme/home': 'sites.google.com/view/acme',
        }
        for address, scope in cases.items():
            with self.subTest(address=address):
                self.assertEqual(M._publisher_scope(address, 'u'), scope)

    def test_two_tenants_of_one_host_never_share_a_scope(self):
        a = M._publisher_scope('https://gist.githubusercontent.com/alice/x/raw/p.txt', 'u')
        b = M._publisher_scope('https://gist.githubusercontent.com/bob/x/raw/p.txt', 'u')
        self.assertNotEqual(a, b)

    def test_a_shared_host_url_without_a_namespace_is_refused(self):
        for address in ('https://gist.githubusercontent.com/', 'https://github.com', 'https://sites.google.com/view/'):
            with self.subTest(address=address):
                with self.assertRaises(Exception) as caught:
                    M._publisher_scope(address, 'report_prefix')
                self.assertIn('publisher namespace', str(caught.exception))

    def test_hosts_that_give_no_publisher_a_namespace_are_refused(self):
        for address in ('https://pastebin.com/raw/abc123', 'https://docs.google.com/document/d/1', 'https://www.dropbox.com/s/x'):
            with self.subTest(address=address):
                with self.assertRaises(Exception) as caught:
                    M._publisher_scope(address, 'pledge_url')
                self.assertIn('no publisher a namespace', str(caught.exception))


class DeclarationParsingTests(unittest.TestCase):
    BASE = HOST + '/pledges/audit.html'

    def declared(self, markup):
        text = M._html_to_text(markup)
        return M._declared_urls(markup, text, self.BASE)

    def test_a_link_element_declares_a_prefix_and_relative_links_resolve_against_the_page(self):
        cases = {
            '<link rel="goalpost-reports" href="https://acme.example/reports/">': HOST + '/reports/',
            '<link rel="goalpost-reports" href="/reports">': HOST + '/reports/',
            '<link rel="goalpost-reports" href="../reports/">': HOST + '/reports/',
            '<link rel="goalpost-reports" href="reports/">': HOST + '/pledges/reports/',
            '<link rel="goalpost-reports" href="//acme.example/r/">': HOST + '/r/',
            "<link rel='goalpost-reports' href='/r/'>": HOST + '/r/',
            '<link rel="stylesheet goalpost-reports" href="/r/">': HOST + '/r/',
            '<meta name="goalpost-reports" content="https://acme.example/m/">': HOST + '/m/',
            '<META NAME="Goalpost-Reports" CONTENT="/m/">': HOST + '/m/',
            '<link rel="goalpost-reports" href="https://ACME.example/Reports/2026/?x=1#y">': HOST + '/Reports/2026/',
            '<link rel="goalpost-reports" href="/a/./b/../c/">': HOST + '/a/c/',
            '<link rel="goalpost-reports" href="/r/&amp;/">': HOST + '/r/&/',
        }
        for markup, expected in cases.items():
            with self.subTest(markup=markup):
                self.assertEqual(self.declared(markup), [expected])

    def test_an_address_written_on_the_page_declares_it(self):
        found = self.declared('<p>Our reports live at https://acme.example/reports/, updated yearly.</p>')
        self.assertEqual(found, [HOST + '/reports/'])
        self.assertEqual(self.declared('<p>See (https://acme.example/reports).</p>'), [HOST + '/reports/'])
        self.assertEqual(M._declared_urls(HOST, 'Reports: https://acme.example/reports/ end', self.BASE), [HOST + '/reports/'])

    def test_ordinary_navigation_does_not_declare_anything(self):
        markup = (
            '<nav><a href="/">Home</a> <a href="https://acme.example/reports/">Reports</a>'
            '<link rel="stylesheet" href="/reports/site.css"></nav><meta name="description" content="https://acme.example/reports/">'
        )
        self.assertEqual(self.declared(markup), [])

    def test_hidden_markup_does_not_declare_anything(self):
        for markup in (
            '<!-- <link rel="goalpost-reports" href="/reports/"> -->',
            '<script>document.write(\'<link rel="goalpost-reports" href="/reports/">\')</script>',
            '<style>/* <link rel="goalpost-reports" href="/reports/"> */</style>',
            '<noscript><link rel="goalpost-reports" href="/reports/"></noscript>',
        ):
            with self.subTest(markup=markup):
                self.assertEqual(self.declared(markup), [])

    def test_unsafe_or_unusable_targets_are_ignored(self):
        for target in ('', '#top', '?x=1', 'http://acme.example/reports/', 'javascript:alert(1)', 'mailto:a@b.example',
                       'https://user@acme.example/r/', 'https://acme.example:8443/r/', 'https:///r/', 'data:text/plain,x'):
            with self.subTest(target=target):
                self.assertEqual(self.declared('<link rel="goalpost-reports" href="%s">' % target), [])

    def test_the_number_of_declared_addresses_is_bounded(self):
        text = ' '.join('https://acme.example/r%d/' % number for number in range(500))
        self.assertEqual(len(M._declared_urls(text, text, self.BASE)), M.MAX_DECLARED_URLS)

    def test_a_prefix_is_authorised_by_a_declared_directory_or_one_above_it_only(self):
        declared = [HOST + '/reports/']
        self.assertTrue(M._authority_declared(HOST + '/reports/', declared))
        self.assertTrue(M._authority_declared(HOST + '/reports/2026/', declared))
        self.assertFalse(M._authority_declared(HOST + '/', declared))
        self.assertFalse(M._authority_declared(HOST + '/reports-evil/', declared))
        self.assertFalse(M._authority_declared(HOST + '/other/', declared))
        self.assertFalse(M._authority_declared('https://evil.example/reports/', declared))
        self.assertFalse(M._authority_declared(HOST + '/reports/', []))


class RegistrationAuthorityTests(unittest.TestCase):
    def test_a_pledge_page_that_does_not_name_its_reports_cannot_be_registered(self):
        w = world({PLEDGE: page()})
        with expect_user_error(self, 'does not declare the reporting prefix'):
            register(w)
        self.assertEqual(w.jview('stats')['pledges'], 0)

    def test_each_declaration_channel_works(self):
        variants = {
            'link': page(head='<link rel="goalpost-reports" href="/reports/">'),
            'relative link': page(head='<link rel="goalpost-reports" href="../reports/">'),
            'meta': page(head='<meta name="goalpost-reports" content="https://acme.example/reports/">'),
            'visible address': page(body='<p>Reports: https://acme.example/reports/</p>'),
            'linked address': page(body='<p><a href="https://acme.example/reports/">https://acme.example/reports/</a></p>'),
            'broader declaration': page(head='<link rel="goalpost-reports" href="/">'),
        }
        for name, text in variants.items():
            with self.subTest(channel=name):
                w = world({PLEDGE: text})
                self.assertEqual(register(w), 'PLG-0001')
                record = w.jview('get_pledge_bundle', 'PLG-0001')['pledge']
                self.assertEqual(record['authority'], {'scope': 'acme.example', 'method': 'PLEDGE_PAGE_DECLARATION'})

    def test_plain_text_pledges_can_declare_the_prefix_in_words(self):
        w = world({PLEDGE: QUOTE + '\nOur reports are published under https://acme.example/reports/ each year.\n'})
        self.assertEqual(register(w), 'PLG-0001')

    def test_a_home_link_or_a_navigation_link_is_not_a_declaration(self):
        w = world({PLEDGE: page(body='<nav><a href="/">Home</a> <a href="/reports/">Reports</a></nav>')})
        with expect_user_error(self, 'does not declare the reporting prefix'):
            register(w)

    def test_a_hidden_declaration_does_not_count(self):
        hidden = page(body='<!-- <link rel="goalpost-reports" href="/reports/"> --><script>var u="https://acme.example/reports/"</script>')
        with expect_user_error(self, 'does not declare the reporting prefix'):
            register(world({PLEDGE: hidden}))

    def test_a_narrower_declaration_does_not_authorise_a_broader_prefix(self):
        w = world({PLEDGE: page(head='<link rel="goalpost-reports" href="/reports/2026/">')})
        with expect_user_error(self, 'does not declare the reporting prefix'):
            register(w, prefix=REPORTS)
        self.assertEqual(register(w, prefix=REPORTS + '2026/'), 'PLG-0001')

    def test_a_broader_declaration_authorises_a_narrower_prefix(self):
        w = world({PLEDGE: page(head='<link rel="goalpost-reports" href="/reports/">')})
        self.assertEqual(register(w, prefix=REPORTS + '2026/'), 'PLG-0001')

    def test_a_third_party_cannot_aim_a_pledge_at_pages_the_publisher_never_named(self):
        # Bob registers Acme's pledge with a prefix he controls on the same host.
        w = world({PLEDGE: page(head='<link rel="goalpost-reports" href="/reports/">')})
        with expect_user_error(self, 'does not declare the reporting prefix'):
            register(w, prefix=HOST + '/users/bob/', sender=BOB)
        with expect_user_error(self, 'does not declare the reporting prefix'):
            register(w, prefix=HOST + '/', sender=BOB)

    def test_the_decision_does_not_depend_on_who_registers(self):
        w = world({PLEDGE: page(head='<link rel="goalpost-reports" href="/reports/">')})
        self.assertEqual(register(w, sender=BOB), 'PLG-0001')

    def test_validators_must_agree_on_whether_the_page_declares_the_prefix(self):
        declared = Env({PLEDGE: (200, page(head='<link rel="goalpost-reports" href="/reports/">'))})
        silent = Env({PLEDGE: (200, page())})
        w = world({PLEDGE: page(head='<link rel="goalpost-reports" href="/reports/">')})
        with self.assertRaises(NoConsensus):
            w.tx('register_pledge', 'Audit promise', 'other', PLEDGE, REPORTS, ELEMENTS, validator_envs=[declared, silent, silent, silent])
        self.assertEqual(w.jview('stats')['pledges'], 0)


class SharedHostTests(unittest.TestCase):
    ALICE_PLEDGE = 'https://gist.githubusercontent.com/alice/p1/raw/pledge.txt'
    ALICE_REPORTS = 'https://gist.githubusercontent.com/alice/'

    def alice_world(self, text=None):
        text = text or (QUOTE + '\nReports: ' + self.ALICE_REPORTS + '\n')
        return world({self.ALICE_PLEDGE: text})

    def test_the_publishers_own_namespace_registers(self):
        w = self.alice_world()
        self.assertEqual(register(w, pledge=self.ALICE_PLEDGE, prefix=self.ALICE_REPORTS, sender=BOB), 'PLG-0001')
        self.assertEqual(w.jview('get_pledge_bundle', 'PLG-0001')['pledge']['authority']['scope'], 'gist.githubusercontent.com/alice')

    def test_another_tenant_of_the_same_host_cannot_be_named_even_if_the_page_says_so(self):
        w = self.alice_world(QUOTE + '\nReports: https://gist.githubusercontent.com/bob/\n')
        with expect_user_error(self, 'outside the publisher scope'):
            register(w, pledge=self.ALICE_PLEDGE, prefix='https://gist.githubusercontent.com/bob/', sender=BOB)
        self.assertEqual(w.last_requests, [], 'a scope violation must be refused before any network access')

    def test_the_whole_shared_host_cannot_be_the_prefix(self):
        w = self.alice_world(QUOTE + '\nReports: https://gist.githubusercontent.com/\n')
        with expect_user_error(self, 'publisher namespace'):
            register(w, pledge=self.ALICE_PLEDGE, prefix='https://gist.githubusercontent.com/', sender=BOB)

    def test_a_missing_declaration_on_a_shared_host_is_refused_even_inside_the_right_namespace(self):
        w = self.alice_world(QUOTE)
        with expect_user_error(self, 'does not declare the reporting prefix'):
            register(w, pledge=self.ALICE_PLEDGE, prefix=self.ALICE_REPORTS, sender=BOB)

    def test_namespace_case_does_not_create_a_second_tenant(self):
        # the same tenant spelled two ways is one scope
        self.assertEqual(
            M._publisher_scope(self.ALICE_PLEDGE.replace('/alice/', '/ALICE/'), 'u'),
            M._publisher_scope(self.ALICE_REPORTS, 'u'),
        )

    def test_a_host_that_offers_no_namespace_cannot_carry_a_pledge(self):
        w = world({'https://pastebin.com/raw/abc123': QUOTE + ' https://pastebin.com/raw/'})
        with expect_user_error(self, 'no publisher a namespace'):
            register(w, pledge='https://pastebin.com/raw/abc123', prefix='https://pastebin.com/raw/')

    def test_only_reports_inside_the_publishers_namespace_can_be_submitted(self):
        w = self.alice_world()
        register(w, pledge=self.ALICE_PLEDGE, prefix=self.ALICE_REPORTS)
        w.tx('submit_report', 'PLG-0001', 'https://gist.githubusercontent.com/alice/r1/raw/2026.txt', 'FY2026', sender=BOB)
        for outsider in (
            'https://gist.githubusercontent.com/bob/r1/raw/2026.txt',
            'https://gist.githubusercontent.com/alicia/r1/raw/2026.txt',
            'https://gist.githubusercontent.com/alice-evil/r1/raw/2026.txt',
        ):
            with self.subTest(report=outsider):
                with expect_user_error(self, 'outside the reporting prefix'):
                    w.tx('submit_report', 'PLG-0001', outsider, 'FY2026', sender=BOB)


class IntegrityOfTheDeclarationTests(unittest.TestCase):
    def setUp(self):
        self.declared = page(head='<link rel="goalpost-reports" href="/reports/">')
        self.w = world({PLEDGE: self.declared})
        register(self.w)

    def test_withdrawing_the_declaration_is_a_recorded_edit(self):
        withdrawn = {PLEDGE: (200, page())}
        self.assertEqual(self.w.tx('check_pledge_integrity', 'PLG-0001', web=withdrawn, sender=CAROL), 'EDITED')
        record = self.w.jview('get_pledge_bundle', 'PLG-0001')['pledge']
        self.assertEqual(record['integrity']['state'], 'EDITED')
        self.assertEqual(record['integrity']['edits'][0]['missing'], ['@reporting_authority'])
        self.assertEqual(self.w.jview('stats')['edits_detected'], 1)

    def test_an_intact_declaration_passes(self):
        self.assertEqual(self.w.tx('check_pledge_integrity', 'PLG-0001', sender=CAROL), 'INTACT')

    def test_the_authority_key_can_never_collide_with_an_element_key(self):
        self.assertIsNone(M._KEY_RE.match(M.AUTHORITY_KEY))


class ContractInfoTests(unittest.TestCase):
    def test_the_authority_tables_are_public(self):
        info = World().jview('contract_info')['authority']
        self.assertEqual(info['declaration_name'], 'goalpost-reports')
        self.assertEqual(info['authority_key'], '@reporting_authority')
        self.assertEqual(info['path_tenant_hosts']['gist.githubusercontent.com'], 1)
        self.assertIn('pastebin.com', info['flat_shared_hosts'])


if __name__ == '__main__':
    unittest.main()
