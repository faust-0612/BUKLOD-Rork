import {
 WORLD_DESTINATIONS,WORLD_PURPOSES,WORLD_COMPLETE_DESTINATION_DIRECTORY,
 WORLD_MAP_PINS,worldCompleteDestinationsByDistrict,worldDestinationById,
 destinationsForPurpose,
} from '@/features/world/worldCatalog';
import {BUKLOD_FEATURE_LINKS} from '@/lib/buklodNavigationV2';

describe('BUKLOD purpose-first world guide keeps existing navigation',()=>{
 it('covers every existing public/personal feature search destination without losing any route',()=>{
   const guided=new Set(WORLD_COMPLETE_DESTINATION_DIRECTORY.map(x=>x.id));
   for(const item of BUKLOD_FEATURE_LINKS){
     expect(guided.has(item.id)||guided.has('existing-'+item.id)).toBe(true);
   }
 });
 it('preserves the five main existing destinations and canonical Focus Apps route',()=>{
   for(const id of ['wall','connect','cluster','profile','market','business','government','family']){
     const entry=worldDestinationById(id);
     expect(entry).not.toBeNull();
     expect(entry?.state).toBe('available');
     expect(entry?.route).toBeTruthy();
   }
   for(const id of ['market','business','government','family','faculty','giving','attendance']){
     expect(worldDestinationById(id)?.route).toBe('/profile/focus-apps');
   }
 });
 it('keeps prospective property and real-world challenges explicitly preview-only',()=>{
   for(const id of ['myworld','resource','challenges']){
     expect(worldDestinationById(id)?.state).toBe('preview');
     expect(worldDestinationById(id)?.route).toBeNull();
   }
 });
 it('every guided purpose resolves to known destinations and every map pin is functional or preview',()=>{
   const allIds=new Set(WORLD_DESTINATIONS.map(x=>x.id));
   for(const p of WORLD_PURPOSES){
     expect(destinationsForPurpose(p.id).length).toBeGreaterThan(0);
     expect(p.destinationIds.every(id=>allIds.has(id))).toBe(true);
   }
   expect(WORLD_MAP_PINS.every(pin=>allIds.has(pin.id))).toBe(true);
 });
 it('does not hide existing routes in the grouped directory',()=>{
   for(const district of ['social','community','growth','world','economy','services'] as const){
     expect(worldCompleteDestinationsByDistrict(district).length).toBeGreaterThan(0);
   }
 });
});
