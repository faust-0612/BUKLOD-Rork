using NUnit.Framework;
using UnityEngine;

namespace Buklod.Empire.Tests {
    public sealed class EmpireStaticContentTests {
        GameObject reference,candidate;
        Material material;
        GameObject Model(){
            var go=GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.DestroyImmediate(go.GetComponent<Collider>());
            go.GetComponent<MeshRenderer>().sharedMaterial=material;
            return go;
        }
        [SetUp] public void Setup(){
            var shader=Shader.Find("Universal Render Pipeline/Lit");
            Assert.IsNotNull(shader,"URP Lit required.");
            material=new Material(shader);
            reference=Model();candidate=Model();
        }
        [TearDown] public void Teardown(){
            if(reference)Object.DestroyImmediate(reference);
            if(candidate)Object.DestroyImmediate(candidate);
            if(material)Object.DestroyImmediate(material);
        }
        [Test] public void MatchingStaticMeshAccepted(){Assert.IsTrue(EmpireStaticContent.Compatible(candidate,reference));}
        [Test] public void ColliderRejected(){candidate.AddComponent<BoxCollider>();Assert.IsFalse(EmpireStaticContent.Compatible(candidate,reference));}
        [Test] public void AnimatorRejected(){candidate.AddComponent<Animator>();Assert.IsFalse(EmpireStaticContent.Compatible(candidate,reference));}
        [Test] public void OversizedGeometryRejected(){
            var mesh=candidate.GetComponent<MeshFilter>();
            var clone=Object.Instantiate(mesh.sharedMesh);
            try{clone.bounds=new Bounds(Vector3.zero,new Vector3(4,4,4));mesh.sharedMesh=clone;
                Assert.IsFalse(EmpireStaticContent.Compatible(candidate,reference));
            }finally{Object.DestroyImmediate(clone);}
        }
        [Test] public void AlteredRootScaleRejected(){candidate.transform.localScale=Vector3.one*2;Assert.IsFalse(EmpireStaticContent.Compatible(candidate,reference));}
        [Test] public void MissingRendererRejected(){Object.DestroyImmediate(candidate.GetComponent<MeshRenderer>());Assert.IsFalse(EmpireStaticContent.Compatible(candidate,reference));}
    }
}
