using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
namespace Buklod.Empire {
    // Scene owner receives a trusted authenticated handoff from the future lobby client.
    // No local authority, embedded secrets, MAIN endpoint or offline fallback.
    [RequireComponent(typeof(OnlineBattlePresentation),typeof(MobileBattleInput),typeof(OnlineBattleHud))]
    public sealed class OnlineSessionController:MonoBehaviour {
        OnlineBattlePresentation presentation;
        MobileBattleInput input;
        OnlineBattleHud hud;
        HttpsMatchTicketProvider tickets;
        OnlineMatchConnection connection;
        CancellationTokenSource lifetime;
        Task running;
        public OnlineConnectionState State=>connection?.State??OnlineConnectionState.Idle;
        public OnlineSnapshot Snapshot=>connection!=null&&connection.Timeline.Connected?connection.Timeline.Current:null;
        public bool Active=>running!=null&&!running.IsCompleted;
        public static bool ValidHandoff(Guid matchId,Uri origin,Uri socket){
            return matchId!=Guid.Empty&&origin!=null&&socket!=null&&origin.IsAbsoluteUri&&socket.IsAbsoluteUri&&
                origin.Scheme=="https"&&socket.Scheme=="wss"&&origin.IsDefaultPort&&socket.IsDefaultPort&&
                origin.AbsolutePath=="/"&&origin.Host.Equals(socket.Host,StringComparison.OrdinalIgnoreCase)&&
                string.IsNullOrEmpty(origin.UserInfo)&&string.IsNullOrEmpty(origin.Query)&&string.IsNullOrEmpty(origin.Fragment)&&
                string.IsNullOrEmpty(socket.UserInfo)&&string.IsNullOrEmpty(socket.Query)&&string.IsNullOrEmpty(socket.Fragment)&&
                socket.AbsolutePath=="/matches/"+matchId.ToString("D")+"/socket"&&
                !origin.Host.Equals("yhanxndaqbmuzbdqlblu.supabase.co",StringComparison.OrdinalIgnoreCase);
        }
        public Task Begin(Guid matchId,Uri origin,Uri socket,Func<CancellationToken,Task<string>> sessionToken){
            if(!isActiveAndEnabled||Active||!ValidHandoff(matchId,origin,socket)||sessionToken==null)
                throw new InvalidOperationException("Valid isolated authenticated online handoff required.");
            presentation=GetComponent<OnlineBattlePresentation>();
            if(!presentation)throw new InvalidOperationException("Online presentation unavailable.");
            var nextTickets=new HttpsMatchTicketProvider(origin,sessionToken);
            var nextConnection=new OnlineMatchConnection(matchId,socket,nextTickets);
            try{
                presentation.Bind(nextConnection.Timeline);
                input=GetComponent<MobileBattleInput>();
                if(!input)throw new InvalidOperationException("Online mobile input unavailable.");
                input.BindOnline(this,presentation.battleCamera);
                hud=GetComponent<OnlineBattleHud>();
                if(!hud)throw new InvalidOperationException("Online HUD unavailable.");
            }
            catch{if(input)input.UnbindOnline(this);presentation.Unbind();nextTickets.Dispose();throw;}
            tickets=nextTickets;connection=nextConnection;lifetime=new CancellationTokenSource();
            hud.enabled=true;
            running=RunOwned(connection,tickets,lifetime);
            return running;
        }
        async Task RunOwned(OnlineMatchConnection current,HttpsMatchTicketProvider provider,CancellationTokenSource cancel){
            try{await current.Run(cancel.Token);}
            finally{
                provider.Dispose();cancel.Dispose();
                if(ReferenceEquals(connection,current)){lifetime=null;tickets=null;if(input)input.UnbindOnline(this);if(current.State!=OnlineConnectionState.Finished&&presentation)presentation.Unbind();}
            }
        }
        public void Move(Vector2 direction){if(Active)connection.SetMovement(direction);}
        public bool Command(MatchAction action,Vector2 aim=default,int target=0,string text=null){
            return Active&&connection.QueueAction(action,aim,target,text);
        }
        public void Stop(){
            if(hud)hud.enabled=false;
            if(input)input.UnbindOnline(this);
            if(lifetime!=null)lifetime.Cancel();
            if(presentation)presentation.Unbind();
        }
        void OnApplicationFocus(bool focused){if(!focused&&Active)connection.SuspendInput();}
        void OnApplicationPause(bool paused){if(paused&&Active)connection.SuspendInput();}
        void OnDisable(){Stop();}
    }
}
