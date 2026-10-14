"""
Validator consensus must compare every decision-critical element classification, not only the
aggregate verdict and the silent-move set. Also covers the adversarial-publisher case, where
validators read different documents at the same URL.
"""

import json
import unittest

from gensim import Env, NoConsensus
from ideal import KEPT_ASSURANCE, answer_for
from support import CAROL, World, evidence_web, fixed_llm, item, load_contract_module, model_answer, url

M = load_contract_module()

ELEMENTS = M._parse_elements(json.dumps(__import__('support').scenarios()['meridian']['elements']))
DISCLOSED_REPORT_PATH = '/evidence/meridian/reports/2026-disclosed.html'


def disclosed_with_scope_unaddressed():
    """
    Same verdict (MOVED_DISCLOSED) and same silent set (none) as the ideal disclosed answer,
    but the scope element is classified NOT_ADDRESSED instead of MOVED_DISCLOSED.
    """
    entries = list(answer_for('meridian', 'disclosed')['elements'])
    entries[1] = item('target_scope', 'NOT_ADDRESSED')
    return model_answer(entries)


def outcome_for(answer, report_path=DISCLOSED_REPORT_PATH):
    from support import page_text

    text = page_text(M, report_path)
    return M._reconcile(ELEMENTS, answer, text), text


class EquivalenceRuleTests(unittest.TestCase):
    def test_the_two_answers_really_share_verdict_and_silent_set(self):
        honest, _ = outcome_for(answer_for('meridian', 'disclosed'))
        variant, _ = outcome_for(disclosed_with_scope_unaddressed())
        self.assertEqual(honest['verdict'], variant['verdict'])
        self.assertEqual(honest['silent_keys'], variant['silent_keys'])
        self.assertNotEqual(
            [entry['status'] for entry in honest['elements']],
            [entry['status'] for entry in variant['elements']],
        )

    def test_outcomes_that_classify_an_element_differently_are_not_equivalent(self):
        honest, text = outcome_for(answer_for('meridian', 'disclosed'))
        variant, _ = outcome_for(disclosed_with_scope_unaddressed())
        self.assertFalse(M._audit_equivalent(honest, variant, text, ELEMENTS))
        self.assertFalse(M._audit_equivalent(variant, honest, text, ELEMENTS))
        # without the frozen elements the rule is just as strict
        self.assertFalse(M._audit_equivalent(honest, variant, text))

    def test_identical_classifications_with_different_prose_and_excerpts_are_equivalent(self):
        honest, text = outcome_for(answer_for('meridian', 'disclosed'))
        reworded = json.loads(json.dumps(honest))
        for entry in reworded['elements']:
            entry['reason'] = 'a different explanation entirely'
        self.assertTrue(M._audit_equivalent(honest, reworded, text, ELEMENTS))

    def test_every_pair_of_distinct_statuses_is_rejected(self):
        honest, text = outcome_for(answer_for('meridian', 'disclosed'))
        statuses = [s for s in M._ALL_STATUSES]
        for index in range(len(ELEMENTS)):
            for status in statuses:
                if status == honest['elements'][index]['status']:
                    continue
                with self.subTest(element=ELEMENTS[index]['key'], status=status):
                    tampered = json.loads(json.dumps(honest))
                    tampered['elements'][index]['status'] = status
                    # keep verdict and silent set equal so only the classification can reject it
                    tampered['verdict'] = honest['verdict']
                    tampered['silent_keys'] = honest['silent_keys']
                    self.assertFalse(M._audit_equivalent(tampered, honest, text, ELEMENTS))

    def test_malformed_classifications_are_rejected(self):
        honest, text = outcome_for(answer_for('meridian', 'disclosed'))
        cases = {}
        missing = json.loads(json.dumps(honest))
        missing['elements'].pop()
        cases['missing element'] = missing
        reordered = json.loads(json.dumps(honest))
        reordered['elements'].reverse()
        cases['reordered'] = reordered
        renamed = json.loads(json.dumps(honest))
        renamed['elements'][0]['key'] = 'other_key'
        cases['renamed key'] = renamed
        unknown = json.loads(json.dumps(honest))
        unknown['elements'][0]['status'] = 'PERFECT'
        cases['unknown status'] = unknown
        not_a_list = dict(honest, elements='nope')
        cases['not a list'] = not_a_list
        with_junk = json.loads(json.dumps(honest))
        with_junk['elements'][0] = 'junk'
        cases['junk entry'] = with_junk
        for name, theirs in cases.items():
            with self.subTest(name):
                self.assertFalse(M._audit_equivalent(theirs, honest, text, ELEMENTS))

    def test_a_verdict_that_does_not_follow_from_the_statuses_is_rejected(self):
        honest, text = outcome_for(answer_for('meridian', 'disclosed'))
        # both sides claim KEPT for a set of statuses that is not KEPT
        liar = dict(honest, verdict='KEPT')
        other = dict(honest, verdict='KEPT')
        self.assertFalse(M._audit_equivalent(liar, other, text, ELEMENTS))

    def test_failures_still_agree_when_for_the_same_reason(self):
        failing = {'ok': False, 'reason': 'HTTP_4XX'}
        self.assertTrue(M._audit_equivalent(failing, dict(failing), ''))
        self.assertFalse(M._audit_equivalent(failing, {'ok': False, 'reason': 'EMPTY'}, ''))


