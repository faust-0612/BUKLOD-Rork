using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;
namespace Buklod.Empire {
    // Isolated offline presentation only. Simulation, hit timing, rewards and
    // production validation never depend on this fallback.
    internal sealed class ReviewClipPlayback:IDisposable {
        readonly Dictionary<string,int> indices=new Dictionary<string,int>(StringComparer.Ordinal);
        readonly List<AnimationClipPlayable> clips=new List<AnimationClipPlayable>();
        readonly List<AnimationClip> assets=new List<AnimationClip>();
        PlayableGraph graph;AnimationMixerPlayable mixer;int current=-1;
        string locomotion="Idle";bool action,death;float remaining;
        static readonly HashSet<string> warned=new HashSet<string>();
        public static ReviewClipPlayback TryCreate(Animator animator,string id){
            try{return new ReviewClipPlayback(animator);}
            catch(Exception e){if(warned.Add(id))Debug.LogWarning("Offline clip playback unavailable for "+id+": "+e.Message);return null;}
        }
        ReviewClipPlayback(Animator animator){
            if(!animator||!animator.runtimeAnimatorController)throw new ArgumentException("Animator/controller missing");
            var source=animator.runtimeAnimatorController.animationClips;
            try{
                graph=PlayableGraph.Create("Empire offline clip playback");
                graph.SetTimeUpdateMode(DirectorUpdateMode.Manual);
                foreach(var clip in source)if(clip&&clip.length>0&&!indices.ContainsKey(clip.name)){
                    indices.Add(clip.name,assets.Count);assets.Add(clip);
                }
                if(!indices.ContainsKey("Idle")||!indices.ContainsKey("Walk"))throw new InvalidOperationException("Locomotion clips missing");
                mixer=AnimationMixerPlayable.Create(graph,assets.Count);
                for(int i=0;i<assets.Count;i++){
                    var playable=AnimationClipPlayable.Create(graph,assets[i]);
                    playable.SetApplyFootIK(false);playable.SetApplyPlayableIK(false);
                    graph.Connect(playable,0,mixer,i);mixer.SetInputWeight(i,0f);clips.Add(playable);
                }
                var output=AnimationPlayableOutput.Create(graph,"Offline hero pose",animator);output.SetSourcePlayable(mixer);
                animator.applyRootMotion=false;animator.enabled=true;animator.cullingMode=AnimatorCullingMode.AlwaysAnimate;
                // Keep the controller reference for diagnostics and death duration; the
                // manually evaluated output owns the pose while this graph is active.
                graph.Play();Switch("Idle");graph.Evaluate(0);
            }catch{Dispose();throw;}
        }
        bool Switch(string name){
            if(!indices.TryGetValue(name,out int next))return false;
            if(current>=0)mixer.SetInputWeight(current,0f);
            current=next;var clip=clips[next];clip.SetTime(0);clip.SetDone(false);mixer.SetInputWeight(next,1f);
            return true;
        }
        public void SetSpeed(float speed){
            locomotion=speed<.12f?"Idle":speed>=4.5f&&indices.ContainsKey("Run")?"Run":"Walk";
            if(!action&&!death&&indices[locomotion]!=current)Switch(locomotion);
        }
        public bool Trigger(string name){
            if(death||!Switch(name))return false;
            action=true;death=name=="Death";remaining=assets[current].length;return true;
        }
        public void Tick(float dt){
            if(!graph.IsValid()||current<0)return;
            dt=Mathf.Clamp(dt,0,.1f);
            if(death&&remaining<=0)return;
            if(action){
                remaining-=dt;
                if(remaining<=0&&!death){action=false;Switch(locomotion);}
            }
            // Explicit loop for imported clips regardless of their imported wrap mode.
            if(!action&&clips[current].GetTime()>=assets[current].length)
                clips[current].SetTime(clips[current].GetTime()%assets[current].length);
            graph.Evaluate(dt);
        }
        public void Dispose(){if(graph.IsValid())graph.Destroy();}
    }
}
