using NUnit.Framework;
using System;
using System.Linq;
using System.Reflection;
namespace Buklod.Empire.Tests {
    public sealed class AuthoredRosterBuildGateTests {
        [Test] public void MissingEvidenceAndIdenticalLodAreRejected(){
            var type=AppDomain.CurrentDomain.GetAssemblies().Select(a=>a.GetType("Buklod.Empire.Editor.AuthoredRosterBuildGate",false)).FirstOrDefault(t=>t!=null);
            Assert.NotNull(type);
            var rowType=type.GetNestedType("Row",BindingFlags.NonPublic);
            Assert.NotNull(rowType);
            var row=Activator.CreateInstance(rowType,true);
            void Set(string field,string value)=>rowType.GetField(field).SetValue(row,value);
            var valid=type.GetMethod("ValidRow",BindingFlags.NonPublic|BindingFlags.Static);
            Assert.NotNull(valid);
            bool Check()=>(bool)valid.Invoke(null,new[]{row});
            Set("id","phan");Set("fullSha256",new string('a',64));Set("lodSha256",new string('b',64));
            Set("author","fixture");Set("sourceUrl","https://example.invalid/fixture");Set("license","CC0-1.0");
            Set("licenseEvidence","fixture");Set("identityEvidence","fixture");
            Assert.IsTrue(Check());
            Set("identityEvidence","");Assert.IsFalse(Check());Set("identityEvidence","fixture");
            Set("license","unknown");Assert.IsFalse(Check());Set("license","CC0-1.0");
            Set("lodSha256",new string('a',64));Assert.IsFalse(Check());Set("lodSha256",new string('b',64));
            Set("id","unknown");Assert.IsFalse(Check());
        }
    }
}
