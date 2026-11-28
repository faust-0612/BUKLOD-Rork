using NUnit.Framework;
using System;
using System.Linq;
using System.Reflection;
namespace Buklod.Empire.Tests {
    public sealed class OwnerHeroStudioContractTests {
        [Test] public void StudioRemainsEditorOnlyAndPinsAllThreeModels(){
            var t=AppDomain.CurrentDomain.GetAssemblies().Select(a=>a.GetType("Buklod.Empire.Editor.OwnerHeroStudio",false)).FirstOrDefault(x=>x!=null);
            Assert.NotNull(t);Assert.IsTrue(typeof(UnityEditor.EditorWindow).IsAssignableFrom(t));
            var rows=(Array)t.GetField("Models",BindingFlags.Static|BindingFlags.NonPublic).GetValue(null);
            Assert.AreEqual(3,rows.Length);
            foreach(var row in rows){
                var rt=row.GetType();var hash=(string)rt.GetField("Hash").GetValue(row);
                Assert.That(hash,Does.Match("^[a-f0-9]{64}$"));
                var clips=(string[])rt.GetField("Clips").GetValue(row);
                Assert.Contains("idle",clips);Assert.AreEqual(clips.Length,clips.Distinct().Count());
            }
        }
    }
}
