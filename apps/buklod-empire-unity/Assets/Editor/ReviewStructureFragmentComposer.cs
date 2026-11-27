using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire.Editor {
    internal static class ReviewStructureFragmentComposer {
        const int MaxPieces=8;
        const string Folder=CandidateReviewComposer.Out+"/StructureFragments";
        // Partition original triangles into spatial octants. Preserve each material
        // submesh and vertex attributes; no generated replacement primitive geometry.
        internal static void Attach(GameObject root,string id){
            var sources=root.GetComponentsInChildren<MeshFilter>(true).Where(f=>f.sharedMesh&&f.GetComponent<MeshRenderer>()).ToArray();
            if(sources.Length==0||sources.Any(f=>!f.sharedMesh.isReadable)){Debug.LogWarning("Fragment fallback (mesh not readable): "+id);return;}
            var sourcesRenderers=sources.Select(f=>f.GetComponent<MeshRenderer>()).ToArray();
            if(sourcesRenderers.Any(r=>!r.enabled||!r.gameObject.activeInHierarchy))return;
            Bounds bound=default;bool found=false;
            foreach(var f in sources){var matrix=root.transform.worldToLocalMatrix*f.transform.localToWorldMatrix;
                foreach(var v in f.sharedMesh.vertices){var p=matrix.MultiplyPoint3x4(v);if(!found){bound=new Bounds(p,Vector3.zero);found=true;}else bound.Encapsulate(p);}}
            if(!found||bound.size.y<.01f)return;
            if(!AssetDatabase.IsValidFolder(Folder)){if(Directory.Exists(Folder))AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);else AssetDatabase.CreateFolder(CandidateReviewComposer.Out,"StructureFragments");}
            if(!AssetDatabase.IsValidFolder(Folder))throw new InvalidOperationException("Fragment asset folder unavailable.");
            var mats=sourcesRenderers.SelectMany(r=>r.sharedMaterials).Distinct().ToArray();
            if(mats.Length==0||mats.Any(m=>!m))return;
            var groups=Enumerable.Range(0,MaxPieces).Select(_=>new Group(mats.Length)).ToArray();
            int expected=0;
            for(int f=0;f<sources.Length;f++){
                var src=sources[f];var mesh=src.sharedMesh;var verts=mesh.vertices;var normals=mesh.normals;var uv=mesh.uv;var tangent=mesh.tangents;
                var matrix=root.transform.worldToLocalMatrix*src.transform.localToWorldMatrix;var normalMatrix=matrix.inverse.transpose;
                for(int sub=0;sub<mesh.subMeshCount;sub++){
                    if(mesh.GetTopology(sub)!=MeshTopology.Triangles||sub>=sourcesRenderers[f].sharedMaterials.Length)return;
                    int mat=Array.IndexOf(mats,sourcesRenderers[f].sharedMaterials[sub]);if(mat<0)return;
                    var ix=mesh.GetTriangles(sub);
                    for(int i=0;i<ix.Length;i+=3){
                        var center=matrix.MultiplyPoint3x4((verts[ix[i]]+verts[ix[i+1]]+verts[ix[i+2]])/3);
                        int key=(center.x>=bound.center.x?1:0)|(center.y>=bound.center.y?2:0)|(center.z>=bound.center.z?4:0);
                        var group=groups[key];int first=group.Vertices.Count;
                        for(int j=0;j<3;j++){int k=ix[i+j];group.Vertices.Add(matrix.MultiplyPoint3x4(verts[k]));group.Normals.Add(normals.Length==verts.Length?normalMatrix.MultiplyVector(normals[k]).normalized:Vector3.up);group.Uv.Add(uv.Length==verts.Length?uv[k]:Vector2.zero);
                            if(tangent.Length==verts.Length){var v=matrix.MultiplyVector(new Vector3(tangent[k].x,tangent[k].y,tangent[k].z)).normalized;group.Tangents.Add(new Vector4(v.x,v.y,v.z,tangent[k].w*(matrix.determinant<0?-1:1)));}else group.HasTangents=false;
                        }
                        var indices=group.Indices[mat];indices.Add(first);indices.Add(first+(matrix.determinant<0?2:1));indices.Add(first+(matrix.determinant<0?1:2));expected++;
                    }
                }
            }
            if(groups.Count(g=>g.Vertices.Count>0)<2)return;
            if(groups.Sum(g=>g.Indices.Sum(i=>i.Count/3))!=expected)throw new InvalidOperationException("Fragment triangle accounting mismatch "+id);
            var pieces=new List<ReviewStructureFragments.Piece>();
            for(int k=0;k<MaxPieces;k++){
                var g=groups[k];if(g.Vertices.Count==0)continue;
                Vector3 pivot=Vector3.zero;foreach(var v in g.Vertices)pivot+=v;pivot/=g.Vertices.Count;
                var mesh=new Mesh{name=id+"_fragment_"+k,indexFormat=g.Vertices.Count>65535?IndexFormat.UInt32:IndexFormat.UInt16};
                for(int i=0;i<g.Vertices.Count;i++)g.Vertices[i]-=pivot;
                mesh.SetVertices(g.Vertices);mesh.SetNormals(g.Normals);mesh.SetUVs(0,g.Uv);if(g.HasTangents)mesh.SetTangents(g.Tangents);
                var used=Enumerable.Range(0,mats.Length).Where(i=>g.Indices[i].Count>0).ToArray();mesh.subMeshCount=used.Length;
                for(int j=0;j<used.Length;j++)mesh.SetTriangles(g.Indices[used[j]],j);mesh.RecalculateBounds();
                string path=Folder+"/"+id+"_"+k+".asset";var old=AssetDatabase.LoadAssetAtPath<Mesh>(path);
                if(old){EditorUtility.CopySerialized(mesh,old);UnityEngine.Object.DestroyImmediate(mesh);mesh=old;EditorUtility.SetDirty(mesh);}else AssetDatabase.CreateAsset(mesh,path);
                var go=new GameObject("Structure fragment "+k);go.transform.SetParent(root.transform,false);go.transform.localPosition=pivot;go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterials=used.Select(i=>mats[i]).ToArray();go.SetActive(false);
                var direction=pivot-bound.center;direction.y=0;if(direction.sqrMagnitude<.001f)direction=new Vector3((k&1)==0?-1:1,0,(k&4)==0?-1:1);
                pieces.Add(new ReviewStructureFragments.Piece{root=go.transform,origin=pivot,direction=direction.normalized,tier=(k&2)==0?2:0});
            }
            var component=root.AddComponent<ReviewStructureFragments>();component.originals=sourcesRenderers;component.pieces=pieces.ToArray();
        }
        sealed class Group {
            internal readonly List<Vector3> Vertices=new List<Vector3>(),Normals=new List<Vector3>();
            internal readonly List<Vector2> Uv=new List<Vector2>();internal readonly List<Vector4> Tangents=new List<Vector4>();
            internal bool HasTangents=true;internal readonly List<int>[] Indices;
            internal Group(int count){Indices=Enumerable.Range(0,count).Select(_=>new List<int>()).ToArray();}
        }
    }
}
