"""Static checks that catch GenVM-specific mistakes and repository rules before deployment."""

import ast
import re
import unittest

from support import CONTRACT_PATH, ROOT, load_contract_module

SOURCE = CONTRACT_PATH.read_text(encoding='utf-8')
TREE = ast.parse(SOURCE)
RUNNER = 'py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6'
FORBIDDEN_IMPORTS = {'os', 'sys', 'time', 'random', 'datetime', 'subprocess', 'socket', 'threading', 'requests', 'urllib'}
ARABIC_SCRIPT = re.compile('[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]')
SKIP_DIRS = {'node_modules', '.git', 'dist', '__pycache__', '.wrangler', '.venv'}
TEXT_SUFFIXES = {'.py', '.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.html', '.css', '.svg', '.toml', '.yml', '.yaml', '.txt', '.example', ''}


class ContractSourceTests(unittest.TestCase):
    def test_first_line_pins_the_stable_studionet_runner(self):
        self.assertEqual(SOURCE.splitlines()[0], '# { "Depends": "%s" }' % RUNNER)

    def test_runner_constant_matches_the_header(self):
        self.assertEqual(load_contract_module().RUNNER, RUNNER)

    def test_no_forbidden_imports(self):
        imported = set()
        for node in ast.walk(TREE):
            if isinstance(node, ast.Import):
                imported.update(alias.name.split('.')[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split('.')[0])
        self.assertEqual(imported & FORBIDDEN_IMPORTS, set())
        self.assertEqual(imported, {'genlayer', 'hashlib', 'json', 're', 'typing'})

    def test_no_floats(self):
        for node in ast.walk(TREE):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                self.assertNotEqual(node.func.id, 'float')
            if isinstance(node, ast.Constant):
                self.assertNotIsInstance(node.value, float)

    def test_sized_integer_types_are_annotations_only(self):
        for node in ast.walk(TREE):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                self.assertNotRegex(node.func.id, r'^[ui]\d+$', 'sized integers are not callable on every runtime')

    def test_nondeterministic_apis_are_confined_to_the_fetch_and_model_helpers(self):
        allowed = {'_fetch_text', '_audit_once'}
        offenders = []
        for function in [n for n in ast.walk(TREE) if isinstance(n, ast.FunctionDef)]:
            for node in ast.walk(function):
                if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Attribute):
                    chain = ast.unparse(node)
                    if chain.startswith('gl.nondet') and function.name not in allowed:
                        offenders.append((function.name, chain))
        # nested functions are visited under their parents too, so only top-level owners matter
        top_level = {n.name for n in TREE.body if isinstance(n, ast.FunctionDef)}
        self.assertEqual([o for o in offenders if o[0] in top_level], [])

    def test_only_run_nondet_unsafe_wrappers_call_the_vm(self):
        owners = set()
        for function in [n for n in TREE.body if isinstance(n, ast.FunctionDef)]:
            for node in ast.walk(function):
                if isinstance(node, ast.Call) and ast.unparse(node.func) == 'gl.vm.run_nondet_unsafe':
                    owners.add(function.name)
        self.assertEqual(owners, {'_run_scan', '_run_audit'})

    def test_public_methods_are_decorated_and_typed(self):
        contract = next(n for n in TREE.body if isinstance(n, ast.ClassDef) and n.name == 'Goalpost')
        decorated = []
        for method in [n for n in contract.body if isinstance(n, ast.FunctionDef)]:
            decorators = [ast.unparse(d) for d in method.decorator_list]
            if method.name.startswith('_'):
                self.assertEqual(decorators, [], method.name)
                continue
            self.assertEqual(len(decorators), 1, method.name)
            self.assertIn(decorators[0], ('gl.public.view', 'gl.public.write'))
            self.assertIsNotNone(method.returns, method.name)
            for arg in method.args.args[1:]:
                self.assertIn(ast.unparse(arg.annotation), ('str', 'int'), '%s.%s' % (method.name, arg.arg))
            decorated.append((method.name, decorators[0]))
        writes = {name for name, kind in decorated if kind == 'gl.public.write'}
        self.assertEqual(writes, {'register_pledge', 'check_pledge_integrity', 'retire_pledge', 'submit_report', 'evaluate_report'})

    def test_only_one_contract_class_exists(self):
        classes = [n for n in TREE.body if isinstance(n, ast.ClassDef)]
        self.assertEqual([c.name for c in classes], ['Goalpost'])

    def test_storage_fields_are_declared_in_the_class_body(self):
        contract = next(n for n in TREE.body if isinstance(n, ast.ClassDef))
        declared = {n.target.id for n in contract.body if isinstance(n, ast.AnnAssign)}
        assigned = set()
        for node in ast.walk(contract):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == 'self':
                        assigned.add(target.attr)
        self.assertLessEqual(assigned, declared, 'assigning an undeclared attribute would not persist')


class RepositoryRuleTests(unittest.TestCase):
    def test_no_persian_or_arabic_script_anywhere_in_the_repository(self):
        offenders = []
        for path in ROOT.rglob('*'):
            if not path.is_file() or any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.suffix not in TEXT_SUFFIXES:
                continue
            try:
                text = path.read_text(encoding='utf-8')
            except UnicodeDecodeError:
                continue
            if ARABIC_SCRIPT.search(text):
                offenders.append(path.relative_to(ROOT).as_posix())
        self.assertEqual(offenders, [])


if __name__ == '__main__':
    unittest.main()
