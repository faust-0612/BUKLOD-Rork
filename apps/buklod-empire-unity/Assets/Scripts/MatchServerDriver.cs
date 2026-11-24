#if UNITY_EDITOR || UNITY_SERVER
using System;
namespace Buklod.Empire {
    // Dedicated room host calls Pump on its owner thread at least once each frame.
    // No room creation from a client packet, no automatic settlement.
    public sealed class MatchServerDriver:IDisposable {
        public const int MaxCatchupTicks=4;
        readonly MatchLoop loop;readonly MatchGrantService grants;
        readonly System.Diagnostics.Stopwatch clock=System.Diagnostics.Stopwatch.StartNew();
        double previous,accumulator;bool running,stopped;
        public bool Faulted {get;private set;}
        public MatchServerDriver(MatchLoop loop,MatchGrantService grants){
            this.loop=loop??throw new ArgumentNullException(nameof(loop));this.grants=grants??throw new ArgumentNullException(nameof(grants));
        }
        public bool StartMatch(){
            if(stopped||running||Faulted||grants.Finished||grants.Tick!=0)return false;
            grants.Sweep();if(!grants.Start())return false;
            previous=clock.Elapsed.TotalSeconds;accumulator=0;running=true;return true;
        }
        public void Pump(){
            if(stopped)return;
            loop.Pump();grants.Sweep();
            if(!running||grants.Finished)return;
            double now=clock.Elapsed.TotalSeconds,delta=now-previous;previous=now;
            accumulator+=delta;
            // Stop rather than silently discard simulation time or settle an invalid result.
            if(accumulator>.5){Faulted=true;running=false;grants.Abort();return;}
            int n=0;
            while(accumulator+1e-7>=OfflineBattle.Step&&n++<MaxCatchupTicks&&!grants.Finished){
                accumulator-=OfflineBattle.Step;grants.AdvanceTick();
            }
        }
        public void Dispose(){if(stopped)return;stopped=true;running=false;grants.Abort();loop.Dispose();}
    }
}
#endif
