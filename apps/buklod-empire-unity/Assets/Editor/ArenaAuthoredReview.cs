using System;
using System.Linq;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    internal static class ArenaAuthoredReview {
        const string Ui="Assets/ThirdParty/KenneyReview/";
        const string Models="Assets/ThirdParty/KayKitReview/";
        static Sprite Load(string file,int border=0){
            string path=Ui+file+".png";
            var importer=AssetImporter.GetAtPath(path) as TextureImporter;
            if(!importer)throw new InvalidOperationException("Missing authored UI: "+path);
            var wanted=new Vector4(border,border,border,border);
            if(importer.textureType!=TextureImporterType.Sprite||importer.spriteImportMode!=SpriteImportMode.Single||importer.spriteBorder!=wanted||importer.mipmapEnabled){
                importer.textureType=TextureImporterType.Sprite;importer.spriteImportMode=SpriteImportMode.Single;
                importer.spriteBorder=wanted;importer.mipmapEnabled=false;importer.alphaIsTransparency=true;
                importer.spritePixelsPerUnit=100;importer.SaveAndReimport();
            }
            var sprite=AssetDatabase.LoadAssetAtPath<Sprite>(path);
            if(!sprite)throw new InvalidOperationException("Authored sprite import failed: "+path);
            return sprite;
        }
        static AudioClip Audio(string name){var clip=AssetDatabase.LoadAssetAtPath<AudioClip>(Ui+"Combat/"+name+".ogg");if(!clip)throw new InvalidOperationException("Missing authored combat audio: "+name);return clip;}
        public static void Bind(GameObject root){
            var ui=root.AddComponent<ArenaAuthoredUi>();
            ui.action=Load("action");ui.stickPad=Load("stick-pad");ui.stickNub=Load("stick-nub");
            ui.menuButton=Load("menu-button",12);ui.menuPanel=Load("menu-panel",20);
            ui.click=AssetDatabase.LoadAssetAtPath<AudioClip>(Ui+"click.ogg");
            if(!ui.click)throw new InvalidOperationException("Authored click audio missing.");
            ui.purchase=PresentationAudioReview.LibraryReward("purchase-ka-ching");ui.pickup=PresentationAudioReview.LibraryReward("item-get");ui.relic=PresentationAudioReview.LibraryReward("rare-item-found");
            var model=AssetDatabase.LoadAssetAtPath<GameObject>(Models+"doorway.glb");
            if(!model)throw new InvalidOperationException("Authored doorway import failed.");
            var obj=(GameObject)PrefabUtility.InstantiatePrefab(model,root.transform);
            if(!obj)throw new InvalidOperationException("Cannot instantiate authored doorway.");
            obj.name="Review entrance gate";
            var leaf=obj.GetComponentsInChildren<Transform>(true).SingleOrDefault(t=>t.name=="wall_doorway_door");
            if(!leaf)throw new InvalidOperationException("Authored door hinge node not found.");
            var renderers=obj.GetComponentsInChildren<Renderer>(true);
            if(renderers.Length==0)throw new InvalidOperationException("Authored doorway has no renderer.");
            Bounds bounds=renderers[0].bounds;foreach(var r in renderers)bounds.Encapsulate(r.bounds);
            if(bounds.size.y<.01f)throw new InvalidOperationException("Invalid doorway dimensions.");
            obj.transform.localScale*=3.4f/bounds.size.y;
            obj.transform.localPosition=new Vector3(20,0,OfflineBattle.Height*.5f+4);
            float minY=renderers.Min(r=>r.bounds.min.y);obj.transform.position+=Vector3.up*(-minY);
            foreach(var collider in obj.GetComponentsInChildren<Collider>(true))collider.enabled=false;
            var gate=obj.AddComponent<ArenaEntranceDoor>();gate.leaf=leaf;ui.entrance=gate;
            gate.openSound=Audio("door-open");
            var foley=root.AddComponent<ArenaReviewFoley>();
            foley.steps=new[]{Audio("step-grass-a"),Audio("step-grass-b")};
            foley.metal=Audio("metal-hit");foley.wood=Audio("wood-hit");foley.coins=PresentationAudioReview.LibraryReward("coin-collect");foley.levelUp=PresentationAudioReview.LibraryReward("level-up-magic-harp");
            foley.pickup=PresentationAudioReview.LibraryReward("item-get");foley.relic=PresentationAudioReview.LibraryReward("rare-item-found");foley.purchase=PresentationAudioReview.LibraryReward("purchase-ka-ching");
            foley.fight=Audio("fight");foley.win=Audio("you_win");foley.lose=Audio("you_lose");foley.draw=Audio("tie");
        }
    }
}
