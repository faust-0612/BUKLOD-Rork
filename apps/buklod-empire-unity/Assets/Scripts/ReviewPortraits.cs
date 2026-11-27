using System;
using UnityEngine;
namespace Buklod.Empire {
    public sealed class ReviewPortraits:MonoBehaviour {
        public string[] ids;
        public Texture2D[] portraits,fullBodies;
        public Texture2D Find(string id,bool fullBody=false){
            var textures=fullBody?fullBodies:portraits;
            if(ids==null||textures==null||ids.Length!=textures.Length)return null;
            for(int i=0;i<ids.Length;i++)if(string.Equals(ids[i],id,StringComparison.Ordinal))return textures[i];
            return null;
        }
    }
}
