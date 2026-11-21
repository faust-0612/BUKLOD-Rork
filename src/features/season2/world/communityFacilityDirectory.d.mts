export type CommunityWorld='village'|'home';
export type CommunityFacilityZone=Readonly<{id:string;world:CommunityWorld;title:string;icon:string}>;
export type CommunityFacility=Readonly<{id:string;world:CommunityWorld;zone:string;label:string;route:string|null;description:string;status:'linked'|'planned';faithOnly:boolean;searchText:string}>;
export const COMMUNITY_FACILITY_ZONES:readonly CommunityFacilityZone[];
export function getCommunityZones(world:CommunityWorld,showFaith?:boolean):readonly CommunityFacilityZone[];
export function listCommunityFacilities(args?:{world:CommunityWorld;zone?:string;query?:string;showFaith?:boolean}):readonly CommunityFacility[];
export function communityFacilitySummary(world:CommunityWorld,showFaith?:boolean):Readonly<{total:number;linked:number;planned:number}>;
