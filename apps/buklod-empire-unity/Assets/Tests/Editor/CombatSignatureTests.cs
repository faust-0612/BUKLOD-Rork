using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class CombatSignatureTests {
        [Test] public void AllActionRhythmsMonotonicAndPreserveEndpoints(){
            foreach(SkillCueShape shape in System.Enum.GetValues(typeof(SkillCueShape))){
                float release=CombatMotionRhythm.Release("Primary",shape),last=0;
                Assert.AreEqual(.5f,CombatMotionRhythm.SourcePhase(release,release),.0001f);
                for(int i=0;i<=1000;i++){float v=CombatMotionRhythm.SourcePhase(i/1000f,release);Assert.That(v,Is.InRange(last-.000001f,1));last=v;}
                Assert.AreEqual(1,last,.00001f);
            }
        }
        [Test] public void SignatureGeometryIsFiniteAndBounded(){
            foreach(SignatureForm form in System.Enum.GetValues(typeof(SignatureForm)))for(int l=0;l<CombatSignatureMesh.Strips;l++)
            for(int j=0;j<=20;j++)for(int i=0;i<=32;i++){
                CombatSignatureMesh.Edges(form,i/32f,j/20f,l,out var a,out var b);
                Assert.IsFalse(float.IsNaN(a.sqrMagnitude)||float.IsInfinity(a.sqrMagnitude)||float.IsNaN(b.sqrMagnitude)||float.IsInfinity(b.sqrMagnitude));
                Assert.Less(a.magnitude,3);Assert.Less(b.magnitude,3);
            }
            Assert.AreEqual(264,CombatSignatureMesh.VertexCount);
            Assert.AreEqual(12,CombatSignatureMesh.Capacity);
        }
        [Test] public void ConfirmedImpactDoesNotInterruptReleaseWindow(){
            Assert.IsFalse(CombatMotionRhythm.CanReact(1.1f,1.3f));Assert.IsTrue(CombatMotionRhythm.CanReact(1.3f,1.3f));
            Assert.LessOrEqual(CombatMotionRhythm.ProtectedSeconds("Ultimate",5),.48f);
            Assert.LessOrEqual(CombatMotionRhythm.ProtectedSeconds("Attack",5),.34f);
        }
    }
}
