"""The demonstration scenarios must actually work under the contract's own rules."""

import unittest

from ideal import IDEAL, all_cases
from support import ROOT, load_contract_module, page_text, scenarios

M = load_contract_module()


class ScenarioDefinitionTests(unittest.TestCase):
    def test_every_scenario_element_passes_contract_validation(self):
        import json

        for scenario_id, scenario in scenarios().items():
            with self.subTest(scenario=scenario_id):
                parsed = M._parse_elements(json.dumps(scenario['elements']))
                self.assertEqual(len(parsed), len(scenario['elements']))
                self.assertIn(scenario['kind'], M.KINDS)

    def test_every_frozen_quote_is_on_its_pledge_page(self):
        for scenario_id, scenario in scenarios().items():
            haystack = M._norm(page_text(M, scenario['pledge_path']))
            for element in scenario['elements']:
                with self.subTest(scenario=scenario_id, element=element['key']):
                    self.assertIn(M._norm(element['quote']), haystack)

    def test_report_paths_live_under_the_report_prefix(self):
        for scenario_id, scenario in scenarios().items():
            for report in scenario['reports']:
                with self.subTest(scenario=scenario_id, report=report['id']):
                    self.assertTrue(report['path'].startswith(scenario['report_prefix_path']))
                    self.assertTrue((ROOT / 'public' / report['path'].lstrip('/')).is_file())

    def test_every_scenario_report_has_an_ideal_answer_and_matching_expectation(self):
        for scenario_id, scenario in scenarios().items():
            for report in scenario['reports']:
                with self.subTest(scenario=scenario_id, report=report['id']):
                    self.assertEqual(IDEAL[scenario_id][report['id']]['verdict'], report['expected'])

    def test_the_ideal_answers_cover_every_element(self):
        for scenario_id, report_id, case in all_cases():
            with self.subTest(scenario=scenario_id, report=report_id):
                keys = [element['key'] for element in scenarios()[scenario_id]['elements']]
                self.assertEqual([entry['key'] for entry in case['items']], keys)


class IdealAnswersHoldUpTests(unittest.TestCase):
    """Reconcile each ideal answer against its real page and check the verdict the contract derives."""

    def test_every_ideal_answer_yields_the_expected_verdict_with_all_excerpts_verified(self):
        for scenario_id, report_id, case in all_cases():
            with self.subTest(scenario=scenario_id, report=report_id):
                scenario = scenarios()[scenario_id]
                report = next(r for r in scenario['reports'] if r['id'] == report_id)
                elements = M._parse_elements(__import__('json').dumps(scenario['elements']))
                body = page_text(M, report['path'])
                outcome = M._reconcile(elements, {'elements': case['items']}, body)
                self.assertEqual(outcome['verdict'], case['verdict'])
                self.assertEqual(outcome['silent_keys'], sorted(case.get('silent', [])))
                for result in outcome['elements']:
                    self.assertNotEqual(result['status'], 'UNSUPPORTED', result)

    def test_pages_hide_no_text_from_the_extractor(self):
        text = page_text(M, '/evidence/meridian/pledge.html')
        self.assertNotIn('color-scheme', text)  # <style> was removed
        self.assertNotIn('<', text)
        self.assertIn('Scope 1 and Scope 2', text)  # &nbsp; became a space


if __name__ == '__main__':
    unittest.main()
