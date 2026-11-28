using System;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire.Editor {
    // Explicit candidate assembly; never registers a scene in build settings or starts a match.
    public static class OnlineCandidateComposer {
        public const string ScenePath="Assets/Generated/OnlineBattleCandidate.unity";
        [MenuItem("BUKLOD Empire/Online/Assemble approved catalog candidate")]
        static void Prepare(){
            var catalog=Selection.activeObject as BattleVisualCatalog;
            if(!catalog)throw new InvalidOperationException("Select a rights-verified production visual catalog first.");
            catalog.Validate();
            if(Application.isPlaying||EditorSceneManager.GetActiveScene().isDirty)throw new InvalidOperationException("Save the scene and stop playback first.");
            if(AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath))throw new InvalidOperationException("Candidate scene already exists; preserve existing edits.");
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var map=(GameObject)PrefabUtility.InstantiatePrefab(catalog.genesisRift,scene);
            if(!map)throw new InvalidOperationException("Catalog terrain prefab is unavailable.");
            var terrain=map.GetComponentsInChildren<Renderer>(true).Where(r=>r.name.Contains("GenesisRift_terrain")).ToArray();
            if(terrain.Length==0)throw new InvalidOperationException("Missing canonical terrain renderer.");
            Bounds BoundsOf(){var b=terrain[0].bounds;foreach(var r in terrain.Skip(1))b.Encapsulate(r.bounds);return b;}
            var bounds=BoundsOf();
            if(Mathf.Abs(bounds.min.x+OfflineBattle.Width)<.1f&&Mathf.Abs(bounds.max.x)<.1f)
                map.transform.localScale=new Vector3(-map.transform.localScale.x,map.transform.localScale.y,map.transform.localScale.z);
            bounds=BoundsOf();
            if(Mathf.Abs(bounds.min.x)>.1f||Mathf.Abs(bounds.max.x-OfflineBattle.Width)>.1f||Mathf.Abs(bounds.min.z)>.1f||Mathf.Abs(bounds.max.z-OfflineBattle.Height)>.1f)
                throw new InvalidOperationException("Online terrain coordinates do not match authority.");
            foreach(var c in map.GetComponentsInChildren<Collider>(true))c.enabled=false;
            if(map.GetComponentsInChildren<BattleView>(true).Length>0)throw new InvalidOperationException("Offline simulation must not be present.");
            var camera=new GameObject("Online camera",typeof(Camera),typeof(AudioListener)).GetComponent<Camera>();
            camera.tag="MainCamera";camera.orthographic=true;camera.orthographicSize=StylizedArenaPresentation.OrthographicSize;camera.farClipPlane=250;
            camera.transform.position=new Vector3(OfflineBattle.Width/2,23,OfflineBattle.Height/2-23*.73f);
            camera.transform.rotation=Quaternion.Euler(54,0,0);
            var light=new GameObject("Online daylight",typeof(Light)).GetComponent<Light>();light.type=LightType.Directional;light.intensity=1.12f;light.shadows=LightShadows.Soft;light.transform.rotation=Quaternion.Euler(48,-35,0);
            RenderSettings.ambientMode=AmbientMode.Trilight;RenderSettings.ambientSkyColor=new Color(.38f,.46f,.58f);RenderSettings.ambientEquatorColor=new Color(.28f,.32f,.34f);RenderSettings.ambientGroundColor=new Color(.18f,.21f,.17f);
            var owner=new GameObject("Authenticated online session",typeof(OnlineSessionController));
            var view=owner.GetComponent<OnlineBattlePresentation>();view.visuals=catalog;view.battleCamera=camera;
            if(!AssetDatabase.IsValidFolder("Assets/Generated"))AssetDatabase.CreateFolder("Assets","Generated");
            if(!EditorSceneManager.SaveScene(scene,ScenePath))throw new InvalidOperationException("Online candidate save failed.");
            Debug.Log("Online scene candidate saved. Authenticated handoff and isolated hosting remain required; no APK or production approval.");
        }
    }
}
