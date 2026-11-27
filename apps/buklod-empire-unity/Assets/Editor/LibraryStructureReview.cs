using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Collections.Generic;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Real CC0 source models replace visual-only static catalog entries in the isolated review.
    // Existing prefab dimensions are used solely as a scale reference; no old geometry is rendered.
    internal static class LibraryStructureReview {
        const string Source="Tools/AssetCandidates/LibraryFirst/";
        const string Out=CandidateReviewComposer.Out+"/LibraryFirst/";
        [Serializable] sealed class Row {public string source,name,gitBlob;public int bytes;}
        [Serializable] sealed class Binding {public string id,group,name,crop;}
        [Serializable] sealed class Manifest {public string status,license,author;public Row[] models;public Binding[] staticReviewBindings;public bool releaseApproved;}
        static readonly string[] Roles={"tower","core","depot","guardPost","farm","barracks","market","house"};
        static readonly string[] Extra={"wood","stone","gold","food","crystal","field_pickup","relic_pickup"};
        internal static string GitBlob(byte[] bytes){
            var header=Encoding.ASCII.GetBytes("blob "+bytes.Length.ToString(System.Globalization.CultureInfo.InvariantCulture)+"\0");
            using(var hash=SHA1.Create()){
                hash.TransformBlock(header,0,header.Length,header,0);
                hash.TransformFinalBlock(bytes,0,bytes.Length);
                return BitConverter.ToString(hash.Hash).Replace("-","").ToLowerInvariant();
            }
        }
        static bool SafeName(string name)=>!string.IsNullOrWhiteSpace(name)&&name.EndsWith(".glb",StringComparison.Ordinal)&&name==Path.GetFileName(name)&&!name.Contains("/")&&!name.Contains("\\")&&!name.Contains(":");
        static Manifest Read(){
            var doc=JsonUtility.FromJson<Manifest>(File.ReadAllText(Source+"manifest.json"));
            if(doc==null||doc.status!="LICENSED_SOURCE_CANDIDATES_ONLY"||doc.license!="CC0-1.0"||doc.author!="Quaternius"||doc.releaseApproved||doc.models==null||doc.staticReviewBindings==null)
                throw new InvalidOperationException("Invalid Library source provenance.");
            var expected=new HashSet<string>(new[]{"lux","tenebra"}.SelectMany(t=>Roles.Select(r=>t+"_"+r)).Concat(Extra),StringComparer.Ordinal);
            foreach(var b in doc.staticReviewBindings){
                if(b==null||!expected.Remove(b.id)||(b.group!="RTS"&&b.group!="RPG")||!SafeName(b.name)||(!string.IsNullOrEmpty(b.crop)&&!SafeName(b.crop)))
                    throw new InvalidOperationException("Invalid Library static binding.");
                Find(doc,b.group,b.name);
                if(!string.IsNullOrEmpty(b.crop))Find(doc,b.group,b.crop);
            }
            if(expected.Count!=0)throw new InvalidOperationException("Incomplete Library static roster.");
            return doc;
        }
        static Row Find(Manifest doc,string group,string name){
            var rows=doc.models.Where(x=>x!=null&&x.source==group&&x.name==name).ToArray();
            if(rows.Length!=1||rows[0].bytes<=0||rows[0].bytes>16*1024*1024||rows[0].gitBlob==null||rows[0].gitBlob.Length!=40)
                throw new InvalidOperationException("Unpinned Library model: "+group+"/"+name);
            return rows[0];
        }
        static byte[] Verified(Row row){
            var path=Source+row.source+"/"+row.name;
            if(!File.Exists(path)||new FileInfo(path).Length!=row.bytes)throw new FileNotFoundException("Missing pinned Library model.",path);
            var bytes=File.ReadAllBytes(path);
            if(GitBlob(bytes)!=row.gitBlob)throw new InvalidOperationException("Library model hash mismatch: "+path);
            return bytes;
        }
        static string ModelPath(string group,string name)=>Out+"Models/"+group+"/"+name;
        static string PrefabPath(string id)=>Out+"Prefabs/"+id+".prefab";
        static void Copy(Manifest doc,string group,string name){
            var row=Find(doc,group,name);var bytes=Verified(row);
            string path=ModelPath(group,name);Directory.CreateDirectory(Path.GetDirectoryName(path));
            if(!File.Exists(path)||GitBlob(File.ReadAllBytes(path))!=row.gitBlob)File.WriteAllBytes(path,bytes);
        }
        internal static Bounds BoundsOf(GameObject obj){
            var renderers=obj.GetComponentsInChildren<Renderer>(true);
            if(renderers.Length==0)throw new InvalidOperationException("No visible mesh: "+obj.name);
            var b=renderers[0].bounds;foreach(var r in renderers)b.Encapsulate(r.bounds);
            if(!Finite(b.size.x)||!Finite(b.size.y)||!Finite(b.size.z)||b.size.x<=.0001f||b.size.z<=.0001f)
                throw new InvalidOperationException("Invalid model bounds: "+obj.name);
            return b;
        }
        internal static bool Finite(float x)=>!float.IsNaN(x)&&!float.IsInfinity(x);
        static GameObject Model(string group,string name,Transform parent){
            var source=AssetDatabase.LoadAssetAtPath<GameObject>(ModelPath(group,name));
            if(!source)throw new InvalidOperationException("Unity failed to import Library model: "+group+"/"+name);
            var obj=(GameObject)PrefabUtility.InstantiatePrefab(source,parent);
            if(!obj)throw new InvalidOperationException("Library model instantiation failed: "+name);
            obj.transform.localPosition=Vector3.zero;obj.transform.localRotation=Quaternion.identity;
            foreach(var collider in obj.GetComponentsInChildren<Collider>(true))collider.enabled=false;
            return obj;
        }
        static void PickupMarker(Transform art,Bounds body){
            var pivot=new GameObject("Library tier marker");pivot.transform.SetParent(art,false);
            var marker=Model("RPG","Crystal2.glb",pivot.transform);
            var shader=Shader.Find("Universal Render Pipeline/Lit");
            if(!shader||!shader.isSupported)throw new InvalidOperationException("Library tier marker shader missing.");
            const string path=Out+"crystal_library_tier.mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(!mat){mat=new Material(shader);mat.name="crystal_library_tier";AssetDatabase.CreateAsset(mat,path);}
            mat.shader=shader;mat.name="crystal_library_tier";mat.SetColor("_BaseColor",Color.white);
            mat.EnableKeyword("_EMISSION");mat.SetColor("_EmissionColor",Color.white*.25f);
            mat.SetFloat("_Metallic",.15f);mat.SetFloat("_Smoothness",.55f);EditorUtility.SetDirty(mat);
            foreach(var renderer in marker.GetComponentsInChildren<Renderer>(true)){
                var materials=renderer.sharedMaterials;for(int i=0;i<materials.Length;i++)materials[i]=mat;renderer.sharedMaterials=materials;
            }
            var b=BoundsOf(marker);
            float span=Mathf.Max(b.size.x,Mathf.Max(b.size.y,b.size.z));
            float bodySpan=Mathf.Max(body.size.x,Mathf.Max(body.size.y,body.size.z));
            marker.transform.localScale*=bodySpan*.32f/span;
            b=BoundsOf(marker);
            marker.transform.position+=new Vector3(body.max.x-b.min.x,body.min.y-b.min.y,body.center.z-b.center.z);
        }
        static GameObject Build(Binding b,GameObject reference){
            if(!reference)throw new InvalidOperationException("Missing footprint reference: "+b.id);
            var old=UnityEngine.Object.Instantiate(reference);
            var root=new GameObject("Library_"+b.id);
            try{
                old.transform.position=Vector3.zero;old.transform.rotation=Quaternion.identity;
                var target=BoundsOf(old);
                var art=new GameObject("Authored geometry");art.transform.SetParent(root.transform,false);
                var body=Model(b.group,b.name,art.transform);
                if(b.id=="field_pickup"||b.id=="relic_pickup")PickupMarker(art.transform,BoundsOf(body));
                if(!string.IsNullOrEmpty(b.crop)){
                    var field=BoundsOf(body);
                    var canopy=new GameObject("review_crop_canopy");canopy.transform.SetParent(art.transform,false);
                    var crop=Model(b.group,b.crop,canopy.transform);
                    var cb=BoundsOf(crop);
                    // Both authored parts share their coordinate system, but recenter and ground the canopy
                    // so growth scales the wheat about its base, not the soil or simulation footprint.
                    float span=Mathf.Min(field.size.x/cb.size.x,field.size.z/cb.size.z);
                    if(!Finite(span)||span<=0)throw new InvalidOperationException("Invalid crop span.");
                    crop.transform.localScale*=Mathf.Min(1f,span);
                    cb=BoundsOf(crop);
                    canopy.transform.position=new Vector3(field.center.x,field.max.y,field.center.z);
                    cb=BoundsOf(crop);crop.transform.position+=new Vector3(field.center.x-cb.center.x,field.max.y-cb.min.y,field.center.z-cb.center.z);
                    if(b.id.EndsWith("_farm",StringComparison.Ordinal))root.AddComponent<ReviewFarmGrowth>().Configure(canopy.transform);
                }
                var size=BoundsOf(art).size;
                float scale=Mathf.Min(target.size.x/size.x,target.size.z/size.z);
                if(size.y>.0001f&&target.size.y>.0001f)scale=Mathf.Min(scale,target.size.y/size.y);
                if(!Finite(scale)||scale<=0)throw new InvalidOperationException("Invalid Library model scale: "+b.id);
                art.transform.localScale=Vector3.one*scale;
                var bounds=BoundsOf(art);
                art.transform.position+=new Vector3(-bounds.center.x,-bounds.min.y,-bounds.center.z);
                bounds=BoundsOf(art);
                if(bounds.size.x>target.size.x+.01f||bounds.size.z>target.size.z+.01f||Mathf.Abs(bounds.min.y)>.01f)
                    throw new InvalidOperationException("Library geometry exceeded footprint: "+b.id);
                if(root.GetComponentsInChildren<Collider>(true).Any(x=>x.enabled))throw new InvalidOperationException("Unexpected decorative collider.");
                Directory.CreateDirectory(Out+"Prefabs");
                var saved=PrefabUtility.SaveAsPrefabAsset(root,PrefabPath(b.id));
                if(!saved)throw new InvalidOperationException("Failed to save Library prefab: "+b.id);
                return saved;
            }finally{UnityEngine.Object.DestroyImmediate(root);UnityEngine.Object.DestroyImmediate(old);}
        }
        internal static void Bind(BattleVisualCatalog catalog){
            var doc=Read();
            foreach(var b in doc.staticReviewBindings){Copy(doc,b.group,b.name);if(!string.IsNullOrEmpty(b.crop))Copy(doc,b.group,b.crop);}
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var map=doc.staticReviewBindings.ToDictionary(b=>b.id,StringComparer.Ordinal);
            foreach(var f in catalog.factions){
                string p=f.team==ArenaTeam.Lux?"lux_":"tenebra_";
                f.tower=Build(map[p+"tower"],f.tower);f.core=Build(map[p+"core"],f.core);
                f.depot=Build(map[p+"depot"],f.depot);f.guardPost=Build(map[p+"guardPost"],f.guardPost);
                f.farm=Build(map[p+"farm"],f.farm);f.barracks=Build(map[p+"barracks"],f.barracks);
                f.market=Build(map[p+"market"],f.market);f.house=Build(map[p+"house"],f.house);
            }
            foreach(var r in catalog.resources)r.prefab=Build(map[r.kind.ToString().ToLowerInvariant()],r.prefab);
            catalog.fieldPickup=Build(map["field_pickup"],catalog.fieldPickup);
            catalog.relicPickup=Build(map["relic_pickup"],catalog.relicPickup);
            AssetDatabase.SaveAssets();
            Debug.Log("Library-first static roster: 16 structures, 5 resources, 2 pickups. Review only; no runtime verification or production approval.");
        }
        internal static void ValidateDependencies(IEnumerable<string> dependencies){
            var doc=Read();var set=new HashSet<string>(dependencies,StringComparer.Ordinal);
            foreach(var b in doc.staticReviewBindings){
                if(!set.Contains(PrefabPath(b.id)))throw new BuildFailedException("Missing Library-first prefab: "+b.id);
                if(b.id=="field_pickup"||b.id=="relic_pickup"){
                    var deps=new HashSet<string>(AssetDatabase.GetDependencies(PrefabPath(b.id),true),StringComparer.Ordinal);
                    if(!deps.Contains(ModelPath("RPG","Crystal2.glb"))||!deps.Contains(Out+"crystal_library_tier.mat"))
                        throw new BuildFailedException("Missing tier-color marker: "+b.id);
                }
                foreach(var name in new[]{b.name,b.crop}.Where(x=>!string.IsNullOrEmpty(x))){
                    var row=Find(doc,b.group,name);Verified(row);
                    var path=ModelPath(b.group,name);
                    if(!set.Contains(path)||!File.Exists(path)||GitBlob(File.ReadAllBytes(path))!=row.gitBlob)
                        throw new BuildFailedException("Missing or changed Library model dependency: "+path);
                }
            }
        }
    }
}
