using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
namespace Buklod.Empire {
    // Pump only from the dedicated server's simulation thread, never a socket callback.
    public sealed class MatchLoop:IDisposable {
        const int Capacity=128;
        readonly ConcurrentQueue<Action> queue=new ConcurrentQueue<Action>();
        readonly object gate=new object();
        bool stopped;int pending;
        public Task<T> Invoke<T>(Func<T> action,CancellationToken cancellation){
            if(action==null)throw new ArgumentNullException(nameof(action));
            if(cancellation.IsCancellationRequested)return Task.FromCanceled<T>(cancellation);
            var completion=new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
            lock(gate){
                if(stopped||pending>=Capacity){completion.TrySetException(new InvalidOperationException("Match loop unavailable."));return completion.Task;}
                pending++;
                queue.Enqueue(()=>{
                    try{
                        if(cancellation.IsCancellationRequested)completion.TrySetCanceled();
                        else if(stopped)completion.TrySetException(new InvalidOperationException("Match loop stopped."));
                        else completion.TrySetResult(action());
                    }catch(Exception e){completion.TrySetException(e);}
                });
            }
            return completion.Task;
        }
        public void Pump(int max=Capacity){
            for(int i=0;i<Math.Min(max,Capacity);i++){
                Action work;
                lock(gate){if(!queue.TryDequeue(out work))return;pending--;}
                work();
            }
        }
        public void Dispose(){
            lock(gate){stopped=true;}
            Pump();
        }
    }
}
