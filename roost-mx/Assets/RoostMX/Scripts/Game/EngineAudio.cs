using UnityEngine;

namespace RoostMX.Game
{
    /// <summary>
    /// Stage 1 procedural audio: a single-cylinder four-stroke synthesised from the simulated
    /// engine (one combustion pulse every two crank revolutions, so the rhythm IS the rpm;
    /// pulses drop out when the rev limiter cuts; brighter and louder with throttle; pops on
    /// the overrun), plus tyre-on-dirt noise from slip and load, wind, and suspension thumps.
    /// Stage 6 layers recorded RPM samples on top of this.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public sealed class EngineAudio : MonoBehaviour
    {
        public BikeController Bike;
        public float Volume = 0.8f;

        // values copied from the simulation on the main thread, read on the audio thread
        volatile float rpm, throttle, load, speed, slip, wind;
        volatile bool cut;
        volatile float thump;
        bool big;
        int sampleRate;
        System.Random rng = new System.Random(1);

        double phase;
        float env, toneT, lp1, lp2, bp1, bp2, noiseLp, windLp, popEnv, thumpEnv;

        void Start()
        {
            sampleRate = AudioSettings.outputSampleRate;
            var src = GetComponent<AudioSource>();
            src.clip = null; src.loop = true; src.playOnAwake = true; src.spatialBlend = 0f;
            src.Play();
        }

        void Update()
        {
            if (Bike == null || Bike.Sim == null) return;
            var s = Bike.Sim;
            big = s.Spec.Name == "450F";
            rpm = s.Engine.Rpm;
            throttle = s.Engine.ThrottleActual;
            load = Mathf.Clamp01(s.Engine.LastTorque / 40f);
            cut = s.Engine.LimiterCut || s.Gearbox.Shifting || s.Engine.Stalled;
            speed = Mathf.Abs(s.Speed);
            float sl = 0f;
            if (s.Rear.InContact) sl += Mathf.Abs(s.Rear.SlipRatio) * 2f + Mathf.Abs(s.Rear.TanSlipAngle) * 2f;
            if (s.Front.InContact) sl += Mathf.Abs(s.Front.TanSlipAngle) * 1.5f;
            slip = Mathf.Clamp01(sl) * (s.Airborne ? 0f : 1f);
            wind = Mathf.Clamp01(speed / 30f);
            if (s.LandingImpact > 0.5f) { thump = Mathf.Clamp01(s.LandingImpact / 5f); s.LandingImpact = 0f; }
        }

        float Noise() => (float)(rng.NextDouble() * 2.0 - 1.0);

        void OnAudioFilterRead(float[] data, int channels)
        {
            if (sampleRate == 0) return;
            float dt = 1f / sampleRate;
            float fire = Mathf.Max(5f, rpm / 120f);                  // pulses per second
            float tau = big ? 0.0065f : 0.0045f;                      // pulse decay
            float res = big ? 115f + rpm * 0.012f : 170f + rpm * 0.013f; // exhaust resonance
            float bright = Mathf.Lerp(0.15f, 0.7f, throttle);
            float amp = Mathf.Lerp(0.35f, 1f, throttle * 0.7f + load * 0.3f) * Volume;
            float bpF = 2f * Mathf.Sin(Mathf.PI * Mathf.Min(res * 2.2f, 4000f) * dt);
            float lpK = 1f - Mathf.Exp(-2f * Mathf.PI * Mathf.Lerp(700f, 3800f, bright) * dt);
            float noiseK = 1f - Mathf.Exp(-2f * Mathf.PI * (300f + speed * 60f) * dt);
            float windK = 1f - Mathf.Exp(-2f * Mathf.PI * 500f * dt);
            if (thump > 0f) { thumpEnv = Mathf.Max(thumpEnv, thump); thump = 0f; }

            for (int i = 0; i < data.Length; i += channels)
            {
                phase += fire * dt;
                if (phase >= 1.0)
                {
                    phase -= 1.0;
                    if (!cut) { env = 1f; toneT = 0f; }
                    else if (rpm > 3000f && rng.NextDouble() < 0.25) popEnv = 1f; // unburnt mixture popping
                    // overrun crackle with the throttle shut at high rpm
                    if (throttle < 0.08f && rpm > 5000f && rng.NextDouble() < 0.06) popEnv = 0.7f;
                }
                toneT += dt;
                env *= Mathf.Exp(-dt / tau);
                popEnv *= Mathf.Exp(-dt / 0.012f);
                thumpEnv *= Mathf.Exp(-dt / 0.09f);

                // combustion pulse: resonant ring + a burst of noise, then exhaust filtering
                float pulse = env * (Mathf.Sin(2f * Mathf.PI * res * toneT) * 0.9f + Noise() * bright * 0.8f);
                pulse += popEnv * Noise() * 0.9f;
                // a little crank/valve-train hash under everything
                pulse += Noise() * 0.015f * Mathf.Clamp01(rpm / 8000f);
                lp1 += (pulse - lp1) * lpK;
                lp2 += (lp1 - lp2) * lpK;
                // state-variable bandpass for the pipe's honk
                float hp = lp2 - bp1 * 0.5f - bp2;
                bp1 += bpF * hp; bp2 += bpF * bp1;
                float engine = (lp2 * 0.8f + bp1 * 0.35f) * amp;

                // tyres on dirt and air rushing past
                noiseLp += (Noise() - noiseLp) * noiseK;
                float tyre = noiseLp * slip * 0.35f + noiseLp * Mathf.Clamp01(speed / 25f) * 0.04f;
                windLp += (Noise() - windLp) * windK;
                float air = windLp * wind * wind * 0.25f;
                float hit = thumpEnv * Mathf.Sin(2f * Mathf.PI * 55f * thumpEnv) * 0.8f;

                float s = Mathf.Clamp(engine + tyre + air + hit, -1f, 1f);
                for (int c = 0; c < channels; c++) data[i + c] = s;
            }
        }
    }
}
