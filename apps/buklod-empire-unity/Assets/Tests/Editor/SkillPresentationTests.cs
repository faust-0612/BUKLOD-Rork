using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class SkillPresentationTests {
        [Test] public void AllCanonicalSkillsHaveUniqueCueIndices(){
            var ids=HeroKitCatalog.All.SelectMany(h=>new[]{h.Primary.Id,h.Secondary.Id,h.Ultimate.Id}).ToArray();
            CollectionAssert.AreEqual(ids,SkillCueCatalog.All.Select(c=>c.Id).ToArray());
            Assert.AreEqual(39,SkillCueCatalog.All.Select(c=>c.Index).Distinct().Count());
            Assert.AreEqual(10,SkillCueCatalog.All.Select(c=>c.Shape).Distinct().Count());
        }
        [Test] public void CommittedBankMatchesCueCatalogAndRejectsTruncation(){
            var data=Resources.Load<TextAsset>("SkillAudioBank").bytes;
            var lengths=SkillAudio.ValidateBank(data);
            Assert.AreEqual(39,lengths.Length);
            Assert.Throws<System.ArgumentException>(()=>SkillAudio.ValidateBank(data.Take(data.Length-1).ToArray()));
        }
    }
}
