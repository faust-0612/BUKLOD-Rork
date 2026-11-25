using System;
using System.IO;
using System.Linq;
using Unity.AI.Navigation;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Buklod.Empire.Editor {
    // Review-only Unity scene. No Android build, production receipt, build-settings mutation or backend.
    public static class OfflineReviewComposer {
        const string Out=CandidateReviewComposer.Out;
        public const string ScenePath=Out+"/OfflineBattleReview.unity";
        static GameObject Prefab(string id){
            var p=AssetDatabase.LoadAssetAtPath<GameObject>(Out+"/Prefabs/"+id+".prefab");
            if(!p)throw new InvalidOperationException("Run candidate asset import first: "+id);
            return p;
        }
        [MenuItem("BUKLOD Empire/Assemble offline gameplay review")]
        public static void Prepare(){
            if(EditorSceneManager.GetActiveScene().isDirty)throw new InvalidOperationException("Save the open scene first.");
            if(!(GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset))
                throw new InvalidOperationException("Set an actual URP asset before importing/rendering candidates.");
            if(!Directory.Exists(Out))throw new InvalidOperationException("Prepare candidate assets first.");
            var c=ScriptableObject.CreateInstance<BattleVisualCatalog>();
            c.genesisRift=Prefab("genesis_rift_candidate");
            c.heroes=HeroKitCatalog.All.Select(h=>new BattleVisualCatalog.HeroVisual{id=h.Id,prefab=Prefab(h.Id)}).ToArray();
            c.factions=new[]{Faction(ArenaTeam.Lux),Faction(ArenaTeam.Tenebra)};
            // Only import these generated models into the isolated review catalog, never a production receipt.
            var wildlife=WildlifeReviewComposer.ImportReviewPrefabs();
            string[] ids={"azure_stag","crimson_wolf","emerald_serpent","golden_scarab","stone_golem","river_spirit","wind_falcon","ancient_sentinel","colossal_guardian"};
            var kinds=new[]{WildernessKind.AzureStag,WildernessKind.CrimsonWolf,WildernessKind.EmeraldSerpent,WildernessKind.GoldenScarab,WildernessKind.StoneGolem,WildernessKind.RiverSpirit,WildernessKind.WindFalcon,WildernessKind.AncientSentinel,WildernessKind.ColossalGuardian};
            c.wilderness=kinds.Select((kind,i)=>new BattleVisualCatalog.WildernessVisual{kind=kind,prefab=wildlife[ids[i]]}).ToArray();
            c.resources=Enum.GetValues(typeof(VillageResourceKind)).Cast<VillageResourceKind>().Select(kind=>new BattleVisualCatalog.ResourceVisual{kind=kind,prefab=wildlife[kind.ToString().ToLowerInvariant()]}).ToArray();
            EconomyReviewImporter.Bind(c);
            c.ValidateEditorReview(); // deliberately no production receipt
            var catalogPath=Out+"/OfflineReviewCatalog.asset";
            var old=AssetDatabase.LoadAssetAtPath<BattleVisualCatalog>(catalogPath);
            if(old){EditorUtility.CopySerialized(c,old);UnityEngine.Object.DestroyImmediate(c);c=old;EditorUtility.SetDirty(c);}
            else AssetDatabase.CreateAsset(c,catalogPath);
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var world=new GameObject("Review world and navigation");
            var map=(GameObject)PrefabUtility.InstantiatePrefab(c.genesisRift,scene);
            map.transform.SetParent(world.transform,false);
            // glTFast reverses X. Undo for this symmetric source coordinate system only;
            // actors retain their own imported handedness. No negative-scale collider meshes.
            var terrain=map.GetComponentsInChildren<Renderer>(true).Where(r=>r.name.Contains("GenesisRift_terrain")).ToArray();
            if(terrain.Length==0)throw new InvalidOperationException("Missing canonical terrain renderer.");
            Bounds bound=terrain[0].bounds;foreach(var r in terrain.Skip(1))bound.Encapsulate(r.bounds);
            if(Mathf.Abs(bound.size.x-OfflineBattle.Width)>.1f||Mathf.Abs(bound.size.z-OfflineBattle.Height)>.1f)
                throw new InvalidOperationException("Unexpected imported map dimensions: "+bound);
            if(Mathf.Abs(bound.min.x+OfflineBattle.Width)<.1f&&Mathf.Abs(bound.max.x)<.1f)
                map.transform.localScale=new Vector3(-map.transform.localScale.x,map.transform.localScale.y,map.transform.localScale.z);
            else if(Mathf.Abs(bound.min.x)>.1f||Mathf.Abs(bound.max.x-OfflineBattle.Width)>.1f)
                throw new InvalidOperationException("Unknown map coordinate conversion.");
            bound=terrain[0].bounds;foreach(var r in terrain.Skip(1))bound.Encapsulate(r.bounds);
            if(Mathf.Abs(bound.min.x)>.1f||Mathf.Abs(bound.max.x-OfflineBattle.Width)>.1f||Mathf.Abs(bound.min.z)>.1f||Mathf.Abs(bound.max.z-OfflineBattle.Height)>.1f)
                throw new InvalidOperationException("Map failed canonical alignment: "+bound);
            foreach(var collider in map.GetComponentsInChildren<Collider>(true))collider.enabled=false;
            // Walkable flat reference plane, matching existing match-local terrain semantics.
            var floor=new GameObject("Navigation ground proxy",typeof(BoxCollider));
            floor.transform.SetParent(world.transform,false);floor.transform.localPosition=new Vector3(OfflineBattle.Width/2,-.5f,OfflineBattle.Height/2);
            floor.GetComponent<BoxCollider>().size=new Vector3(OfflineBattle.Width,1,OfflineBattle.Height);
            foreach(var circle in new[]{new Vector3(.29f,.23f,.025f),new Vector3(.71f,.77f,.025f),new Vector3(.42f,.41f,.025f),new Vector3(.58f,.59f,.025f),new Vector3(.48f,.81f,.018f),new Vector3(.52f,.19f,.018f)}){
                var obstacle=new GameObject("Canonical cover proxy",typeof(CapsuleCollider),typeof(NavMeshModifier));
                obstacle.transform.SetParent(world.transform,false);float radius=circle.z*OfflineBattle.Height;
                obstacle.transform.localPosition=new Vector3(circle.x*OfflineBattle.Width,0,circle.y*OfflineBattle.Height);
                var collider=obstacle.GetComponent<CapsuleCollider>();collider.radius=radius;collider.height=radius*2+3;
                var modifier=obstacle.GetComponent<NavMeshModifier>();modifier.overrideArea=true;modifier.area=1;
            }
            var surface=world.AddComponent<NavMeshSurface>();surface.collectObjects=CollectObjects.Children;surface.useGeometry=NavMeshCollectGeometry.PhysicsColliders;
            surface.BuildNavMesh();
            if(!surface.navMeshData)throw new InvalidOperationException("Review NavMesh bake failed.");
            var navPath=Out+"/OfflineReviewNavMesh.asset";
            var nav=AssetDatabase.LoadAssetAtPath<NavMeshData>(navPath);
            if(nav){EditorUtility.CopySerialized(surface.navMeshData,nav);surface.RemoveData();surface.navMeshData=nav;surface.AddData();EditorUtility.SetDirty(nav);}
            else AssetDatabase.CreateAsset(surface.navMeshData,navPath);
            VerifyRoutes();
            var camera=new GameObject("Review camera",typeof(Camera),typeof(AudioListener)).GetComponent<Camera>();
            camera.tag="MainCamera";camera.fieldOfView=46;camera.farClipPlane=250;
            var sun=new GameObject("Review sunlight",typeof(Light)).GetComponent<Light>();
            sun.type=LightType.Directional;sun.color=new Color(1,.93f,.82f);sun.intensity=1.12f;sun.shadows=LightShadows.Soft;sun.transform.rotation=Quaternion.Euler(48,-35,0);
            RenderSettings.ambientMode=AmbientMode.Trilight;RenderSettings.ambientSkyColor=new Color(.38f,.46f,.58f);RenderSettings.ambientEquatorColor=new Color(.28f,.32f,.34f);RenderSettings.ambientGroundColor=new Color(.18f,.21f,.17f);
            EnvironmentReviewLook.Apply(map,camera);
            var root=new GameObject("UNAPPROVED EDITOR OFFLINE MATCH",typeof(BattleView),typeof(BattleEffects),typeof(WorldInteractionEffects),typeof(ReviewContactShadows));
            var view=root.GetComponent<BattleView>();view.visuals=c;view.battleCamera=camera;view.cameraHeight=19.5f;view.ConfigureEditorReview();
            var shader=Shader.Find("BUKLOD/CombatPulse");if(!shader)throw new InvalidOperationException("Combat shader missing.");
            var mat=AssetDatabase.LoadAssetAtPath<Material>(Out+"/ReviewPulse.mat");
            if(!mat){mat=new Material(shader);AssetDatabase.CreateAsset(mat,Out+"/ReviewPulse.mat");}
            root.GetComponent<BattleEffects>().pulseMaterial=mat;
            root.GetComponent<BattleEffects>().skillParticleMaterial=SkillParticleMaterial.Get(Out+"/ReviewSkillParticles.mat");
            var fragmentShader=Shader.Find("BUKLOD/Review/WorldFragments");
            if(!fragmentShader||!fragmentShader.isSupported)throw new InvalidOperationException("World fragment review shader unavailable.");
            var fragmentPath=Out+"/ReviewWorldFragments.mat";
            var fragmentMaterial=AssetDatabase.LoadAssetAtPath<Material>(fragmentPath);
            if(!fragmentMaterial){fragmentMaterial=new Material(fragmentShader);AssetDatabase.CreateAsset(fragmentMaterial,fragmentPath);}
            else if(fragmentMaterial.shader!=fragmentShader){fragmentMaterial.shader=fragmentShader;EditorUtility.SetDirty(fragmentMaterial);}
            root.GetComponent<WorldInteractionEffects>().debrisMaterial=fragmentMaterial;
            var shadowShader=Shader.Find("BUKLOD/Review/ContactGround");
            if(!shadowShader||!shadowShader.isSupported)throw new InvalidOperationException("Contact ground review shader unavailable.");
            var shadowPath=Out+"/ReviewContactGround.mat";
            var shadowMaterial=AssetDatabase.LoadAssetAtPath<Material>(shadowPath);
            if(!shadowMaterial){shadowMaterial=new Material(shadowShader);AssetDatabase.CreateAsset(shadowMaterial,shadowPath);}
            else if(shadowMaterial.shader!=shadowShader){shadowMaterial.shader=shadowShader;EditorUtility.SetDirty(shadowMaterial);}
            root.GetComponent<ReviewContactShadows>().material=shadowMaterial;
            PresentationAudioReview.Bind(root);
            PortraitCaptureReview.Bind(root);
            if(!EditorSceneManager.SaveScene(scene,ScenePath))throw new InvalidOperationException("Failed to save offline review scene.");
            AssetDatabase.SaveAssets();
            Debug.Log("Editor-only offline match scene assembled. Three lanes and both base routes verified. No production approval or Android build.");
        }
        static BattleVisualCatalog.FactionVisual Faction(ArenaTeam team){
            string id=team==ArenaTeam.Lux?"lux":"tenebra";
            var villagers=team==ArenaTeam.Lux?CandidateReviewComposer.LuxVillagers:CandidateReviewComposer.TenebraVillagers;
            var f=new BattleVisualCatalog.FactionVisual{team=team,tower=Prefab(id+"_tower_candidate"),core=Prefab(id+"_core_candidate"),villagers=villagers.Select(v=>new BattleVisualCatalog.VillagerVisual{id=v,prefab=Prefab(id+"_"+v)}).ToArray()};
            foreach(MinionRole role in Enum.GetValues(typeof(MinionRole)))f.minions[(int)role]=Prefab(id+"_"+role.ToString().ToLowerInvariant());
            return f;
        }
        static void VerifyRoutes(){
            foreach(float fraction in new[]{.19f,.5f,.81f}){
                float z=OfflineBattle.Height*fraction;
                if(!NavMesh.SamplePosition(new Vector3(19,0,z),out var a,1,NavMesh.AllAreas)||
                   !NavMesh.SamplePosition(new Vector3(OfflineBattle.Width-19,0,z),out var b,1,NavMesh.AllAreas))
                    throw new InvalidOperationException("Lane spawn missing from NavMesh: "+fraction);
                var path=new NavMeshPath();
                if(!NavMesh.CalculatePath(a.position,b.position,NavMesh.AllAreas,path)||path.status!=NavMeshPathStatus.PathComplete)
                    throw new InvalidOperationException("Lane has no complete route: "+fraction);
            }
            foreach(float x in new[]{17f,OfflineBattle.Width-17})for(int i=0;i<5;i++){
                var spawn=new Vector3(x,0,OfflineBattle.Height*.5f+(i-2)*5);
                if(!NavMesh.SamplePosition(spawn,out _,.5f,NavMesh.AllAreas))
                    throw new InvalidOperationException("Hero spawn missing from NavMesh: "+spawn);
            }
        }
    }
}
