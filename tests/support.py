"""Shared helpers for the Goalpost test suite. Standard library only."""

from __future__ import annotations

import calendar
import importlib.util
import json
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import gensim
from gensim import Address, Env, Message, RUNTIME, UserError

ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = ROOT / 'contracts' / 'goalpost.py'
EVIDENCE_DIR = ROOT / 'public' / 'evidence'
SCENARIOS_PATH = ROOT / 'src' / 'data' / 'scenarios.json'

BASE = 'https://goalpost.example'


def addr(number: int) -> Address:
    return Address('0x' + format(number, '040x'))


ALICE = addr(0xA11CE)
BOB = addr(0xB0B)
CAROL = addr(0xCA401)
CONTRACT = addr(0xC0417AC7)


def load_contract_module() -> Any:
    """Execute the real contract file against the simulated SDK."""
    gensim.install()
    spec = importlib.util.spec_from_file_location('goalpost_contract_under_test', CONTRACT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def scenarios() -> Dict[str, Dict[str, Any]]:
    data = json.loads(SCENARIOS_PATH.read_text(encoding='utf-8'))
    return {item['id']: item for item in data['scenarios']}


def evidence_web() -> Dict[str, Any]:
    """Serve every file under public/evidence as https://goalpost.example/evidence/..."""
    routes: Dict[str, Any] = {}
    for path in EVIDENCE_DIR.rglob('*.html'):
        relative = path.relative_to(ROOT / 'public').as_posix()
        routes[BASE + '/' + relative] = (200, path.read_text(encoding='utf-8'))
    return routes


def url(path: str) -> str:
    return BASE + path


def elements_json(scenario_id: str) -> str:
    return json.dumps(scenarios()[scenario_id]['elements'])


def page_text(module: Any, path: str) -> str:
    """Visible text of an evidence page, as the contract itself extracts it."""
    return module._html_to_text((ROOT / 'public' / path.lstrip('/')).read_text(encoding='utf-8'))


def model_answer(items: List[Dict[str, str]]) -> Dict[str, Any]:
    """Shape a model reply the way the prompt asks for it."""
    return {'elements': items}


def item(key: str, status: str, report: str = '', disclosure: str = '', reason: str = 'because') -> Dict[str, str]:
    return {
        'key': key,
        'status': status,
        'report_excerpt': report,
        'disclosure_excerpt': disclosure,
        'reason': reason,
    }


def fixed_llm(reply: Any) -> Callable[[str], Any]:
    """A model that ignores the prompt and always gives the same answer."""

    def respond(prompt: str) -> Any:
        return reply

    return respond


class World:
    """One deployed contract, a controllable clock, and a network of nodes."""

    def __init__(
        self,
        web: Optional[Dict[str, Any]] = None,
        llm: Optional[Callable[[str], Any]] = None,
        validators: int = 4,
    ) -> None:
        self.module = load_contract_module()
        self.contract = self.module.Goalpost()
        self.web: Dict[str, Any] = web if web is not None else evidence_web()
        self.llm = llm
        self.validators = validators
        self._clock = calendar.timegm((2026, 9, 28, 10, 0, 0))
        self.last_prompts: List[str] = []
        self.last_requests: List[str] = []
        self.last_rounds: List[List[bool]] = []

    # ------------------------------------------------------------------ clock

    def advance(self, seconds: int) -> None:
        self._clock += seconds

    def _stamp(self) -> str:
        return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(self._clock)) + '.000000Z'

    @property
    def now(self) -> int:
        return self._clock

    # ---------------------------------------------------------------- execution

    def tx(
        self,
        method: str,
        *args: Any,
        sender: Address = ALICE,
        web: Optional[Dict[str, Any]] = None,
        llm: Optional[Callable[[str], Any]] = None,
        validator_envs: Optional[List[Env]] = None,
    ) -> Any:
        """Run a write method as a transaction. On any exception the storage is rolled back."""
        self.advance(30)
        RUNTIME.reset()
        leader = Env(web if web is not None else self.web, llm if llm is not None else self.llm)
        RUNTIME.env = leader
        RUNTIME.validator_envs = validator_envs if validator_envs is not None else [leader] * self.validators
        gensim.GL.message = Message(sender, CONTRACT)
        gensim.GL.message_raw = {'datetime': self._stamp()}

        before = gensim.snapshot(self.contract)
        try:
            return getattr(self.contract, method)(*args)
        except BaseException:
            gensim.restore(self.contract, before)
            raise
        finally:
            self.last_prompts = list(RUNTIME.prompts)
            self.last_requests = list(RUNTIME.requests)
            self.last_rounds = [list(votes) for votes in RUNTIME.rounds]

    def view(self, method: str, *args: Any) -> Any:
        RUNTIME.reset()
        gensim.GL.message = Message(ALICE, CONTRACT)
        gensim.GL.message_raw = {'datetime': self._stamp()}
        return getattr(self.contract, method)(*args)

    def jview(self, method: str, *args: Any) -> Any:
        return json.loads(self.view(method, *args))

    # ---------------------------------------------------------------- shortcuts

    def register(self, scenario_id: str = 'meridian', **overrides: Any) -> str:
        scenario = scenarios()[scenario_id]
        params = {
            'title': scenario['title'],
            'kind': scenario['kind'],
            'pledge_url': url(scenario['pledge_path']),
            'report_prefix': url(scenario['report_prefix_path']),
            'elements_json': json.dumps(scenario['elements']),
        }
        params.update(overrides)
        sender = params.pop('sender', ALICE)
        return self.tx(
            'register_pledge',
            params['title'],
            params['kind'],
            params['pledge_url'],
            params['report_prefix'],
            params['elements_json'],
            sender=sender,
        )

    def submit(self, pledge_id: str, scenario_id: str, report_id: str, sender: Address = BOB) -> str:
        report = next(r for r in scenarios()[scenario_id]['reports'] if r['id'] == report_id)
        return self.tx('submit_report', pledge_id, url(report['path']), report['period'], sender=sender)


def expect_user_error(test: Any, fragment: str) -> Any:
    """assertRaises for UserError, also checking the message."""

    class _Context:
        def __enter__(self) -> '_Context':
            return self

        def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> bool:
            test.assertIsNotNone(exc_type, 'expected the call to be rejected')
            test.assertTrue(issubclass(exc_type, UserError), 'expected UserError, got %r' % (exc,))
            test.assertIn(fragment.lower(), exc.message.lower())
            return True

    return _Context()
