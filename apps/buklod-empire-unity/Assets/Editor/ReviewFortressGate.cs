using System;
using System.Linq;
using UnityEditor.Build;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Gate actual imported fortress assets, rather than merely checking the composer source.
    internal static class ReviewFortressGate {
        internal static void Validate(BattleVisualCatalog catalog){
            int checkedCount=0;
            foreach(var f in catalog.factions)foreach(var prefab in new[]{f.tower,f.core}){
                if(!prefab)throw new BuildFailedException("Missing fortress structure");
                var fragments=prefab.GetComponent<ReviewStructureFragments>();
                if(!fragments||!fragments.Ready||fragments.pieces.Length>8)throw new BuildFailedException("Missing imported fortress fragments: "+prefab.name);
                long before=0,after=0;
                foreach(var renderer in fragments.originals){
                    if(!renderer||!renderer.enabled||!renderer.GetComponent<MeshFilter>())throw new BuildFailedException("Invalid original fortress mesh: "+prefab.name);
                    var mesh=renderer.GetComponent<MeshFilter>().sharedMesh;
                    if(!mesh)throw new BuildFailedException("Missing original mesh");
                    for(int i=0;i<mesh.subMeshCount;i++)before+=(long)mesh.GetIndexCount(i);
                }
                foreach(var part in fragments.pieces){
                    if(part==null||!part.root||part.root.gameObject.activeSelf||!part.root.IsChildOf(prefab.transform)||part.root.GetComponent<Collider>())throw new BuildFailedException("Invalid fortress fragment: "+prefab.name);
                    var filter=part.root.GetComponent<MeshFilter>();var renderer=part.root.GetComponent<MeshRenderer>();
                    if(!filter||!filter.sharedMesh||!renderer||renderer.sharedMaterials.Length!=filter.sharedMesh.subMeshCount||renderer.sharedMaterials.Any(x=>!x))throw new BuildFailedException("Invalid fragment materials: "+prefab.name);
                    var mesh=filter.sharedMesh;for(int i=0;i<mesh.subMeshCount;i++)after+=(long)mesh.GetIndexCount(i);
                }
                if(before<=0||before!=after)throw new BuildFailedException("Fortress triangle accounting mismatch: "+prefab.name);
                checkedCount++;
            }
            if(checkedCount!=4)throw new BuildFailedException("Both factions require tower and core fragmentation.");
            Debug.Log("BUKLOD_FORTRESS_GATE_PASS: "+checkedCount+" imported structures, original index counts retained.");
        }
    }
}
