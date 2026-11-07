"""Extract and audit a fresh Nginx release directory before publishing it."""
import argparse
import ctypes
import errno
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sys
import tarfile


ALLOWED_ROOT_FILES = {'.firebaserc', 'docker-compose.order.yml', 'firebase.json', 'nginx.conf'}
REQUIRED_ROOT_FILES = {'docker-compose.order.yml', 'nginx.conf'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def normalized_member(member):
    name = member.name
    require(name and not name.startswith('/'), f'Unsafe archive path: {name!r}')
    path = PurePosixPath(name)
    require(all(part not in ('', '.', '..') for part in path.parts),
            f'Unsafe archive path: {name!r}')
    require(path.parts[0] == 'site' or (len(path.parts) == 1 and path.name in ALLOWED_ROOT_FILES),
            f'Unexpected release entry: {name!r}')
    require(member.isdir() or member.isfile(), f'Links and special files are forbidden: {name!r}')
    return path


def audit_tree(root, manifest=None):
    require((root / 'site').is_dir(), 'Staged release has no site directory')
    for required_file in REQUIRED_ROOT_FILES:
        require((root / required_file).is_file(), f'Staged release is missing {required_file}')
    for current, directories, files in os.walk(root, followlinks=False):
        for name in directories + files:
            path = Path(current) / name
            require(not path.is_symlink(), f'Symlink in staged release: {path.relative_to(root)}')
            require(not name.startswith('.') or path.relative_to(root).as_posix() == '.firebaserc',
                    f'Hidden staged entry: {path.relative_to(root)}')
    require(any((root / 'site').iterdir()), 'Staged site directory is empty')
    if manifest:
        expected = {item['path']: (item['bytes'], item['sha256'])
                    for item in json.loads(Path(manifest).read_text())['files']}
        actual = {}
        for path in (root / 'site').rglob('*'):
            if path.is_file():
                data = path.read_bytes()
                actual[path.relative_to(root / 'site').as_posix()] = (
                    len(data), hashlib.sha256(data).hexdigest())
        require(actual == expected, 'Staged site differs from the reviewed publish manifest')


def rename_without_replacement(source, destination):
    libc = ctypes.CDLL(None, use_errno=True)
    renameat2 = getattr(libc, 'renameat2', None)
    require(renameat2 is not None, 'Atomic no-replace rename is unavailable on this host')
    renameat2.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p,
                          ctypes.c_uint]
    renameat2.restype = ctypes.c_int
    result = renameat2(-100, os.fsencode(source), -100, os.fsencode(destination), 1)
    if result != 0:
        error = ctypes.get_errno()
        if error == errno.EEXIST:
            raise FileExistsError(error, os.strerror(error), str(destination))
        raise OSError(error, os.strerror(error), str(destination))


def stage_archive(archive, temporary, destination, manifest=None):
    archive = Path(archive)
    temporary = Path(temporary)
    destination = Path(destination)
    require(temporary.parent == destination.parent,
            'Temporary and final directories must share a parent for atomic promotion')
    require(not temporary.exists() and not temporary.is_symlink(),
            f'Temporary destination already exists: {temporary}')
    require(not destination.exists() and not destination.is_symlink(),
            f'Final destination already exists: {destination}')
    require(archive.is_file(), f'Release archive is missing: {archive}')

    temporary.parent.mkdir(parents=True, exist_ok=True)
    temporary.mkdir(mode=0o755)
    try:
        require(not any(temporary.iterdir()), 'Temporary directory must be empty before extraction')
        with tarfile.open(archive, mode='r:gz') as bundle:
            members = bundle.getmembers()
            seen = set()
            for member in members:
                path = normalized_member(member)
                require(path.as_posix() not in seen, f'Duplicate archive path: {member.name!r}')
                seen.add(path.as_posix())
            bundle.extractall(temporary, members=members, filter='data')
        audit_tree(temporary, manifest)
        require(not destination.exists() and not destination.is_symlink(),
                f'Final destination already exists: {destination}')
        rename_without_replacement(temporary, destination)
    except BaseException:
        shutil.rmtree(temporary, ignore_errors=True)
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True)
    parser.add_argument('--temporary', required=True)
    parser.add_argument('--destination', required=True)
    parser.add_argument('--manifest')
    args = parser.parse_args(argv)
    stage_archive(args.archive, args.temporary, args.destination, args.manifest)
    print(f'Release staged and audited at {args.destination}')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, tarfile.TarError) as error:
        sys.exit(f'NGINX RELEASE REFUSED: {error}')
