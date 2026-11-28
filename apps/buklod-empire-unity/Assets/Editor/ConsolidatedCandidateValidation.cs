using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // All native candidate entrypoints must validate the same actual serialized assets,
    // not a stale scene, older roster, or unsigned content configuration.
    internal static class ConsolidatedCandidateValidation {
        internal static void Validate(string scenePath,bool requireTrust){
            if(scenePath!=StylizedArenaBenchmark.ScenePath||!AssetDatabase.LoadAssetAtPath<SceneAsset>(scenePath))
                throw new BuildFailedException("Expected consolidated Empire scene.");
            if(requireTrust)EmpireContentPublisher.ValidateBuildConfiguration();
            var deps=AssetDatabase.GetDependencies(scenePath,true);
            ReviewAuthoredAssetGate.Validate(deps);
            AuthoredExpansionReview.Validate(deps);
            OfflineAuthoredMotionReview.ValidateDependencies(deps);
            PortraitCaptureReview.ValidateDependencies(deps);
            var catalogPath=CandidateReviewComposer.Out+"/OfflineReviewCatalog.asset";
            var navPath=CandidateReviewComposer.Out+"/OfflineReviewNavMesh.asset";
            if(!deps.Contains(catalogPath)||!deps.Contains(navPath)||deps.Any(p=>p.StartsWith("Assets/Production/",StringComparison.OrdinalIgnoreCase)||p==ArenaSceneComposer.ScenePath||OwnerMotionPracticeScene.IsPrivatePath(p)))
                throw new BuildFailedException("Invalid consolidated scene dependencies.");
            var catalog=AssetDatabase.LoadAssetAtPath<BattleVisualCatalog>(catalogPath);
            if(!catalog)throw new BuildFailedException("Missing consolidated catalog.");
            catalog.ValidateOfflineReview();
            EmpireContentPublisher.ValidateBase(catalog);
            if(!(UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline is UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset))
                throw new BuildFailedException("Missing review URP pipeline.");
            var bank=Resources.Load<TextAsset>("SkillAudioBank");
            if(!bank)throw new BuildFailedException("Missing skill audio bank.");
            SkillAudio.ValidateBank(bank.bytes);
            // Scene is open during preparation. Check exact live component bindings then;
            // dependency checks above also run in the actual build callback.
            var scene=UnityEngine.SceneManagement.SceneManager.GetSceneByPath(scenePath);
            if(scene.IsValid()&&scene.isLoaded){
                var views=scene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<BattleView>(true)).ToArray();
                if(views.Length!=1||!views[0].IsConfiguredReview||views[0].visuals!=catalog||
                    !views[0].GetComponent<EmpireContentUpdater>()||!views[0].battleCamera)
                    throw new BuildFailedException("Actual consolidated match or updater binding missing.");
                HeroDialogueReview.ValidateDependencies(views[0].gameObject,deps);
            }
        }
    }
}
