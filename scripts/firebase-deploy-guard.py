"""Fail closed before Hosting uploads; inspect the actual Firebase CLI ancestor.

Linux /proc is required. No environment variable can authorize a preview as live.
Production requires the separate explicit release gate; preview rules remain unchanged.
"""
import os
from pathlib import Path
import re
import sys
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def preview_arguments(channel):
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,39}', channel) or channel == 'live':
        raise ValueError('Preview channel must be lowercase and must not be live')
    if channel.startswith('restore-check'):
        raise ValueError('The verified historical preview is protected')
    return ['hosting:channel:deploy', channel,
            '--expires', '7d', '--project', 'vearuny', '--config',
            str(ROOT / 'firebase.json'), '--no-authorized-domains', '--non-interactive']


def cli_arguments(argv):
    # Standalone Firebase uses its executable as Node for the CLI and hook helpers.
    # The nested CLI script comes before the real command in this distribution.
    if len(argv) > 1 and Path(argv[1]).name in ('firebase', 'firebase.js'):
        return argv[2:]
    if argv and Path(argv[0]).name in ('firebase', 'firebase.js'):
        if len(argv) > 1 and Path(argv[1]).name == 'cross-env-shell.js':
            return None  # Hook helper, continue to the actual CLI ancestor.
        return argv[1:]
    return None


def firebase_arguments():
    pid = os.getppid()
    while pid > 1:
        proc = Path('/proc') / str(pid)
        argv = [x.decode() for x in (proc / 'cmdline').read_bytes().split(b'\0') if x]
        args = cli_arguments(argv)
        if args is not None:
            return args
        status = (proc / 'status').read_text()
        pid = int(re.search(r'^PPid:\s+(\d+)', status, re.M).group(1))
    raise ValueError('Cannot verify the Firebase CLI invocation')


def authorize(args, environment):
    if environment.get('GCLOUD_PROJECT') != 'vearuny':
        raise ValueError('Only project vearuny is allowed')
    if args and args[0] == 'hosting:channel:deploy':
        if len(args) < 2 or args != preview_arguments(args[1]):
            raise ValueError('Use python3 scripts/deploy-preview.py CHANNEL; overrides are forbidden')
        return
    if args and args[0] == 'deploy':
        import importlib.util
        spec = importlib.util.spec_from_file_location('production', ROOT / 'scripts/deploy-production.py')
        production = importlib.util.module_from_spec(spec)
        sys.dont_write_bytecode = True
        spec.loader.exec_module(production)
        production.hook_check(args, environment)
        return
    raise ValueError('Live deployment blocked. Use the explicit production wrapper.')


if __name__ == '__main__':
    try:
        authorize(firebase_arguments(), os.environ)
    except (ValueError, OSError, AttributeError, UnicodeError) as error:
        sys.exit('DEPLOYMENT REFUSED: ' + str(error))
    subprocess.run([sys.executable, '-B', str(ROOT / 'scripts/preview-preflight.py')],
                   cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    print('Firebase deployment guard passed')
