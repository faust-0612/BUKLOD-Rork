using System;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class SkillParticleMotionTests {
        [Test] public void AllStylesHaveFiniteBoundedChoreography(){
            var styles=new HashSet<string>();
            foreach(SkillCueShape shape in Enum.GetValues(typeof(SkillCueShape))){
                var signature=new System.Text.StringBuilder();
                for(int i=0;i<SkillParticleMotion.Count;i++)for(int frame=0;frame<=20;frame++){
                    float t=frame/20f;var s=SkillParticleMotion.Evaluate(shape,i,t,4f);
                    Assert.That(s.Position.sqrMagnitude,Is.LessThan(100f));Assert.That(s.Size,Is.GreaterThan(0));
                    Assert.That(s.Opacity,Is.InRange(-.000001f,1f));
                    if(frame==0||frame==20)Assert.That(Mathf.Abs(s.Opacity),Is.LessThan(.000001f));
                    if(frame==10)signature.Append(s.Position.ToString("F4"));
                }
                Assert.True(styles.Add(signature.ToString()),"Duplicate style "+shape);
            }
            Assert.AreEqual(10,styles.Count);
        }
        [Test] public void EveryCanonicalCueHasParticleChoreography(){
            Assert.AreEqual(39,SkillCueCatalog.All.Count);
            foreach(var cue in SkillCueCatalog.All){
                var s=SkillParticleMotion.Evaluate(cue.Shape,17,.5f,cue.Size);
                Assert.That(s.Opacity,Is.GreaterThan(0));Assert.That(s.Position.sqrMagnitude,Is.GreaterThan(0));
            }
        }
    }
}
