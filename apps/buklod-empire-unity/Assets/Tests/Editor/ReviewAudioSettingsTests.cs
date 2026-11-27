using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ReviewAudioSettingsTests {
        [TestCase(-1f,0f)]
        [TestCase(0f,0f)]
        [TestCase(.4f,.4f)]
        [TestCase(1f,1f)]
        [TestCase(2f,1f)]
        public void GainIsBounded(float input,float expected){Assert.AreEqual(expected,ReviewAudioSettings.Sanitize(input));}
        [Test] public void InvalidGainRecoversDefault(){Assert.AreEqual(1f,ReviewAudioSettings.Sanitize(float.NaN));Assert.AreEqual(1f,ReviewAudioSettings.Sanitize(float.PositiveInfinity));}
    }
}
