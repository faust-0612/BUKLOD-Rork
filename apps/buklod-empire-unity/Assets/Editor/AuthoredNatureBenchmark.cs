using System;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Authored CC0 foliage, opt-in review only. No collision or rule changes.
    internal static class AuthoredNatureBenchmark {
        const string Root="Assets/ThirdParty/QuaterniusReview/nature/glTF/";
        public static void Apply(){
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
            obj.transform.localScale=Vector3.one*size;
            foreach(var collider in obj.GetComponentsInChildren<Collider>(true))collider.enabled=false;
        }
    }
}
