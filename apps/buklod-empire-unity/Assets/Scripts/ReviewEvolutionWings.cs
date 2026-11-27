using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire {
    // Preview-only original layered feather geometry. Created solely for the
    // isolated showcase; never added to the battle prefab, inventory or account.
    public sealed class ReviewEvolutionWings:MonoBehaviour {
        Transform left,right;
        Mesh leftMesh,rightMesh;
        float phase;
        public static Mesh CreateMesh(int side){
            if(side!=-1&&side!=1)throw new ArgumentOutOfRangeException(nameof(side));
            var verts=new List<Vector3>();var uv=new List<Vector2>();var outer=new List<int>();var inner=new List<int>();
            const int rings=8,slices=8;
            // Overlapping upper flight feathers and a shorter inner cover layer.
            for(int layer=0;layer<2;layer++){
                int count=layer==0?10:7;
                for(int f=0;f<count;f++){
                    float t=f/(count-1f),angle=Mathf.Lerp(1.05f,-.96f,t);
                    float length=(layer==0?1f:.56f)*Mathf.Lerp(.72f,1.17f,Mathf.Sin(t*Mathf.PI*.8f));
                    var dir=new Vector3(side*Mathf.Cos(angle),Mathf.Sin(angle),0);
                    var cross=new Vector3(-dir.y,dir.x,0);
                    var root=new Vector3(side*(.055f+.17f*t),.13f-.29f*t,-.03f-layer*.035f);
                    int offset=verts.Count;
                    for(int k=0;k<=rings;k++){
                        float s=k/(float)rings;
                        var center=root+dir*(length*s)+new Vector3(side*.10f*s*s,-.12f*s*s,-.12f*s*s);
                        float width=(layer==0?.085f:.065f)*Mathf.Max(.015f,Mathf.Sin(Mathf.PI*Mathf.Pow(s,.63f)));
                        for(int j=0;j<=slices;j++){
                            float a=2*Mathf.PI*j/slices;
                            verts.Add(center+cross*(width*Mathf.Cos(a))+Vector3.forward*(width*.22f*Mathf.Sin(a)));
                            uv.Add(new Vector2(j/(float)slices,s));
                        }
                    }
                    var indices=layer==0?outer:inner;
                    for(int k=0;k<rings;k++)for(int j=0;j<slices;j++){
                        int a=offset+k*(slices+1)+j,b=a+1,c=a+slices+1,d=c+1;
                        indices.Add(a);indices.Add(b);indices.Add(c);indices.Add(b);indices.Add(d);indices.Add(c);
                    }
                }
            }
            var mesh=new Mesh{name=side<0?"Evolution preview left wing":"Evolution preview right wing"};
            mesh.SetVertices(verts);mesh.SetUVs(0,uv);mesh.subMeshCount=2;mesh.SetTriangles(outer,0);mesh.SetTriangles(inner,1);mesh.RecalculateNormals();mesh.RecalculateTangents();mesh.RecalculateBounds();return mesh;
        }
        Transform Part(string label,Mesh mesh,Material[] materials){
            var go=new GameObject(label);go.layer=gameObject.layer;go.transform.SetParent(transform,false);
            go.AddComponent<MeshFilter>().sharedMesh=mesh;
            var renderer=go.AddComponent<MeshRenderer>();renderer.sharedMaterials=materials;renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;return go.transform;
        }
        public void Initialize(Material armor,Material trim){
            if(!armor||!trim)throw new ArgumentException("Missing wing materials");
            leftMesh=CreateMesh(-1);rightMesh=CreateMesh(1);
            left=Part("Left flight feathers",leftMesh,new[]{trim,armor});right=Part("Right flight feathers",rightMesh,new[]{trim,armor});
            Animate(0);
        }
        public void Animate(float elapsed){
            if(!left||!right)return;
            phase+=Mathf.Max(0,elapsed)*1.8f;
            float flap=18f+Mathf.Sin(phase)*13f,fold=Mathf.Sin(phase+.8f)*5f;
            left.localRotation=Quaternion.Euler(0,flap,fold);right.localRotation=Quaternion.Euler(0,-flap,-fold);
        }
        void OnDestroy(){if(leftMesh)Destroy(leftMesh);if(rightMesh)Destroy(rightMesh);}
    }
}
