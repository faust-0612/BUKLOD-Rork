using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    internal static class EconomyReviewImporter {
        const string Source="Tools/ReviewOutput/economy";
        const string Out=CandidateReviewComposer.Out;
        static readonly string[] Roles={"depot","guard_post","farm","barracks","market","house"};
        [Serializable] sealed class Manifest {public string status;public Row[] models;}
        [Serializable] sealed class Row {public string id,team,role,file,sha256;public int bytes,triangles;}
        static string Hash(string path){
            using(var stream=File.OpenRead(path))using(var sha=SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
        }
        internal static Dictionary<string,GameObject> Import(){
            string receipt=Source+"/manifest.json";
            if(!File.Exists(receipt))throw new InvalidOperationException("Run node Tools/economy-review.mjs first.");
            var doc=JsonUtility.FromJson<Manifest>(File.ReadAllText(receipt));
            var expected=new HashSet<string>(new[]{"lux","tenebra"}.SelectMany(team=>Roles.Select(role=>team+"_"+role)).Concat(new[]{"field_pickup","relic_pickup"}),StringComparer.Ordinal);
            if(doc==null||doc.status!="REVIEW_ONLY"||doc.models==null||doc.models.Length!=expected.Count)
                throw new InvalidOperationException("Incomplete economy review models.");
            foreach(var row in doc.models){
                if(row==null||!expected.Remove(row.id)||row.file!=row.id+".glb"||row.triangles<=0)throw new InvalidOperationException("Invalid economy identity.");
                var path=Source+"/"+row.file;
                if(!File.Exists(path)||new FileInfo(path).Length!=row.bytes||Hash(path)!=row.sha256)
                    throw new InvalidOperationException("Economy model hash mismatch: "+row.id);
            }
            if(expected.Count!=0)throw new InvalidOperationException("Missing economy model.");
            foreach(var dir in new[]{"Models","Prefabs"})Directory.CreateDirectory(Out+"/"+dir);
            foreach(var row in doc.models)File.Copy(Source+"/"+row.file,Out+"/Models/economy_"+row.file,true);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var result=new Dictionary<string,GameObject>(StringComparer.Ordinal);
            foreach(var row in doc.models)result.Add(row.id,CandidateReviewComposer.MakePrefab("economy_"+row.id,Array.Empty<string>()));
            return result;
        }
        internal static void Bind(BattleVisualCatalog catalog){
            var assets=Import();
            foreach(var f in catalog.factions){
                string p=f.team==ArenaTeam.Lux?"lux_":"tenebra_";
                f.depot=assets[p+"depot"];f.guardPost=assets[p+"guard_post"];f.farm=assets[p+"farm"];
                f.barracks=assets[p+"barracks"];f.market=assets[p+"market"];f.house=assets[p+"house"];
            }
            catalog.fieldPickup=assets["field_pickup"];catalog.relicPickup=assets["relic_pickup"];
        }
    }
}
