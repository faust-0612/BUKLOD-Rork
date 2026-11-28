using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Actual Library geometry, not generated meshes. Decorative only; no combat/nav changes.
    internal static class LibraryVillageReview {
        const string Source="Assets/Art/Library/KayKitFurniture/";
        const string Atlas=Source+"furniturebits_texture.png";
        const string MaterialPath=CandidateReviewComposer.Out+"/LibraryFurniture.mat";
        // Preserve the original curated models and include every pinned furniture mesh.
        static readonly string[] Names={"cabinet_medium_decorated","shelf_B_large_decorated","table_medium_long","chair_stool_wood","cactus_medium_A","cactus_medium_B","lamp_standing","book_set","table_small","chair_A_wood","shelf_A_small","cabinet_small_decorated","armchair","armchair_pillows","bed_double_A","bed_double_B","bed_single_A","bed_single_B","book_single","cabinet_medium","cabinet_small","cactus_small_A","cactus_small_B","chair_A","chair_B","chair_B_wood","chair_C","chair_stool","couch","couch_pillows","lamp_table","pictureframe_large_A","pictureframe_large_B","pictureframe_medium","pictureframe_small_A","pictureframe_small_B","pictureframe_small_C","pictureframe_standing_A","pictureframe_standing_B","pillow_A","pillow_B","rug_oval_A","rug_oval_B","rug_rectangle_A","rug_rectangle_B","rug_rectangle_stripes_A","rug_rectangle_stripes_B","shelf_A_big","shelf_B_large","shelf_B_small","shelf_B_small_decorated","table_low","table_medium"};
        static readonly Dictionary<string,string> Hashes=new Dictionary<string,string>(StringComparer.Ordinal){
            {"Assets/Art/Library/KayKitFurniture/armchair.fbx","751a982b3ac36cadb18a5e6ae116ff8430cbf56afe2fe4cc36595b48be233cfa"},
            {"Assets/Art/Library/KayKitFurniture/armchair_pillows.fbx","2b940763c0caa04e848838f9f567b8f70e8b62d6e494463e0c64586b6f6edb8a"},
            {"Assets/Art/Library/KayKitFurniture/bed_double_A.fbx","ade8ffa4d355ae5d7f1da0412cb2224f3eb2ded14287d74444a587aa3315564f"},
            {"Assets/Art/Library/KayKitFurniture/bed_double_B.fbx","68e707f9312e3b6c780424bd2fdbecd3e478aea508d6c1e543c71d14866daed1"},
            {"Assets/Art/Library/KayKitFurniture/bed_single_A.fbx","3bef87857c689e7c2dda2a8cefc156fab4f025cd1d6c664f84a663ddb9fa673a"},
            {"Assets/Art/Library/KayKitFurniture/bed_single_B.fbx","30bbb54c485a81e9f6cfca6153b8aa6eeb271cd961ea9d738ebd4d18a1a5a84a"},
            {"Assets/Art/Library/KayKitFurniture/book_set.fbx","d93bec807737f1b217fc594104c8d5e870076018b743b9a1d9f27242bf450d60"},
            {"Assets/Art/Library/KayKitFurniture/book_single.fbx","1c1ddd9cb95341c3bf2be2ea160f8aef93cc2788abdb6660bb4c22e598196ae1"},
            {"Assets/Art/Library/KayKitFurniture/cabinet_medium.fbx","b2d170910f2e2bead3adf794e350fdec69c3b3b16920392918e0c7d777c22790"},
            {"Assets/Art/Library/KayKitFurniture/cabinet_medium_decorated.fbx","fe6cd0349dc67fe3d64284c3262c5f05986dc0c92f116472459dc2f8bab4f708"},
            {"Assets/Art/Library/KayKitFurniture/cabinet_small.fbx","fb27d3ceaa1fef5ae0b55e528ae86d4d1dc7c2989df493802f871f4bc92283ff"},
            {"Assets/Art/Library/KayKitFurniture/cabinet_small_decorated.fbx","c6c8958618b749d3a73630fb4248fad1cb69cbe0bf2155f5c7b7ccca20195aa1"},
            {"Assets/Art/Library/KayKitFurniture/cactus_medium_A.fbx","e43ee956a6d99b7d362c466ce65935feff632f5e6f50c0528ceb041071cc17a6"},
            {"Assets/Art/Library/KayKitFurniture/cactus_medium_B.fbx","36c2ee0f926a30451ceb3e6483d785cbfc2e7ef80e0e7bf2b6992d554c99c5d2"},
            {"Assets/Art/Library/KayKitFurniture/cactus_small_A.fbx","ed1d332070c625be283b45cf51f8abc97efbb4752db744d80df9552e7115792c"},
            {"Assets/Art/Library/KayKitFurniture/cactus_small_B.fbx","df586de672bc60103cb6a880de14d8ca54f04ece1485fcd21a418b4a1c0864de"},
            {"Assets/Art/Library/KayKitFurniture/chair_A.fbx","ec61c1958457cae9cb5278fed05d01da1a30d895b2f15133d932f4c54b93b2d0"},
            {"Assets/Art/Library/KayKitFurniture/chair_A_wood.fbx","27ccdf8b93a569c48008e0dee7b828741a086f2cd2a5cb451bf2cb81d69154d4"},
            {"Assets/Art/Library/KayKitFurniture/chair_B.fbx","ee5e863f3d80fe9fd5f6b6f61845e85a7a69e7c6da50c2ddfd2338d1d8189b26"},
            {"Assets/Art/Library/KayKitFurniture/chair_B_wood.fbx","a90334709bba8db5e2d058408bdb77c254cbd66e8e28aa7c527df7e8b2cb3345"},
            {"Assets/Art/Library/KayKitFurniture/chair_C.fbx","919df80e6f7c72a374ae835e543f1724628b8e29402fb2328e6698f0b5754733"},
            {"Assets/Art/Library/KayKitFurniture/chair_stool.fbx","d89529331f8fc93142ee51eda7f18c65adfb4210703189879fa9896c5a419c3b"},
            {"Assets/Art/Library/KayKitFurniture/chair_stool_wood.fbx","8245275f0320c52a939819f0ea9772f95fdfbe6661a1e5c77c67bf88657e5612"},
            {"Assets/Art/Library/KayKitFurniture/couch.fbx","903c67cfd8acac88537c47529a66b000b6ddfd0ad37c092484b38128ddc6cf6a"},
            {"Assets/Art/Library/KayKitFurniture/couch_pillows.fbx","f41675bf352dfd1ebedc4e2236a829537061fd181c57d8efa78515639d122434"},
            {"Assets/Art/Library/KayKitFurniture/furniturebits_texture.png","de62db37a80d1801c3d9eb674890ae04b04469e0c149481a51fa250562c628dc"},
            {"Assets/Art/Library/KayKitFurniture/lamp_standing.fbx","7dd8456bff90c669ec9546041778de9ba02c16d046a30fddf948ed4c751d9fb7"},
            {"Assets/Art/Library/KayKitFurniture/lamp_table.fbx","514bdd1c2bf6dfec99fcb115d56680a96f63e0dbd972dfe1034ee6cb2ccd489c"},
            {"Assets/Art/Library/KayKitFurniture/pictureframe_large_A.fbx","85c33dc8f162e9c4d85dce08706a2bb3fd42067fba572e4f243aec9fa1ff801d"},
            {"Assets/Art/Library/KayKitFurniture/pictureframe_large_B.fbx","d6c2b4cf744bdaba865b092a13432861278ed45ec656a8cd4333ddde764545e0"},
            {"Assets/Art/Library/KayKitFurniture/pictureframe_medium.fbx","9ad66cbc94471855078bf466ef6671b233111c7c5ea003c5a68843fd9b92a3d7"},
            {"Assets/Art/Library/KayKitFurniture/pictureframe_small_A.fbx","4e1c63c5b0695be70555285e8579f79a6cac23bad8e1f6884616e85582c13a30"},
            {"Assets/Art/Library/KayKitFurniture/pictureframe_small_B.fbx","6f301231f28933459e9824660ddc6c3f20d5b55156e468c963224ec7f0f0c600"},
            {"Assets/Art/Library/KayKitFurniture/pictureframe_small_C.fbx","b325c727dfde3f575be2b4654c26562b9e42b43cac0018a7d6689eb715b8554e"},
            {"Assets/Art/Library/KayKitFurniture/pictureframe_standing_A.fbx","939dc9751040f5256c0c4dd7cf2a182bb70344b6a4ef8dd6751fd7b957eb9c5a"},
            {"Assets/Art/Library/KayKitFurniture/pictureframe_standing_B.fbx","9597dce27db856be4f69e835f2c5c8eb253c48d81ee68337d0c12d77f1de9cba"},
            {"Assets/Art/Library/KayKitFurniture/pillow_A.fbx","e06f043e8f0df552e999d5f615d13697379d7ea1c60db49cf427d795431721cc"},
            {"Assets/Art/Library/KayKitFurniture/pillow_B.fbx","f15c12ce124b63985202f0d536802a5544aa6e98808695da8ef4b619bd92bc50"},
            {"Assets/Art/Library/KayKitFurniture/rug_oval_A.fbx","6ce7c166fb1a9a14f9398a4737bb5f8b8e4cd317bd1f3e8ae2a31718640e62b9"},
            {"Assets/Art/Library/KayKitFurniture/rug_oval_B.fbx","c380376974ea23fac13bf949d76f5d20724d7f4323d70b35c910d966dd433ed7"},
            {"Assets/Art/Library/KayKitFurniture/rug_rectangle_A.fbx","db61869b53eed582725ab1612b741a7480d0a6c5df9c67eea2046b63f0099487"},
            {"Assets/Art/Library/KayKitFurniture/rug_rectangle_B.fbx","ec252170b4fda99cddaec2e0dbafb576a7a057921a5b85273b3bd9e31a2646f8"},
            {"Assets/Art/Library/KayKitFurniture/rug_rectangle_stripes_A.fbx","663628896b53ea5b6595b10b43e22e59532c3c3bed3a4d34c0f736a54c52aff4"},
            {"Assets/Art/Library/KayKitFurniture/rug_rectangle_stripes_B.fbx","5f44eec00109e75a80860f0bbd2f76787352bd75ef012cc1159830097616e877"},
            {"Assets/Art/Library/KayKitFurniture/shelf_A_big.fbx","55ee286706aef6a6ee597b2261c05703fdfa52fc8f54fb673191e624480e12c0"},
            {"Assets/Art/Library/KayKitFurniture/shelf_A_small.fbx","640230980af6e99332aa74f94b18893c121a08e7429107d764f803cd9a3e27a3"},
            {"Assets/Art/Library/KayKitFurniture/shelf_B_large.fbx","f511f74063109803d2592da2fd668eb58e5c7bd7ab82761c20a8bf4f9aa9f4dd"},
            {"Assets/Art/Library/KayKitFurniture/shelf_B_large_decorated.fbx","48f31034266500a96fba4b75d43d7b70b2996cc0698a7d96d2a8db310d180761"},
            {"Assets/Art/Library/KayKitFurniture/shelf_B_small.fbx","4b70639d61642f2bf70183b95796635e2cdb5709d3111e2a39d9d3f90689b395"},
            {"Assets/Art/Library/KayKitFurniture/shelf_B_small_decorated.fbx","e6c4f0382b51418bf76e1a80f20ca5c106eb7136aabe68d206e49ba72a4019a3"},
            {"Assets/Art/Library/KayKitFurniture/table_low.fbx","d9e06711bab8a29a6c11610813f04f2fb83d9f71d5cda7ea8eb17f542a6a2142"},
            {"Assets/Art/Library/KayKitFurniture/table_medium.fbx","84f48d3fc346e06d60a62cbe77cdd212e8bc67382b8e40d31064b256bd544e75"},
            {"Assets/Art/Library/KayKitFurniture/table_medium_long.fbx","5d5554ecbaa217fb3bfad060d40ac0439a8ed217559f78f0ddb3ca429e04aeb7"},
            {"Assets/Art/Library/KayKitFurniture/table_small.fbx","599e8d33c7c1978f7820c835b3ff9cc20811001b8060045364a5164282c5d288"}
        };
        static string Hash(string path){using(var s=File.OpenRead(path))using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(s)).Replace("-","").ToLowerInvariant();}
        internal static void ValidateInputs(){
            foreach(var row in Hashes){
                if(!File.Exists(row.Key)||Hash(row.Key)!=row.Value)
                    throw new InvalidOperationException("Missing or changed Library model: "+row.Key+"; run Tools/install-library-assets.py");
            }
        }
        static Bounds BoundsOf(GameObject obj){
            var renderers=obj.GetComponentsInChildren<Renderer>(true);
            if(renderers.Length==0)throw new InvalidOperationException("No imported Library mesh: "+obj.name);
            var b=renderers[0].bounds;foreach(var r in renderers)b.Encapsulate(r.bounds);
            return b;
        }
        static Material Material(){
            var tex=AssetDatabase.LoadAssetAtPath<Texture2D>(Atlas);
            var shader=Shader.Find("Universal Render Pipeline/Lit");
            if(!tex||!shader||!shader.isSupported)throw new InvalidOperationException("Library texture or URP Lit missing.");
            var mat=AssetDatabase.LoadAssetAtPath<Material>(MaterialPath);
            if(!mat){mat=new Material(shader);AssetDatabase.CreateAsset(mat,MaterialPath);}
            mat.shader=shader;mat.SetTexture("_BaseMap",tex);mat.SetColor("_BaseColor",Color.white);
            mat.SetFloat("_Metallic",0f);mat.SetFloat("_Smoothness",.15f);EditorUtility.SetDirty(mat);
            return mat;
        }
        internal static void Apply(Transform parent){
            ValidateInputs();
            var expected=new HashSet<string>(Hashes.Keys.Where(path=>path.EndsWith(".fbx",StringComparison.Ordinal)),StringComparer.Ordinal);
            if(Names.Length!=expected.Count||!expected.SetEquals(Names.Select(name=>Source+name+".fbx")))
                throw new InvalidOperationException("Library furniture roster does not match pinned meshes.");
            if(OfflineBattle.Height-12f<(Names.Length-1)*2f)
                throw new InvalidOperationException("Insufficient exterior space for Library furniture.");
            var models=Names.Select(name=>{
                string path=Source+name+".fbx";
                var model=AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if(!model||model.GetComponentsInChildren<MeshRenderer>(true).Length==0)
                    throw new InvalidOperationException("Library model not imported: "+path);
                return model;
            }).ToArray();
            var mat=Material();
            var holder=new GameObject("Library village exterior props (review only)");
            holder.transform.SetParent(parent,false);
            try{
                for(int team=0;team<2;team++)for(int i=0;i<models.Length;i++){
                    var obj=(GameObject)PrefabUtility.InstantiatePrefab(models[i],holder.transform);
                    if(!obj)throw new InvalidOperationException("Library model instantiation failed: "+Names[i]);
                    obj.name="Library_"+(team==0?"lux_":"tenebra_")+Names[i];
                    obj.transform.localRotation=Quaternion.Euler(0,team==0?30:-150,0);
                    var b=BoundsOf(obj);
                    float span=Mathf.Max(b.size.x,Mathf.Max(b.size.y,b.size.z));
                    if(span<=.001f||float.IsNaN(span)||float.IsInfinity(span))throw new InvalidOperationException("Invalid Library bounds: "+Names[i]);
                    obj.transform.localScale*=1.35f/span;
                    b=BoundsOf(obj);
                    float x=team==0?-2.6f:OfflineBattle.Width+2.6f;
                    float z=6+i*(OfflineBattle.Height-12f)/(models.Length-1);
                    obj.transform.position+=new Vector3(x-b.center.x,-b.min.y,z-b.center.z);
                    b=BoundsOf(obj);
                    if(team==0?b.max.x>=0:b.min.x<=OfflineBattle.Width)throw new InvalidOperationException("Library prop overlaps playable field.");
                    foreach(var renderer in obj.GetComponentsInChildren<Renderer>(true)){
                        var materials=renderer.sharedMaterials;
                        for(int j=0;j<materials.Length;j++)materials[j]=mat;
                        renderer.sharedMaterials=materials;
                    }
                    foreach(var collider in obj.GetComponentsInChildren<Collider>(true))collider.enabled=false;
                }
                AssetDatabase.SaveAssets();
            }catch{UnityEngine.Object.DestroyImmediate(holder);throw;}
            Debug.Log("Library village review: "+Names.Length+" original CC0 models, "+Names.Length*2+" exterior instances. No gameplay collision.");
        }
        internal static void ValidateDependencies(IEnumerable<string> dependencies){
            ValidateInputs();
            var paths=new HashSet<string>(dependencies,StringComparer.Ordinal);
            foreach(var name in Names)if(!paths.Contains(Source+name+".fbx"))
                throw new BuildFailedException("Missing Library village scene dependency: "+name);
            if(!paths.Contains(Atlas)||!paths.Contains(MaterialPath))throw new BuildFailedException("Missing Library village atlas or material.");
        }
    }
}
