using System;
using System.Collections.Generic;
namespace Buklod.Empire {
    public enum SkillSlot { Primary, Secondary, Ultimate }
    public readonly struct SkillSpec {
        public readonly string Id; public readonly float Cooldown;
        public SkillSpec(string id,float cooldown){Id=id;Cooldown=cooldown;}
    }
    public sealed class HeroKit {
        public readonly string Id, Name, Passive;
        public readonly float Speed, BasicDamage, BasicRange, BasicCooldown;
        public readonly SkillSpec Primary, Secondary, Ultimate;
        public HeroKit(string id,string name,string passive,float speed,float damage,float range,float cooldown,SkillSpec primary,SkillSpec secondary,SkillSpec ultimate){
            Id=id;Name=name;Passive=passive;Speed=speed;BasicDamage=damage;BasicRange=range;BasicCooldown=cooldown;Primary=primary;Secondary=secondary;Ultimate=ultimate;
        }
        public SkillSpec Skill(SkillSlot slot){switch(slot){case SkillSlot.Primary:return Primary;case SkillSlot.Secondary:return Secondary;case SkillSlot.Ultimate:return Ultimate;default:throw new ArgumentOutOfRangeException(nameof(slot));}}
    }
    // Canonical six starter kits and seven library kits, pinned from the original Godot pack inputs.
    // Source speed is in pixels/second; 40 pixels = one simulation unit.
    public static class HeroKitCatalog {
        private static readonly HeroKit[] kits={
            new HeroKit("phan", "Phan", "lands_resolve", 5f, 22f, 3f, 0.8f, new SkillSpec("groundbreaker", 8f), new SkillSpec("foundation_wall", 12f), new SkillSpec("bayanihan_bastion", 90f)),
            new HeroKit("quin", "Quin", "trail_sense", 6f, 25f, 13f, 0.7f, new SkillSpec("route_dash", 8f), new SkillSpec("beacon_mark", 12f), new SkillSpec("horizon_corridor", 90f)),
            new HeroKit("van", "Van", "protective_link", 5.25f, 19f, 3f, 0.9f, new SkillSpec("signal_shield", 8f), new SkillSpec("intercept_rush", 12f), new SkillSpec("command_network", 90f)),
            new HeroKit("christian", "Christian", "command_presence", 5.25f, 28f, 3.5f, 0.8f, new SkillSpec("banner_rush", 8f), new SkillSpec("rally_formation", 12f), new SkillSpec("stand_united", 90f)),
            new HeroKit("lhen", "Lhen", "harmony_weaver", 5.5f, 20f, 10f, 0.8f, new SkillSpec("resonance_wave", 8f), new SkillSpec("restorative_beat", 12f), new SkillSpec("symphony_of_buklod", 90f)),
            new HeroKit("ace", "Ace", "critical_care", 5.25f, 19f, 9.5f, 0.8f, new SkillSpec("field_patch", 8f), new SkillSpec("knight_step", 12f), new SkillSpec("checkmate_rescue", 90f)),
            new HeroKit("ellusur", "ELESUR", "teach_by_example", 5.375f, 19f, 9.5f, 0.9f, new SkillSpec("guiding_path", 10f), new SkillSpec("seed_sanctuary", 14f), new SkillSpec("beacon_of_service", 100f)),
            new HeroKit("jawo", "Jawo", "natural_rhythm", 5.75f, 21f, 9f, 0.8f, new SkillSpec("vine_riff", 8f), new SkillSpec("echo_skip", 12f), new SkillSpec("canopy_crescendo", 100f)),
            new HeroKit("mitch", "Mitch", "color_theory", 5.125f, 22f, 9f, 0.8f, new SkillSpec("pigment_bolt", 8f), new SkillSpec("mosaic_wall", 12f), new SkillSpec("living_canvas", 100f)),
            new HeroKit("niel", "Niel", "shared_resolve", 5.25f, 30f, 2.5f, 0.8f, new SkillSpec("echo_lance", 8f), new SkillSpec("conviction_dash", 12f), new SkillSpec("call_of_the_dawn", 100f)),
            new HeroKit("angel", "Angel", "fair_allocation", 5f, 19f, 2f, 0.9f, new SkillSpec("ledger_shield", 8f), new SkillSpec("balance_field", 14f), new SkillSpec("equal_measure", 100f)),
            new HeroKit("vhen", "Vhen", "rooted_growth", 5.125f, 19f, 8.5f, 0.8f, new SkillSpec("seed_turret", 10f), new SkillSpec("irrigation_snare", 14f), new SkillSpec("harvest_engine", 100f)),
            new HeroKit("trudice", "Trudice", "lesson_learned", 5.25f, 19f, 9.5f, 0.8f, new SkillSpec("question_sigil", 10f), new SkillSpec("turning_page", 14f), new SkillSpec("grand_lesson", 100f)),
        };
        public static IReadOnlyList<HeroKit> All {get;}=Array.AsReadOnly(kits);
        public static HeroKit Get(string id){foreach(var kit in kits)if(kit.Id==id)return kit;throw new ArgumentException("Unknown hero ID",nameof(id));}
    }
}
