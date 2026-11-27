using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;

namespace Buklod.Empire {
    // Content-only protocol. No code, gameplay state, user data, or remote URLs in the payload.
    public static class EmpireContentProtocol {
        public const string Abi="empire-audio-v1";
        public const int MaxManifestBytes=65536,MaxBundleBytes=16*1024*1024;
        public const long MaxRevisionBytes=32L*1024*1024;
        [Serializable] public sealed class Trust {public string baseUrl,modulus,exponent;public int apkVersionCode;}
        [Serializable] public sealed class Envelope {public string payload,signature;}
        [Serializable] public sealed class Manifest {public string abi,platform,unity;public int schema,minApk,maxApk,revision;public Bundle[] bundles;}
        [Serializable] public sealed class Bundle {public string sha256;public int bytes;public string[] slots;}
        public static readonly string[] Slots={
            "cartoon-wink-sparkle","dark-magic-curse","fairy-dust-sparkles","healing-spell","holy-light-spell","ice-spell-freeze",
            "magic-portal-close","magic-portal-hum","magic-portal-open","magic-shield","magic-shimmer-swell","magic-spell-cast",
            "magic-vanish-disappear","magic-vortex-swirl","magic-wand-sparkle","magical-transformation","sparkle-burst","summoning-spell",
            "teleport-in-arrival","teleport-out","twinkle-star-sparkle","achievement-unlocked","coin-collect","coin-shower","correct-answer-ding",
            "gem-sparkle","heal-restore","item-get","jackpot-win","level-up-bells","level-up-epic-brass","level-up-magic-harp",
            "level-up-synth","power-up-charge","purchase-ka-ching","quest-complete","rank-up-fanfare","rare-item-found","secret-found",
            "stage-clear","success-chime","success-vibraphone-triad","ta-da-fanfare","task-complete-pop","three-stars-rating",
            "treasure-chest-reveal","victory-fanfare","win-jingle","xp-gain"
        };
        public static string AssetName(string slot)=>"assets/empirecontent/audio/"+slot+".ogg";
        public static bool IsHash(string value)=>value!=null&&value.Length==64&&value.All(c=>c>='0'&&c<='9'||c>='a'&&c<='f');
        public static string Hash(byte[] data){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(data)).Replace("-","").ToLowerInvariant();}
        public static string HashFile(string file){using(var stream=File.OpenRead(file))using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();}
        public static Uri Origin(Trust trust){
            if(trust==null||trust.apkVersionCode<=0||!Uri.TryCreate(trust.baseUrl,UriKind.Absolute,out var uri)||uri.Scheme!=Uri.UriSchemeHttps||
               !string.IsNullOrEmpty(uri.UserInfo)||!string.IsNullOrEmpty(uri.Query)||!string.IsNullOrEmpty(uri.Fragment)||!uri.AbsolutePath.EndsWith("/",StringComparison.Ordinal))
                throw new InvalidDataException("Invalid pinned content origin.");
            var modulus=Convert.FromBase64String(trust.modulus);var exponent=Convert.FromBase64String(trust.exponent);
            if(modulus.Length<256||modulus.Length>512||exponent.Length!=3||exponent[0]!=1||exponent[1]!=0||exponent[2]!=1)
                throw new InvalidDataException("Require RSA 2048–4096 / exponent 65537.");
            return uri;
        }
        public static Manifest Verify(byte[] envelope,Trust trust,string unity){
            Origin(trust);
            if(envelope==null||envelope.Length==0||envelope.Length>MaxManifestBytes)throw new InvalidDataException("Manifest size.");
            var doc=JsonUtility.FromJson<Envelope>(Encoding.UTF8.GetString(envelope));
            if(doc==null||string.IsNullOrEmpty(doc.payload)||string.IsNullOrEmpty(doc.signature))throw new InvalidDataException("Unsigned manifest.");
            var payload=Convert.FromBase64String(doc.payload);var sig=Convert.FromBase64String(doc.signature);
            using(var rsa=RSA.Create()){
                rsa.ImportParameters(new RSAParameters{Modulus=Convert.FromBase64String(trust.modulus),Exponent=Convert.FromBase64String(trust.exponent)});
                if(!rsa.VerifyData(payload,sig,HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1))throw new CryptographicException("Invalid content signature.");
            }
            var m=JsonUtility.FromJson<Manifest>(Encoding.UTF8.GetString(payload));
            if(m==null||m.schema!=1||m.abi!=Abi||m.platform!="Android"||m.unity!=unity||m.revision<=0||m.minApk<=0||m.maxApk<m.minApk||
               trust.apkVersionCode<m.minApk||trust.apkVersionCode>m.maxApk||m.bundles==null||m.bundles.Length<1||m.bundles.Length>8)
                throw new InvalidDataException("Incompatible content revision.");
            var hashes=new HashSet<string>(StringComparer.Ordinal);var allowed=new HashSet<string>(Slots,StringComparer.Ordinal);long total=0;
            foreach(var b in m.bundles){
                if(b==null||!IsHash(b.sha256)||!hashes.Add(b.sha256)||b.bytes<=0||b.bytes>MaxBundleBytes||b.slots==null||b.slots.Length==0)
                    throw new InvalidDataException("Invalid bundle.");
                total+=b.bytes;
                foreach(var slot in b.slots)if(!allowed.Remove(slot))throw new InvalidDataException("Unknown or duplicate content slot.");
            }
            if(total>MaxRevisionBytes)throw new InvalidDataException("Content revision exceeds budget.");
            return m;
        }
        public static string BundleFile(Bundle bundle)=>bundle.sha256+".bundle";
        public static bool Matches(string path,Bundle bundle)=>File.Exists(path)&&new FileInfo(path).Length==bundle.bytes&&HashFile(path)==bundle.sha256;
    }
}
