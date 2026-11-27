using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Buklod.Empire {
    // Static, decorative assets only. No remote colliders, behaviours, animators or gameplay changes.
    public static class EmpireStaticContent {
        public static Dictionary<string,GameObject> Slots(BattleVisualCatalog catalog){
            var result=new Dictionary<string,GameObject>(StringComparer.Ordinal);
            foreach(var f in catalog.factions){
                string p=f.team==ArenaTeam.Lux?"lux_":"tenebra_";
                result.Add(p+"tower",f.tower);result.Add(p+"core",f.core);
                result.Add(p+"depot",f.depot);result.Add(p+"guardpost",f.guardPost);
                result.Add(p+"barracks",f.barracks);result.Add(p+"market",f.market);result.Add(p+"house",f.house);
            }
            foreach(var r in catalog.resources){
                string slot=r.kind.ToString().ToLowerInvariant();
                if(EmpireContentProtocol.IsStatic(slot))result.Add(slot,r.prefab);
            }
            if(!new HashSet<string>(result.Keys,StringComparer.Ordinal).SetEquals(EmpireContentProtocol.StaticSlots)||result.Values.Any(v=>!v))
                throw new InvalidOperationException("Incomplete static baseline.");
            return result;
        }
        static bool Finite(float x)=>!float.IsNaN(x)&&!float.IsInfinity(x);
        static bool Finite(Vector3 v)=>Finite(v.x)&&Finite(v.y)&&Finite(v.z);
        static bool BoundsOf(GameObject model,out Bounds bounds){
            bounds=default;bool found=false;
            foreach(var filter in model.GetComponentsInChildren<MeshFilter>(true)){
                if(!filter.sharedMesh)continue;
                var b=filter.sharedMesh.bounds;
                var matrix=model.transform.worldToLocalMatrix*filter.transform.localToWorldMatrix;
                for(int i=0;i<8;i++){
                    var point=matrix.MultiplyPoint3x4(b.center+Vector3.Scale(b.extents,new Vector3((i&1)==0?-1:1,(i&2)==0?-1:1,(i&4)==0?-1:1)));
                    if(!Finite(point))return false;
                    if(!found){bounds=new Bounds(point,Vector3.zero);found=true;}else bounds.Encapsulate(point);
                }
            }
            return found&&Finite(bounds.size)&&bounds.size.x>.0001f&&bounds.size.z>.0001f;
        }
        public static bool Compatible(GameObject candidate,GameObject baseline){
            if(!candidate||!baseline||!candidate.activeSelf||
               candidate.transform.localPosition.sqrMagnitude>.0001f||
               Quaternion.Angle(candidate.transform.localRotation,baseline.transform.localRotation)>.1f||
               (candidate.transform.localScale-baseline.transform.localScale).sqrMagnitude>.0001f)return false;
            var nodes=candidate.GetComponentsInChildren<Transform>(true);
            if(nodes.Length>128||nodes.Any(t=>!Finite(t.localPosition)||!Finite(t.localScale)||t.localScale.x==0||t.localScale.y==0||t.localScale.z==0))return false;
            foreach(var component in candidate.GetComponentsInChildren<Component>(true))
                if(!component||!(component is Transform||component is MeshFilter||component is MeshRenderer))return false;
            var allowedShaders=new HashSet<string>(baseline.GetComponentsInChildren<Renderer>(true)
                .SelectMany(r=>r.sharedMaterials).Where(m=>m&&m.shader).Select(m=>m.shader.name),StringComparer.Ordinal);
            long vertices=0,indices=0,pixels=0;
            var textures=new HashSet<Texture>();
            var filters=candidate.GetComponentsInChildren<MeshFilter>(true);
            if(filters.Length<1||filters.Length>64)return false;
            foreach(var filter in filters){
                var mesh=filter.sharedMesh;var renderer=filter.GetComponent<MeshRenderer>();
                if(!mesh||!renderer||!renderer.enabled||mesh.subMeshCount<1||mesh.subMeshCount>16||renderer.sharedMaterials.Length!=mesh.subMeshCount)return false;
                vertices+=mesh.vertexCount;
                for(int i=0;i<mesh.subMeshCount;i++){
                    if(mesh.GetTopology(i)!=MeshTopology.Triangles)return false;
                    indices+=mesh.GetIndexCount(i);
                }
                foreach(var mat in renderer.sharedMaterials){
                    if(!mat||!mat.shader||!mat.shader.isSupported||!allowedShaders.Contains(mat.shader.name))return false;
                    foreach(var property in mat.GetTexturePropertyNames()){
                        var texture=mat.GetTexture(property);
                        if(texture){
                            if(!(texture is Texture2D)||texture.width>2048||texture.height>2048)return false;
                            if(textures.Add(texture))pixels+=(long)texture.width*texture.height;
                        }
                    }
                }
            }
            if(vertices>100000||indices>300000||textures.Count>16||pixels>8L*1024*1024||candidate.GetComponentsInChildren<MeshRenderer>(true).Length!=filters.Length)return false;
            if(!BoundsOf(candidate,out var actual)||!BoundsOf(baseline,out var limit))return false;
            const float tolerance=.04f;
            return actual.min.x>=limit.min.x-tolerance&&actual.min.z>=limit.min.z-tolerance&&actual.max.x<=limit.max.x+tolerance&&actual.max.z<=limit.max.z+tolerance
                &&actual.min.y>=limit.min.y-tolerance&&actual.max.y<=limit.max.y+tolerance;
        }
        static void RebindLocalShaders(GameObject candidate,GameObject baseline){
            var shaders=baseline.GetComponentsInChildren<Renderer>(true).SelectMany(r=>r.sharedMaterials)
                .Where(m=>m&&m.shader).Select(m=>m.shader).GroupBy(s=>s.name,StringComparer.Ordinal)
                .ToDictionary(g=>g.Key,g=>g.First(),StringComparer.Ordinal);
            // Bind the actual trusted native shader object, never a same-name remote shader.
            foreach(var renderer in candidate.GetComponentsInChildren<MeshRenderer>(true))
                foreach(var mat in renderer.sharedMaterials)
                    if(mat&&mat.shader&&shaders.TryGetValue(mat.shader.name,out var local))mat.shader=local;
        }
        public static BattleVisualCatalog CloneWith(BattleVisualCatalog baseline,IReadOnlyDictionary<string,GameObject> replacements){
            if(replacements.Count==0)return baseline;
            var original=Slots(baseline);
            foreach(var row in replacements)
                if(!original.TryGetValue(row.Key,out var reference)||!Compatible(row.Value,reference))throw new InvalidOperationException("Incompatible static content: "+row.Key);
            foreach(var row in replacements)RebindLocalShaders(row.Value,original[row.Key]);
            var result=UnityEngine.Object.Instantiate(baseline);
            GameObject Pick(string slot,GameObject fallback)=>replacements.TryGetValue(slot,out var model)?model:fallback;
            try{
                // Explicit copies ensure no mutable nested data is shared with the serialized baseline.
                result.factions=baseline.factions.Select(f=>{
                    string p=f.team==ArenaTeam.Lux?"lux_":"tenebra_";
                    return new BattleVisualCatalog.FactionVisual{team=f.team,
                        tower=Pick(p+"tower",f.tower),core=Pick(p+"core",f.core),depot=Pick(p+"depot",f.depot),
                        guardPost=Pick(p+"guardpost",f.guardPost),farm=f.farm,barracks=Pick(p+"barracks",f.barracks),
                        market=Pick(p+"market",f.market),house=Pick(p+"house",f.house),
                        minions=f.minions,villagers=f.villagers};
                }).ToArray();
                result.resources=baseline.resources.Select(r=>new BattleVisualCatalog.ResourceVisual{
                    kind=r.kind,prefab=Pick(r.kind.ToString().ToLowerInvariant(),r.prefab)}).ToArray();
                return result;
            }catch{UnityEngine.Object.Destroy(result);throw;}
        }
    }
}