class ValidatorConsensusTests(unittest.TestCase):
    def setup(self):
        w = World(llm=fixed_llm(answer_for('meridian', 'disclosed')))
        pid = w.register('meridian')
        return w, pid, w.submit(pid, 'meridian', 'disclosed')

    def test_validators_that_classify_one_element_differently_block_the_verdict(self):
        w, pid, audit_id = self.setup()
        variant = Env(w.web, fixed_llm(disclosed_with_scope_unaddressed()))
        with self.assertRaises(NoConsensus):
            w.tx('evaluate_report', audit_id, sender=CAROL, validator_envs=[variant] * 4)
        audit = w.jview('get_audit_bundle', audit_id)['audit']
        self.assertEqual((audit['state'], audit['verdict'], audit['elements']), ('PENDING', '', []))
        self.assertEqual(w.view('standing_of', pid), 'UNAUDITED')
        self.assertEqual(w.jview('stats')['settled'], 0)

    def test_a_majority_that_classifies_every_element_alike_still_settles_with_the_leaders_statuses(self):
        w, pid, audit_id = self.setup()
        honest = Env(w.web, fixed_llm(answer_for('meridian', 'disclosed')))
        variant = Env(w.web, fixed_llm(disclosed_with_scope_unaddressed()))
        self.assertEqual(w.tx('evaluate_report', audit_id, validator_envs=[honest, honest, variant, variant]), 'MOVED_DISCLOSED')
        self.assertEqual(w.last_rounds, [[True, True, True, False, False]])
        statuses = [entry['status'] for entry in w.jview('get_audit_bundle', audit_id)['audit']['elements']]
        self.assertEqual(statuses, ['MOVED_DISCLOSED', 'MOVED_DISCLOSED', 'KEPT'])

    def test_a_dishonest_leader_that_downgrades_one_element_is_outvoted(self):
        w, pid, audit_id = self.setup()
        honest = Env(w.web, fixed_llm(answer_for('meridian', 'disclosed')))
        with self.assertRaises(NoConsensus):
            w.tx('evaluate_report', audit_id, llm=fixed_llm(disclosed_with_scope_unaddressed()), validator_envs=[honest] * 4)
        self.assertEqual(w.jview('get_audit_bundle', audit_id)['audit']['state'], 'PENDING')

    def test_the_pending_audit_can_be_evaluated_again_after_a_failed_round(self):
        w, pid, audit_id = self.setup()
        variant = Env(w.web, fixed_llm(disclosed_with_scope_unaddressed()))
        with self.assertRaises(NoConsensus):
            w.tx('evaluate_report', audit_id, validator_envs=[variant] * 4)
        self.assertEqual(w.tx('evaluate_report', audit_id), 'MOVED_DISCLOSED')


