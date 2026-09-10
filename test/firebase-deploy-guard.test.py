"""Offline guard/hook/wrapper tests. Never invokes Firebase or its network APIs."""
import importlib.util
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('guard', ROOT / 'scripts/firebase-deploy-guard.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
CHANNEL = 'phase5g-acceptance-20260910'


class DeploymentGuardTests(unittest.TestCase):
    def test_live_commands_denied_even_with_old_authorization(self):
        for args in (['deploy'], ['deploy', '--only', 'hosting'],
                     ['deploy', '--only', 'hosting:vearuny-site'],
                     ['hosting:clone', 'vearuny:preview', 'vearuny:live']):
            for flag in ('', 'vearuny:live:explicitly-approved'):
                with self.subTest(args=args, flag=flag), self.assertRaises(ValueError):
                    guard.authorize(args, {'GCLOUD_PROJECT': 'vearuny',
                                          'VEARUNY_PRODUCTION_AUTHORIZATION': flag})

    def test_preview_scope(self):
        args = guard.preview_arguments(CHANNEL)
        guard.authorize(args, {'GCLOUD_PROJECT': 'vearuny'})
        self.assertNotIn('--only', args)
        for altered in (args + ['--only', 'hosting'], args + ['--project', 'other'],
                        args + ['--config', '/tmp/other.json'],
                        ['deploy', *args[1:]], args[:-1],
                        [x.replace('7d', '30d') for x in args]):
            with self.subTest(args=altered), self.assertRaises(ValueError):
                guard.authorize(altered, {'GCLOUD_PROJECT': 'vearuny'})

    def test_reserved_and_normalized_channels(self):
        for channel in ('live', 'LIVE', ' live ', 'live/', '--live', 'restore-check-20260907',
                        '', 'foo/bar', 'foo_bar', 'a' * 41):
            with self.subTest(channel=channel), self.assertRaises(ValueError):
                guard.preview_arguments(channel)

    def test_other_or_missing_project_denied(self):
        for env in ({}, {'GCLOUD_PROJECT': 'other'}):
            with self.assertRaises(ValueError):
                guard.authorize(guard.preview_arguments(CHANNEL), env)

    def test_no_target_alias_can_masquerade_as_preview(self):
        rc = json.loads((ROOT / '.firebaserc').read_text())
        hosting = json.loads((ROOT / 'firebase.json').read_text())['hosting']
        self.assertNotIn('targets', rc)
        self.assertNotIn('target', hosting)
        self.assertEqual(hosting['site'], 'vearuny')
        self.assertEqual(hosting['public'], 'site')

    def test_hook_process_ancestry_offline(self):
        # An inert fixture models CLI -> shell -> hook using real /proc ancestry.
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Path(tmp) / 'firebase'
            fixture.write_text('import subprocess,sys\n'
                               'sys.exit(subprocess.call(["sh", "-c", '
                               + repr('python3 -B ' + str(ROOT / 'scripts/firebase-deploy-guard.py')) + ']))\n')
            for args, allowed in ((['deploy'], False), (['deploy', '--only', 'hosting'], False),
                                  (guard.preview_arguments(CHANNEL), True),
                                  (['hosting:channel:deploy', 'live'], False)):
                result = subprocess.run([sys.executable, str(fixture), *args],
                                        env={**os.environ, 'GCLOUD_PROJECT': 'vearuny'},
                                        capture_output=True, text=True)
                self.assertEqual(result.returncode == 0, allowed, result.stderr)

    def test_hook_without_cli_fails_closed(self):
        result = subprocess.run([sys.executable, '-B', str(ROOT / 'scripts/firebase-deploy-guard.py')],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)

    def run_wrapper(self, arguments, audit_status=0):
        audit = subprocess.CompletedProcess([], audit_status,
                    json.dumps({'publicDirectory': 'site', 'frontendCheckpoint': 'fixture',
                                'fileCount': 31, 'totalBytes': 123}), 'audit rejected' if audit_status else '')
        with patch.object(sys, 'argv', ['deploy-preview.py', *arguments]), \
             patch('subprocess.run', return_value=audit) as preflight, \
             patch('subprocess.call', return_value=0) as firebase, \
             patch('builtins.print'), self.assertRaises(SystemExit):
            runpy.run_path(str(ROOT / 'scripts/deploy-preview.py'), run_name='__main__')
        return preflight, firebase

    def test_prepare_never_invokes_firebase(self):
        audit, firebase = self.run_wrapper([CHANNEL, '--prepare'])
        audit.assert_called_once()
        firebase.assert_not_called()

    def test_audit_failure_prevents_channel_creation(self):
        audit, firebase = self.run_wrapper([CHANNEL], audit_status=1)
        audit.assert_called_once()
        firebase.assert_not_called()

    def test_wrapper_only_uses_channel_command(self):
        with patch.dict(os.environ, {'VEARUNY_PRODUCTION_AUTHORIZATION': 'vearuny:live:explicitly-approved'}):
            audit, firebase = self.run_wrapper([CHANNEL])
        audit.assert_called_once()
        firebase.assert_called_once()
        self.assertEqual(firebase.call_args.args[0], ['firebase', *guard.preview_arguments(CHANNEL)])
        self.assertNotIn('VEARUNY_PRODUCTION_AUTHORIZATION', firebase.call_args.kwargs['env'])

    def test_wrapper_rejects_live_before_audit(self):
        audit, firebase = self.run_wrapper(['live'])
        audit.assert_not_called()
        firebase.assert_not_called()


if __name__ == '__main__':
    unittest.main()
