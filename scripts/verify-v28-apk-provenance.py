"""Read-only APK/source provenance audit. Audit determinism is NOT bundle parity."""
import argparse, hashlib, json, pathlib, zipfile

def digest(data): return hashlib.sha256(data).hexdigest()
def git_blob(data): return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\x00' + data).hexdigest()
def export_files(folder):
    return {str(p.relative_to(folder)): digest(p.read_bytes()) for p in sorted(folder.rglob('*')) if p.is_file()}
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apk', type=pathlib.Path, required=True)
    parser.add_argument('--source-root', type=pathlib.Path, default=pathlib.Path('.'))
    parser.add_argument('--baseline', type=pathlib.Path, default=pathlib.Path('release/V28_BASELINE_4F56497.json'))
    parser.add_argument('--out', type=pathlib.Path, required=True)
    parser.add_argument('--export-a', type=pathlib.Path)
    parser.add_argument('--export-b', type=pathlib.Path)
    args = parser.parse_args()
    baseline = json.loads(args.baseline.read_text())
    verified, mismatches, missing = [], [], []
    for row in baseline['files']:
        path = args.source_root / row['path']
        if not path.is_file(): missing.append(row['path']); continue
        if git_blob(path.read_bytes()) == row['git_blob_sha']: verified.append(row['path'])
        else: mismatches.append(row['path'])
    resources = {}
    with zipfile.ZipFile(args.apk) as apk:
        embedded = apk.read('assets/index.android.bundle')
        manifest = json.loads(apk.read('assets/app.manifest'))
        for name in apk.namelist():
            if name.startswith(('res/raw/', 'res/drawable', 'assets/')) and not name.endswith('/'):
                sha = git_blob(apk.read(name)); resources.setdefault(sha, []).append(name)
    asset_matches = []
    for row in baseline['files']:
        if row['path'].startswith('assets/') and row['git_blob_sha'] in resources:
            asset_matches.append({'source': row['path'], 'apk_entries': resources[row['git_blob_sha']]})
    exports = {'status': 'NOT_PROVEN', 'reason': 'Two successful pinned Android JS exports are required; no native build is used.'}
    if args.export_a and args.export_b and args.export_a.is_dir() and args.export_b.is_dir():
        a, b = export_files(args.export_a), export_files(args.export_b)
        exports = {'status': 'MATCH' if a and a == b else 'DIFFERENT_OR_EMPTY', 'files_a': a, 'files_b': b,
                   'limitation': 'Repeatable candidate exports do not prove equality with the older APK embedded bundle.'}
    result = {
        'upstream_commit': baseline['upstream_commit'], 'upstream_tree': baseline['upstream_tree'],
        'baseline_manifest_sha256': digest(args.baseline.read_bytes()),
        'apk_sha256': digest(args.apk.read_bytes()), 'expected_apk_sha256_match': digest(args.apk.read_bytes()) == baseline['apk_sha256'],
        'embedded_update_id': manifest.get('id'), 'embedded_commit_time': manifest.get('commitTime'),
        'embedded_bundle_sha256': digest(embedded), 'embedded_hermes_bytecode_version': int.from_bytes(embedded[8:12], 'little'),
        'source_maps_present': [n for n in zipfile.ZipFile(args.apk).namelist() if n.endswith('.map')],
        'source_files_verified': len(verified), 'source_missing': missing, 'source_mismatches': mismatches,
        'repository_assets_byte_identical_in_apk': asset_matches,
        'apk_manifest_assets': len(manifest.get('assets', [])), 'candidate_export_reproducibility': exports,
        'apk_source_parity': 'UNPROVEN',
        'evidence_gap': 'No original embedded-source commit/map/build manifest binds the Hermes bundle to the cumulative Git tree. Matching assets or repeatable new exports alone cannot establish that binding.'
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    print(json.dumps({k: result[k] for k in ['expected_apk_sha256_match', 'source_files_verified', 'source_missing', 'source_mismatches', 'apk_source_parity']}))
    print('APK_ASSET_EXACT_MATCHES', len(asset_matches))
    return 1 if missing or mismatches or not result['expected_apk_sha256_match'] else 0
if __name__ == '__main__': raise SystemExit(main())
