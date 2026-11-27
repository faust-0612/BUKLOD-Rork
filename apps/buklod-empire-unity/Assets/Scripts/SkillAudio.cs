using System;
using UnityEngine;
namespace Buklod.Empire {
    // Original offline mono PCM bank. No network, asset subscription, or licensed music.
    public sealed class SkillAudio:MonoBehaviour {
        public const int VoiceLimit=8, SampleRate=16000;
        [Range(0,1)] public float volume=.38f;
        private AudioClip[] clips;private AudioSource[] voices;
        private bool attempted,ownsClips;private float[] started;
#if UNITY_EDITOR || BUKLOD_OFFLINE_REVIEW
        // Real CC0 Library clips; selection is presentation-only and never changes skill mechanics.
        public static string LibraryPath(SkillCue cue){
            string name;
            switch(cue.Id){
                case "groundbreaker":name="magic-vortex-swirl";break;
                case "foundation_wall":name="ice-spell-freeze";break;
                case "bayanihan_bastion":name="holy-light-spell";break;
                case "route_dash":name="teleport-out";break;
                case "beacon_mark":name="magic-wand-sparkle";break;
                case "horizon_corridor":name="magic-portal-open";break;
                case "signal_shield":name="magic-shield";break;
                case "intercept_rush":name="teleport-in-arrival";break;
                case "command_network":name="magic-shimmer-swell";break;
                case "banner_rush":name="magic-vanish-disappear";break;
                case "rally_formation":name="sparkle-burst";break;
                case "stand_united":name="holy-light-spell";break;
                case "resonance_wave":name="magic-vortex-swirl";break;
                case "restorative_beat":name="healing-spell";break;
                case "symphony_of_buklod":name="magical-transformation";break;
                case "field_patch":name="healing-spell";break;
                case "knight_step":name="teleport-in-arrival";break;
                case "checkmate_rescue":name="magic-shield";break;
                case "guiding_path":name="fairy-dust-sparkles";break;
                case "seed_sanctuary":name="healing-spell";break;
                case "beacon_of_service":name="holy-light-spell";break;
                case "vine_riff":name="dark-magic-curse";break;
                case "echo_skip":name="teleport-out";break;
                case "canopy_crescendo":name="magic-vortex-swirl";break;
                case "pigment_bolt":name="magic-spell-cast";break;
                case "mosaic_wall":name="magic-shield";break;
                case "living_canvas":name="magical-transformation";break;
                case "echo_lance":name="magic-spell-cast";break;
                case "conviction_dash":name="magic-vanish-disappear";break;
                case "call_of_the_dawn":name="holy-light-spell";break;
                case "ledger_shield":name="magic-shield";break;
                case "balance_field":name="magic-shimmer-swell";break;
                case "equal_measure":name="magic-portal-close";break;
                case "seed_turret":name="summoning-spell";break;
                case "irrigation_snare":name="ice-spell-freeze";break;
                case "harvest_engine":name="summoning-spell";break;
                case "question_sigil":name="twinkle-star-sparkle";break;
                case "turning_page":name="magic-shield";break;
                case "grand_lesson":name="magical-transformation";break;
                default:throw new ArgumentException("Unmapped Library skill: "+cue.Id);
            }
            return "LibraryAudio/Magic/"+name;
        }
        public static AudioClip[] LoadLibraryClips(){
            var result=new AudioClip[SkillCueCatalog.All.Count];
            var cache=new System.Collections.Generic.Dictionary<string,AudioClip>(StringComparer.Ordinal);
            foreach(var cue in SkillCueCatalog.All){
                string path=LibraryPath(cue);
                if(!cache.TryGetValue(path,out var clip)){
                    clip=Resources.Load<AudioClip>(path);
                    if(!clip||clip.length<=0)throw new InvalidOperationException("Missing Library audio: "+path);
                    cache.Add(path,clip);
                }
                result[cue.Index]=clip;
            }
            return result;
        }
#endif
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
#if UNITY_EDITOR || BUKLOD_OFFLINE_REVIEW
            if(GetComponent<BattleView>()?.IsEditorReview==true){
                try{clips=LoadLibraryClips();}
                catch(InvalidOperationException ex){Debug.LogError(ex.Message);return false;}
                return InitVoices();
            }
#endif
            var asset=Resources.Load<TextAsset>("SkillAudioBank");if(!asset){Debug.LogWarning("Offline skill audio bank missing.");return false;}
            byte[] data=asset.bytes;int[] lengths;
            try{lengths=ValidateBank(data);}catch(ArgumentException ex){Debug.LogWarning(ex.Message);return false;}
            ownsClips=true;clips=new AudioClip[lengths.Length];int off=12+lengths.Length*4;
            for(int i=0;i<lengths.Length;i++){
                var samples=new float[lengths[i]];
                for(int j=0;j<samples.Length;j++,off+=2)samples[j]=unchecked((short)(data[off]|data[off+1]<<8))/32768f;
                var clip=AudioClip.Create(SkillCueCatalog.All[i].Id,samples.Length,1,SampleRate,false);
                clip.SetData(samples,0);clips[i]=clip;
            }
            return InitVoices();
        }
        private bool InitVoices(){
            voices=new AudioSource[VoiceLimit];started=new float[VoiceLimit];
            for(int i=0;i<voices.Length;i++){
                var go=new GameObject("Skill audio voice "+i);go.transform.SetParent(transform,false);
                var s=go.AddComponent<AudioSource>();s.playOnAwake=false;s.loop=false;s.spatialBlend=1;s.dopplerLevel=0;s.minDistance=4;s.maxDistance=48;s.rolloffMode=AudioRolloffMode.Linear;voices[i]=s;
            }
            return true;
        }
        public void Play(SkillCue cue,Vector3 position,bool player,bool preview=false){
            if(preview&&GetComponent<BattleView>()?.IsEditorReview!=true)return;
            if(!isActiveAndEnabled||volume<=0||!Init()||cue.Index<0||cue.Index>=clips.Length)return;
            int chosen=-1;for(int i=0;i<voices.Length;i++)if(!voices[i].isPlaying){chosen=i;break;}
            if(chosen<0){if(!player)return;chosen=0;for(int i=1;i<voices.Length;i++)if(started[i]<started[chosen])chosen=i;voices[chosen].Stop();}
            var s=voices[chosen];s.spatialBlend=preview?0:1;s.transform.position=position;var view=GetComponent<BattleView>();s.volume=volume*(view&&view.IsEditorReview?ReviewAudioSettings.Get(ReviewAudioChannel.Effects):1);s.clip=clips[cue.Index];started[chosen]=Time.unscaledTime;s.Play();
        }
        private void Update(){if(voices==null)return;var view=GetComponent<BattleView>();float level=volume*(view&&view.IsEditorReview?ReviewAudioSettings.Get(ReviewAudioChannel.Effects):1);foreach(var s in voices)if(s.isPlaying)s.volume=level;}
        public void ClearPreview(){if(voices!=null)foreach(var s in voices)if(s.spatialBlend==0)s.Stop();}
        public void Clear(){if(voices!=null)foreach(var s in voices)s.Stop();}
        private void OnApplicationFocus(bool focused){if(!focused&&GetComponent<BattleView>()?.IsEditorReview==true)Clear();}
        private void OnApplicationPause(bool paused){if(paused&&GetComponent<BattleView>()?.IsEditorReview==true)Clear();}
        private void OnDisable(){Clear();}
        private void OnDestroy(){if(ownsClips&&clips!=null)foreach(var clip in clips)if(clip)Destroy(clip);}
    }
}
