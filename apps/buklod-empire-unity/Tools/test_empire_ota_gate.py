import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from empire_ota_gate import classify, sha256, stamp_export, verify_base, verify_export


class GateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.project = self.root / 'apps/empire'
        self.project.mkdir(parents=True)
        self.trust = {'apkVersionCode': 42}
        self.write('Assets/Resources/EmpireContentTrust.json', json.dumps(self.trust))
        self.write('Assets/Scripts/Battle.cs', 'base')
        self.git('init', '-q')
        self.git('config', 'user.email', 'qa@example.invalid')
        self.git('config', 'user.name', 'QA')
        self.commit('base')
        self.apk = self.root / 'test.apk'
        self.apk.write_bytes(b'fixture-only')
        self.receipt = self.root / 'receipt.json'
        self.data = dict(sourceCommit=self.git('rev-parse', 'HEAD').strip(), deviceVerified=True,
                         signatureVerified=True, updaterVerified=True, unity='6000.3.29f1',
                         abi='empire-content-v2', package='org.mzbministry.buklod.empire.review', apkCode=42, apkSha256=sha256(self.apk),
                         trustSha256=sha256(self.project / 'Assets/Resources/EmpireContentTrust.json'))
        self.receipt.write_text(json.dumps(self.data))

    def tearDown(self): self.temp.cleanup()
    def git(self, *args): return subprocess.check_output(['git', '-C', str(self.root), *args], text=True)
    def write(self, path, value):
        p = self.project / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(value)
    def commit(self, msg):
        self.git('add', 'apps/empire')
        self.git('commit', '-qm', msg)
    def verify(self): return verify_base(self.project, self.apk, self.receipt, self.trust)
    def test_clean_base(self): self.assertEqual(self.verify()['baseCommit'], self.data['sourceCommit'])
    def test_native_change_rejected(self):
        self.write('Assets/Scripts/Battle.cs', 'new')
        self.commit('native')
        with self.assertRaisesRegex(ValueError, 'Native APK required'): self.verify()
    def test_reviewed_content_path_allowed(self):
        self.write('Assets/EmpireContentSource/asset.png', 'fixture')
        self.commit('data')
        self.verify()
    def test_dirty_rejected(self):
        self.write('Assets/Scripts/Battle.cs', 'dirty')
        with self.assertRaisesRegex(ValueError, 'Clean'): self.verify()
    def test_wrong_apk_rejected(self):
        self.apk.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'fingerprint'): self.verify()
    def test_unverified_rejected(self):
        self.data['updaterVerified'] = False
        self.receipt.write_text(json.dumps(self.data))
        with self.assertRaisesRegex(ValueError, 'acceptance'): self.verify()
    def test_other_package_rejected(self):
        self.data['package'] = 'org.mzbministry.buklod'
        self.receipt.write_text(json.dumps(self.data))
        with self.assertRaisesRegex(ValueError, 'package'): self.verify()
    def test_export_binding(self):
        base = self.verify()
        export = self.root / 'export'
        export.mkdir()
        manifest = export / 'unsigned-content.json'
        manifest.write_text('{}')
        stamp_export(export, base)
        verify_export(export, base)
        manifest.write_text('{"changed":true}')
        with self.assertRaisesRegex(ValueError, 'Export'): verify_export(export, base)
    def test_executable_in_content_root_rejected(self):
        self.assertEqual(classify(['Assets/EmpireContentSource/evil.cs', 'Assets/EmpireContentSource/evil.dll.meta']), ['Assets/EmpireContentSource/evil.cs', 'Assets/EmpireContentSource/evil.dll.meta'])
    def test_native_paths_conservative(self):
        self.assertEqual(classify(['Tools/EMPIRE_CONTENT_UPDATE.md', 'Assets/Scripts/Logic.cs', 'Assets/Scenes/Map.unity']), ['Assets/Scenes/Map.unity', 'Assets/Scripts/Logic.cs'])


if __name__ == '__main__': unittest.main()
