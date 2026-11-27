using System;
using System.IO;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class LocalPracticeStoreTests {
        string folder;
        [SetUp] public void Setup(){folder=Path.Combine(Path.GetTempPath(),"empire-practice-"+Guid.NewGuid().ToString("N"));}
        [TearDown] public void Cleanup(){if(Directory.Exists(folder))Directory.Delete(folder,true);}
        [Test] public void CompletionPersistsAndDuplicateDoesNotAdvance(){
            var s=new LocalPracticeStore(folder);var id=Guid.NewGuid();
            Assert.True(s.Record(id,"phan",1,2,1,4));
            Assert.False(s.Record(id,"phan",1,2,1,4));
            s=new LocalPracticeStore(folder);
            Assert.AreEqual(1,s.Stats("phan").completed);Assert.AreEqual(1,s.Stats("phan").wins);
            Assert.AreEqual(2,s.Stats("phan").kills);Assert.AreEqual(0,s.Stats("quin").completed);
            Assert.False(s.Record(id,"phan",1,2,1,4));
            for(int i=0;i<4;i++)Assert.True(s.Record(Guid.NewGuid(),"phan",0,0,0,0));
            Assert.AreEqual(2,s.Stats("phan").Mastery);
            Assert.AreEqual(4,new LocalPracticeStore(folder).Stats("phan").draws);
        }
        [Test] public void CorruptLatestSlotRecoversPreviousAndDoesNotOverwriteBoth(){
            var s=new LocalPracticeStore(folder);
            s.Record(Guid.NewGuid(),"phan",1,0,0,0);
            s.Record(Guid.NewGuid(),"phan",-1,0,0,0);
            File.WriteAllText(Path.Combine(folder,"practice-v1-0.json"),"broken");
            Assert.AreEqual(1,new LocalPracticeStore(folder).Stats("phan").completed);
            File.WriteAllText(Path.Combine(folder,"practice-v1-1.json"),"broken");
            Assert.Throws<IOException>(()=>new LocalPracticeStore(folder));
        }
        [Test] public void InvalidRecordCannotChangeHistory(){
            var s=new LocalPracticeStore(folder);
            Assert.Throws<ArgumentException>(()=>s.Record(Guid.Empty,"phan",1,0,0,0));
            Assert.Throws<ArgumentException>(()=>s.Record(Guid.NewGuid(),"unknown",1,0,0,0));
            Assert.Throws<ArgumentException>(()=>s.Record(Guid.NewGuid(),"phan",2,0,0,0));
            Assert.AreEqual(0,s.Stats("phan").completed);
        }
    }
}
