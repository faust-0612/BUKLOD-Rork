using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Verify real serialized scene dependencies, not merely presence in the checkout.
    internal static class ReviewAuthoredAssetGate {
        const string Ui="Assets/ThirdParty/KenneyReview/";
        const string Nature="Assets/ThirdParty/QuaterniusReview/nature/glTF/";
        internal static readonly string[] Required={
            Ui+"action.png",Ui+"stick-pad.png",Ui+"stick-nub.png",Ui+"menu-button.png",Ui+"menu-panel.png",Ui+"click.ogg",
            "Assets/ThirdParty/KayKitReview/doorway.glb",
            Ui+"Combat/step-grass-a.ogg",Ui+"Combat/step-grass-b.ogg",Ui+"Combat/metal-hit.ogg",Ui+"Combat/wood-hit.ogg",
            Ui+"Combat/door-open.ogg","Assets/Resources/LibraryAudio/Reward/coin-collect.ogg","Assets/Resources/LibraryAudio/Reward/level-up-magic-harp.ogg","Assets/Resources/LibraryAudio/Reward/item-get.ogg","Assets/Resources/LibraryAudio/Reward/rare-item-found.ogg","Assets/Resources/LibraryAudio/Reward/purchase-ka-ching.ogg","Assets/Resources/LibraryAudio/Reward/purchase-ka-ching.ogg","Assets/Resources/LibraryAudio/Reward/item-get.ogg","Assets/Resources/LibraryAudio/Reward/rare-item-found.ogg",Ui+"Combat/fight.ogg",Ui+"Combat/you_win.ogg",Ui+"Combat/you_lose.ogg",Ui+"Combat/tie.ogg",
            Nature+"Bush_Common.gltf",Nature+"Grass_Common_Short.gltf",Nature+"Grass_Common_Tall.gltf"
        };
        static readonly Dictionary<string,string> LibraryAudioHashes=new Dictionary<string,string>(StringComparer.Ordinal){
            {"Assets/Resources/LibraryAudio/Magic/cartoon-wink-sparkle.ogg","0f2065edc6c5f0be2c9e87689df29f8557856d3d4370812fff8d39d1bf2d3974"},
            {"Assets/Resources/LibraryAudio/Magic/dark-magic-curse.ogg","83d6ad32db112fce71ac5a8c0392d5b34455898e8cfa634649dccdeae324bc27"},
            {"Assets/Resources/LibraryAudio/Magic/fairy-dust-sparkles.ogg","5842844ef45eb6cd5261093bf6b6bcc85d28be4733838b97d1cccaff2fa5260c"},
            {"Assets/Resources/LibraryAudio/Magic/healing-spell.ogg","ad9fb9d4e298690ddddc63c7344c21c0121cf3a9d1d94c067aca0c34a0a4f4ce"},
            {"Assets/Resources/LibraryAudio/Magic/holy-light-spell.ogg","8ec4795250a3c4b7999ca840e189dda800be16115169261c05e049c915b6ede5"},
            {"Assets/Resources/LibraryAudio/Magic/ice-spell-freeze.ogg","48077c4fd7fc5dd0ff1ed4d295343129829b52f29741cf6764f4b0bdf8e3914f"},
            {"Assets/Resources/LibraryAudio/Magic/magic-portal-close.ogg","e691dd5e30950c18c840c7806f197d57abaade0f91d9be24b756538782dfa83e"},
            {"Assets/Resources/LibraryAudio/Magic/magic-portal-hum.ogg","264ec02879e277e5dd6f192e86c86de5cda1bb0db8abe7543549e2f2b2179de6"},
            {"Assets/Resources/LibraryAudio/Magic/magic-portal-open.ogg","44098552a5359bc5fe5481256c838a2986862965d401f0efcd2a756ec41947c9"},
            {"Assets/Resources/LibraryAudio/Magic/magic-shield.ogg","45e0c73c411a03f12a17490fc303ecd25f5c4d4a81ab5df0913091491de94b34"},
            {"Assets/Resources/LibraryAudio/Magic/magic-shimmer-swell.ogg","2faf911bdab79677654c865f41e06388257cd74ea1bd3ba661ea7de136dd4934"},
            {"Assets/Resources/LibraryAudio/Magic/magic-spell-cast.ogg","ad30de9dc5230c7cfed3271caf2f7100f51a3870124a8233c85675b545199e2e"},
            {"Assets/Resources/LibraryAudio/Magic/magic-vanish-disappear.ogg","b655b806c85aee5477da6a486b4797d84054b8a561e3cca9369bf42095f9f0c2"},
            {"Assets/Resources/LibraryAudio/Magic/magic-vortex-swirl.ogg","0518160987c6b26b9d475d210f235085d9e88a899e12f4d11a1bbd8bebabdf92"},
            {"Assets/Resources/LibraryAudio/Magic/magic-wand-sparkle.ogg","5709bff8a5fe50589b2c965e6b1fc842d6cc8c3c4132aa37b937c30cdc4c36e2"},
            {"Assets/Resources/LibraryAudio/Magic/magical-transformation.ogg","470b5222e4f8e440b833d6d54ef06c0a85ae9c5258d1e7c94cfeb4bfce1178dc"},
            {"Assets/Resources/LibraryAudio/Magic/sparkle-burst.ogg","aacc87975c72dc66fdda81d74b8fb78c82c3d089bbb7f3ffd2411b9deb95123a"},
            {"Assets/Resources/LibraryAudio/Magic/summoning-spell.ogg","fd3c3bb20d1aa5b6b2617522541720397a61e0c713c99d24a2d8624627345a0b"},
            {"Assets/Resources/LibraryAudio/Magic/teleport-in-arrival.ogg","2da66fe2c093719bfe7c060351730076dc96315fd3f07394bcd877547ff14b5b"},
            {"Assets/Resources/LibraryAudio/Magic/teleport-out.ogg","b9d5005146ba3a7239edcc4eb45b111ea957334321707be5a616581b8a36e5bb"},
            {"Assets/Resources/LibraryAudio/Magic/twinkle-star-sparkle.ogg","f55318267e959539f5ecc8e8c2f7d58b872fecee3f61b7039133af5e1024ce41"},
            {"Assets/Resources/LibraryAudio/Reward/achievement-unlocked.ogg","d4f830463e90e28b61844734a8a39e98f90202bb4e41c02922e48235183341bb"},
            {"Assets/Resources/LibraryAudio/Reward/coin-collect.ogg","3cee8b827fa245385d9ff58470f802dfe46fce7f9ba05c4d301553e45d54b2de"},
            {"Assets/Resources/LibraryAudio/Reward/coin-shower.ogg","02c60c89e591aed464887180301020cb234990fdefba9fce9f6c4bf423e05a4e"},
            {"Assets/Resources/LibraryAudio/Reward/correct-answer-ding.ogg","e03cf96bd232bec37d9484d79fd550738627feacf0f26a7f2d8a172b7e0a9e5a"},
            {"Assets/Resources/LibraryAudio/Reward/gem-sparkle.ogg","bc28553f62980073f08473799f9d610a02de54cf721ed1572c6cc70f039068b8"},
            {"Assets/Resources/LibraryAudio/Reward/heal-restore.ogg","ebefbfa83d02bd213b6f107fefe0fae4a13c53408c6fc1d30b8964040313f7df"},
            {"Assets/Resources/LibraryAudio/Reward/item-get.ogg","b440c9f2b91b8279846fb08a70b2e58618e413385f911bb937e74576fb19bbee"},
            {"Assets/Resources/LibraryAudio/Reward/jackpot-win.ogg","b8217b603a1139e264b7575dee3e047c94b0a81597a2b5921e6d00c99e1d1a48"},
            {"Assets/Resources/LibraryAudio/Reward/level-up-bells.ogg","0a12a9abff819aa82b8d6341a49512246216483752ae91eb90581f5a9fad89de"},
            {"Assets/Resources/LibraryAudio/Reward/level-up-epic-brass.ogg","5dd2e78762d9bc6e216bdc8d1b1c89b2845f593d28ef027c15a60b8666ecafe8"},
            {"Assets/Resources/LibraryAudio/Reward/level-up-magic-harp.ogg","d0fd15c109bc96070ae044a1bc2498241c66e023f1fe0f3a42a88722af2c287f"},
            {"Assets/Resources/LibraryAudio/Reward/level-up-synth.ogg","48b6e89963916300e7b31504408a26ed01ad1f81f8ecf907db62daef472a6c34"},
            {"Assets/Resources/LibraryAudio/Reward/power-up-charge.ogg","12ed0c995c12c97217de3493ec4e3801e023f03737ecab6cb8f97a631b4060d4"},
            {"Assets/Resources/LibraryAudio/Reward/purchase-ka-ching.ogg","389b1d4436062942bbb9bc9a98f159f61546f8d2507c2b53e888520456f8960e"},
            {"Assets/Resources/LibraryAudio/Reward/quest-complete.ogg","34b2324f811baa3d9a0f1e8964ab06a8fe9ccf99607ce11099780dca2994a0a0"},
            {"Assets/Resources/LibraryAudio/Reward/rank-up-fanfare.ogg","5dbc0bd3d800b36497306e92c533183c6caf939aeb664d9bc30d252d3a03c915"},
            {"Assets/Resources/LibraryAudio/Reward/rare-item-found.ogg","518e1a99507f48bdf0395922082cc69734dcfd9e33ae3806143970c10cae07aa"},
            {"Assets/Resources/LibraryAudio/Reward/secret-found.ogg","34863066e70bbbc01d4b86d7bbc803091108d3847d5de9a022251d92bc9bf6bb"},
            {"Assets/Resources/LibraryAudio/Reward/stage-clear.ogg","0a21682482c7086a0f38862afa3d05cb4abde0d0cd81f6145b2a2a68dbcc2101"},
            {"Assets/Resources/LibraryAudio/Reward/success-chime.ogg","a390c7730518013dccd056080c242a7895d68b695cea94e46c8e74e1d54025f6"},
            {"Assets/Resources/LibraryAudio/Reward/success-vibraphone-triad.ogg","8b6aa1a34c1976606cf138374fa33cd484c67d0d5ff6619ff75efded32196a6c"},
            {"Assets/Resources/LibraryAudio/Reward/ta-da-fanfare.ogg","54e91e3e700318b98eaa1d6fe15b2245c5814a211d9a93d790a10507075918c6"},
            {"Assets/Resources/LibraryAudio/Reward/task-complete-pop.ogg","0939c1a885c7009c94a7c87194149668555026539b1e6c73e92ca7b7fcf178bf"},
            {"Assets/Resources/LibraryAudio/Reward/three-stars-rating.ogg","5fc52271925344546c1c4f963bde97710d06e3edf551d8fefe97b23e68e38064"},
            {"Assets/Resources/LibraryAudio/Reward/treasure-chest-reveal.ogg","96ef8f6b7c87b12593743770c3bf3783a10e95687becf333f8fa2d04a5727e63"},
            {"Assets/Resources/LibraryAudio/Reward/victory-fanfare.ogg","7db21bb9bd8b3bcf2d67e534a4426464a30600b5232620c44783a9e13085dcb2"},
            {"Assets/Resources/LibraryAudio/Reward/win-jingle.ogg","30c87a6727e7d0a0488b9923eee76292c05bdc69eec2dff5099806e4fa838ef0"},
            {"Assets/Resources/LibraryAudio/Reward/xp-gain.ogg","14359b900435fea093906cfca32b32463f0dd655eb228c7d14f252c294d5ed2a"},
        };
        internal static void ValidateLibraryAudioInputs(){
            foreach(var row in LibraryAudioHashes){
                if(!System.IO.File.Exists(row.Key))throw new BuildFailedException("Missing pinned Library audio: "+row.Key);
                using(var stream=System.IO.File.OpenRead(row.Key))
                using(var hash=System.Security.Cryptography.SHA256.Create()){
                    var actual=BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
                    if(actual!=row.Value)throw new BuildFailedException("Changed Library audio: "+row.Key);
                }
                var clip=AssetDatabase.LoadAssetAtPath<AudioClip>(row.Key);
                if(!clip||clip.samples<=0||clip.channels<=0||clip.frequency<=0||clip.length<=0||float.IsNaN(clip.length)||float.IsInfinity(clip.length))
                    throw new BuildFailedException("Invalid imported Library audio: "+row.Key);
            }
        }
        internal static void Validate(IEnumerable<string> dependencies){
            ValidateLibraryAudioInputs();
            var present=new HashSet<string>(dependencies,StringComparer.Ordinal);
            AuthoredRosterBuildGate.ValidateDependencies(present);
            foreach(var asset in new[]{"WalkableIsland","CliffFaces","CurvedLanes","RiverWater","CausewayDecks","CoverOutcrops","ObjectiveTerraces"})
                if(!present.Contains(SculptedRiftComposer.Out+"/"+asset+".asset"))throw new BuildFailedException("Sculpted map missing from actual build: "+asset);
            LibraryVillageReview.ValidateDependencies(present);
            LibraryStructureReview.ValidateDependencies(present);
            LibraryWildlifeReview.ValidateDependencies(present);
            if(!present.Contains("Assets/Resources/LibraryAudio/Reward/victory-fanfare.ogg"))throw new BuildFailedException("Library victory fanfare dependency missing.");
            SkillAudio.LoadLibraryClips();
            foreach(var path in Required)if(!present.Contains(path))throw new BuildFailedException("Required authored review scene dependency missing: "+path);
            foreach(var name in new[]{"ReviewRiftWater","ReviewRiftCascade","ReviewLeafA","ReviewLeafB"}){
                string path=CandidateReviewComposer.Out+"/"+name+".mat";
                var material=AssetDatabase.LoadAssetAtPath<Material>(path);
                if(!present.Contains(path)||!material||!material.shader||!material.shader.isSupported||ShaderUtil.ShaderHasError(material.shader))
                    throw new BuildFailedException("Review environment shader/material not ready: "+name);
            }
            string reflection=CandidateReviewComposer.Out+"/ReviewSkyReflection.asset";
            if(!present.Contains(reflection))throw new BuildFailedException("Review water reflection dependency missing.");
            UnityEngine.Debug.Log("BUKLOD REVIEW AUTHORED SCENE DEPENDENCIES VERIFIED: "+Required.Length+" plus environment look.");
        }
    }
}
