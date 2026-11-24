#!/usr/bin/env python3
"""Import private owner assets only into git-ignored project paths."""
import hashlib,json,pathlib,sys,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
expected="a161d09937563e2dcfd93fffa0d9f9d4cea2ad0ee8f58fb59f4b5489903c556e"
def main():
    archive=pathlib.Path(sys.argv[1])
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected: raise ValueError("Owner archive mismatch")
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        index=json.loads(z.read("owner-intake.json"))
        rows=index["files"]
        assert len(rows)==124 and len({r["path"] for r in rows})==124
        for r in rows:
            path=pathlib.PurePosixPath(r["path"])
            if path.is_absolute() or ".." in path.parts or not (r["path"].startswith("ReferenceArt/") or r["path"].startswith("Assets/Generated/OwnerAudio/")): raise ValueError("Unsafe path")
            data=z.read(r["path"])
            if len(data)!=r["bytes"] or hashlib.sha256(data).hexdigest()!=r["sha256"]: raise ValueError("Asset mismatch")
        for r in rows:
            dest=root/r["path"]
            dest.parent.mkdir(parents=True,exist_ok=True)
            if not dest.resolve().is_relative_to(root.resolve()): raise ValueError("Unsafe destination")
            dest.write_bytes(z.read(r["path"]))
    print("Imported 124 verified owner reference/audio/source entries. Not premium 3D approval.")
if __name__=="__main__": main()
