"""Offline production release tests; all network and deployment calls are mocked."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('production', ROOT / 'scripts/deploy-production.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
HEAD = 'a' * 40
ENV = {'VEARUNY_ALLOW_PRODUCTION_DEPLOY': 'YES',
       'VEARUNY_PRODUCTION_CONFIRMATION': p.PHRASE,
       'VEARUNY_PRODUCTION_EXPECTED_HEAD': HEAD, 'GCLOUD_PROJECT': 'vearuny'}


class ProductionTests(unittest.TestCase):
    def test_missing_authorization(self):
        for value in ('', 'yes', 'true'):
            with self.assertRaises(ValueError):
                p.authorization({'VEARUNY_ALLOW_PRODUCTION_DEPLOY': value}, p.PHRASE)

    def test_wrong_confirmation(self):
        for phrase in ('', p.PHRASE.lower(), p.PHRASE + ' '):
            with self.assertRaises(ValueError):
                p.authorization(ENV, phrase)

    def local(self, status='', head=HEAD, project='vearuny', site='vearuny'):
        contents = [json.dumps({'hosting': {'site': site}}),
                    json.dumps({'projects': {'default': project}})]
        with patch.object(p, 'run', side_effect=[head, status, json.dumps({'frontendCheckpoint': p.CHECKPOINT})]), \
             patch.object(Path, 'read_text', side_effect=contents):
            return p.local_state(HEAD)

    def test_wrong_project(self):
        with self.assertRaisesRegex(ValueError, 'project'):
            self.local(project='other')

    def test_wrong_site(self):
        with self.assertRaisesRegex(ValueError, 'site'):
            self.local(site='other')

    def test_dirty_worktree(self):
        for status in ('M site/index.html', '?? other.txt', '?? firepit-log.txt\n?? other.txt'):
            with self.assertRaisesRegex(ValueError, 'Dirty'):
                self.local(status=status)

    def test_expected_head(self):
        with self.assertRaisesRegex(ValueError, 'HEAD'):
            self.local(head='b' * 40)
        with self.assertRaises(ValueError):
            p.local_state('4d9a5ba')

    def test_known_untracked_allowed(self):
        self.assertEqual(self.local(status='?? firepit-log.txt'), HEAD)
        self.assertEqual(self.local(), HEAD)

    def live(self, version=p.LIVE_VERSION, digest=p.LIVE_HASH):
        data = {'status': 'success', 'result': {'channels': [{
            'name': 'projects/vearuny/sites/vearuny/channels/live',
            'release': {'version': {'name': 'projects/vearuny/sites/vearuny/versions/' + version}}}]}}
        with patch.object(p.subprocess, 'check_output', return_value=json.dumps(data)), \
             patch.object(p.urllib.request, 'urlopen') as request, \
             patch.object(p.hashlib, 'sha256') as sha:
            response = request.return_value.__enter__.return_value
            response.status = 200
            response.url = 'https://vearuny.web.app/'
            response.read.return_value = b'fixture'
            sha.return_value.hexdigest.return_value = digest
            return p.live_state()

    def test_live_version_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'version'):
            self.live(version='other')

    def test_live_hash_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'hash'):
            self.live(digest='other')

    def test_live_matches(self):
        self.assertEqual(self.live(), (p.LIVE_VERSION, p.LIVE_HASH))

    def test_exact_hosting_only_command(self):
        for args in (['deploy'], p.command()[1:] + ['--force'],
                     [x.replace('vearuny', 'other') for x in p.command()[1:]],
                     ['hosting:clone', 'vearuny:preview', 'vearuny:live']):
            with self.assertRaises(ValueError):
                p.hook_check(args, ENV)
        with self.assertRaises(ValueError):
            p.hook_check(p.command()[1:], {**ENV, 'GCLOUD_PROJECT': 'other'})

    def test_authorized_hook_rechecks_all_gates(self):
        with patch.object(p, 'local_state') as local, patch.object(p, 'release_tests') as tests, \
             patch.object(p, 'live_state') as live:
            p.hook_check(p.command()[1:], ENV)
        local.assert_called_once_with(HEAD)
        tests.assert_called_once()
        live.assert_called_once()

    def test_authorized_dry_run_never_deploys(self):
        with patch.dict(os.environ, ENV, clear=True), patch.object(p, 'local_state', return_value=HEAD), \
             patch.object(p, 'release_tests') as tests, \
             patch.object(p, 'live_state', return_value=(p.LIVE_VERSION, p.LIVE_HASH)), \
             patch.object(p.subprocess, 'call') as deploy, contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(p.main(['--expected-head', HEAD, '--confirm', p.PHRASE, '--dry-run']), 0)
        deploy.assert_not_called()
        tests.assert_called_once()
        report = json.loads(output.getvalue())
        self.assertEqual(report['HEAD'], HEAD)
        self.assertEqual(report['rollbackVersion'], p.LIVE_VERSION)
        self.assertTrue(report['dryRun'])

    def test_failed_tests_or_live_prevents_deploy(self):
        for failing in ('release_tests', 'live_state', 'local_state'):
            with patch.dict(os.environ, ENV, clear=True), patch.object(p, 'local_state', return_value=HEAD), \
                 patch.object(p, 'release_tests'), patch.object(p, 'live_state'), \
                 patch.object(p, failing, side_effect=ValueError('rejected')), \
                 patch.object(p.subprocess, 'call') as deploy, self.assertRaises(ValueError):
                p.main(['--expected-head', HEAD, '--confirm', p.PHRASE])
            deploy.assert_not_called()


if __name__ == '__main__':
    unittest.main()
