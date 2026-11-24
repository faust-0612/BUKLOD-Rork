using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
namespace Buklod.Empire {
    public sealed class OnlineUnit {
        public int Id{get;internal set;} public int Level{get;internal set;}
        public ArenaTeam Team{get;internal set;} public BattleTargetKind Kind{get;internal set;}
        public MinionRole Role{get;internal set;} public Vector2 Position{get;internal set;}
        public float Health{get;internal set;} public float MaxHealth{get;internal set;}
        public ushort Flags{get;internal set;} public bool Alive=>(Flags&1)!=0;
        public string Hero{get;internal set;} public string VillagerVisual{get;internal set;} public string WorkerId{get;internal set;}
    }
    public sealed class OnlineCamp {
        public int Id{get;internal set;} public WildernessKind Kind{get;internal set;} public Vector2 Position{get;internal set;}
        public float Health{get;internal set;} public float MaxHealth{get;internal set;}
        public bool Alive{get;internal set;} public bool Boss{get;internal set;}
    }
    public sealed class OnlineResource {
        public int Id{get;internal set;} public int StructureId{get;internal set;}
        public ArenaTeam Team{get;internal set;} public VillageResourceKind Kind{get;internal set;}
        public Vector2 Position{get;internal set;} public double Stock{get;internal set;} public double Capacity{get;internal set;}
        public float CaptureProgress{get;internal set;}
    }
    public sealed class OnlineDrop {
        public int Id{get;internal set;} public string Item{get;internal set;} public Vector2 Position{get;internal set;}
        public float SpawnedAt{get;internal set;} public bool Relic{get;internal set;}
    }
    // Read-only outside the shared runtime assembly. Never constructs simulation actors.
    public sealed class OnlineSnapshot {
        public int Tick{get;internal set;} public int OwnUnitId{get;internal set;} public ArenaTeam Team{get;internal set;}
        public bool IsRtsController{get;internal set;} public long AcceptedSequence{get;internal set;} public long AppliedSequence{get;internal set;}
        public bool LastActionSucceeded{get;internal set;} public bool Finished{get;internal set;} public ArenaTeam? Winner{get;internal set;}
        public string EndReason{get;internal set;} public int Gold{get;internal set;} public float Mana{get;internal set;}
        public float MaxMana{get;internal set;} public float Xp{get;internal set;} public int PopulationUsed{get;internal set;}
        public int PopulationCapacity{get;internal set;} public float TacticRemaining{get;internal set;}
        public IReadOnlyList<double> TeamBalances{get;internal set;} public IReadOnlyList<float> SkillRemaining{get;internal set;}
        public IReadOnlyList<string> Gear{get;internal set;} public IReadOnlyList<string> Relics{get;internal set;}
        public IReadOnlyList<OnlineUnit> Units{get;internal set;} public IReadOnlyList<OnlineCamp> Camps{get;internal set;}
        public IReadOnlyList<OnlineResource> Resources{get;internal set;} public IReadOnlyList<OnlineDrop> Drops{get;internal set;}
    }
    public static partial class MatchWire {
        static void Need(bool ok){if(!ok)throw new InvalidDataException("Invalid snapshot field.");}
        static bool Flag(BinaryReader r){byte b=r.ReadByte();Need(b<=1);return b!=0;}
        static T EnumByte<T>(BinaryReader r) where T:struct {
            var value=(T)Enum.ToObject(typeof(T),r.ReadByte());Need(Enum.IsDefined(typeof(T),value));return value;
        }
        static int Nonnegative(BinaryReader r){int x=r.ReadInt32();Need(x>=0);return x;}
        static int Positive(BinaryReader r){int x=r.ReadInt32();Need(x>0);return x;}
        static float Scalar(BinaryReader r){float x=r.ReadSingle();Need(!float.IsNaN(x)&&!float.IsInfinity(x)&&x>=0);return x;}
        static double Amount(BinaryReader r){double x=r.ReadDouble();Need(!double.IsNaN(x)&&!double.IsInfinity(x)&&x>=0);return x;}
        static Vector2 Position(BinaryReader r){var p=V(r);Need(p.x>=0&&p.x<=OfflineBattle.Width&&p.y>=0&&p.y<=OfflineBattle.Height);return p;}
        static IReadOnlyList<T> Rows<T>(BinaryReader r,int limit,Func<T> read){
            int n=r.ReadUInt16();Need(n<=limit);var rows=new T[n];for(int i=0;i<n;i++)rows[i]=read();return Array.AsReadOnly(rows);
        }
        static IReadOnlyList<string> Names(BinaryReader r,int limit){
            var ids=new HashSet<string>(StringComparer.Ordinal);return Rows(r,limit,()=>{var id=Text(r,128);Need(id.Length>0&&ids.Add(id));return id;});
        }
        public static bool TryDecodeSnapshot(byte[] bytes,out OnlineSnapshot snapshot){
            snapshot=null;if(bytes==null||bytes.Length<2||bytes.Length>MaxSnapshotBytes)return false;
            try{
                using(var stream=new MemoryStream(bytes,false))using(var r=new BinaryReader(stream,Utf8)){
                    if(r.ReadByte()!=Version||r.ReadByte()!=Snapshot)return false;
                    var s=new OnlineSnapshot{Tick=Nonnegative(r),OwnUnitId=Positive(r),Team=EnumByte<ArenaTeam>(r),IsRtsController=Flag(r),
                        AcceptedSequence=r.ReadInt64(),AppliedSequence=r.ReadInt64(),LastActionSucceeded=Flag(r),Finished=Flag(r)};
                    Need(s.AcceptedSequence>=0&&s.AppliedSequence>=0&&s.AppliedSequence<=s.AcceptedSequence);
                    byte winner=r.ReadByte();Need(winner==255||winner<=1&&s.Finished);
                    s.Winner=winner==255?(ArenaTeam?)null:(ArenaTeam)winner;s.EndReason=Text(r,64);
                    s.Gold=Nonnegative(r);s.Mana=Scalar(r);s.MaxMana=Scalar(r);s.Xp=Scalar(r);s.PopulationUsed=Nonnegative(r);s.PopulationCapacity=Nonnegative(r);
                    var balances=new double[5];for(int i=0;i<5;i++)balances[i]=Amount(r);s.TeamBalances=Array.AsReadOnly(balances);
                    var cooldowns=new float[3];for(int i=0;i<3;i++)cooldowns[i]=Scalar(r);s.SkillRemaining=Array.AsReadOnly(cooldowns);s.TacticRemaining=Scalar(r);
                    s.Gear=Names(r,6);s.Relics=Names(r,16);
                    var ids=new HashSet<int>();bool own=false;
                    s.Units=Rows(r,512,()=>{
                        var u=new OnlineUnit{Id=Positive(r),Team=EnumByte<ArenaTeam>(r),Kind=EnumByte<BattleTargetKind>(r),Role=EnumByte<MinionRole>(r),
                            Level=Nonnegative(r),Position=Position(r),Health=Scalar(r),MaxHealth=Scalar(r),Flags=r.ReadUInt16(),Hero=Text(r,64),VillagerVisual=Text(r,64),WorkerId=Text(r,64)};
                        Need(ids.Add(u.Id)&&u.Level<=15&&u.MaxHealth>0&&u.Health<=u.MaxHealth+.01f&&(u.Flags&~511)==0&&u.Alive==(u.Health>0));
                        if(u.Kind==BattleTargetKind.Hero)Need(ArenaDraftRules.Known(u.Hero));else Need(u.Hero.Length==0);
                        if(u.Id==s.OwnUnitId){Need(u.Team==s.Team&&u.Kind==BattleTargetKind.Hero);own=true;}
                        return u;
                    });
                    Need(own);
                    ids.Clear();s.Camps=Rows(r,32,()=>{
                        var c=new OnlineCamp{Id=Positive(r),Kind=EnumByte<WildernessKind>(r),Position=Position(r),Health=Scalar(r),MaxHealth=Scalar(r),Alive=Flag(r),Boss=Flag(r)};
                        Need(ids.Add(c.Id)&&c.MaxHealth>0&&c.Health<=c.MaxHealth+.01f);return c;
                    });
                    ids.Clear();s.Resources=Rows(r,64,()=>{
                        var n=new OnlineResource{Id=Positive(r),StructureId=Nonnegative(r),Team=EnumByte<ArenaTeam>(r),Kind=EnumByte<VillageResourceKind>(r),
                            Position=Position(r),Stock=Amount(r),Capacity=Amount(r),CaptureProgress=Scalar(r)};
                        Need(ids.Add(n.Id)&&n.Capacity>0&&n.Stock<=n.Capacity+.001);return n;
                    });
                    var dropIds=new HashSet<long>();s.Drops=Rows(r,64,()=>{
                        var d=new OnlineDrop{Id=Positive(r),Item=Text(r,128),Position=Position(r),SpawnedAt=Scalar(r),Relic=Flag(r)};
                        Need(d.Item.Length>0&&dropIds.Add(((long)d.Id<<1)|(d.Relic?1L:0L)));return d;
                    });
                    Need(stream.Position==stream.Length);snapshot=s;return true;
                }
            }catch(IOException){return false;}catch(ArgumentException){return false;}
        }
    }
    // Main-thread timeline. A missing entity is removed immediately; interpolation cannot
    // continue tracking a hidden opponent. Never predicts combat or awards local rewards.
    public sealed class OnlineTimeline {
        readonly Dictionary<int,OnlineUnit> visible=new Dictionary<int,OnlineUnit>();
        readonly Dictionary<int,Vector2> previous=new Dictionary<int,Vector2>();
        public OnlineSnapshot Current{get;private set;}
        public bool Connected{get;private set;}
        public void Disconnect(){Connected=false;visible.Clear();previous.Clear();}
        public bool Accept(OnlineSnapshot s){
            if(s==null||Current!=null&&(s.OwnUnitId!=Current.OwnUnitId||s.Team!=Current.Team||s.Tick<Current.Tick||
                s.AcceptedSequence<Current.AcceptedSequence||s.AppliedSequence<Current.AppliedSequence||Current.Finished&&!s.Finished))return false;
            if(Connected&&Current!=null&&s.Tick==Current.Tick)return false;
            previous.Clear();foreach(var u in s.Units)if(Connected&&visible.TryGetValue(u.Id,out var old)&&old.Alive&&u.Alive)previous.Add(u.Id,old.Position);
            visible.Clear();foreach(var u in s.Units)if(u.Alive)visible.Add(u.Id,u);
            Current=s;Connected=true;return true;
        }
        public bool TryPosition(int id,float fraction,out Vector2 position){
            position=default;if(!Connected||!visible.TryGetValue(id,out var unit))return false;
            position=unit.Position;
            if(previous.TryGetValue(id,out var from)&&Vector2.Distance(from,position)<=8)position=Vector2.Lerp(from,position,Mathf.Clamp01(fraction));
            return true;
        }
    }
}
