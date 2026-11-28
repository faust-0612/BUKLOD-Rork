using System;
using UnityEngine;
namespace Buklod.Empire {
    // Anonymous device-local aggregate of visible opponent behavior. No account or reward data.
    [Serializable] public sealed class OfflineBotLearning {
        public const int Schema=1, MaxSamples=64;
        public int version=Schema, samples;
        public float burst, pursuit, exposure;
        static float Bounded(float v)=>float.IsNaN(v)||float.IsInfinity(v)?0:Mathf.Clamp01(v);
        public static OfflineBotLearning Decode(string json){
            if(string.IsNullOrEmpty(json)||json.Length>2048)return new OfflineBotLearning();
            try{
                var p=JsonUtility.FromJson<OfflineBotLearning>(json);
                if(p==null||p.version!=Schema||p.samples<0||p.samples>MaxSamples)return new OfflineBotLearning();
                p.burst=Bounded(p.burst);p.pursuit=Bounded(p.pursuit);p.exposure=Bounded(p.exposure);return p;
            }catch(Exception){return new OfflineBotLearning();}
        }
        public OfflineBotLearning Copy()=>Decode(JsonUtility.ToJson(this));
        public float Confidence=>Mathf.Clamp01(samples/8f);
        public bool Learn(int observations,int casts,int advances,int isolated){
            if(observations<8||casts<0||advances<0||isolated<0||casts>observations||advances>observations||isolated>observations)return false;
            float w=samples==0?1f:.20f;
            burst=Mathf.Lerp(Bounded(burst),casts/(float)observations,w);
            pursuit=Mathf.Lerp(Bounded(pursuit),advances/(float)observations,w);
            exposure=Mathf.Lerp(Bounded(exposure),isolated/(float)observations,w);
            samples=Mathf.Min(MaxSamples,samples+1);return true;
        }
        public float RiskBias=>Confidence*(burst*.08f+pursuit*.04f);
        public float FlankBias=>Confidence*exposure*.18f;
    }
    public static class OfflineBotLearningStore {
        const string Prefix="empire.offline.ai.v1.";
        public static OfflineBotLearning Load(string hero,ArenaDifficulty difficulty){
            HeroKitCatalog.Get(hero);
            try{return OfflineBotLearning.Decode(PlayerPrefs.GetString(Prefix+hero+"."+(int)difficulty,""));}
            catch(Exception){return new OfflineBotLearning();}
        }
        public static void Save(string hero,ArenaDifficulty difficulty,OfflineBotLearning profile){
            HeroKitCatalog.Get(hero);
            if(profile==null)return;
            PlayerPrefs.SetString(Prefix+hero+"."+(int)difficulty,JsonUtility.ToJson(profile.Copy()));PlayerPrefs.Save();
        }
    }
}
