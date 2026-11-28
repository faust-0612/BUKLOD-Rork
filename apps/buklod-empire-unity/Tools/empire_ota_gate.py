"""Fail-closed local content release guard; no deployment or private-key access."""
import hashlib
import json
import re
import subprocess
from urllib.parse import urlsplit
from pathlib import Path


def git(project, *args):
    return subprocess.check_output(['git', '-C', str(project), *args], stderr=subprocess.PIPE)


def sha256(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest() if hasattr(hashlib, 'file_digest') else _digest(stream)


def _digest(stream):
    h = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        h.update(block)
    return h.hexdigest()


def classify(paths):
    """Conservative: only reviewed supplemental assets and release documentation may differ."""
    allowed_docs = {'README.md', 'RELEASE_LEDGER.md', 'Tools/EMPIRE_CONTENT_UPDATE.md',
                    'Tools/empire-content-sign.py', 'Tools/empire_ota_gate.py', 'Tools/test_empire_ota_gate.py'}
    def content(p):
        if not p.startswith('Assets/EmpireContentSource/'):
            return False
        path = p[:-5] if p.endswith('.meta') else p
        return path == 'Assets/EmpireContentSource/manifest.json' or Path(path).suffix.lower() in {'.prefab', '.ogg', '.glb', '.gltf', '.bin', '.fbx', '.asset', '.mat', '.png', '.jpg', '.jpeg', '.tga', '.exr'}
    return sorted(p for p in paths if p not in allowed_docs and not content(p))


def verify_base(project, apk, receipt_path, trust, *, bootstrap_review=False):
    project = Path(project).resolve()
    root = Path(git(project, 'rev-parse', '--show-toplevel').decode().strip()).resolve()
    prefix = project.relative_to(root).as_posix()
    prefix = '' if prefix == '.' else prefix + '/'
    receipt = json.loads(Path(receipt_path).read_text(encoding='utf-8'))
    commit = receipt.get('sourceCommit', '')
    if not isinstance(commit, str) or not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('Verified base source commit required')
    if receipt.get('deviceVerified') is not True or receipt.get('signatureVerified') is not True:
        raise ValueError('Native signature and device acceptance receipts required')
    if bootstrap_review:
        origin = trust.get('baseUrl', '')
        uri = urlsplit(origin)
        if (receipt.get('reviewBootstrap') is not True or receipt.get('reviewOrigin') != origin
                or uri.scheme != 'https' or not uri.hostname or uri.username or uri.password
                or uri.query or uri.fragment or not uri.path.endswith('/empire-review/')):
            raise ValueError('Bootstrap requires an explicitly accepted isolated HTTPS empire-review origin')
    elif receipt.get('updaterVerified') is not True:
        raise ValueError('Updater acceptance receipt required')
    if receipt.get('package') != 'org.mzbministry.buklod.empire.review':
        raise ValueError('Isolated Empire review package required')
    if receipt.get('unity') != '6000.3.29f1' or receipt.get('abi') != 'empire-content-v2' or receipt.get('apkCode') != trust['apkVersionCode']:
        raise ValueError('Base runtime or APK code mismatch')
    if receipt.get('trustSha256') != sha256(project / 'Assets/Resources/EmpireContentTrust.json'):
        raise ValueError('Pinned native trust changed; new APK required')
    if not Path(apk).is_file() or receipt.get('apkSha256') != sha256(apk):
        raise ValueError('APK fingerprint does not match accepted base')
    head = git(project, 'rev-parse', 'HEAD').decode().strip()
    if git(project, 'status', '--porcelain=v1', '--untracked-files=normal', '--', '.').strip():
        raise ValueError('Clean Empire source checkout required')
    git(project, 'cat-file', '-e', commit + '^{commit}')
    git(project, 'merge-base', '--is-ancestor', commit, head)
    changed = git(project, 'diff', '--no-renames', '--name-only', '-z', commit, head, '--', '.').decode().split('\0')
    native = classify([p[len(prefix):] for p in changed if p and p.startswith(prefix)])
    if native:
        raise ValueError('Native APK required; changed source paths: ' + ', '.join(native[:12]))
    return {'sourceCommit': head, 'baseCommit': commit, 'apkSha256': receipt['apkSha256'], 'trustSha256': receipt['trustSha256'], 'mode': 'BOOTSTRAP_REVIEW_ONLY' if bootstrap_review else 'ACCEPTED_REVIEW', 'origin': trust.get('baseUrl', '')}


def verify_export(directory, base):
    directory = Path(directory)
    proof = json.loads((directory / 'export-proof.json').read_text(encoding='utf-8'))
    if any(proof.get(k) != v for k, v in base.items()) or proof.get('manifestSha256') != sha256(directory / 'unsigned-content.json'):
        raise ValueError('Export does not match accepted native base and clean source')


def stamp_export(directory, base):
    directory = Path(directory)
    proof = dict(base, manifestSha256=sha256(directory / 'unsigned-content.json'))
    with (directory / 'export-proof.json').open('x', encoding='utf-8') as out:
        json.dump(proof, out, indent=2)
