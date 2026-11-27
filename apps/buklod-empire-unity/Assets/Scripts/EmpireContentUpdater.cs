using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace Buklod.Empire {
    // Isolated content cache; the built-in assets always remain available. No accounts or game state.
    public sealed class EmpireContentUpdater:MonoBehaviour {
        const long CacheBudget=128L*1024*1024,Reserve=64L*1024*1024;
        static Dictionary<string,AudioClip> overrides=new Dictionary<string,AudioClip>(StringComparer.Ordinal);
        readonly List<AssetBundle> loaded=new List<AssetBundle>();
        EmpireContentProtocol.Trust trust;
        EmpireContentProtocol.Manifest offered;
        byte[] offerEnvelope;
        string root;
        int floor,activeRevision;
        UnityWebRequest request;
        public bool Busy{get;private set;}
        public bool CanDownload=>!Busy&&offered!=null&&offered.revision>floor;
        public string Status{get;private set;}="Built-in content ready";
        public long PendingBytes{get;private set;}
        public float Progress{get;private set;}
        public static AudioClip Resolve(AudioClip original)=>original&&overrides.TryGetValue(original.name,out var clip)&&clip?clip:original;
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetOverrides(){overrides=new Dictionary<string,AudioClip>(StringComparer.Ordinal);}
        public static EmpireContentProtocol.Trust ReadTrust(){
            var asset=Resources.Load<TextAsset>("EmpireContentTrust");
            if(!asset)return null;
            var t=JsonUtility.FromJson<EmpireContentProtocol.Trust>(asset.text);
            EmpireContentProtocol.Origin(t);return t;
        }
        IEnumerator Start(){
            if(!GetComponent<BattleView>()||!GetComponent<BattleView>().IsEditorReview){enabled=false;yield break;}
            try{trust=ReadTrust();root=Path.Combine(Application.persistentDataPath,"empire-content-v1");}
            catch(Exception){Status="Content trust invalid; built-in assets available";yield break;}
            if(trust==null){Status="Content service not configured; offline assets available";yield break;}
            Busy=true;
            yield return Restore();
            Busy=false;
            if(Application.internetReachability!=NetworkReachability.NotReachable)Check();
        }
        string Receipt(int revision)=>Path.Combine(root,"revision-"+revision+".json");
        string Blob(EmpireContentProtocol.Bundle bundle)=>Path.Combine(root,EmpireContentProtocol.BundleFile(bundle));
        sealed class Candidate{public EmpireContentProtocol.Manifest manifest;public byte[] envelope;}
        static List<Candidate> ReadReceipts(string folder,EmpireContentProtocol.Trust t,string unity){
            var rows=new List<Candidate>();
            if(!Directory.Exists(folder))return rows;
            foreach(var path in Directory.EnumerateFiles(folder,"revision-*.json").Take(64)){
                try{
                    if(new FileInfo(path).Length>EmpireContentProtocol.MaxManifestBytes)continue;
                    byte[] bytes=File.ReadAllBytes(path);var m=EmpireContentProtocol.Verify(bytes,t,unity);
                    if(Path.GetFileName(path)!="revision-"+m.revision+".json")continue;
                    rows.Add(new Candidate{manifest=m,envelope=bytes});
                }catch(Exception){/* Invalid local receipt cannot authorize content. */}
            }
            return rows.OrderByDescending(x=>x.manifest.revision).ToList();
        }
        IEnumerator Restore(){
            string unity=Application.unityVersion;
            var work=Task.Run(()=>ReadReceipts(root,trust,unity));
            while(!work.IsCompleted)yield return null;
            if(work.IsFaulted||work.IsCanceled){Status="Cache unavailable; built-in content";yield break;}
            var candidates=work.Result;
            if(candidates.Count>0)floor=candidates[0].manifest.revision;
            foreach(var candidate in candidates.Take(2)){
                var m=candidate.manifest;
                var check=Task.Run(()=>m.bundles.All(b=>EmpireContentProtocol.Matches(Blob(b),b)));
                while(!check.IsCompleted)yield return null;
                if(check.IsFaulted||check.IsCanceled||!check.Result)continue;
                var next=new Dictionary<string,AudioClip>(StringComparer.Ordinal);
                var handles=new List<AssetBundle>();bool valid=true;
                foreach(var b in m.bundles){
                    var load=AssetBundle.LoadFromFileAsync(Blob(b));yield return load;
                    var bundle=load.assetBundle;if(!bundle){valid=false;break;}handles.Add(bundle);
                    var expected=new HashSet<string>(b.slots.Select(EmpireContentProtocol.AssetName),StringComparer.Ordinal);
                    if(bundle.GetAllScenePaths().Length!=0||!expected.SetEquals(bundle.GetAllAssetNames())){valid=false;break;}
                    foreach(var slot in b.slots){
                        var asset=bundle.LoadAssetAsync<AudioClip>(EmpireContentProtocol.AssetName(slot));yield return asset;
                        var clip=asset.asset as AudioClip;
                        if(!clip||clip.length<=0||clip.length>30||clip.channels<1||clip.channels>2){valid=false;break;}
                        next.Add(slot,clip);
                    }
                    if(!valid)break;
                }
                if(!valid){foreach(var bundle in handles)bundle.Unload(true);continue;}
                // A complete compatible revision replaces the lookup atomically, never a partial bundle.
                loaded.AddRange(handles);overrides=next;activeRevision=m.revision;
                Status="Active content revision "+activeRevision+(floor>activeRevision?" (recovered)":"");yield break;
            }
            Status=floor>0?"Cached content invalid; built-in assets restored":"Built-in content ready";
        }
        public void Check(){
            if(Busy||trust==null||Application.internetReachability==NetworkReachability.NotReachable)return;
            StartCoroutine(CheckRoutine());
        }
        public void Download(){
            if(!CanDownload||Application.internetReachability==NetworkReachability.NotReachable)return;
            StartCoroutine(DownloadRoutine());
        }
        sealed class BoundedHandler:DownloadHandlerScript{
            readonly MemoryStream stream=new MemoryStream();readonly int limit;
            public BoundedHandler(int max):base(new byte[32768]){limit=max;}
            protected override bool ReceiveData(byte[] data,int length){
                if(data==null||length<0||stream.Length+length>limit)return false;
                stream.Write(data,0,length);return true;
            }
            public byte[] Bytes()=>stream.ToArray();
        }
        IEnumerator Fetch(string relative,int max,Action<byte[]> done){
            for(int attempt=0;attempt<2;attempt++){
                if(attempt>0)yield return new WaitForSecondsRealtime(1.5f);
                var handler=new BoundedHandler(max);
                using(var req=new UnityWebRequest(new Uri(EmpireContentProtocol.Origin(trust),relative).AbsoluteUri,"GET",handler,null)){
                    request=req;req.timeout=20;req.redirectLimit=0;
                    var op=req.SendWebRequest();
                    float started=Time.realtimeSinceStartup;
                    while(!op.isDone){Progress=Mathf.Clamp01(req.downloadProgress);if(Time.realtimeSinceStartup-started>25){req.Abort();break;}yield return null;}
                    request=null;
                    if(req.result==UnityWebRequest.Result.Success){done(handler.Bytes());yield break;}
                }
            }
            done(null);
        }
        IEnumerator CheckRoutine(){
            Busy=true;offered=null;PendingBytes=0;Progress=0;Status="Checking signed content...";
            try{
                byte[] envelope=null;yield return Fetch("manifest.json",EmpireContentProtocol.MaxManifestBytes,b=>envelope=b);
                if(envelope==null){Status="Update check unavailable; offline content retained";yield break;}
                string unity=Application.unityVersion;
                var task=Task.Run(()=>{
                    var m=EmpireContentProtocol.Verify(envelope,trust,unity);
                    long missing=m.bundles.Where(b=>!EmpireContentProtocol.Matches(Blob(b),b)).Sum(b=>(long)b.bytes);
                    return new {manifest=m,missing};
                });
                while(!task.IsCompleted)yield return null;
                if(task.IsFaulted||task.IsCanceled){Status="Invalid or incompatible signed content rejected";yield break;}
                var result=task.Result;
                if(result.manifest.revision<=floor){Status="No newer compatible revision; active "+activeRevision;yield break;}
                offered=result.manifest;offerEnvelope=envelope;PendingBytes=result.missing;
                Status="Revision "+offered.revision+" available • "+(PendingBytes/1048576d).ToString("0.0")+" MB • download only on approval";
            }finally{Busy=false;Progress=0;}
        }
        // Keep the two newest signed receipts plus the actually active recovery revision.
        void Prune(EmpireContentProtocol.Manifest incoming){
            Directory.CreateDirectory(root);
            var receipts=ReadReceipts(root,trust,Application.unityVersion);
            var keep=receipts.Take(2).Concat(receipts.Where(x=>x.manifest.revision==activeRevision)).ToArray();
            var names=new HashSet<string>(keep.SelectMany(x=>x.manifest.bundles).Select(EmpireContentProtocol.BundleFile),StringComparer.Ordinal);
            foreach(var b in incoming.bundles)names.Add(EmpireContentProtocol.BundleFile(b));
            var revisions=new HashSet<int>(keep.Select(x=>x.manifest.revision));
            foreach(var row in receipts)if(!revisions.Contains(row.manifest.revision))File.Delete(Receipt(row.manifest.revision));
            foreach(var path in Directory.EnumerateFiles(root,"*.bundle")){
                if(EmpireContentProtocol.IsHash(Path.GetFileNameWithoutExtension(path))&&!names.Contains(Path.GetFileName(path)))File.Delete(path);
            }
            foreach(var path in Directory.EnumerateFiles(root,"*.partial"))File.Delete(path);
        }
        static long AvailableSpace(string path){
#if UNITY_ANDROID && !UNITY_EDITOR
            using(var stat=new AndroidJavaObject("android.os.StatFs",path))return stat.Call<long>("getAvailableBytes");
#else
            return new DriveInfo(Path.GetPathRoot(path)).AvailableFreeSpace;
#endif
        }
        IEnumerator DownloadRoutine(){
            Busy=true;Progress=0;var m=offered;var envelope=offerEnvelope;Status="Preparing content download...";
            try{
                bool ready=true;
                try{
                    Prune(m);
                    long used=Directory.EnumerateFiles(root).Sum(p=>new FileInfo(p).Length);
                    long missing=m.bundles.Where(b=>!EmpireContentProtocol.Matches(Blob(b),b)).Sum(b=>(long)b.bytes);
                    if(used+missing+EmpireContentProtocol.MaxManifestBytes>CacheBudget||AvailableSpace(root)<missing+Reserve)ready=false;
                }catch(Exception){ready=false;}
                if(!ready){Status="Insufficient or unavailable content storage; existing content retained";yield break;}
                foreach(var b in m.bundles){
                    bool exists=false;try{exists=EmpireContentProtocol.Matches(Blob(b),b);}catch(IOException){}
                    if(exists)continue;
                    byte[] data=null;Status="Downloading revision "+m.revision+"...";
                    yield return Fetch("bundles/"+EmpireContentProtocol.BundleFile(b),b.bytes,x=>data=x);
                    if(data==null||data.Length!=b.bytes){Status="Interrupted download; retry to reuse completed bundles";yield break;}
                    string destination=Blob(b);
                    var write=Task.Run(()=>{
                        if(EmpireContentProtocol.Hash(data)!=b.sha256)throw new InvalidDataException("Hash mismatch");
                        string temp=destination+".partial";
                        try{
                            using(var stream=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None)){stream.Write(data,0,data.Length);stream.Flush(true);}
                            if(File.Exists(destination)){
                                if(!EmpireContentProtocol.Matches(destination,b)){
                                    // Never replace a file currently loaded by a known-good revision.
                                    File.Delete(destination);File.Move(temp,destination);
                                }else File.Delete(temp);
                            }else File.Move(temp,destination);
                        }finally{if(File.Exists(temp))File.Delete(temp);}
                    });
                    while(!write.IsCompleted)yield return null;
                    if(write.IsFaulted||write.IsCanceled){Status="Bundle rejected or storage failed; built-in content retained";yield break;}
                }
                // Receipt is the commit point; activation is deliberately deferred to the next launch.
                var commit=Task.Run(()=>{
                    if(!m.bundles.All(b=>EmpireContentProtocol.Matches(Blob(b),b)))throw new InvalidDataException("Incomplete revision");
                    string dest=Receipt(m.revision),tmp=dest+".partial";
                    try{
                        using(var f=new FileStream(tmp,FileMode.Create,FileAccess.Write,FileShare.None)){f.Write(envelope,0,envelope.Length);f.Flush(true);}
                        File.Move(tmp,dest);
                    }finally{if(File.Exists(tmp))File.Delete(tmp);}
                });
                while(!commit.IsCompleted)yield return null;
                if(commit.IsFaulted||commit.IsCanceled){Status="Activation receipt failed; current assets retained";yield break;}
                floor=m.revision;offered=null;PendingBytes=0;Status="Revision "+floor+" verified on disk. Restart app to activate.";
            }finally{Busy=false;Progress=0;}
        }
        void OnDestroy(){if(request!=null)request.Abort();overrides.Clear();foreach(var b in loaded)if(b)b.Unload(false);}
    }
}
