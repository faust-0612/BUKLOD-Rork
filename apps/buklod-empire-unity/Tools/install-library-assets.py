#!/usr/bin/env python3
"""Install the pinned Library-first CC0 asset set from the previously staged folder.
Usage: python Tools/install-library-assets.py PATH_TO_Empire_Library_Staged
Use with Unity closed, on the Library-first DEV branch. No network or paid services.
"""
import argparse, hashlib, json, os, pathlib, subprocess, sys

PROJECT = pathlib.Path(__file__).resolve().parents[1]
BRANCH = "dev/empire-library-first-20261128"
MANIFEST_SHA = "e629a376ac468f6669fb8a1207f4b80e8f835232fd206040c2af54156105dafe"
EXPECTED = {
  "Assets/Art/Library/KayKitFurniture/armchair.fbx": "751a982b3ac36cadb18a5e6ae116ff8430cbf56afe2fe4cc36595b48be233cfa",
  "Assets/Art/Library/KayKitFurniture/armchair_pillows.fbx": "2b940763c0caa04e848838f9f567b8f70e8b62d6e494463e0c64586b6f6edb8a",
  "Assets/Art/Library/KayKitFurniture/bed_double_A.fbx": "ade8ffa4d355ae5d7f1da0412cb2224f3eb2ded14287d74444a587aa3315564f",
  "Assets/Art/Library/KayKitFurniture/bed_double_B.fbx": "68e707f9312e3b6c780424bd2fdbecd3e478aea508d6c1e543c71d14866daed1",
  "Assets/Art/Library/KayKitFurniture/bed_single_A.fbx": "3bef87857c689e7c2dda2a8cefc156fab4f025cd1d6c664f84a663ddb9fa673a",
  "Assets/Art/Library/KayKitFurniture/bed_single_B.fbx": "30bbb54c485a81e9f6cfca6153b8aa6eeb271cd961ea9d738ebd4d18a1a5a84a",
  "Assets/Art/Library/KayKitFurniture/book_set.fbx": "d93bec807737f1b217fc594104c8d5e870076018b743b9a1d9f27242bf450d60",
  "Assets/Art/Library/KayKitFurniture/book_single.fbx": "1c1ddd9cb95341c3bf2be2ea160f8aef93cc2788abdb6660bb4c22e598196ae1",
  "Assets/Art/Library/KayKitFurniture/cabinet_medium.fbx": "b2d170910f2e2bead3adf794e350fdec69c3b3b16920392918e0c7d777c22790",
  "Assets/Art/Library/KayKitFurniture/cabinet_medium_decorated.fbx": "fe6cd0349dc67fe3d64284c3262c5f05986dc0c92f116472459dc2f8bab4f708",
  "Assets/Art/Library/KayKitFurniture/cabinet_small.fbx": "fb27d3ceaa1fef5ae0b55e528ae86d4d1dc7c2989df493802f871f4bc92283ff",
  "Assets/Art/Library/KayKitFurniture/cabinet_small_decorated.fbx": "c6c8958618b749d3a73630fb4248fad1cb69cbe0bf2155f5c7b7ccca20195aa1",
  "Assets/Art/Library/KayKitFurniture/cactus_medium_A.fbx": "e43ee956a6d99b7d362c466ce65935feff632f5e6f50c0528ceb041071cc17a6",
  "Assets/Art/Library/KayKitFurniture/cactus_medium_B.fbx": "36c2ee0f926a30451ceb3e6483d785cbfc2e7ef80e0e7bf2b6992d554c99c5d2",
  "Assets/Art/Library/KayKitFurniture/cactus_small_A.fbx": "ed1d332070c625be283b45cf51f8abc97efbb4752db744d80df9552e7115792c",
  "Assets/Art/Library/KayKitFurniture/cactus_small_B.fbx": "df586de672bc60103cb6a880de14d8ca54f04ece1485fcd21a418b4a1c0864de",
  "Assets/Art/Library/KayKitFurniture/chair_A.fbx": "ec61c1958457cae9cb5278fed05d01da1a30d895b2f15133d932f4c54b93b2d0",
  "Assets/Art/Library/KayKitFurniture/chair_A_wood.fbx": "27ccdf8b93a569c48008e0dee7b828741a086f2cd2a5cb451bf2cb81d69154d4",
  "Assets/Art/Library/KayKitFurniture/chair_B.fbx": "ee5e863f3d80fe9fd5f6b6f61845e85a7a69e7c6da50c2ddfd2338d1d8189b26",
  "Assets/Art/Library/KayKitFurniture/chair_B_wood.fbx": "a90334709bba8db5e2d058408bdb77c254cbd66e8e28aa7c527df7e8b2cb3345",
  "Assets/Art/Library/KayKitFurniture/chair_C.fbx": "919df80e6f7c72a374ae835e543f1724628b8e29402fb2328e6698f0b5754733",
  "Assets/Art/Library/KayKitFurniture/chair_stool.fbx": "d89529331f8fc93142ee51eda7f18c65adfb4210703189879fa9896c5a419c3b",
  "Assets/Art/Library/KayKitFurniture/chair_stool_wood.fbx": "8245275f0320c52a939819f0ea9772f95fdfbe6661a1e5c77c67bf88657e5612",
  "Assets/Art/Library/KayKitFurniture/couch.fbx": "903c67cfd8acac88537c47529a66b000b6ddfd0ad37c092484b38128ddc6cf6a",
  "Assets/Art/Library/KayKitFurniture/couch_pillows.fbx": "f41675bf352dfd1ebedc4e2236a829537061fd181c57d8efa78515639d122434",
  "Assets/Art/Library/KayKitFurniture/furniturebits_texture.png": "de62db37a80d1801c3d9eb674890ae04b04469e0c149481a51fa250562c628dc",
  "Assets/Art/Library/KayKitFurniture/lamp_standing.fbx": "7dd8456bff90c669ec9546041778de9ba02c16d046a30fddf948ed4c751d9fb7",
  "Assets/Art/Library/KayKitFurniture/lamp_table.fbx": "514bdd1c2bf6dfec99fcb115d56680a96f63e0dbd972dfe1034ee6cb2ccd489c",
  "Assets/Art/Library/KayKitFurniture/pictureframe_large_A.fbx": "85c33dc8f162e9c4d85dce08706a2bb3fd42067fba572e4f243aec9fa1ff801d",
  "Assets/Art/Library/KayKitFurniture/pictureframe_large_B.fbx": "d6c2b4cf744bdaba865b092a13432861278ed45ec656a8cd4333ddde764545e0",
  "Assets/Art/Library/KayKitFurniture/pictureframe_medium.fbx": "9ad66cbc94471855078bf466ef6671b233111c7c5ea003c5a68843fd9b92a3d7",
  "Assets/Art/Library/KayKitFurniture/pictureframe_small_A.fbx": "4e1c63c5b0695be70555285e8579f79a6cac23bad8e1f6884616e85582c13a30",
  "Assets/Art/Library/KayKitFurniture/pictureframe_small_B.fbx": "6f301231f28933459e9824660ddc6c3f20d5b55156e468c963224ec7f0f0c600",
  "Assets/Art/Library/KayKitFurniture/pictureframe_small_C.fbx": "b325c727dfde3f575be2b4654c26562b9e42b43cac0018a7d6689eb715b8554e",
  "Assets/Art/Library/KayKitFurniture/pictureframe_standing_A.fbx": "939dc9751040f5256c0c4dd7cf2a182bb70344b6a4ef8dd6751fd7b957eb9c5a",
  "Assets/Art/Library/KayKitFurniture/pictureframe_standing_B.fbx": "9597dce27db856be4f69e835f2c5c8eb253c48d81ee68337d0c12d77f1de9cba",
  "Assets/Art/Library/KayKitFurniture/pillow_A.fbx": "e06f043e8f0df552e999d5f615d13697379d7ea1c60db49cf427d795431721cc",
  "Assets/Art/Library/KayKitFurniture/pillow_B.fbx": "f15c12ce124b63985202f0d536802a5544aa6e98808695da8ef4b619bd92bc50",
  "Assets/Art/Library/KayKitFurniture/rug_oval_A.fbx": "6ce7c166fb1a9a14f9398a4737bb5f8b8e4cd317bd1f3e8ae2a31718640e62b9",
  "Assets/Art/Library/KayKitFurniture/rug_oval_B.fbx": "c380376974ea23fac13bf949d76f5d20724d7f4323d70b35c910d966dd433ed7",
  "Assets/Art/Library/KayKitFurniture/rug_rectangle_A.fbx": "db61869b53eed582725ab1612b741a7480d0a6c5df9c67eea2046b63f0099487",
  "Assets/Art/Library/KayKitFurniture/rug_rectangle_B.fbx": "ec252170b4fda99cddaec2e0dbafb576a7a057921a5b85273b3bd9e31a2646f8",
  "Assets/Art/Library/KayKitFurniture/rug_rectangle_stripes_A.fbx": "663628896b53ea5b6595b10b43e22e59532c3c3bed3a4d34c0f736a54c52aff4",
  "Assets/Art/Library/KayKitFurniture/rug_rectangle_stripes_B.fbx": "5f44eec00109e75a80860f0bbd2f76787352bd75ef012cc1159830097616e877",
  "Assets/Art/Library/KayKitFurniture/shelf_A_big.fbx": "55ee286706aef6a6ee597b2261c05703fdfa52fc8f54fb673191e624480e12c0",
  "Assets/Art/Library/KayKitFurniture/shelf_A_small.fbx": "640230980af6e99332aa74f94b18893c121a08e7429107d764f803cd9a3e27a3",
  "Assets/Art/Library/KayKitFurniture/shelf_B_large.fbx": "f511f74063109803d2592da2fd668eb58e5c7bd7ab82761c20a8bf4f9aa9f4dd",
  "Assets/Art/Library/KayKitFurniture/shelf_B_large_decorated.fbx": "48f31034266500a96fba4b75d43d7b70b2996cc0698a7d96d2a8db310d180761",
  "Assets/Art/Library/KayKitFurniture/shelf_B_small.fbx": "4b70639d61642f2bf70183b95796635e2cdb5709d3111e2a39d9d3f90689b395",
  "Assets/Art/Library/KayKitFurniture/shelf_B_small_decorated.fbx": "e6c4f0382b51418bf76e1a80f20ca5c106eb7136aabe68d206e49ba72a4019a3",
  "Assets/Art/Library/KayKitFurniture/table_low.fbx": "d9e06711bab8a29a6c11610813f04f2fb83d9f71d5cda7ea8eb17f542a6a2142",
  "Assets/Art/Library/KayKitFurniture/table_medium.fbx": "84f48d3fc346e06d60a62cbe77cdd212e8bc67382b8e40d31064b256bd544e75",
  "Assets/Art/Library/KayKitFurniture/table_medium_long.fbx": "5d5554ecbaa217fb3bfad060d40ac0439a8ed217559f78f0ddb3ca429e04aeb7",
  "Assets/Art/Library/KayKitFurniture/table_small.fbx": "599e8d33c7c1978f7820c835b3ff9cc20811001b8060045364a5164282c5d288",
  "Assets/Resources/LibraryAudio/Magic/cartoon-wink-sparkle.ogg": "0f2065edc6c5f0be2c9e87689df29f8557856d3d4370812fff8d39d1bf2d3974",
  "Assets/Resources/LibraryAudio/Magic/dark-magic-curse.ogg": "83d6ad32db112fce71ac5a8c0392d5b34455898e8cfa634649dccdeae324bc27",
  "Assets/Resources/LibraryAudio/Magic/fairy-dust-sparkles.ogg": "5842844ef45eb6cd5261093bf6b6bcc85d28be4733838b97d1cccaff2fa5260c",
  "Assets/Resources/LibraryAudio/Magic/healing-spell.ogg": "ad9fb9d4e298690ddddc63c7344c21c0121cf3a9d1d94c067aca0c34a0a4f4ce",
  "Assets/Resources/LibraryAudio/Magic/holy-light-spell.ogg": "8ec4795250a3c4b7999ca840e189dda800be16115169261c05e049c915b6ede5",
  "Assets/Resources/LibraryAudio/Magic/ice-spell-freeze.ogg": "48077c4fd7fc5dd0ff1ed4d295343129829b52f29741cf6764f4b0bdf8e3914f",
  "Assets/Resources/LibraryAudio/Magic/magic-portal-close.ogg": "e691dd5e30950c18c840c7806f197d57abaade0f91d9be24b756538782dfa83e",
  "Assets/Resources/LibraryAudio/Magic/magic-portal-hum.ogg": "264ec02879e277e5dd6f192e86c86de5cda1bb0db8abe7543549e2f2b2179de6",
  "Assets/Resources/LibraryAudio/Magic/magic-portal-open.ogg": "44098552a5359bc5fe5481256c838a2986862965d401f0efcd2a756ec41947c9",
  "Assets/Resources/LibraryAudio/Magic/magic-shield.ogg": "45e0c73c411a03f12a17490fc303ecd25f5c4d4a81ab5df0913091491de94b34",
  "Assets/Resources/LibraryAudio/Magic/magic-shimmer-swell.ogg": "2faf911bdab79677654c865f41e06388257cd74ea1bd3ba661ea7de136dd4934",
  "Assets/Resources/LibraryAudio/Magic/magic-spell-cast.ogg": "ad30de9dc5230c7cfed3271caf2f7100f51a3870124a8233c85675b545199e2e",
  "Assets/Resources/LibraryAudio/Magic/magic-vanish-disappear.ogg": "b655b806c85aee5477da6a486b4797d84054b8a561e3cca9369bf42095f9f0c2",
  "Assets/Resources/LibraryAudio/Magic/magic-vortex-swirl.ogg": "0518160987c6b26b9d475d210f235085d9e88a899e12f4d11a1bbd8bebabdf92",
  "Assets/Resources/LibraryAudio/Magic/magic-wand-sparkle.ogg": "5709bff8a5fe50589b2c965e6b1fc842d6cc8c3c4132aa37b937c30cdc4c36e2",
  "Assets/Resources/LibraryAudio/Magic/magical-transformation.ogg": "470b5222e4f8e440b833d6d54ef06c0a85ae9c5258d1e7c94cfeb4bfce1178dc",
  "Assets/Resources/LibraryAudio/Magic/sparkle-burst.ogg": "aacc87975c72dc66fdda81d74b8fb78c82c3d089bbb7f3ffd2411b9deb95123a",
  "Assets/Resources/LibraryAudio/Magic/summoning-spell.ogg": "fd3c3bb20d1aa5b6b2617522541720397a61e0c713c99d24a2d8624627345a0b",
  "Assets/Resources/LibraryAudio/Magic/teleport-in-arrival.ogg": "2da66fe2c093719bfe7c060351730076dc96315fd3f07394bcd877547ff14b5b",
  "Assets/Resources/LibraryAudio/Magic/teleport-out.ogg": "b9d5005146ba3a7239edcc4eb45b111ea957334321707be5a616581b8a36e5bb",
  "Assets/Resources/LibraryAudio/Magic/twinkle-star-sparkle.ogg": "f55318267e959539f5ecc8e8c2f7d58b872fecee3f61b7039133af5e1024ce41",
  "Assets/Resources/LibraryAudio/Reward/achievement-unlocked.ogg": "d4f830463e90e28b61844734a8a39e98f90202bb4e41c02922e48235183341bb",
  "Assets/Resources/LibraryAudio/Reward/coin-collect.ogg": "3cee8b827fa245385d9ff58470f802dfe46fce7f9ba05c4d301553e45d54b2de",
  "Assets/Resources/LibraryAudio/Reward/coin-shower.ogg": "02c60c89e591aed464887180301020cb234990fdefba9fce9f6c4bf423e05a4e",
  "Assets/Resources/LibraryAudio/Reward/correct-answer-ding.ogg": "e03cf96bd232bec37d9484d79fd550738627feacf0f26a7f2d8a172b7e0a9e5a",
  "Assets/Resources/LibraryAudio/Reward/gem-sparkle.ogg": "bc28553f62980073f08473799f9d610a02de54cf721ed1572c6cc70f039068b8",
  "Assets/Resources/LibraryAudio/Reward/heal-restore.ogg": "ebefbfa83d02bd213b6f107fefe0fae4a13c53408c6fc1d30b8964040313f7df",
  "Assets/Resources/LibraryAudio/Reward/item-get.ogg": "b440c9f2b91b8279846fb08a70b2e58618e413385f911bb937e74576fb19bbee",
  "Assets/Resources/LibraryAudio/Reward/jackpot-win.ogg": "b8217b603a1139e264b7575dee3e047c94b0a81597a2b5921e6d00c99e1d1a48",
  "Assets/Resources/LibraryAudio/Reward/level-up-bells.ogg": "0a12a9abff819aa82b8d6341a49512246216483752ae91eb90581f5a9fad89de",
  "Assets/Resources/LibraryAudio/Reward/level-up-epic-brass.ogg": "5dd2e78762d9bc6e216bdc8d1b1c89b2845f593d28ef027c15a60b8666ecafe8",
  "Assets/Resources/LibraryAudio/Reward/level-up-magic-harp.ogg": "d0fd15c109bc96070ae044a1bc2498241c66e023f1fe0f3a42a88722af2c287f",
  "Assets/Resources/LibraryAudio/Reward/level-up-synth.ogg": "48b6e89963916300e7b31504408a26ed01ad1f81f8ecf907db62daef472a6c34",
  "Assets/Resources/LibraryAudio/Reward/power-up-charge.ogg": "12ed0c995c12c97217de3493ec4e3801e023f03737ecab6cb8f97a631b4060d4",
  "Assets/Resources/LibraryAudio/Reward/purchase-ka-ching.ogg": "389b1d4436062942bbb9bc9a98f159f61546f8d2507c2b53e888520456f8960e",
  "Assets/Resources/LibraryAudio/Reward/quest-complete.ogg": "34b2324f811baa3d9a0f1e8964ab06a8fe9ccf99607ce11099780dca2994a0a0",
  "Assets/Resources/LibraryAudio/Reward/rank-up-fanfare.ogg": "5dbc0bd3d800b36497306e92c533183c6caf939aeb664d9bc30d252d3a03c915",
  "Assets/Resources/LibraryAudio/Reward/rare-item-found.ogg": "518e1a99507f48bdf0395922082cc69734dcfd9e33ae3806143970c10cae07aa",
  "Assets/Resources/LibraryAudio/Reward/secret-found.ogg": "34863066e70bbbc01d4b86d7bbc803091108d3847d5de9a022251d92bc9bf6bb",
  "Assets/Resources/LibraryAudio/Reward/stage-clear.ogg": "0a21682482c7086a0f38862afa3d05cb4abde0d0cd81f6145b2a2a68dbcc2101",
  "Assets/Resources/LibraryAudio/Reward/success-chime.ogg": "a390c7730518013dccd056080c242a7895d68b695cea94e46c8e74e1d54025f6",
  "Assets/Resources/LibraryAudio/Reward/success-vibraphone-triad.ogg": "8b6aa1a34c1976606cf138374fa33cd484c67d0d5ff6619ff75efded32196a6c",
  "Assets/Resources/LibraryAudio/Reward/ta-da-fanfare.ogg": "54e91e3e700318b98eaa1d6fe15b2245c5814a211d9a93d790a10507075918c6",
  "Assets/Resources/LibraryAudio/Reward/task-complete-pop.ogg": "0939c1a885c7009c94a7c87194149668555026539b1e6c73e92ca7b7fcf178bf",
  "Assets/Resources/LibraryAudio/Reward/three-stars-rating.ogg": "5fc52271925344546c1c4f963bde97710d06e3edf551d8fefe97b23e68e38064",
  "Assets/Resources/LibraryAudio/Reward/treasure-chest-reveal.ogg": "96ef8f6b7c87b12593743770c3bf3783a10e95687becf333f8fa2d04a5727e63",
  "Assets/Resources/LibraryAudio/Reward/victory-fanfare.ogg": "7db21bb9bd8b3bcf2d67e534a4426464a30600b5232620c44783a9e13085dcb2",
  "Assets/Resources/LibraryAudio/Reward/win-jingle.ogg": "30c87a6727e7d0a0488b9923eee76292c05bdc69eec2dff5099806e4fa838ef0",
  "Assets/Resources/LibraryAudio/Reward/xp-gain.ogg": "14359b900435fea093906cfca32b32463f0dd655eb228c7d14f252c294d5ed2a"
}

