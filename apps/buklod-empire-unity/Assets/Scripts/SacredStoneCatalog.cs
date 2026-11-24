using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using UnityEngine;
namespace Buklod.Empire {
    public sealed class SacredStone {
        public string HeroId { get; }
        public string Name { get; }
        public Color Accent { get; }
        public string VirtueTl { get; }
        public int FoundationOrder { get; }
        public string Source { get; }
        internal SacredStone(string id,string name,Color accent,string virtue,int order,string source){
            HeroId=id;Name=name;Accent=accent;VirtueTl=virtue;FoundationOrder=order;Source=source;
        }
    }
    // Main-thread Unity resource; visual identity only, never combat or economy.
    public static class SacredStoneCatalog {
        [Serializable] private sealed class Document { public int schema; public Row[] stones; }
        [Serializable] private sealed class Row {
            public string heroId,stone,color,virtueTl,source;
            public int foundationOrder;
        }
        private static IReadOnlyDictionary<string,SacredStone> cached;
        public static IReadOnlyDictionary<string,SacredStone> Load(){
            if(cached!=null)return cached;
            var asset=Resources.Load<TextAsset>("SacredStones");
            if(asset==null)throw new InvalidOperationException("Missing SacredStones resource.");
            var doc=JsonUtility.FromJson<Document>(asset.text);
            if(doc==null||doc.schema!=1||doc.stones==null||doc.stones.Length!=13)
                throw new InvalidOperationException("Expected thirteen stone identities.");
            var map=new Dictionary<string,SacredStone>(StringComparer.Ordinal);
            var names=new HashSet<string>(StringComparer.Ordinal);
            var orders=new HashSet<int>();
            foreach(var row in doc.stones){
                if(row==null||string.IsNullOrWhiteSpace(row.heroId)||string.IsNullOrWhiteSpace(row.stone)||
                   string.IsNullOrWhiteSpace(row.virtueTl)||!ColorUtility.TryParseHtmlString(row.color,out var accent)||
                   map.ContainsKey(row.heroId)||!names.Add(row.stone)||row.foundationOrder<0||row.foundationOrder>12||
                   !orders.Add(row.foundationOrder))
                    throw new InvalidOperationException("Invalid or duplicate stone.");
                var expectedSource=row.foundationOrder==0?"BUKLOD original lore":"Revelation 21:19-20 (NIV)";
                if(row.source!=expectedSource||(row.foundationOrder==0&&row.stone!="Diamond"))
                    throw new InvalidOperationException("Incorrect stone source.");
                map.Add(row.heroId,new SacredStone(row.heroId,row.stone,accent,row.virtueTl,row.foundationOrder,row.source));
            }
            foreach(var kit in HeroKitCatalog.All)
                if(!map.ContainsKey(kit.Id))throw new InvalidOperationException("Missing hero stone: "+kit.Id);
            cached=new ReadOnlyDictionary<string,SacredStone>(map);
            return cached;
        }
        public static bool TryGet(string id,out SacredStone stone){
            stone=null;return id!=null&&Load().TryGetValue(id,out stone);
        }
    }
}
