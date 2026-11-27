using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
namespace Buklod.Empire {
    // Explicit review-only locomotion comparison. Never mutates shared
    // controllers, root motion, combat timing, weapon attacks or signature skills.
    public sealed class ReviewMotionLibrary:MonoBehaviour {
        [Serializable] public sealed class Entry {public GameObject prefab;public AnimationClip walk;}
        public Entry[] entries;
        const string Preference="buklod.empire.review.authoredWalk";
        readonly Dictionary<GameObject,AnimatorOverrideController> overrides=new Dictionary<GameObject,AnimatorOverrideController>();
        readonly Dictionary<GameObject,RuntimeAnimatorController> original=new Dictionary<GameObject,RuntimeAnimatorController>();
        public bool Requested=>PlayerPrefs.GetInt(Preference,0)==1;
        public void SetRequested(bool enabled){PlayerPrefs.SetInt(Preference,enabled?1:0);PlayerPrefs.Save();}
        public void Validate(){
            if(entries==null||entries.Length!=13)throw new InvalidOperationException("Incomplete authored locomotion preview.");
            var seen=new HashSet<GameObject>();
            foreach(var e in entries){
                if(e==null||!e.prefab||!e.walk||e.walk.length<=0||!seen.Add(e.prefab))throw new InvalidOperationException("Invalid authored locomotion identity.");
                var a=e.prefab.GetComponentInChildren<Animator>(true);
                if(!a||!a.runtimeAnimatorController||a.runtimeAnimatorController.animationClips.Count(c=>c&&c.name=="Walk")!=1)
                    throw new InvalidOperationException("Unique original Walk required.");
            }
        }
        public void Apply(GameObject prefab,Animator animator,bool useAuthored){
            if(!animator||entries==null)return;
            var e=entries.FirstOrDefault(x=>x!=null&&x.prefab==prefab);
            if(e==null)return;
            if(!original.TryGetValue(prefab,out var baseline)){
                baseline=prefab.GetComponentInChildren<Animator>(true).runtimeAnimatorController;
                original.Add(prefab,baseline);
            }
            RuntimeAnimatorController controller=baseline;
            if(useAuthored){
                if(!overrides.TryGetValue(prefab,out var authored)){
                    authored=new AnimatorOverrideController(baseline);
                    var pairs=new List<KeyValuePair<AnimationClip,AnimationClip>>();
                    authored.GetOverrides(pairs);
                    int index=pairs.FindIndex(x=>x.Key&&x.Key.name=="Walk");
                    if(index<0||pairs.Count(x=>x.Key&&x.Key.name=="Walk")!=1){Destroy(authored);throw new InvalidOperationException("Authored walk mapping drift.");}
                    pairs[index]=new KeyValuePair<AnimationClip,AnimationClip>(pairs[index].Key,e.walk);
                    authored.ApplyOverrides(pairs);overrides.Add(prefab,authored);
                }
                controller=authored;
            }
            if(animator.runtimeAnimatorController!=controller)animator.runtimeAnimatorController=controller;
            animator.applyRootMotion=false;
        }
        void OnDestroy(){foreach(var c in overrides.Values)if(c)Destroy(c);overrides.Clear();original.Clear();}
    }
}
