namespace RoostMX.Sim
{
    /// <summary>One frame of rider commands, already merged from touch / gamepad / keyboard.</summary>
    public struct BikeInput
    {
        public float Throttle;      // 0..1
        public float FrontBrake;    // 0..1
        public float RearBrake;     // 0..1
        public float Clutch;        // 0..1 lever pulled in (ignored with auto clutch)
        public float Steer;         // -1..1 desired lean / turn direction
        public float RiderLean;     // -1..1 rider body left/right
        public float RiderForeAft;  // -1..1 rider body back/forward
        public bool Stand;          // held/toggled standing state
        public bool ShiftUp, ShiftDown; // edges
    }

    public sealed class Assists
    {
        public bool AutoClutch = true;
        public bool AutoGearbox = true;
        public bool BalanceAssist = true;   // rider keeps the bike up at walking pace
        public bool SteeringAssist = true;  // the virtual rider turns lean requests into bar input
        public bool BrakeAssist = true;     // eases the front brake when the rear lifts (stoppie)
        public bool WheelieAssist = true;   // eases the throttle when the front climbs too high
    }
}
