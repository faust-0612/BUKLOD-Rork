using System;
using UnityEngine;
namespace Buklod.Empire {
    // Original offline mono PCM bank. No network, asset subscription, or licensed music.
    public sealed class SkillAudio:MonoBehaviour {
        public const int VoiceLimit=8, SampleRate=16000;
        [Range(0,1)] public float volume=.38f;
        private AudioClip[] clips;private AudioSource[] voices;
        private bool attempted;private float[] started;
        public static int[] ValidateBank(byte[] data){
            int count=SkillCueCatalog.All.Count,header=12+count*4;
            if(data==null||data.Length<header||Read(data,0)!=0x31534b42||Read(data,4)!=SampleRate||Read(data,8)!=count)throw new ArgumentException("Invalid skill bank header.");
            var lengths=new int[count];long total=header;
            for(int i=0;i<count;i++){int n=Read(data,12+i*4);if(n<SampleRate/10||n>SampleRate*2)throw new ArgumentException("Invalid cue length.");lengths[i]=n;total+=n*2L;}
            if(total!=data.Length)throw new ArgumentException("Invalid skill bank length.");return lengths;
        }
        private static int Read(byte[] data,int i)=>data[i]|data[i+1]<<8|data[i+2]<<16|data[i+3]<<24;
        private bool Init(){
            if(attempted)return clips!=null;attempted=true;
            var asset=Resources.Load<TextAsset>("SkillAudioBank");if(!asset){Debug.LogWarning("Offline skill audio bank missing.");return false;}
            byte[] data=asset.bytes;int[] lengths;
            try{lengths=ValidateBank(data);}catch(ArgumentException ex){Debug.LogWarning(ex.Message);return false;}
            clips=new AudioClip[lengths.Length];int off=12+lengths.Length*4;
            for(int i=0;i<lengths.Length;i++){
                var samples=new float[lengths[i]];
                for(int j=0;j<samples.Length;j++,off+=2)samples[j]=unchecked((short)(data[off]|data[off+1]<<8))/32768f;
                var clip=AudioClip.Create(SkillCueCatalog.All[i].Id,samples.Length,1,SampleRate,false);
                clip.SetData(samples,0);clips[i]=clip;
            }
            voices=new AudioSource[VoiceLimit];started=new float[VoiceLimit];
            for(int i=0;i<voices.Length;i++){
                var go=new GameObject("Skill audio voice "+i);go.transform.SetParent(transform,false);
                var s=go.AddComponent<AudioSource>();s.playOnAwake=false;s.loop=false;s.spatialBlend=1;s.dopplerLevel=0;s.minDistance=4;s.maxDistance=48;s.rolloffMode=AudioRolloffMode.Linear;voices[i]=s;
            }
            return true;
        }
        public void Play(SkillCue cue,Vector3 position,bool player){
            if(!isActiveAndEnabled||volume<=0||!Init()||cue.Index<0||cue.Index>=clips.Length)return;
            int chosen=-1;for(int i=0;i<voices.Length;i++)if(!voices[i].isPlaying){chosen=i;break;}
            if(chosen<0){if(!player)return;chosen=0;for(int i=1;i<voices.Length;i++)if(started[i]<started[chosen])chosen=i;voices[chosen].Stop();}
            var s=voices[chosen];s.transform.position=position;s.volume=volume;s.clip=clips[cue.Index];started[chosen]=Time.unscaledTime;s.Play();
        }
        public void Clear(){if(voices!=null)foreach(var s in voices)s.Stop();}
        private void OnDisable(){Clear();}
        private void OnDestroy(){if(clips!=null)foreach(var clip in clips)if(clip)Destroy(clip);}
    }
}
