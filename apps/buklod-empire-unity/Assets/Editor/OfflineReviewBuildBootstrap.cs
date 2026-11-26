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
        public static void Build() {
            if (Application.unityVersion != "6000.0.86f1")
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
                OfflineReviewAndroidBuild.Build();
            } finally {
                GraphicsSettings.defaultRenderPipeline = previous;
                QualitySettings.renderPipeline = quality;
                AssetDatabase.SaveAssets();
            }
        }
    }
}
