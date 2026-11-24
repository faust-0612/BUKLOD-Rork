using System;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire {
    public sealed class PremiumCinematicStageTests {
        [Test] public void CurvesAreFiniteBoundedAndClosed(){
            foreach(PremiumCinematicKind k in Enum.GetValues(typeof(PremiumCinematicKind))){
                Assert.That(PremiumCinematicStage.Duration(k),Is.InRange(1f,3f));
                for(int l=0;l<PremiumCinematicStage.Rings;l++)for(int t=0;t<=20;t++){
                    float progress=t/20f;
                    var first=PremiumCinematicStage.Point(k,l,0,progress);
                    var last=PremiumCinematicStage.Point(k,l,1,progress);
                    Assert.Less(Vector3.Distance(first,last),.001f);
                    for(int i=0;i<=PremiumCinematicStage.Segments;i++){
                        var p=PremiumCinematicStage.Point(k,l,i/(float)PremiumCinematicStage.Segments,progress);
                        Assert.IsFalse(float.IsNaN(p.sqrMagnitude)||float.IsInfinity(p.sqrMagnitude));
                        Assert.Less(p.magnitude,4f);
                    }
                }
            }
        }
    }
}
