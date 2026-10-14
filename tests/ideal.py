"""
What a careful model would answer for every demonstration report.

The contract never trusts these answers: it re-verifies every excerpt against the page and
applies the anchor rules. Tests use them to prove that the shipped evidence pages and
scenario definitions are consistent with the contract's rules.
"""

from typing import Any, Dict, List

from support import item, model_answer

KEPT_ASSURANCE = 'Progress continues to be verified each year by an independent third-party assurance provider.'

IDEAL: Dict[str, Dict[str, Dict[str, Any]]] = {
    'meridian': {
        'faithful': {
            'verdict': 'KEPT',
            'items': [
                item('emissions_target', 'KEPT', 'Against our 2019 baseline, our absolute Scope 1 and Scope 2 greenhouse gas emissions fell 17% by the end of 2025, keeping us on course for our 40% reduction by 2030.'),
                item('target_scope', 'KEPT', 'The target continues to apply to every wholly owned power plant and excludes no facility.'),
                item('assurance', 'KEPT', KEPT_ASSURANCE),
            ],
        },
        'silent': {
            'verdict': 'MOVED_SILENTLY',
            'silent': ['emissions_target', 'target_scope'],
            'items': [
                item('emissions_target', 'MOVED_SILENT', 'We will cut our emissions intensity of Scope 1 and Scope 2 greenhouse gas emissions by 40% by 2035, measured against our 2022 baseline.'),
                item('target_scope', 'MOVED_SILENT', 'The target applies to plants in our continuing portfolio; assets held for sale are not included.'),
                item('assurance', 'KEPT', KEPT_ASSURANCE),
            ],
        },
        'disclosed': {
            'verdict': 'MOVED_DISCLOSED',
            'items': [
                item('emissions_target', 'MOVED_DISCLOSED',
                     'Our target is now a 40% reduction in emissions intensity per megawatt-hour by 2035, against a 2022 baseline.',
                     'In 2026 the board revised the target we published in 2025.'),
                item('target_scope', 'MOVED_DISCLOSED',
                     'The revised target excludes assets held for sale.',
                     'This is a change from the original pledge and is explained in Section 4.'),
                item('assurance', 'KEPT', KEPT_ASSURANCE),
            ],
        },
        'withheld': {
            # The page has no readable report, so validators settle INCONCLUSIVE without any model call.
            'verdict': 'INCONCLUSIVE',
            'unreadable': True,
            'items': [],
        },
        'partial': {
            'verdict': 'INCOMPLETE',
            'items': [
                item('emissions_target', 'KEPT', 'Against our 2019 baseline, our absolute Scope 1 and Scope 2 greenhouse gas emissions fell 21% by the end of 2026, keeping us on course for our 40% reduction by 2030.'),
                item('target_scope', 'NOT_ADDRESSED'),
                item('assurance', 'NOT_ADDRESSED'),
            ],
        },
    },
    'halden': {
        'faithful': {
            'verdict': 'KEPT',
            'items': [
                item('primary_outcome', 'KEPT', 'The primary outcome was the change in seated systolic blood pressure from baseline to week 12, as registered.'),
                item('sample_size', 'KEPT', 'The trial enrolled 240 participants, randomised 1:1.'),
                item('analysis_plan', 'KEPT', 'The primary analysis followed the intention-to-treat principle.'),
            ],
        },
        'silent': {
            'verdict': 'MOVED_SILENTLY',
            'silent': ['analysis_plan', 'primary_outcome', 'sample_size'],
            'items': [
                item('primary_outcome', 'MOVED_SILENT', 'The primary outcome was the change in 24-hour ambulatory diastolic blood pressure from baseline to week 24.'),
                item('sample_size', 'MOVED_SILENT', 'The trial enrolled 186 participants, randomised 1:1.'),
                item('analysis_plan', 'MOVED_SILENT', 'The primary analysis followed the per-protocol principle.'),
            ],
        },
        'disclosed': {
            'verdict': 'MOVED_DISCLOSED',
            'items': [
                item('primary_outcome', 'MOVED_DISCLOSED',
                     'The primary outcome is now the change in 24-hour ambulatory diastolic blood pressure from baseline to week 24, replacing seated systolic blood pressure at week 12.',
                     'We changed the primary outcome after registration.'),
                item('sample_size', 'MOVED_DISCLOSED',
                     'Recruitment stopped early because of funding limits, so the trial enrolled 186 participants instead of the planned 240.',
                     'Recruitment stopped early because of funding limits'),
                item('analysis_plan', 'MOVED_DISCLOSED',
                     'The primary analysis followed the per-protocol principle, a departure from the registered plan.',
                     'a departure from the registered plan'),
            ],
        },
    },
}


def answer_for(scenario_id: str, report_id: str) -> Dict[str, Any]:
    return model_answer(IDEAL[scenario_id][report_id]['items'])


def all_cases() -> List[tuple]:
    """Every demonstration report that a model reads. Unreadable reports never reach the model."""
    return [(s, r, case) for s, reports in IDEAL.items() for r, case in reports.items() if not case.get('unreadable')]
