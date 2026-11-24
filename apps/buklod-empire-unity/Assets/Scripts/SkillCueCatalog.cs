using System;
using System.Collections.Generic;
namespace Buklod.Empire {
    public enum SkillCueShape { Impact, Wall, Shield, Dash, Mark, Surge, Heal, Bolt, Snare, Summon }
    public readonly struct SkillCue {
        public readonly string Id; public readonly SkillCueShape Shape; public readonly float Size,Duration; public readonly int Index;
        public SkillCue(string id,SkillCueShape shape,float size,float duration,int index){Id=id;Shape=shape;Size=size;Duration=duration;Index=index;}
    }
    // Presentation scale only; not targeting radius, hit geometry, or damage authority.
    public static class SkillCueCatalog {
        private static readonly SkillCue[] cues={
            new SkillCue("groundbreaker",SkillCueShape.Impact,2.7f,0.320f,0),
            new SkillCue("foundation_wall",SkillCueShape.Wall,2.2f,0.440f,1),
            new SkillCue("bayanihan_bastion",SkillCueShape.Shield,3.4f,0.610f,2),
            new SkillCue("route_dash",SkillCueShape.Dash,2.5f,0.335f,3),
            new SkillCue("beacon_mark",SkillCueShape.Mark,1.7f,0.455f,4),
            new SkillCue("horizon_corridor",SkillCueShape.Surge,3.5f,0.625f,5),
            new SkillCue("signal_shield",SkillCueShape.Shield,1.9f,0.350f,6),
            new SkillCue("intercept_rush",SkillCueShape.Dash,2.6f,0.470f,7),
            new SkillCue("command_network",SkillCueShape.Shield,3.3f,0.640f,8),
            new SkillCue("banner_rush",SkillCueShape.Dash,2.8f,0.320f,9),
            new SkillCue("rally_formation",SkillCueShape.Surge,2.7f,0.440f,10),
            new SkillCue("stand_united",SkillCueShape.Shield,3.6f,0.610f,11),
            new SkillCue("resonance_wave",SkillCueShape.Impact,2.5f,0.335f,12),
            new SkillCue("restorative_beat",SkillCueShape.Heal,2.2f,0.455f,13),
            new SkillCue("symphony_of_buklod",SkillCueShape.Heal,3.6f,0.625f,14),
            new SkillCue("field_patch",SkillCueShape.Heal,1.8f,0.350f,15),
            new SkillCue("knight_step",SkillCueShape.Dash,2.3f,0.470f,16),
            new SkillCue("checkmate_rescue",SkillCueShape.Shield,2.8f,0.640f,17),
            new SkillCue("guiding_path",SkillCueShape.Surge,2.4f,0.320f,18),
            new SkillCue("seed_sanctuary",SkillCueShape.Heal,2.6f,0.440f,19),
            new SkillCue("beacon_of_service",SkillCueShape.Heal,3.8f,0.610f,20),
            new SkillCue("vine_riff",SkillCueShape.Snare,2.9f,0.335f,21),
            new SkillCue("echo_skip",SkillCueShape.Dash,2.7f,0.455f,22),
            new SkillCue("canopy_crescendo",SkillCueShape.Snare,3.8f,0.625f,23),
            new SkillCue("pigment_bolt",SkillCueShape.Bolt,2.5f,0.350f,24),
            new SkillCue("mosaic_wall",SkillCueShape.Wall,2.4f,0.470f,25),
            new SkillCue("living_canvas",SkillCueShape.Heal,3.7f,0.640f,26),
            new SkillCue("echo_lance",SkillCueShape.Bolt,2.9f,0.320f,27),
            new SkillCue("conviction_dash",SkillCueShape.Dash,3f,0.440f,28),
            new SkillCue("call_of_the_dawn",SkillCueShape.Impact,4f,0.610f,29),
            new SkillCue("ledger_shield",SkillCueShape.Shield,2.3f,0.335f,30),
            new SkillCue("balance_field",SkillCueShape.Shield,2.5f,0.455f,31),
            new SkillCue("equal_measure",SkillCueShape.Shield,4f,0.625f,32),
            new SkillCue("seed_turret",SkillCueShape.Summon,2.2f,0.350f,33),
            new SkillCue("irrigation_snare",SkillCueShape.Snare,2.8f,0.470f,34),
            new SkillCue("harvest_engine",SkillCueShape.Summon,3.4f,0.640f,35),
            new SkillCue("question_sigil",SkillCueShape.Mark,2.1f,0.320f,36),
            new SkillCue("turning_page",SkillCueShape.Shield,2f,0.440f,37),
            new SkillCue("grand_lesson",SkillCueShape.Surge,3.9f,0.610f,38),
        };
        public static IReadOnlyList<SkillCue> All {get;}=Array.AsReadOnly(cues);
        private static readonly Dictionary<string,SkillCue> byId=Create();
        private static Dictionary<string,SkillCue> Create(){var map=new Dictionary<string,SkillCue>(StringComparer.Ordinal);foreach(var cue in cues)map.Add(cue.Id,cue);return map;}
        public static bool TryGet(string id,out SkillCue cue){cue=default;return id!=null&&byId.TryGetValue(id,out cue);}
    }
}
