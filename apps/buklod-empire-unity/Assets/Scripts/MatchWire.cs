using System;
using System.IO;
using System.Text;
using UnityEngine;
namespace Buklod.Empire {
    // Explicit, bounded little-endian wire format. Only client intentions are decoded.
    // Header: version byte, opcode byte. No polymorphic/object deserialization.
    public static partial class MatchWire {
        public const byte Version=1,Hello=1,Input=2,Ping=3,Snapshot=4;
        public const int MaxClientBytes=256,MaxSnapshotBytes=65536;
        static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
        static void Header(BinaryWriter w,byte type){w.Write(Version);w.Write(type);}
        static void Text(BinaryWriter w,string value,int max){
            var data=Utf8.GetBytes(value??"");if(data.Length>max)throw new ArgumentException("Wire text exceeds limit.");
            w.Write((byte)data.Length);w.Write(data);
        }
        static string Text(BinaryReader r,int max){
            int n=r.ReadByte();if(n>max)throw new InvalidDataException("Wire text exceeds limit.");
            var data=r.ReadBytes(n);if(data.Length!=n)throw new EndOfStreamException();return Utf8.GetString(data);
        }
        static void V(BinaryWriter w,Vector2 v){w.Write(v.x);w.Write(v.y);}
        static Vector2 V(BinaryReader r)=>new Vector2(r.ReadSingle(),r.ReadSingle());
        static byte[] Write(Action<BinaryWriter> encode,int max){
            using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream,Utf8,true)){
                encode(writer);writer.Flush();if(stream.Length>max)throw new InvalidDataException("Wire frame exceeds limit.");return stream.ToArray();
            }
        }
        public static byte[] EncodeHello(Guid match,string ticket)=>Write(w=>{Header(w,Hello);w.Write(match.ToByteArray());Text(w,ticket,44);},MaxClientBytes);
        public static byte[] EncodePing()=>new[]{Version,Ping};
        public static byte[] EncodeInput(MatchInput frame){
            if(!frame.Valid())throw new ArgumentException("Invalid match input.");
            return Write(w=>{Header(w,Input);w.Write(frame.Sequence);w.Write(frame.Tick);V(w,frame.Movement);V(w,frame.Aim);w.Write((byte)frame.Action);w.Write(frame.Target);Text(w,frame.Text,128);},MaxClientBytes);
        }
        public static bool TryDecodeClient(byte[] bytes,out byte type,out Guid match,out string ticket,out MatchInput frame){
            type=0;match=Guid.Empty;ticket=null;frame=default;
            if(bytes==null||bytes.Length<2||bytes.Length>MaxClientBytes)return false;
            try{
                using(var stream=new MemoryStream(bytes,false))using(var r=new BinaryReader(stream,Utf8)){
                    if(r.ReadByte()!=Version)return false;type=r.ReadByte();
                    if(type==Hello){var id=r.ReadBytes(16);if(id.Length!=16)return false;match=new Guid(id);ticket=Text(r,44);if(match==Guid.Empty||ticket.Length!=44)return false;}
                    else if(type==Input){long seq=r.ReadInt64();int tick=r.ReadInt32();var move=V(r);var aim=V(r);var action=(MatchAction)r.ReadByte();int target=r.ReadInt32();string text=Text(r,128);frame=new MatchInput(seq,tick,move,action,aim,target,text.Length==0?null:text);if(!frame.Valid())return false;}
                    else if(type!=Ping)return false;
                    return stream.Position==stream.Length;
                }
            }catch(IOException){return false;}catch(ArgumentException){return false;}
        }
        public static byte[] EncodeSnapshot(MatchSnapshot s){
            if(s==null)throw new ArgumentNullException(nameof(s));
            return Write(w=>{
                Header(w,Snapshot);w.Write(s.Tick);w.Write(s.OwnUnitId);w.Write((byte)s.Team);w.Write(s.IsRtsController);w.Write(s.AcceptedSequence);w.Write(s.AppliedSequence);w.Write(s.LastActionSucceeded);
                w.Write(s.Finished);w.Write(s.Winner.HasValue?(byte)s.Winner.Value:(byte)255);Text(w,s.EndReason,64);
                w.Write(s.Gold);w.Write(s.Mana);w.Write(s.MaxMana);w.Write(s.Xp);w.Write(s.PopulationUsed);w.Write(s.PopulationCapacity);
                foreach(var x in s.TeamBalances)w.Write(x);foreach(var x in s.SkillRemaining)w.Write(x);w.Write(s.TacticRemaining);
                w.Write((ushort)s.Gear.Count);foreach(var x in s.Gear)Text(w,x,128);
                w.Write((ushort)s.Relics.Count);foreach(var x in s.Relics)Text(w,x,128);
                w.Write((ushort)s.Units.Count);foreach(var u in s.Units){
                    w.Write(u.Id);w.Write((byte)u.Team);w.Write((byte)u.Kind);w.Write((byte)u.Role);w.Write(u.Level);V(w,u.Position);w.Write(u.Health);w.Write(u.MaxHealth);
                    ushort flags=(ushort)((u.Alive?1:0)|(u.Core?2:0)|(u.Temporary?4:0)|(u.Depot?8:0)|(u.GuardPost?16:0)|(u.Farm?32:0)|(u.Barracks?64:0)|(u.Market?128:0)|(u.House?256:0));
                    w.Write(flags);Text(w,u.Hero,64);Text(w,u.VillagerVisual,64);Text(w,u.WorkerId,64);
                }
                w.Write((ushort)s.Camps.Count);foreach(var c in s.Camps){w.Write(c.Id);w.Write((byte)c.Kind);V(w,c.Position);w.Write(c.Health);w.Write(c.MaxHealth);w.Write(c.Alive);w.Write(c.Boss);}
                w.Write((ushort)s.Resources.Count);foreach(var n in s.Resources){w.Write(n.Id);w.Write(n.StructureId);w.Write((byte)n.Team);w.Write((byte)n.Kind);V(w,n.Position);w.Write(n.Stock);w.Write(n.Capacity);w.Write(n.CaptureProgress);}
                w.Write((ushort)s.Drops.Count);foreach(var d in s.Drops){w.Write(d.Id);Text(w,d.Item,128);V(w,d.Position);w.Write(d.SpawnedAt);w.Write(d.Relic);}
            },MaxSnapshotBytes);
        }
    }
}
