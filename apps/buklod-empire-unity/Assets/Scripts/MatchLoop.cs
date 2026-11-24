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
        volatile bool stopped;int pending;
        readonly int ownerThread=Thread.CurrentThread.ManagedThreadId;
        void RequireOwner(){if(Thread.CurrentThread.ManagedThreadId!=ownerThread)throw new InvalidOperationException("Use the match owner thread.");}
        public async Task<T> Invoke<T>(Func<T> action,CancellationToken cancellation){
            if(action==null)throw new ArgumentNullException(nameof(action));
            cancellation.ThrowIfCancellationRequested();
            var completion=new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
            lock(gate){
                if(stopped||pending>=Capacity)throw new InvalidOperationException("Match loop unavailable.");
                pending++;
                queue.Enqueue(()=>{
                    try{
                        if(cancellation.IsCancellationRequested)completion.TrySetCanceled();
                        else if(stopped)completion.TrySetException(new InvalidOperationException("Match loop stopped."));
                        else completion.TrySetResult(action());
                    }catch(Exception e){completion.TrySetException(e);}
                });
            }
            using(cancellation.Register(()=>completion.TrySetCanceled()))return await completion.Task.ConfigureAwait(false);
        }
        public void Pump(int max=Capacity){
            RequireOwner();
            for(int i=0;i<Math.Min(max,Capacity);i++){
                Action work;
                lock(gate){if(!queue.TryDequeue(out work))return;pending--;}
                work();
            }
        }
        public void Dispose(){
            RequireOwner();
            lock(gate){stopped=true;}
            Pump();
        }
    }
}
