using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using NUnit.Framework;
using UnityEngine;

namespace Buklod.Empire.Tests {
    public sealed class EmpireContentProtocolTests {
        RSA key;
        EmpireContentProtocol.Trust trust;
        const string UnityVersion="6000.3.29f1";
        [SetUp] public void Setup(){
            key=RSA.Create();key.KeySize=2048;
            var p=key.ExportParameters(false);
            trust=new EmpireContentProtocol.Trust{baseUrl="https://example.invalid/empire/",apkVersionCode=1,
                modulus=Convert.ToBase64String(p.Modulus),exponent=Convert.ToBase64String(p.Exponent)};
        }
        [TearDown] public void Teardown(){key.Dispose();}
        EmpireContentProtocol.Manifest Valid()=>new EmpireContentProtocol.Manifest{schema=2,abi=EmpireContentProtocol.Abi,platform="Android",unity=UnityVersion,minApk=1,maxApk=1,revision=1,
            bundles=new[]{new EmpireContentProtocol.Bundle{sha256=new string('a',64),bytes=120,slots=new[]{"coin-collect","item-get"}}}};
        byte[] Sign(EmpireContentProtocol.Manifest manifest,bool tampered=false){
            var payload=Encoding.UTF8.GetBytes(JsonUtility.ToJson(manifest));
            var signature=key.SignData(payload,HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1);
            if(tampered)signature[0]^=1;
            return Encoding.UTF8.GetBytes(JsonUtility.ToJson(new EmpireContentProtocol.Envelope{payload=Convert.ToBase64String(payload),signature=Convert.ToBase64String(signature)}));
        }
        [Test] public void ReceiptRetryReplacesInvalidCacheAndPreservesValidRevision(){
            var folder=Path.Combine(Path.GetTempPath(),Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(folder);
            try{
                var destination=Path.Combine(folder,"revision-1.json");
                var valid=Sign(Valid());
                File.WriteAllBytes(destination,Sign(Valid(),true));
                EmpireContentUpdater.CommitReceipt(destination,valid,trust,UnityVersion);
                EmpireContentUpdater.CommitReceipt(destination,valid,trust,UnityVersion);
                var conflict=Valid();
                conflict.bundles[0].bytes++;
                Assert.Throws<InvalidDataException>(()=>EmpireContentUpdater.CommitReceipt(destination,Sign(conflict),trust,UnityVersion));
                CollectionAssert.AreEqual(valid,File.ReadAllBytes(destination));
                Assert.False(File.Exists(destination+".partial"));
            }finally{Directory.Delete(folder,true);}
        }
        [Test] public void DamagedLatestRevisionCanRepairWithoutWeakeningReplayFloor(){
            var m=Valid();m.revision=7;var recorded=Sign(m);
            Assert.IsTrue(EmpireContentUpdater.CanOfferRevision(7,7,6,120,recorded,recorded));
            Assert.IsTrue(EmpireContentUpdater.CanOfferRevision(7,7,0,120,recorded,recorded));
            Assert.IsFalse(EmpireContentUpdater.CanOfferRevision(7,7,7,120,recorded,recorded));
            Assert.IsFalse(EmpireContentUpdater.CanOfferRevision(7,7,6,0,recorded,recorded));
            m.bundles[0].bytes++;var conflict=Sign(m);
            Assert.IsFalse(EmpireContentUpdater.CanOfferRevision(7,7,6,120,conflict,recorded));
            Assert.IsFalse(EmpireContentUpdater.CanOfferRevision(7,7,6,120,recorded,null));
            m.revision=6;Assert.IsFalse(EmpireContentUpdater.CanOfferRevision(6,7,6,120,Sign(m),recorded));
            m.revision=8;Assert.IsTrue(EmpireContentUpdater.CanOfferRevision(8,7,6,120,Sign(m),recorded));
        }
        [Test] public void ValidSignatureAndCompatibleRuntime(){Assert.AreEqual(1,EmpireContentProtocol.Verify(Sign(Valid()),trust,UnityVersion).revision);}
        [Test] public void TamperedSignatureRejected(){Assert.Throws<CryptographicException>(()=>EmpireContentProtocol.Verify(Sign(Valid(),true),trust,UnityVersion));}
        [Test] public void OtherRuntimeRejected(){Assert.Throws<InvalidDataException>(()=>EmpireContentProtocol.Verify(Sign(Valid()),trust,"6000.6.10f1"));}
        [Test] public void InvalidApkRejected(){trust.apkVersionCode=2;Assert.Throws<InvalidDataException>(()=>EmpireContentProtocol.Verify(Sign(Valid()),trust,UnityVersion));}
        [Test] public void UnknownSlotRejected(){var m=Valid();m.bundles[0].slots[0]="../code.dll";Assert.Throws<InvalidDataException>(()=>EmpireContentProtocol.Verify(Sign(m),trust,UnityVersion));}
        [Test] public void DuplicateSlotRejected(){var m=Valid();m.bundles[0].slots[1]="coin-collect";Assert.Throws<InvalidDataException>(()=>EmpireContentProtocol.Verify(Sign(m),trust,UnityVersion));}
        [Test] public void InvalidDigestRejected(){var m=Valid();m.bundles[0].sha256="../bundle";Assert.Throws<InvalidDataException>(()=>EmpireContentProtocol.Verify(Sign(m),trust,UnityVersion));}
        [Test] public void OversizeBundleRejected(){var m=Valid();m.bundles[0].bytes=EmpireContentProtocol.MaxBundleBytes+1;Assert.Throws<InvalidDataException>(()=>EmpireContentProtocol.Verify(Sign(m),trust,UnityVersion));}
        [Test] public void InsecureOriginRejected(){trust.baseUrl="http://example.invalid/";Assert.Throws<InvalidDataException>(()=>EmpireContentProtocol.Verify(Sign(Valid()),trust,UnityVersion));}
        [Test] public void OversizeManifestRejected(){Assert.Throws<InvalidDataException>(()=>EmpireContentProtocol.Verify(new byte[EmpireContentProtocol.MaxManifestBytes+1],trust,UnityVersion));}
        [Test] public void StaticSlotHasTypedAssetAddress(){
            var m=Valid();m.bundles[0].slots=new[]{"lux_tower","wood","coin-collect"};
            Assert.AreEqual(3,EmpireContentProtocol.Verify(Sign(m),trust,UnityVersion).bundles[0].slots.Length);
            Assert.AreEqual("assets/empirecontent/static/lux_tower.prefab",EmpireContentProtocol.AssetName("lux_tower"));
            Assert.AreEqual("assets/empirecontent/audio/coin-collect.ogg",EmpireContentProtocol.AssetName("coin-collect"));
        }
        [Test] public void DynamicVisualSlotRejected(){
            var m=Valid();m.bundles[0].slots=new[]{"phan"};
            Assert.Throws<InvalidDataException>(()=>EmpireContentProtocol.Verify(Sign(m),trust,UnityVersion));
        }
        [Test] public void PreviousAbiRejected(){
            var m=Valid();m.schema=1;m.abi="empire-audio-v1";
            Assert.Throws<InvalidDataException>(()=>EmpireContentProtocol.Verify(Sign(m),trust,UnityVersion));
        }
        [Test] public void StaticSlotDuplicatesAcrossBundlesRejected(){
            var m=Valid();m.bundles[0].slots=new[]{"wood"};
            m.bundles=new[]{m.bundles[0],new EmpireContentProtocol.Bundle{sha256=new string('b',64),bytes=120,slots=new[]{"wood"}}};
            Assert.Throws<InvalidDataException>(()=>EmpireContentProtocol.Verify(Sign(m),trust,UnityVersion));
        }
        [Test] public void ChangedCacheFileRejected(){
            var temp=Path.GetTempFileName();
            try{var data=new byte[]{1,2,3};File.WriteAllBytes(temp,data);var b=new EmpireContentProtocol.Bundle{sha256=EmpireContentProtocol.Hash(data),bytes=data.Length};
                Assert.IsTrue(EmpireContentProtocol.Matches(temp,b));File.WriteAllBytes(temp,new byte[]{1,2,4});Assert.IsFalse(EmpireContentProtocol.Matches(temp,b));
            }finally{File.Delete(temp);}
        }
    }
}
