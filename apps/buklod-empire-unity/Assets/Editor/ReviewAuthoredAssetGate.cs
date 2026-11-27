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
            Ui+"Combat/door-open.ogg","Assets/Resources/LibraryAudio/Reward/coin-collect.ogg",Ui+"Combat/fight.ogg",Ui+"Combat/you_win.ogg",Ui+"Combat/you_lose.ogg",Ui+"Combat/tie.ogg",
            Nature+"Bush_Common.gltf",Nature+"Grass_Common_Short.gltf",Nature+"Grass_Common_Tall.gltf"
        };
        internal static void Validate(IEnumerable<string> dependencies){
            var present=new HashSet<string>(dependencies,StringComparer.Ordinal);
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
