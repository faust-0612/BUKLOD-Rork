using System;
using UnityEngine;
namespace Buklod.Empire {
    public sealed class ReviewPortraits:MonoBehaviour {
        public string[] ids;
        public Texture2D[] portraits;
        public Texture2D Find(string id){
            if(ids==null||portraits==null||ids.Length!=portraits.Length)return null;
            for(int i=0;i<ids.Length;i++)if(string.Equals(ids[i],id,StringComparison.Ordinal))return portraits[i];
            return null;
        }
    }
}
