using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire.Editor {
    // Original beveled wearable bands, built once as shared mesh assets and
    // attached to the existing rig after LOD construction. No collider or new bone.
    internal static class ReviewEquipmentComposer {
        const string Dir=CandidateReviewComposer.Out+"/WearablesV1";
        static Transform Bone(GameObject root,string name){
            var found=root.GetComponentsInChildren<Transform>(true).Where(t=>t.name==name).ToArray();
            if(found.Length!=1)throw new InvalidOperationException("Equipment anchor missing: "+name);
            return found[0];
        }
        static Mesh Band(string name,float radius,float length){
            string path=Dir+"/"+name+".asset";
            var cached=AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if(cached&&cached.vertexCount==136&&cached.subMeshCount==2)return cached;
            var vertices=new List<Vector3>();var uv=new List<Vector2>();
            var armor=new List<int>();var trim=new List<int>();
            const int sides=16;
            // Rounded bevels, recessed central panel and raised metallic edges.
            var rings=new[]{(-.5f,.91f),(-.39f,1f),(-.28f,1f),(-.18f,.955f),(.18f,.955f),(.28f,1f),(.39f,1f),(.5f,.91f)};
            for(int j=0;j<rings.Length;j++)for(int i=0;i<=sides;i++){
                float a=2*Mathf.PI*i/sides;
                vertices.Add(new Vector3(Mathf.Cos(a)*radius*rings[j].Item2,rings[j].Item1*length,Mathf.Sin(a)*radius*rings[j].Item2));
                uv.Add(new Vector2((float)i/sides,(float)j/(rings.Length-1)));
            }
            for(int j=0;j<rings.Length-1;j++)for(int i=0;i<sides;i++){
                int a=j*(sides+1)+i,b=a+1,c=a+sides+1,d=c+1;
                var indices=j==0||j==1||j==5||j==6?trim:armor;
                indices.Add(a);indices.Add(c);indices.Add(b);indices.Add(b);indices.Add(c);indices.Add(d);
            }
            var fresh=new Mesh{name=name};fresh.SetVertices(vertices);fresh.SetUVs(0,uv);fresh.subMeshCount=2;
            fresh.SetTriangles(armor,0);fresh.SetTriangles(trim,1);fresh.RecalculateNormals();fresh.RecalculateTangents();fresh.RecalculateBounds();
            var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if(mesh){EditorUtility.CopySerialized(fresh,mesh);UnityEngine.Object.DestroyImmediate(fresh);EditorUtility.SetDirty(mesh);}
            else{mesh=fresh;AssetDatabase.CreateAsset(mesh,path);}
            return mesh;
        }
        static GameObject Add(Transform anchor,string name,Mesh mesh,Material[] materials,Vector3 offset){
            var go=new GameObject(name);go.transform.SetParent(anchor,false);go.transform.localPosition=offset;
            go.AddComponent<MeshFilter>().sharedMesh=mesh;
            var r=go.AddComponent<MeshRenderer>();r.sharedMaterials=materials;
            r.shadowCastingMode=ShadowCastingMode.On;r.receiveShadows=true;go.SetActive(false);return go;
        }
        internal static void Attach(GameObject hero){
            if(!AssetDatabase.IsValidFolder(Dir)){
                if(System.IO.Directory.Exists(Dir))AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
                else AssetDatabase.CreateFolder(CandidateReviewComposer.Out,"WearablesV1");
                if(!AssetDatabase.IsValidFolder(Dir))throw new InvalidOperationException("Wearable asset folder unavailable.");
            }
            var materials=hero.GetComponentsInChildren<SkinnedMeshRenderer>(true).SelectMany(r=>r.sharedMaterials).Where(m=>m).Distinct().ToArray();
            Material armor=materials.FirstOrDefault(m=>m.name=="armor"),trim=materials.FirstOrDefault(m=>m.name=="trim");
            if(!armor||!trim)throw new InvalidOperationException("Original hero armor materials unavailable.");
            var pair=new[]{armor,trim};
            var specs=new[]{
                (slot:"weapon",bone:"Forearm_R",radius:.101f,length:.10f,y:-.13f),
                (slot:"shield",bone:"Forearm_L",radius:.102f,length:.12f,y:-.12f),
                (slot:"armor",bone:"UpperArm_L",radius:.126f,length:.11f,y:-.085f),
                (slot:"armor",bone:"UpperArm_R",radius:.126f,length:.11f,y:-.085f),
                (slot:"boots",bone:"Shin_L",radius:.107f,length:.10f,y:-.22f),
                (slot:"boots",bone:"Shin_R",radius:.107f,length:.10f,y:-.22f),
                (slot:"jewel",bone:"Hand_L",radius:.072f,length:.045f,y:-.04f)
            };
            var mounts=new List<ReviewEquipmentVisual.Mount>();
            foreach(var spec in specs){
                var bone=Bone(hero,spec.bone);
                var offset=new Vector3(0,spec.y,0);
                var plate=Add(bone,"Earned "+spec.slot+" armor",Band(spec.slot+"-base",spec.radius,spec.length),pair,offset);
                var advanced=Add(bone,"Earned "+spec.slot+" tier III trim",Band(spec.slot+"-trim",spec.radius*1.08f,spec.length*.24f),pair,offset+Vector3.up*spec.length*.28f);
                mounts.Add(new ReviewEquipmentVisual.Mount{slot=spec.slot,basePlate=plate,advancedTrim=advanced});
            }
            hero.AddComponent<ReviewEquipmentVisual>().mounts=mounts.ToArray();
        }
    }
}
