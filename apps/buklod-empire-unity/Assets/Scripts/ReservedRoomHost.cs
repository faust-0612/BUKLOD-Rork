#if UNITY_EDITOR || UNITY_SERVER
using System;
using System.Security.Cryptography;
namespace Buklod.Empire {
    // Construction can only use a reservation already confirmed by the trusted
    // durable wallet worker. No client endpoint, no settlement and no live database call.
    public sealed class ReservedRoomHost:IDisposable {
        readonly OnlineLobbyDirectory lobby;
        public readonly DraftReservationRequest Draft;
        public readonly MatchGrantService Grants;
        public readonly MatchSocketEndpoint Endpoint;
        public readonly MatchServerDriver Driver;
        bool disposed;
        ReservedRoomHost(OnlineLobbyDirectory lobby,DraftReservationRequest draft,IMatchIdentityVerifier identity,IBattleNavigation navigation){
            this.lobby=lobby;Draft=draft;
            var random=new byte[4];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(random);
            var match=new AuthoritativeMatch(draft.Picks,BitConverter.ToInt32(random,0),navigation,draft.LuxBan,draft.TenebraBan);
            var loop=new MatchLoop();Grants=new MatchGrantService(draft.MatchId,match);
            Endpoint=new MatchSocketEndpoint(Grants,loop,identity);Driver=new MatchServerDriver(loop,Grants);
        }
        internal static ReservedRoomHost Create(OnlineLobbyDirectory lobby,Guid id,IMatchIdentityVerifier identity,IBattleNavigation navigation=null){
            if(lobby==null||identity==null)throw new ArgumentNullException();
            var draft=lobby.InspectReserved(id);if(draft==null)return null;
            // Build first; a construction exception does not consume the handoff.
            var host=new ReservedRoomHost(lobby,draft,identity,navigation);
            if(!ReferenceEquals(lobby.TakeReserved(id),draft)){host.Dispose();throw new InvalidOperationException("Reservation handoff changed.");}
            return host;
        }
        // Caller must persist the authoritative result or refund before releasing the lobby.
        internal bool CompleteAfterDurableSettlement(){
            if(!disposed)throw new InvalidOperationException("Stop the room before releasing its membership.");
            return lobby.Complete(Draft.MatchId);
        }
        public void Dispose(){if(disposed)return;disposed=true;Driver.Dispose();}
    }
}
#endif
