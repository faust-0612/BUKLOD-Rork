using UnityEngine;
namespace Buklod.Empire {
    // Local onboarding only; observes real simulation outcomes, never grants rewards.
    public sealed class ReviewPracticeGuide {
        const string Preference="buklod.empire.review.guide.v1";
        public static bool Enabled=>PlayerPrefs.GetInt(Preference,1)==1;
        public static void SetEnabled(bool enabled){PlayerPrefs.SetInt(Preference,enabled?1:0);PlayerPrefs.Save();}
        public int Step {get;private set;}
        Vector2 previous;
        float distance,lastAttack;
        int lastCast;
        public ReviewPracticeGuide(Vector2 position,float attack,int cast){previous=position;lastAttack=attack;lastCast=cast;}
        public void Observe(Vector2 position,bool moving,float attack,int cast){
            if(Step>=3)return;
            if(Step==0&&moving){
                // Ignore teleports and respawn jumps rather than count as walking.
                float delta=Vector2.Distance(previous,position);
                if(delta<=2f)distance+=delta;
                if(distance>=3f)Step=1;
            }else if(Step==1&&attack>lastAttack)Step=2;
            else if(Step==2&&cast>lastCast)Step=3;
            previous=position;lastAttack=attack;lastCast=cast;
        }
        public string Hint=>Step==0?"1/3  •  Move with the left joystick."
            :Step==1?"2/3  •  Approach a visible enemy or creature, then land an attack."
            :Step==2?"3/3  •  Tap or aim an available skill and release."
            :"Controls learned. Support villagers, gather equipment, breach a tower and destroy the fortress. Eliminate remaining enemies.";
    }
}
