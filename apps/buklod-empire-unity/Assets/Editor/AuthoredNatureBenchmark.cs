using System;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Authored CC0 foliage, opt-in review only. No collision or rule changes.
    internal static class AuthoredNatureBenchmark {
        const string Root="Assets/ThirdParty/QuaterniusReview/nature/glTF/";
        public static void Apply(){
            // The sculpted scene already places all three pinned authored foliage models
            // along its actual perimeter and cover. Do not re-add the old straight boundary.
            var view=UnityEngine.Object.FindFirstObjectByType<BattleView>();
            if(view&&view.UsesSculptedRift)return;
            var holder=new GameObject("Authored Quaternius foliage (review)");
            var bush=Load("Bush_Common");
            var shortGrass=Load("Grass_Common_Short");
            var tallGrass=Load("Grass_Common_Tall");
            // Off the navigable ground; no obstructing existing battle lanes.
            for(int i=0;i<12;i++){
                float z=6+i*(OfflineBattle.Height-12)/11f;
                foreach(float x in new[]{-1.5f,OfflineBattle.Width+1.5f}){
                    Place(bush,holder.transform,x,z,1.0f,i*43);
                    Place(i%2==0?shortGrass:tallGrass,holder.transform,x,z+1.3f,.8f,i*61);
                }
            }
            // A playable-camera sample near the Lux central route, using only low grass.
            for(int i=0;i<9;i++){
                float x=12+i*2.1f;
                foreach(float z in new[]{OfflineBattle.Height*.5f-6.5f,OfflineBattle.Height*.5f+6.5f})
                    Place(i%3==0?tallGrass:shortGrass,holder.transform,x,z,.28f,i*47);
            }
        }
        static GameObject Load(string name){
            var obj=AssetDatabase.LoadAssetAtPath<GameObject>(Root+name+".gltf");
            if(!obj)throw new InvalidOperationException("Authored asset import failed: "+name);
            return obj;
        }
        static void Place(GameObject prefab,Transform parent,float x,float z,float size,float yaw){
            var obj=(GameObject)PrefabUtility.InstantiatePrefab(prefab,parent);
            if(!obj)throw new InvalidOperationException("Authored foliage instantiation failed");
            obj.transform.localPosition=new Vector3(x,0,z);
            obj.transform.localRotation=Quaternion.Euler(0,yaw,0);
            var renderers=obj.GetComponentsInChildren<Renderer>(true);
            if(renderers.Length==0)throw new InvalidOperationException("Authored foliage has no renderers");
            var bounds=renderers[0].bounds;foreach(var renderer in renderers)bounds.Encapsulate(renderer.bounds);
            if(bounds.size.y<=.001f)throw new InvalidOperationException("Invalid foliage dimensions");
            obj.transform.localScale*=size/bounds.size.y;
            float minY=float.PositiveInfinity;foreach(var renderer in renderers)minY=Mathf.Min(minY,renderer.bounds.min.y);
            obj.transform.position+=Vector3.up*(-minY);
            foreach(var collider in obj.GetComponentsInChildren<Collider>(true))collider.enabled=false;
        }
    }
}
