"""Offline regression tests for fresh, atomic Nginx release staging."""
import importlib.util
import gzip
import io
from pathlib import Path
import tempfile
import tarfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_nginx_release', ROOT / 'scripts/stage-nginx-release.py')
stager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stager)


class NginxReleaseStagingTests(unittest.TestCase):
    def bundle(self, path, extra=None, broken=False, rollback=False):
        with tarfile.open(path, 'w:gz') as archive:
            entries = {
                'site/index.html': b'<h1>release fixture</h1>',
                'docker-compose.order.yml': b'services: {}\n',
                'nginx.conf': b'server {}\n',
            }
            if not rollback:
                entries.update({'firebase.json': b'{"hosting":{}}\n',
                                '.firebaserc': b'{"projects":{}}\n'})
            if extra:
                entries[extra] = b'unexpected'
            if broken:
                entries['site/broken'] = b'x' * 100
            for name, content in entries.items():
                info = tarfile.TarInfo(name)
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
        if broken:
            raw = gzip.decompress(path.read_bytes())
            header = raw.index(b'site/broken')
            member_start = header - (header % tarfile.BLOCKSIZE)
            path.write_bytes(gzip.compress(raw[:member_start + tarfile.BLOCKSIZE + 5]))

    def paths(self, root):
        return sorted(path.relative_to(root).as_posix() for path in root.rglob('*'))

    def test_existing_temporary_or_final_destination_is_refused(self):
        for release_kind in ('release', 'rollback'):
            for occupied in ('temporary', 'destination'):
                with self.subTest(release_kind=release_kind, occupied=occupied), tempfile.TemporaryDirectory() as tmp:
                    parent = Path(tmp)
                    archive = parent / 'bundle.tar.gz'
                    temporary, destination = parent / 'stage', parent / f'{release_kind}-v1'
                    self.bundle(archive, rollback=release_kind == 'rollback')
                    existing = temporary if occupied == 'temporary' else destination
                    existing.mkdir()
                    marker = existing / 'keep.txt'
                    marker.write_text('preserve')
                    with self.assertRaisesRegex(ValueError, 'already exists'):
                        stager.stage_archive(archive, temporary, destination)
                    self.assertEqual(marker.read_text(), 'preserve')

    def test_fresh_extraction_contains_only_audited_archive_files(self):
        for release_kind in ('release', 'rollback'):
            with self.subTest(release_kind=release_kind), tempfile.TemporaryDirectory() as tmp:
                parent = Path(tmp)
                archive = parent / 'bundle.tar.gz'
                temporary, destination = parent / 'stage', parent / f'{release_kind}-v1'
                stale = parent / 'old-release' / 'stale.txt'
                stale.parent.mkdir()
                stale.write_text('must not be copied')
                self.bundle(archive, rollback=release_kind == 'rollback')
                stager.stage_archive(archive, temporary, destination)
                self.assertFalse(temporary.exists())
                expected = ['docker-compose.order.yml', 'nginx.conf', 'site', 'site/index.html']
                if release_kind == 'release':
                    expected.extend(['.firebaserc', 'firebase.json'])
                self.assertEqual(self.paths(destination), sorted(expected))
                self.assertFalse((destination / 'stale.txt').exists())

    def test_failed_extraction_never_changes_active_release(self):
        for release_kind in ('release', 'rollback'):
            with self.subTest(release_kind=release_kind), tempfile.TemporaryDirectory() as tmp:
                parent = Path(tmp)
                archive = parent / 'broken.tar.gz'
                temporary, destination = parent / 'stage', parent / f'{release_kind}-new'
                active = parent / 'active' / 'site' / 'index.html'
                active.parent.mkdir(parents=True)
                active.write_text('currently serving')
                self.bundle(archive, broken=True, rollback=release_kind == 'rollback')
                with self.assertRaises((OSError, tarfile.TarError, ValueError)):
                    stager.stage_archive(archive, temporary, destination)
                self.assertEqual(active.read_text(), 'currently serving')
                self.assertFalse(destination.exists())
                self.assertFalse(temporary.exists())

    def test_unexpected_archive_entries_are_refused_for_release_and_rollback(self):
        for release_kind in ('release', 'rollback'):
            with self.subTest(release_kind=release_kind), tempfile.TemporaryDirectory() as tmp:
                parent = Path(tmp)
                archive = parent / 'bundle.tar.gz'
                temporary, destination = parent / 'stage', parent / f'{release_kind}-new'
                self.bundle(archive, extra='stale-or-extra.txt', rollback=release_kind == 'rollback')
                with self.assertRaisesRegex(ValueError, 'Unexpected release entry'):
                    stager.stage_archive(archive, temporary, destination)
                self.assertFalse(destination.exists())
                self.assertFalse(temporary.exists())


if __name__ == '__main__':
    unittest.main()
