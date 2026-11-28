using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ReviewAudioSettingsTests {
        [TestCase(-1f,0f)]
        [TestCase(0f,0f)]
        [TestCase(.4f,.4f)]
        [TestCase(1f,1f)]
        [TestCase(2f,1f)]
        public void GainIsBounded(float input,float expected){Assert.AreEqual(expected,ReviewAudioSettings.Sanitize(input));}
        [TestCase(2,"level-up-magic-harp")]
        [TestCase(3,"level-up-bells")]
        [TestCase(4,"level-up-synth")]
        [TestCase(5,"level-up-epic-brass")]
        [TestCase(6,"level-up-synth")]
        [TestCase(10,"level-up-epic-brass")]
        public void LevelUpVariantMatchesProgression(int level,string expected){Assert.AreEqual(expected,ArenaReviewFoley.LevelUpVariant(level));}
        [TestCase("health","heal-restore")]
        [TestCase("mana","gem-sparkle")]
        [TestCase("xp","xp-gain")]
        [TestCase("gold","coin-shower")]
        [TestCase("shield","power-up-charge")]
        [TestCase("cooldown","power-up-charge")]
        [TestCase("haste","power-up-charge")]
        [TestCase("fury","power-up-charge")]
        [TestCase("guard","power-up-charge")]
        [TestCase("regen","power-up-charge")]
        [TestCase("wood","item-get")]
        [TestCase("stone","item-get")]
        [TestCase(null,"item-get")]
        public void AcceptedPickupSoundMatchesEffect(string effect,string expected){Assert.AreEqual(expected,ArenaReviewFoley.PickupSound(effect));}
        [Test] public void InvalidGainRecoversDefault(){Assert.AreEqual(1f,ReviewAudioSettings.Sanitize(float.NaN));Assert.AreEqual(1f,ReviewAudioSettings.Sanitize(float.PositiveInfinity));}
    }
}
