using NUnit.Framework;
using System;
using System.Linq;
using System.Reflection;
namespace Buklod.Empire.Tests {
    public sealed class OwnerMotionPracticeTests {
        [Test] public void PrivateModelsAndStudioCannotEnterPlayerBuild(){
            var t=AppDomain.CurrentDomain.GetAssemblies().Select(a=>a.GetType("Buklod.Empire.Editor.OwnerMotionPracticeScene",false)).FirstOrDefault(x=>x!=null);
            Assert.NotNull(t);var method=t.GetMethod("IsPrivatePath",BindingFlags.Public|BindingFlags.Static);
            bool Private(string s)=>(bool)method.Invoke(null,new object[]{s});
            Assert.IsTrue(Private("Assets/Generated/ReviewOnly/OwnerMotionPractice/Models/azure.glb"));
            Assert.IsTrue(Private("Assets/Generated/ReviewOnly/OwnerHeroStudio/model.glb"));
            Assert.IsFalse(Private("Assets/Generated/ReviewOnly/OfflineBattleReview.unity"));
            Assert.IsFalse(Private("Assets/Production/Heroes/niel.prefab"));
        }
    }
}
