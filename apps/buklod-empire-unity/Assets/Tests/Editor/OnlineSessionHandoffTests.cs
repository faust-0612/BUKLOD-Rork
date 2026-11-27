using System;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class OnlineSessionHandoffTests {
        [Test] public void OnlySameOriginMatchScopedEncryptedHandoff(){
            var id=Guid.NewGuid();var https=new Uri("https://empire.example/");
            Assert.IsTrue(OnlineSessionController.ValidHandoff(id,https,new Uri("wss://empire.example/matches/"+id.ToString("D")+"/socket")));
            Assert.IsFalse(OnlineSessionController.ValidHandoff(id,https,new Uri("ws://empire.example/matches/"+id.ToString("D")+"/socket")));
            Assert.IsFalse(OnlineSessionController.ValidHandoff(id,https,new Uri("wss://other.example/matches/"+id.ToString("D")+"/socket")));
            Assert.IsFalse(OnlineSessionController.ValidHandoff(id,https,new Uri("wss://empire.example/matches/"+Guid.NewGuid().ToString("D")+"/socket")));
            Assert.IsFalse(OnlineSessionController.ValidHandoff(id,https,new Uri("wss://empire.example/matches/"+id.ToString("D")+"/socket?token=abc")));
            Assert.IsFalse(OnlineSessionController.ValidHandoff(Guid.Empty,https,new Uri("wss://empire.example/")));
        }
    }
}
