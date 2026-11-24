using System;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    public enum CinematicMotif { Fracture, Pillars, Dome, Comet, Beacon, Corridor, Constellation, Ribbon, Harmonics, Spiral, Bloom, Vines }
    public readonly struct CinematicSkillProfile {
        public readonly string Id; public readonly CinematicMotif Motif; public readonly int Lobes; public readonly float Lift,Reach;
        public CinematicSkillProfile(string id,CinematicMotif motif,int lobes,float lift,float reach){Id=id;Motif=motif;Lobes=lobes;Lift=lift;Reach=reach;}
    }
    // Secondary visual accents only. The primary cue still describes the existing cast.
    // No hitboxes, target data, game-time effects or changes to simulation.
    public static class CinematicSkillCatalog {
        private static readonly CinematicSkillProfile[] profiles={
            new CinematicSkillProfile("groundbreaker",CinematicMotif.Fracture,5,0.18f,1.10f),
            new CinematicSkillProfile("foundation_wall",CinematicMotif.Pillars,6,0.20f,0.85f),
            new CinematicSkillProfile("bayanihan_bastion",CinematicMotif.Dome,8,0.28f,1.20f),
            new CinematicSkillProfile("route_dash",CinematicMotif.Comet,3,0.16f,1.25f),
            new CinematicSkillProfile("beacon_mark",CinematicMotif.Beacon,4,0.22f,0.85f),
            new CinematicSkillProfile("horizon_corridor",CinematicMotif.Corridor,5,0.30f,1.15f),
            new CinematicSkillProfile("signal_shield",CinematicMotif.Dome,6,0.18f,0.90f),
            new CinematicSkillProfile("intercept_rush",CinematicMotif.Comet,4,0.20f,1.15f),
            new CinematicSkillProfile("command_network",CinematicMotif.Constellation,7,0.27f,1.05f),
            new CinematicSkillProfile("banner_rush",CinematicMotif.Ribbon,3,0.19f,1.20f),
            new CinematicSkillProfile("rally_formation",CinematicMotif.Corridor,4,0.21f,0.95f),
            new CinematicSkillProfile("stand_united",CinematicMotif.Dome,10,0.29f,1.15f),
            new CinematicSkillProfile("resonance_wave",CinematicMotif.Harmonics,4,0.17f,1.05f),
            new CinematicSkillProfile("restorative_beat",CinematicMotif.Spiral,5,0.21f,0.95f),
            new CinematicSkillProfile("symphony_of_buklod",CinematicMotif.Harmonics,9,0.32f,1.10f),
            new CinematicSkillProfile("field_patch",CinematicMotif.Spiral,3,0.15f,0.80f),
            new CinematicSkillProfile("knight_step",CinematicMotif.Comet,5,0.17f,1.00f),
            new CinematicSkillProfile("checkmate_rescue",CinematicMotif.Constellation,8,0.26f,1.10f),
            new CinematicSkillProfile("guiding_path",CinematicMotif.Corridor,3,0.16f,0.90f),
            new CinematicSkillProfile("seed_sanctuary",CinematicMotif.Bloom,5,0.20f,0.90f),
            new CinematicSkillProfile("beacon_of_service",CinematicMotif.Beacon,9,0.31f,1.20f),
            new CinematicSkillProfile("vine_riff",CinematicMotif.Vines,5,0.19f,0.90f),
            new CinematicSkillProfile("echo_skip",CinematicMotif.Ribbon,6,0.18f,1.15f),
            new CinematicSkillProfile("canopy_crescendo",CinematicMotif.Vines,9,0.29f,1.25f),
            new CinematicSkillProfile("pigment_bolt",CinematicMotif.Comet,7,0.23f,1.00f),
            new CinematicSkillProfile("mosaic_wall",CinematicMotif.Pillars,9,0.25f,1.00f),
            new CinematicSkillProfile("living_canvas",CinematicMotif.Bloom,10,0.30f,1.20f),
            new CinematicSkillProfile("echo_lance",CinematicMotif.Corridor,6,0.16f,1.25f),
            new CinematicSkillProfile("conviction_dash",CinematicMotif.Ribbon,4,0.18f,1.35f),
            new CinematicSkillProfile("call_of_the_dawn",CinematicMotif.Beacon,12,0.34f,1.30f),
            new CinematicSkillProfile("ledger_shield",CinematicMotif.Constellation,4,0.18f,0.85f),
            new CinematicSkillProfile("balance_field",CinematicMotif.Harmonics,6,0.24f,0.90f),
            new CinematicSkillProfile("equal_measure",CinematicMotif.Constellation,12,0.32f,1.20f),
            new CinematicSkillProfile("seed_turret",CinematicMotif.Bloom,3,0.17f,0.85f),
            new CinematicSkillProfile("irrigation_snare",CinematicMotif.Vines,7,0.21f,1.05f),
            new CinematicSkillProfile("harvest_engine",CinematicMotif.Pillars,11,0.29f,1.15f),
            new CinematicSkillProfile("question_sigil",CinematicMotif.Constellation,5,0.19f,0.95f),
            new CinematicSkillProfile("turning_page",CinematicMotif.Ribbon,8,0.21f,0.90f),
            new CinematicSkillProfile("grand_lesson",CinematicMotif.Harmonics,11,0.33f,1.25f),
        };
        public static IReadOnlyList<CinematicSkillProfile> All {get;}=Array.AsReadOnly(profiles);
        private static readonly Dictionary<string,CinematicSkillProfile> ById=Create();
        private static Dictionary<string,CinematicSkillProfile> Create(){
            var map=new Dictionary<string,CinematicSkillProfile>(StringComparer.Ordinal);
            foreach(var p in profiles)map.Add(p.Id,p);
            return map;
        }
        public static bool TryGet(string id,out CinematicSkillProfile profile){profile=default;return id!=null&&ById.TryGetValue(id,out profile);}
        public const int AccentCount=16;
        public static SkillParticleMotion.Sample Evaluate(CinematicSkillProfile p,int index,float progress,float radius){
            float t=Mathf.Clamp01(progress),r=Mathf.Max(.1f,radius),u=(index+.5f)/AccentCount;
            float a=u*2*Mathf.PI, envelope=Mathf.Sin(t*Mathf.PI);
            float x=Mathf.Cos(a),z=Mathf.Sin(a),y=.08f,spread=.35f+.65f*t,stretch=1.25f;
            switch(p.Motif){
                case CinematicMotif.Fracture:
                    x*=spread;z*=spread;y+=p.Lift*envelope*(.5f+.5f*Mathf.Abs(Mathf.Sin(a*p.Lobes)));stretch=1.8f;break;
                case CinematicMotif.Pillars:
                    x=(u*2-1)*.95f;z=.25f;y+=p.Lift*envelope*(1+Mathf.Abs(Mathf.Sin(a*p.Lobes)));stretch=2.2f;break;
                case CinematicMotif.Dome:
                    x*=Mathf.Sin(a*.5f);z*=Mathf.Sin(a*.5f);y+=p.Lift*(.4f+1.6f*envelope)*Mathf.Abs(Mathf.Cos(a*.5f));break;
                case CinematicMotif.Comet:
                    x=.16f*Mathf.Sin(a*p.Lobes+t*3);z=-.85f+1.7f*u+.25f*t;y+=p.Lift*envelope;stretch=2.8f;break;
                case CinematicMotif.Beacon:
                    x*=.22f;z*=.22f;y+=p.Lift*(.25f+2.5f*t)*u;stretch=2.4f;break;
                case CinematicMotif.Corridor:
                    x=(index%2==0?-.33f:.33f);z=-.7f+1.7f*u;y+=p.Lift*envelope*Mathf.Abs(Mathf.Sin(a*p.Lobes));stretch=2.1f;break;
                case CinematicMotif.Constellation:
                    x*=.6f+.25f*Mathf.Cos(a*p.Lobes);z*=.6f+.25f*Mathf.Cos(a*p.Lobes);y+=p.Lift*envelope;break;
                case CinematicMotif.Ribbon:
                    x=.35f*Mathf.Sin(a*p.Lobes+t*4);z=u*1.7f-.8f;y+=p.Lift*(.5f+.5f*Mathf.Sin(a+t*4));stretch=2.3f;break;
                case CinematicMotif.Harmonics:
                    float wave=spread*(.75f+.18f*Mathf.Sin(a*p.Lobes-t*5));x*=wave;z*=wave;y+=p.Lift*envelope;break;
                case CinematicMotif.Spiral:
                    a+=t*4.5f;x=Mathf.Cos(a)*(.75f-.3f*t);z=Mathf.Sin(a)*(.75f-.3f*t);y+=p.Lift*(.3f+2*t)*u;break;
                case CinematicMotif.Bloom:
                    float petal=spread*(.55f+.30f*Mathf.Abs(Mathf.Cos(a*p.Lobes*.5f)));x*=petal;z*=petal;y+=p.Lift*envelope;break;
                case CinematicMotif.Vines:
                    float vine=.6f+.25f*Mathf.Sin(a*p.Lobes+t*4);x*=vine;z*=vine;y+=p.Lift*envelope*Mathf.Abs(Mathf.Cos(a*p.Lobes));stretch=1.7f;break;
            }
            return new SkillParticleMotion.Sample(new Vector3(x*p.Reach,y,z*p.Reach)*r,r*(.035f+.025f*envelope),.7f*envelope,stretch);
        }
    }
}
