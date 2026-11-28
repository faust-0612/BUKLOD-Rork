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
        readonly DurableMatchStart start;
        public DurableStartState State=>start.State;
        bool disposed;
        ReservedRoomHost(OnlineLobbyDirectory lobby,DraftReservationRequest draft,IMatchIdentityVerifier identity,Guid hostId,IOnlineStartStore store,IBattleNavigation navigation){
            this.lobby=lobby;Draft=draft;
            var random=new byte[4];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(random);
            var match=new AuthoritativeMatch(draft.Picks,BitConverter.ToInt32(random,0),navigation,draft.LuxBan,draft.TenebraBan);
            var loop=new MatchLoop();Grants=new MatchGrantService(draft.MatchId,match);
            Endpoint=new MatchSocketEndpoint(Grants,loop,identity);
            start=new DurableMatchStart(draft.MatchId,hostId,new MatchServerDriver(loop,Grants),Grants,store);
        }
        internal static ReservedRoomHost Create(OnlineLobbyDirectory lobby,Guid id,IMatchIdentityVerifier identity,Guid hostId,IOnlineStartStore store,IBattleNavigation navigation=null){
            if(lobby==null||identity==null||store==null)throw new ArgumentNullException();
            if(hostId==Guid.Empty)throw new ArgumentException("A leased host identity is required.",nameof(hostId));
            var draft=lobby.InspectReserved(id);if(draft==null)return null;
            // Build first; a construction exception does not consume the handoff.
            var host=new ReservedRoomHost(lobby,draft,identity,hostId,store,navigation);
            if(!ReferenceEquals(lobby.TakeReserved(id),draft)){host.Dispose();throw new InvalidOperationException("Reservation handoff changed.");}
            return host;
        }
        public void Pump()=>start.Pump();
        // Caller must persist the authoritative result or refund before releasing the lobby.
        internal bool CompleteAfterDurableSettlement(){
            if(!disposed)throw new InvalidOperationException("Stop the room before releasing its membership.");
            return lobby.Complete(Draft.MatchId);
        }
        public void Dispose(){if(disposed)return;start.Dispose();disposed=true;}
    }
}
#endif
