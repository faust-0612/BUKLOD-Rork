using System;
using UnityEngine;
namespace Buklod.Empire {
    // Isolated review preferences, no network and no production audio settings.
    public enum ReviewAudioChannel {Master,Music,Effects,Voice}
    public static class ReviewAudioSettings {
        const string Prefix="buklod.empire.review.";
        static string Key(ReviewAudioChannel channel){
            switch(channel){case ReviewAudioChannel.Master:return Prefix+"masterVolume";case ReviewAudioChannel.Music:return Prefix+"musicVolume";case ReviewAudioChannel.Effects:return Prefix+"effectsVolume";case ReviewAudioChannel.Voice:return Prefix+"voiceVolume";default:throw new ArgumentOutOfRangeException(nameof(channel));}
        }
        public static float Sanitize(float value)=>float.IsNaN(value)||float.IsInfinity(value)?1:Mathf.Clamp01(value);
        public static float Get(ReviewAudioChannel channel)=>Sanitize(PlayerPrefs.GetFloat(Key(channel),1));
        public static void Set(ReviewAudioChannel channel,float value){
            value=Sanitize(value);PlayerPrefs.SetFloat(Key(channel),value);
            if(channel==ReviewAudioChannel.Master)AudioListener.volume=value;
        }
        public static void ApplyMaster(){AudioListener.volume=Get(ReviewAudioChannel.Master);}
        public static void Save(){PlayerPrefs.Save();}
    }
}
