using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire.Editor {
    // Build the actual playable terrain, not a camera backdrop or a square plane.
    // Source artwork: Library "BUKLOD Empire Arena: Genesis Blueprint.png".
    // Use the existing verified environment materials and authored foliage;
    // preserve the current simulation anchors and collision cover.
    internal static class SculptedRiftComposer {
        internal const string Out=CandidateReviewComposer.Out+"/SculptedRift";
        internal const string FloorAsset=Out+"/WalkableIsland.asset";
        const int N=SculptedRiftLayout.BoundarySegments;
        static Vector3 V(Vector2 p,float y)=>new Vector3(p.x,y,p.y);
        sealed class Geometry {
            internal readonly List<Vector3> Vertices=new List<Vector3>();
            internal readonly List<int> Indices=new List<int>();
            internal void Tri(Vector3 a,Vector3 b,Vector3 c){
                if(Vector3.Cross(b-a,c-a).sqrMagnitude<.00000001f)return;
                int i=Vertices.Count;Vertices.Add(a);Vertices.Add(b);Vertices.Add(c);
                Indices.Add(i);Indices.Add(i+1);Indices.Add(i+2);
            }
            internal void Quad(Vector3 a,Vector3 b,Vector3 c,Vector3 d){Tri(a,b,c);Tri(a,c,d);}
            internal Mesh Save(string name){
                var fresh=new Mesh{name=name,indexFormat=IndexFormat.UInt32};
                fresh.SetVertices(Vertices);fresh.SetTriangles(Indices,0);
                // World-space tiled UVs; the previous mesh had no UV channel, making
                // imported stone/grass materials sample a single texel across the map.
                var uv=new List<Vector2>(Vertices.Count);
                foreach(var v in Vertices)uv.Add(name=="CliffFaces"||name=="CoverOutcrops"?new Vector2((v.x+v.z)*.16f,v.y*.22f):new Vector2(v.x*.16f,v.z*.16f));
                fresh.SetUVs(0,uv);fresh.RecalculateNormals();fresh.RecalculateBounds();
                string path=Out+"/"+name+".asset";
                var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(path);
                if(mesh){EditorUtility.CopySerialized(fresh,mesh);UnityEngine.Object.DestroyImmediate(fresh);EditorUtility.SetDirty(mesh);}
                else{mesh=fresh;AssetDatabase.CreateAsset(mesh,path);}
                return mesh;
            }
        }
        static Material FindMaterial(GameObject map,string name){
            var found=map.GetComponentsInChildren<Renderer>(true).SelectMany(r=>r.sharedMaterials).FirstOrDefault(m=>m&&(m.name==name||m.name.EndsWith("_"+name,StringComparison.Ordinal)));
            if(!found)throw new InvalidOperationException("Missing original map material: "+name);
            return found;
        }
        static GameObject PlaceMesh(Transform parent,string name,Mesh mesh,Material mat,bool collision=false){
            var obj=new GameObject(name);obj.transform.SetParent(parent,false);
            obj.AddComponent<MeshFilter>().sharedMesh=mesh;
            var r=obj.AddComponent<MeshRenderer>();r.sharedMaterial=mat;r.receiveShadows=true;
            r.shadowCastingMode=ShadowCastingMode.Off;
            if(collision)obj.AddComponent<MeshCollider>().sharedMesh=mesh;
            return obj;
        }
        static void Strip(Geometry g,IReadOnlyList<Vector2> points,float halfWidth,float y){
            for(int i=0;i<points.Count-1;i++){
                Vector2 a=points[i],b=points[i+1],d=(b-a).normalized;
                var n=new Vector2(-d.y,d.x)*halfWidth;
                // Shared point tangents avoid disconnected road seams at bends.
                Vector2 ta=i==0?d:(points[i+1]-points[i-1]).normalized;
                Vector2 tb=i==points.Count-2?d:(points[i+2]-points[i]).normalized;
                Vector2 na=new Vector2(-ta.y,ta.x)*halfWidth,nb=new Vector2(-tb.y,tb.x)*halfWidth;
                g.Quad(V(a-na,y),V(a+na,y),V(b+nb,y),V(b-nb,y));
            }
        }
        static void Disc(Geometry g,Vector2 center,float radius,float y,int count=48){
            for(int i=0;i<count;i++){
                float a=i*2*Mathf.PI/count,b=(i+1)*2*Mathf.PI/count;
                g.Tri(V(center,y),V(center+new Vector2(Mathf.Cos(b),Mathf.Sin(b))*radius,y),V(center+new Vector2(Mathf.Cos(a),Mathf.Sin(a))*radius,y));
            }
        }
        static void Annulus(Geometry g,Vector2 center,float inner,float outer,float y,int count=48){
            for(int i=0;i<count;i++){
                float a=i*2*Mathf.PI/count,b=(i+1)*2*Mathf.PI/count;
                var v=new Vector2(Mathf.Cos(a),Mathf.Sin(a));var w=new Vector2(Mathf.Cos(b),Mathf.Sin(b));
                g.Quad(V(center+v*inner,y),V(center+w*inner,y),V(center+w*outer,y),V(center+v*outer,y));
            }
        }
        static void Cliff(Geometry g){
            var center=SculptedRiftLayout.Center;
            for(int i=0;i<N;i++){
                var a=SculptedRiftLayout.Boundary(i);var b=SculptedRiftLayout.Boundary(i+1);
                float h0=3.2f+2.1f*(.5f+.5f*Mathf.Sin(i*.83f)),h1=3.2f+2.1f*(.5f+.5f*Mathf.Sin((i+1)*.83f));
                Vector2 a1=Vector2.Lerp(a,center,.035f),b1=Vector2.Lerp(b,center,.035f);
                Vector2 a2=Vector2.Lerp(a,center,.10f),b2=Vector2.Lerp(b,center,.10f);
                g.Quad(V(a,0),V(b,0),V(b1,-h1),V(a1,-h0));
                g.Quad(V(a1,-h0),V(b1,-h1),V(b2,-11),V(a2,-11));
            }
        }
        static void Outcrop(Geometry g,Vector2 c,float radius,int seed){
            const int sides=12;
            var rings=new Vector3[4,sides];
            for(int row=0;row<4;row++)for(int i=0;i<sides;i++){
                float a=i*2*Mathf.PI/sides;
                float scale=(row==0?.92f:row==1?.86f:row==2?.61f:.27f)*radius;
                float rough=1+.07f*Mathf.Sin(i*3.1f+seed*.67f);
                float y=row==0?0:row==1?radius*.43f:row==2?radius*.85f:radius*1.03f;
                rings[row,i]=V(c+new Vector2(Mathf.Cos(a),Mathf.Sin(a))*scale*rough,y+(row==0?0:.23f*Mathf.Sin(i*2.1f+seed)));
            }
            for(int row=0;row<3;row++)for(int i=0;i<sides;i++){
                int next=(i+1)%sides;g.Quad(rings[row,i],rings[row+1,i],rings[row+1,next],rings[row,next]);
            }
            for(int i=0;i<sides;i++)g.Tri(V(c,radius*1.05f),rings[3,(i+1)%sides],rings[3,i]);
        }
        static void Plant(GameObject prefab,Transform parent,Vector2 point,float height,float yaw){
            var obj=(GameObject)PrefabUtility.InstantiatePrefab(prefab,parent);
            if(!obj)throw new InvalidOperationException("Authored foliage instantiation failed.");
            obj.transform.localRotation=Quaternion.Euler(0,yaw,0);
            var renderers=obj.GetComponentsInChildren<Renderer>(true);
            if(renderers.Length==0)throw new InvalidOperationException("Empty foliage.");
            var b=renderers[0].bounds;foreach(var r in renderers.Skip(1))b.Encapsulate(r.bounds);
            if(b.size.y<.001f)throw new InvalidOperationException("Invalid foliage bounds.");
            obj.transform.localScale*=height/b.size.y;
            b=renderers[0].bounds;foreach(var r in renderers.Skip(1))b.Encapsulate(r.bounds);
            obj.transform.position+=new Vector3(point.x-b.center.x,-b.min.y,point.y-b.center.z);
            foreach(var c in obj.GetComponentsInChildren<Collider>(true))c.enabled=false;
        }
        internal static void Assemble(GameObject original,Transform world){
            if(!AssetDatabase.IsValidFolder(Out)){AssetDatabase.CreateFolder(CandidateReviewComposer.Out,"SculptedRift");}
            var soil=FindMaterial(original,"terrain");var grass=FindMaterial(original,"grass_edge");var stone=FindMaterial(original,"stone");var paving=FindMaterial(original,"paving");
            var water=AssetDatabase.LoadAssetAtPath<Material>(CandidateReviewComposer.Out+"/ReviewRiftWater.mat");
            if(!water)throw new InvalidOperationException("Existing animated river material missing.");
            water.SetFloat("_RiverMeander",1);EditorUtility.SetDirty(water);
            var holder=new GameObject("Genesis Rift — sculpted three-route island");holder.transform.SetParent(world,false);
            // Disable the old rectangular renderers. They remain as material/provenance
            // references; the new island mesh is the actual visible and navigable ground.
            foreach(var r in original.GetComponentsInChildren<Renderer>(true))r.enabled=false;
            var floor=new Geometry();var cliff=new Geometry();var rim=new Geometry();
            var center=SculptedRiftLayout.Center;
            for(int i=0;i<N;i++){
                var a=SculptedRiftLayout.Boundary(i);var b=SculptedRiftLayout.Boundary(i+1);
                floor.Tri(V(center,0),V(b,0),V(a,0));
                rim.Quad(V(Vector2.Lerp(a,center,.055f),.012f),V(Vector2.Lerp(b,center,.055f),.012f),V(b,.012f),V(a,.012f));
            }
            Cliff(cliff);
            PlaceMesh(holder.transform,"Actual walkable island",floor.Save("WalkableIsland"),soil,true);
            PlaceMesh(holder.transform,"Layered rift cliffs",cliff.Save("CliffFaces"),stone);
            PlaceMesh(holder.transform,"Grass cliff shoulders",rim.Save("GrassShoulders"),grass);
            var roads=new Geometry();var roadBorder=new Geometry();var joints=new Geometry();
            for(int lane=0;lane<3;lane++){
                var points=new List<Vector2>();
                for(int i=0;i<=80;i++)points.Add(SculptedRiftLayout.LanePoint(lane,i,80));
                Strip(roadBorder,points,5.2f,.018f);Strip(roads,points,4.2f,.026f);
                // Broken stone paving joints follow the road tangent, not world axes.
                for(int i=2;i<79;i+=2){
                    var a=points[i];var d=(points[i+1]-points[i-1]).normalized;var n=new Vector2(-d.y,d.x);
                    if(Mathf.Abs(a.x-SculptedRiftLayout.RiverX(a.y))<13)continue;
                    joints.Quad(V(a-n*4.1f-d*.065f,.029f),V(a+n*4.1f-d*.065f,.029f),V(a+n*4.1f+d*.065f,.029f),V(a-n*4.1f+d*.065f,.029f));
                }
                // Interlocking fortress access lanes, not isolated horizontal lines.
                if(lane!=1)foreach(bool lux in new[]{true,false}){
                    float x=lux?19:SculptedRiftLayout.Width-19;
                    var join=new List<Vector2>();
                    float z=SculptedRiftLayout.LaneHeight(lane,x);
                    for(int j=0;j<=24;j++){
                        float t=j/24f;
                        join.Add(new Vector2(x+(lux?-1:1)*4*Mathf.Sin(t*Mathf.PI*.5f),Mathf.Lerp(z,110,t)));
                    }
                    Strip(roadBorder,join,3.6f,.019f);Strip(roads,join,2.9f,.027f);
                }
            }
            var riverPoints=new List<Vector2>();
            for(int i=0;i<=110;i++){float z=1+218*i/110f;riverPoints.Add(new Vector2(SculptedRiftLayout.RiverX(z),z));}
            var banks=new Geometry();var river=new Geometry();
            Strip(banks,riverPoints,6.8f,.031f);Strip(river,riverPoints,SculptedRiftLayout.RiverHalfWidth,.037f);
            PlaceMesh(holder.transform,"Meandering river banks",banks.Save("RiverBanks"),stone);
            PlaceMesh(holder.transform,"Animated shallow rift river",river.Save("RiverWater"),water);
            PlaceMesh(holder.transform,"Curved stone lane shoulders",roadBorder.Save("LaneShoulders"),stone);
            PlaceMesh(holder.transform,"Three interlocking lanes",roads.Save("CurvedLanes"),paving);
            PlaceMesh(holder.transform,"Stone paving joints",joints.Save("LaneJoints"),stone);
            var bridges=new Geometry();var bridgeTrim=new Geometry();var bridgeSides=new Geometry();
            for(int lane=0;lane<3;lane++){
                var crossing=SculptedRiftLayout.Crossing(lane);float x=crossing.x;
                var route=new List<Vector2>();
                for(int i=0;i<=10;i++){float px=x-10+2*i;route.Add(new Vector2(px,SculptedRiftLayout.LaneHeight(lane,px)));}
                Strip(bridgeTrim,route,5.2f,.049f);Strip(bridges,route,4.1f,.058f);
                for(int i=0;i<route.Count-1;i++){
                    var a=route[i];var b=route[i+1];var d=(b-a).normalized;var n=new Vector2(-d.y,d.x);
                    foreach(float side in new[]{-1f,1f}){
                        var p=a+n*4.65f*side;var q=b+n*4.65f*side;
                        // Low stone parapets are visual only, outside the lane center.
                        bridgeSides.Quad(V(p,.06f),V(q,.06f),V(q,.65f),V(p,.65f));
                        bridgeSides.Quad(V(p,.65f),V(q,.65f),V(q+n*.28f*side,.65f),V(p+n*.28f*side,.65f));
                        bridgeSides.Quad(V(q+n*.28f*side,.06f),V(p+n*.28f*side,.06f),V(p+n*.28f*side,.65f),V(q+n*.28f*side,.65f));
                    }
                }
            }
            PlaceMesh(holder.transform,"Three river crossings",bridges.Save("CausewayDecks"),paving);
            PlaceMesh(holder.transform,"Causeway stone borders",bridgeTrim.Save("CausewayBorders"),stone);
            PlaceMesh(holder.transform,"Raised stone bridge parapets",bridgeSides.Save("CausewayParapets"),stone);
            var plazas=new Geometry();var rings=new Geometry();
            foreach(float x in new[]{14f,306f}){
                var pos=new Vector2(x,110);Disc(plazas,pos,10,.065f);Annulus(rings,pos,8.5f,10,.073f);
            }
            // Existing neutral boss camps are the center objectives; no invented buff or win rule.
            foreach(var pos in new[]{new Vector2(160,95),new Vector2(160,125)}){
                Disc(plazas,pos,6,.065f);Annulus(rings,pos,5.2f,6,.073f);
            }
            foreach(var camp in new NeutralObjectiveDirector().Camps.Where(c=>!c.Boss)){
                Disc(plazas,camp.Position,3.4f,.043f,24);Annulus(rings,camp.Position,3.1f,3.6f,.046f,24);
            }
            PlaceMesh(holder.transform,"Fortress terraces and neutral sanctuaries",plazas.Save("ObjectiveTerraces"),paving);
            PlaceMesh(holder.transform,"Terrace stone rims",rings.Save("ObjectiveRims"),stone);
            var cover=new Geometry();
            for(int i=0;i<SculptedRiftLayout.CoverCount;i++){
                var c=SculptedRiftLayout.Cover(i);Outcrop(cover,new Vector2(c.x*320,c.y*220),c.z*220,i/2);
            }
            PlaceMesh(holder.transform,"Actual solid-cover outcrops",cover.Save("CoverOutcrops"),stone).GetComponent<MeshRenderer>().shadowCastingMode=ShadowCastingMode.On;
            // Authored nature models on non-interfering rim and actual solid-cover shoulders.
            const string nature="Assets/ThirdParty/QuaterniusReview/nature/glTF/";
            var bush=AssetDatabase.LoadAssetAtPath<GameObject>(nature+"Bush_Common.gltf");
            var shortGrass=AssetDatabase.LoadAssetAtPath<GameObject>(nature+"Grass_Common_Short.gltf");
            var tallGrass=AssetDatabase.LoadAssetAtPath<GameObject>(nature+"Grass_Common_Tall.gltf");
            if(!bush||!shortGrass||!tallGrass)throw new InvalidOperationException("Required authored foliage is missing.");
            for(int i=0;i<N;i+=2){
                var edge=SculptedRiftLayout.Boundary(i);var p=Vector2.Lerp(edge,center,.027f);
                if(Mathf.Abs(p.x-SculptedRiftLayout.RiverX(p.y))<12||Mathf.Abs(p.y-110)<19&&Mathf.Min(p.x,320-p.x)<25)continue;
                Plant(i%4==0?bush:shortGrass,holder.transform,p,i%4==0?2.3f:.8f,i*37);
            }
            for(int i=0;i<SculptedRiftLayout.CoverCount;i++){
                var c=SculptedRiftLayout.Cover(i);var pos=new Vector2(c.x*320,c.y*220);float radius=c.z*220;
                for(int j=0;j<6;j++){
                    float a=j*Mathf.PI/3;var p=pos+new Vector2(Mathf.Cos(a),Mathf.Sin(a))*radius*.92f;
                    Plant(j%2==0?bush:tallGrass,holder.transform,p,j%2==0?1.9f:1.0f,j*61+i*13);
                }
            }
            // Validate the actual generated terrain asset rather than accepting the old plane.
            var actual=AssetDatabase.LoadAssetAtPath<Mesh>(FloorAsset);
            if(!actual||actual.vertexCount!=N*3||actual.uv.Length!=actual.vertexCount)
                throw new InvalidOperationException("Sculpted terrain geometry or texture mapping missing.");
            AssetDatabase.SaveAssets();
        }
    }
}