def sha(data): return hashlib.sha256(data).hexdigest()
def safe_file(root, relative):
    p = root
    for part in pathlib.PurePosixPath(relative).parts:
        if part in ("", ".", ".."): raise ValueError("Unsafe path")
        p = p / part
        if p.is_symlink() or (hasattr(p, "is_junction") and p.is_junction()):
            raise ValueError("Linked path: " + str(p))
    if not p.resolve().is_relative_to(root.resolve()): raise ValueError("Escaping path")
    return p

def install(stage, verify_only=False):
    stage = stage.resolve()
    if not (PROJECT / "ProjectSettings/ProjectVersion.txt").is_file():
        raise ValueError("Not the Empire Unity project")
    branch = subprocess.check_output(["git","branch","--show-current"],cwd=PROJECT,text=True).strip()
    if branch != BRANCH: raise ValueError("Use the Library-first DEV branch, found " + branch)
    receipt = json.loads(safe_file(stage,"STAGING_RECEIPT.json").read_text(encoding="utf-8"))
    if receipt.get("status") != "VERIFIED_STAGING_ONLY" or receipt.get("manifestSha256") != MANIFEST_SHA:
        raise ValueError("Unexpected staging receipt")
    if sha(safe_file(stage,"Companions/ASSET_MANIFEST.json").read_bytes()) != MANIFEST_SHA:
        raise ValueError("Manifest hash mismatch")
    assets = json.loads(safe_file(stage,"Companions/ASSET_MANIFEST.json").read_text(encoding="utf-8"))
    approved = {r["path"]:r for r in assets["assets"] if r.get("path") in EXPECTED}
    if set(approved) != set(EXPECTED): raise ValueError("Missing manifest entries")
    prepared = []
    for path, digest in EXPECTED.items():
        row = approved[path]
        if row.get("license") != "CC0-1.0" or not row.get("author") or not str(row.get("source_url","")).startswith("https://"):
            raise ValueError("License metadata mismatch: "+path)
        if receipt["fileHashes"].get("Eligible/"+path) != digest or row.get("sha256") != digest:
            raise ValueError("Unexpected file identity: "+path)
        data = safe_file(stage,"Eligible/"+path).read_bytes()
        if sha(data) != digest or len(data) != row.get("bytes"): raise ValueError("Changed source: "+path)
        dst = safe_file(PROJECT,path)
        if dst.exists():
            if not dst.is_file() or sha(dst.read_bytes()) != digest: raise ValueError("Existing asset differs; no overwrite: "+path)
        else: prepared.append((dst,data,digest))
    if verify_only: return {"verified":len(EXPECTED),"missing":len(prepared),"installed":0}
    lock = PROJECT / ".library-install.lock"
    lock.mkdir()
    created = []
    try:
        for dst,data,digest in prepared:
            dst = safe_file(PROJECT,dst.relative_to(PROJECT).as_posix())
            dst.parent.mkdir(parents=True,exist_ok=True)
            with dst.open("xb") as f:
                created.append((dst,digest))
                f.write(data)
            if sha(dst.read_bytes()) != digest: raise IOError("Post-copy hash mismatch")
        for path,digest in EXPECTED.items():
            if sha(safe_file(PROJECT,path).read_bytes()) != digest: raise IOError("Final verification failed")
    except BaseException:
        for dst,digest in reversed(created):
            if dst.is_file(): dst.unlink()
        raise
    finally: lock.rmdir()
    return {"verified":len(EXPECTED),"installed":len(created),"unchanged":len(EXPECTED)-len(created),"unityImported":False,"releaseApproved":False}

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage",type=pathlib.Path)
    parser.add_argument("--verify-only",action="store_true")
    args=parser.parse_args()
    print(json.dumps(install(args.stage,args.verify_only),indent=2))