class AdversarialPublisherTests(unittest.TestCase):
    """The publisher serves a different document on every request, so validators read different reports."""

    PLEDGE = '/evidence/flapping/pledge.html'
    PREFIX = '/evidence/flapping/reports/'
    REPORT = url('/evidence/flapping/reports/2026-a.html')

    VARIANTS = {
        'faithful': '/evidence/meridian/reports/2026-faithful.html',
        'silent': '/evidence/meridian/reports/2026-silent.html',
        'disclosed': '/evidence/meridian/reports/2026-disclosed.html',
    }

    def env_seeing(self, variant):
        web = evidence_web()
        web[self.REPORT] = web[url(self.VARIANTS[variant])]
        return Env(web, fixed_llm(answer_for('meridian', variant)))

    def setup_world(self):
        w = World(llm=fixed_llm(answer_for('meridian', 'faithful')))
        pid = w.register('meridian', pledge_url=url(self.PLEDGE), report_prefix=url(self.PREFIX))
        audit_id = w.tx('submit_report', pid, self.REPORT, 'FY2026')
        return w, pid, audit_id

    def test_the_adversarial_demonstration_pledge_registers_under_the_contract_rules(self):
        w, pid, _ = self.setup_world()
        record = w.jview('get_pledge_bundle', pid)['pledge']
        self.assertEqual(record['integrity']['state'], 'VERIFIED')
        self.assertEqual(record['authority']['scope'], 'goalpost.example')

    def test_three_validators_reading_three_different_documents_cannot_settle_anything(self):
        w, pid, audit_id = self.setup_world()
        leader = self.env_seeing('silent')
        with self.assertRaises(NoConsensus):
            w.tx(
                'evaluate_report', audit_id, web=leader.web, llm=leader.llm,
                validator_envs=[self.env_seeing('faithful'), self.env_seeing('disclosed'), self.env_seeing('faithful'), self.env_seeing('disclosed')],
            )
        audit = w.jview('get_audit_bundle', audit_id)['audit']
        self.assertEqual((audit['state'], audit['verdict']), ('PENDING', ''))
        self.assertEqual(w.view('standing_of', pid), 'UNAUDITED')
        self.assertEqual(w.view('strikes_of', pid), 0)

    def test_a_publisher_cannot_earn_a_strike_for_a_report_most_validators_did_not_read_as_silent(self):
        w, pid, audit_id = self.setup_world()
        leader = self.env_seeing('silent')
        with self.assertRaises(NoConsensus):
            w.tx(
                'evaluate_report', audit_id, web=leader.web, llm=leader.llm,
                validator_envs=[self.env_seeing('faithful')] * 4,
            )
        self.assertEqual(w.view('strikes_of', pid), 0)

    def test_when_a_majority_does_read_the_same_document_that_reading_is_what_is_recorded(self):
        w, pid, audit_id = self.setup_world()
        leader = self.env_seeing('silent')
        verdict = w.tx(
            'evaluate_report', audit_id, web=leader.web, llm=leader.llm,
            validator_envs=[self.env_seeing('silent'), self.env_seeing('silent'), self.env_seeing('faithful'), self.env_seeing('disclosed')],
        )
        self.assertEqual(verdict, 'MOVED_SILENTLY')
        self.assertEqual(w.last_rounds, [[True, True, True, False, False]])
        audit = w.jview('get_audit_bundle', audit_id)['audit']
        self.assertEqual(audit['silent_keys'], ['emissions_target', 'target_scope'])


class UnreadableReportTests(unittest.TestCase):
    def test_a_withheld_report_settles_as_inconclusive_without_asking_a_model(self):
        w = World(llm=fixed_llm(RuntimeError('the model must not be called')))
        pid = w.register('meridian')
        audit_id = w.tx('submit_report', pid, url('/evidence/meridian/reports/2026-withheld.html'), 'FY2026')
        self.assertEqual(w.tx('evaluate_report', audit_id, sender=CAROL), 'INCONCLUSIVE')
        self.assertEqual(w.last_prompts, [])
        audit = w.jview('get_audit_bundle', audit_id)['audit']
        self.assertEqual((audit['state'], audit['verdict'], audit['failure_reason']), ('SETTLED', 'INCONCLUSIVE', 'EMPTY'))
        self.assertEqual(audit['elements'], [])
        self.assertEqual(w.view('standing_of', pid), 'UNAUDITED')
        self.assertEqual(w.view('recompute_attestation', audit_id), audit['attestation'])

    def test_a_404_settles_as_inconclusive_with_the_http_class(self):
        w = World()
        pid = w.register('meridian')
        missing = url('/evidence/meridian/reports/2026-missing.html')
        audit_id = w.tx('submit_report', pid, missing, 'FY2026')
        web = evidence_web()
        web[missing] = (404, 'not found')
        self.assertEqual(w.tx('evaluate_report', audit_id, web=web, validator_envs=[Env(web)] * 4), 'INCONCLUSIVE')
        self.assertEqual(w.jview('get_audit_bundle', audit_id)['audit']['failure_reason'], 'HTTP_4XX')


if __name__ == '__main__':
    unittest.main()
