using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Buklod.Empire.Editor {
    // Explicit local test build only. Never supplies production provenance.
    public static class OfflineReviewBuildBootstrap {
        const string Folder = "Assets/Generated/ReviewBuildPipeline";
        const string PipelinePath = Folder + "/ReviewPipeline.asset";
        const string RendererPath = Folder + "/ReviewRenderer.asset";
        const string PackagePath = "Packages/com.unity.render-pipelines.universal";
        internal static void EnsureReviewPipeline() {
            if (Application.unityVersion != "6000.3.29f1" || SystemInfo.graphicsDeviceType == GraphicsDeviceType.Null)
                throw new BuildFailedException("Pinned graphics-capable Unity editor required; disable headless mode.");
            if (GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset) return;
            if (GraphicsSettings.defaultRenderPipeline != null || QualitySettings.renderPipeline != null)
                throw new BuildFailedException("Existing non-URP configuration will not be overwritten.");
                Directory.CreateDirectory(Folder);
                AssetDatabase.Refresh();
                var renderer = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(RendererPath);
                if (!renderer) {
                    if (File.Exists(RendererPath)) throw new BuildFailedException("Unexpected renderer asset.");
                    renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                    AssetDatabase.CreateAsset(renderer, RendererPath);
                }
                ResourceReloader.ReloadAllNullIn(renderer, PackagePath);
                EditorUtility.SetDirty(renderer);
                var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(PipelinePath);
                if (!pipeline) {
                    if (File.Exists(PipelinePath)) throw new BuildFailedException("Unexpected pipeline asset.");
                    pipeline = UniversalRenderPipelineAsset.Create(renderer);
                    AssetDatabase.CreateAsset(pipeline, PipelinePath);
                }
                AssetDatabase.SaveAssets();
                GraphicsSettings.defaultRenderPipeline = pipeline;
                if (GraphicsSettings.currentRenderPipeline != pipeline)
                    throw new BuildFailedException("Review URP activation failed.");
        }
        // Import, scene and deformation validation only; does not call BuildPlayer.
        public static void ValidateOnly() {
            var previous=GraphicsSettings.defaultRenderPipeline;var quality=QualitySettings.renderPipeline;
            try {
                EnsureReviewPipeline();ConsolidatedOfflineReview.Prepare();StylizedArenaBenchmark.Prepare();
                var view=UnityEngine.Object.FindFirstObjectByType<BattleView>();
                if(!view||!view.IsConfiguredReview||!view.visuals)throw new BuildFailedException("Review scene missing.");
                var deps=AssetDatabase.GetDependencies(StylizedArenaBenchmark.ScenePath,true);
                ReviewAuthoredAssetGate.Validate(deps);AuthoredExpansionReview.Validate(deps);
                OfflineMotionGate.Validate(view.visuals);
                Debug.Log("BUKLOD_OFFLINE_PREFLIGHT_PASS — no APK or device approval.");
            } finally {GraphicsSettings.defaultRenderPipeline=previous;QualitySettings.renderPipeline=quality;AssetDatabase.SaveAssets();}
        }
        public static void Build() {
            if (Application.unityVersion != "6000.3.29f1")
                throw new BuildFailedException("Use the pinned Unity editor.");
            if (SystemInfo.graphicsDeviceType == GraphicsDeviceType.Null)
                throw new BuildFailedException("A graphics-capable editor is required.");
            var previous = GraphicsSettings.defaultRenderPipeline;
            var quality = QualitySettings.renderPipeline;
            if (GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset) {
                OfflineReviewAndroidBuild.Build();
                return;
            }
            if (previous != null || quality != null)
                throw new BuildFailedException("Existing non-URP configuration will not be overwritten.");
            try {
                EnsureReviewPipeline();
                OfflineReviewAndroidBuild.Build();
            } finally {
                GraphicsSettings.defaultRenderPipeline = previous;
                QualitySettings.renderPipeline = quality;
                AssetDatabase.SaveAssets();
            }
        }
    }
}
