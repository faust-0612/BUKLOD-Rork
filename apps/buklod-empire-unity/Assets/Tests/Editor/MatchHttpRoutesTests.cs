using System;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class MatchHttpRoutesTests {
        [Test] public void RoutesAreStrictAndMatchScoped(){
            var id=Guid.NewGuid();string path="/matches/"+id.ToString("D");
            Assert.AreEqual(MatchRouteKind.Ticket,MatchHttpRoutes.Parse(path+"/ticket","POST",out var actual));Assert.AreEqual(id,actual);
            Assert.AreEqual(MatchRouteKind.Socket,MatchHttpRoutes.Parse(path+"/socket","GET",out actual));Assert.AreEqual(id,actual);
            foreach(string invalid in new[]{path+"/ticket?token=x",path+"/ticket/",path+"/../ticket",path+"/%74icket","/arena-v2","/matches/"+Guid.Empty.ToString("D")+"/ticket"})
                Assert.AreEqual(MatchRouteKind.Invalid,MatchHttpRoutes.Parse(invalid,"POST",out _));
            Assert.AreEqual(MatchRouteKind.Invalid,MatchHttpRoutes.Parse(path+"/ticket","GET",out _));
        }
        [Test] public void RejectsAmbiguousBearer(){
            Assert.AreEqual("abc.def.ghi",MatchHttpRoutes.Bearer("Bearer abc.def.ghi"));
            foreach(string header in new[]{"Bearer ","Bearer a b","Bearer a,b","Bearer a\r\nb","Basic abc","Bearer "+new string('a',8193)})
                Assert.IsNull(MatchHttpRoutes.Bearer(header));
        }
    }
}
