/** BUKLOD Season 2 community coverage catalog.
 * Every linked item points to an EXISTING route, not a newly invented service.
 * Planned items are explicitly unlaunchable and carry no financial or property state.
 * Public metadata only: never place private member or location data here.
 */
const ZONES = Object.freeze([
  {
    "id": "village-square",
    "world": "village",
    "title": "Community Square & Social Life",
    "icon": "account-group-outline",
    "facilities": [
      [
        "public-wall",
        "Community Plaza / Wall",
        "/buklod",
        "Public discussions, posts and community announcements"
      ],
      [
        "scope-wall",
        "Neighborhood and Scope Wall",
        "/clusters",
        "Membership-scoped community publishing and conversations"
      ],
      [
        "community-reels",
        "Public Performances / Reels",
        "/reels",
        "Videos and community performances"
      ],
      [
        "community-connect",
        "Community Communication Center",
        "/messages",
        "Chats, calls, notes and messaging"
      ],
      [
        "community-discovery",
        "Neighbors and Community Discovery",
        "/community/discover",
        "Find eligible communities without exposing private member locations"
      ],
      [
        "community-events",
        "Events and Invitations",
        "/clusters",
        "Find member-hosted community activities"
      ],
      [
        "community-festivals",
        "Town Festivals",
        null,
        "Seasonal cultural gatherings and celebrations"
      ],
      [
        "community-heritage",
        "Museum and Local Heritage",
        null,
        "Curated community history and heritage exhibits"
      ],
      [
        "community-art",
        "Art Gallery",
        null,
        "Community artworks and exhibitions"
      ]
    ]
  },
  {
    "id": "civic-governance",
    "world": "village",
    "title": "Civic Hall & Governance",
    "icon": "bank-outline",
    "facilities": [
      [
        "community-cluster",
        "My Cluster",
        "/clusters",
        "Existing verified Cluster membership and leadership"
      ],
      [
        "community-organizations",
        "Organizations and Sub-organizations",
        "/organizations",
        "Organization and Sub-organization workspaces"
      ],
      [
        "agency-focus-app",
        "Government Focus App",
        "/profile/focus-apps",
        "Permissioned government-related communications and services"
      ],
      [
        "official-announcements",
        "Authorized Public Notices",
        "/buklod",
        "Official publishing retains existing Wall scope guards"
      ],
      [
        "community-council",
        "Community Council",
        "/clusters",
        "Scope leadership and member participation"
      ],
      [
        "village-elections",
        "Virtual Community Elections",
        null,
        "Audited virtual ballots separate from public civil elections"
      ],
      [
        "village-petitions",
        "Petitions and Consultations",
        null,
        "Moderated proposals and community consultations"
      ],
      [
        "public-records",
        "Meeting Minutes and Public Records",
        null,
        "Permissioned community documents and transparent notices"
      ],
      [
        "civic-disputes",
        "Mediation and Appeals",
        null,
        "Private, consent-based community dispute resolution"
      ],
      [
        "public-project-dashboard",
        "Project Transparency Dashboard",
        null,
        "Audited public milestones and community treasury receipts"
      ]
    ]
  },
  {
    "id": "residential",
    "world": "village",
    "title": "Residences & Community Land",
    "icon": "home-city-outline",
    "facilities": [
      [
        "housing-family",
        "Family and Household Workspace",
        "/profile/buklod-family",
        "Family invitations, roles and shared-household functions"
      ],
      [
        "housing-personal",
        "Personal Lot and House",
        "/season2/my-world",
        "Independent personal construction preview and family home access"
      ],
      [
        "housing-compounds",
        "Shared Compounds and Subdivisions",
        "/profile/buklod-family",
        "Existing household-community membership and gardens"
      ],
      [
        "housing-upgrade",
        "Community Development Planning",
        "/points/progression",
        "Existing progression view and verified achievement requirements"
      ],
      [
        "housing-land-registry",
        "Virtual Parcel Registry",
        null,
        "Server-verified non-overlapping virtual parcels and titles"
      ],
      [
        "housing-coowners",
        "Shared Property Ownership",
        null,
        "Audited co-owner shares, guest roles and editor permissions"
      ],
      [
        "housing-apartments",
        "Shared Apartments",
        null,
        "Private spaces and permissioned occupancy"
      ],
      [
        "housing-public-lots",
        "Community Land Reserves",
        null,
        "Public and protected virtual land management"
      ],
      [
        "housing-community-buildings",
        "Shared Village Buildings",
        null,
        "Authorized treasury-funded facilities with staged construction"
      ],
      [
        "housing-construction",
        "Construction Yards",
        null,
        "Approved blueprints, materials and visible work stages"
      ],
      [
        "housing-maintenance",
        "Village Repair and Maintenance",
        null,
        "Scheduled repairs with verified stewardship"
      ]
    ]
  },
  {
    "id": "infrastructure",
    "world": "village",
    "title": "Infrastructure & Utilities",
    "icon": "road-variant",
    "facilities": [
      [
        "roads",
        "Roads and Footpaths",
        null,
        "Progressive roads, paths and accessibility routes"
      ],
      [
        "bridges",
        "Bridges",
        null,
        "Community bridge construction and repair"
      ],
      [
        "streetlights",
        "Street Lighting",
        null,
        "Visible lighting and safe public pathways"
      ],
      [
        "water",
        "Water Infrastructure",
        null,
        "Public water coordination and virtual construction"
      ],
      [
        "electricity",
        "Power Infrastructure",
        null,
        "Community utility development and maintenance"
      ],
      [
        "communications",
        "Digital Communications",
        "/messages",
        "Real communications use existing Connect systems"
      ],
      [
        "public-transport",
        "Transport Information",
        null,
        "Official transport schedules and service links"
      ],
      [
        "garage",
        "Community Parking and Garage",
        null,
        "Vehicle and parking facilities"
      ],
      [
        "drainage",
        "Drainage and Flood Control",
        null,
        "Community resilience projects"
      ],
      [
        "waste",
        "Waste Collection and Recycling",
        null,
        "Environmental service coordination"
      ],
      [
        "public-restrooms",
        "Public Sanitation Facilities",
        null,
        "Shared sanitation infrastructure"
      ],
      [
        "public-maintenance",
        "Public Works Requests",
        null,
        "Repair reporting and responsible project assignment"
      ]
    ]
  },
  {
    "id": "commerce",
    "world": "village",
    "title": "Market, Livelihood & Production",
    "icon": "storefront-outline",
    "facilities": [
      [
        "market",
        "Marketplace / Palengke",
        "/profile/buklod-market",
        "Existing market entry and canonical trade permissions"
      ],
      [
        "business",
        "Personal Business",
        "/profile/buklod-business",
        "Existing business workspace"
      ],
      [
        "economic-guide",
        "Earned BP and Economy Guide",
        "/points/economy",
        "Explains existing BP, QMP and transfer boundaries"
      ],
      [
        "construction-supply",
        "Construction Material Store",
        null,
        "Validated SKUs, stock and unit pricing"
      ],
      [
        "sari-sari",
        "Sari-sari Store",
        null,
        "Member-managed virtual retail shops"
      ],
      [
        "food-shops",
        "Restaurants and Food Shops",
        null,
        "Food stalls and community sellers"
      ],
      [
        "craft-workshop",
        "Crafting and Workshops",
        null,
        "Audited recipes, crafting and item production"
      ],
      [
        "farm-shop",
        "Farm Produce Market",
        null,
        "Harvest delivery and trade inventory"
      ],
      [
        "employment",
        "Jobs and Local Opportunities",
        null,
        "Permissioned job discovery and referrals"
      ],
      [
        "skills",
        "Skilled Workers Directory",
        null,
        "Verified skills and opt-in contact"
      ],
      [
        "cooperative",
        "Cooperative Enterprises",
        null,
        "Shared business decision and financial permissions"
      ],
      [
        "logistics",
        "Trade Delivery and Logistics",
        null,
        "Proof of inventory fulfillment and delivery"
      ]
    ]
  },
  {
    "id": "learning-culture",
    "world": "village",
    "title": "Learning, Faith & Culture",
    "icon": "school-outline",
    "facilities": [
      [
        "learning",
        "Learning Center",
        "/learn",
        "Existing learning opportunities and study materials"
      ],
      [
        "classroom",
        "Schools and Classrooms",
        "/profile/focus-apps",
        "Existing education Focus App and role-based classroom access"
      ],
      [
        "children",
        "Children's Stories",
        "/children-stories",
        "Safe stories and learning for children"
      ],
      [
        "mentors",
        "Mentoring",
        "/mentor",
        "Existing mentorship entry and verification"
      ],
      [
        "library",
        "Community Library",
        "/learn",
        "Reading and learning resources"
      ],
      [
        "workshops",
        "Seminars and Workshops",
        "/learn",
        "Learning destination for skills and training"
      ],
      [
        "faith",
        "Church and Ministry",
        "/church",
        "Faith-related community access",
        true
      ],
      [
        "prayer",
        "Prayer Groups",
        "/prayer",
        "Optional faith support and prayer",
        true
      ],
      [
        "theater",
        "Community Theater",
        null,
        "Performances, festivals and cultural programming"
      ],
      [
        "sports",
        "Sports Center",
        null,
        "Recreation and community sporting events"
      ],
      [
        "certificates",
        "Verified Learning Certificates",
        null,
        "Auditable completion certificates for learning"
      ]
    ]
  },
  {
    "id": "health-welfare",
    "world": "village",
    "title": "Health, Welfare & Care",
    "icon": "heart-pulse",
    "facilities": [
      [
        "health-center",
        "Health Center",
        "/profile/buklod-health",
        "Existing health destination and governed service boundaries"
      ],
      [
        "health-professionals",
        "Healthcare Professional Directory",
        null,
        "Verified professionals and safe referrals"
      ],
      [
        "hospitals",
        "Hospital Referrals",
        null,
        "Official hospital directory and referral links"
      ],
      [
        "pharmacy",
        "Pharmacy and Medicine Information",
        null,
        "Trusted information and appropriate referrals"
      ],
      [
        "mental-wellness",
        "Mental Wellness",
        null,
        "Support resources and professional referral"
      ],
      [
        "maternal-health",
        "Maternal and Child Care",
        null,
        "Restricted and privacy-protective family health resources"
      ],
      [
        "senior-care",
        "Senior Citizen Support",
        null,
        "Accessible resources and consent-based care coordination"
      ],
      [
        "disability",
        "Disability and Accessibility Services",
        null,
        "Inclusive participation and local service directory"
      ],
      [
        "nutrition",
        "Nutrition and Healthy Living",
        null,
        "Health education and well-being activities"
      ],
      [
        "health-drives",
        "Community Health Drives",
        null,
        "Verified vaccination and blood-donation notices"
      ],
      [
        "welfare-help",
        "Emergency Community Assistance",
        "/bayanihan",
        "Existing Bayanihan assistance and scope permissions"
      ]
    ]
  },
  {
    "id": "safety",
    "world": "village",
    "title": "Safety, Emergency & Protection",
    "icon": "shield-alert-outline",
    "facilities": [
      [
        "support",
        "Community Help Desk",
        "/support/live",
        "Existing permissioned support case entry"
      ],
      [
        "sos",
        "Emergency Help",
        "/support",
        "Existing support routes; not an emergency dispatch service"
      ],
      [
        "safety-incident",
        "Incident Reporting",
        "/support/live",
        "Submit concerns without exposing private member information"
      ],
      [
        "police",
        "Police and Peace-and-Order Referrals",
        null,
        "Official agency contact links, not app-controlled dispatch"
      ],
      [
        "fire",
        "Fire Preparedness",
        null,
        "Safety education and verified official emergency contacts"
      ],
      [
        "rescue",
        "Rescue and Evacuation Guidance",
        null,
        "Verified official disaster resources and safe referral"
      ],
      [
        "weather",
        "Weather and Disaster Alerts",
        null,
        "Source-attributed public weather preparedness"
      ],
      [
        "missing-person",
        "Missing Person Notices",
        null,
        "Strictly verified privacy-sensitive notices"
      ],
      [
        "child-protection",
        "Child Protection Resources",
        null,
        "Moderated age-appropriate reporting and safeguards"
      ],
      [
        "community-patrol",
        "Community Safety Coordination",
        null,
        "Role-based safety volunteers without exposing exact home locations"
      ],
      [
        "cybersecurity",
        "Digital Safety and Fraud Reports",
        "/support/live",
        "Report identity misuse, abuse or suspicious activity"
      ]
    ]
  },
  {
    "id": "nature-farming",
    "world": "village",
    "title": "Parks, Farming & Environment",
    "icon": "pine-tree",
    "facilities": [
      [
        "family-gardens",
        "Shared Household Gardens",
        "/profile/buklod-family",
        "Existing community garden and household workspace"
      ],
      [
        "parks",
        "Public Parks",
        null,
        "Shared walking and recreation spaces"
      ],
      [
        "forests",
        "Forests and Protected Zones",
        null,
        "Nature stewardship and resource restrictions"
      ],
      [
        "rivers",
        "Rivers and Lakes",
        null,
        "Interactive scenic waterways and safe commons"
      ],
      [
        "beaches",
        "Coastal and Tropical Areas",
        null,
        "Nature-first scenic exploration areas"
      ],
      [
        "highlands",
        "Mountain and Winter Regions",
        null,
        "Distinct scenic regions, not separate rankings"
      ],
      [
        "community-farm",
        "Community Farming",
        null,
        "Verified planting, harvest and farm development"
      ],
      [
        "livestock",
        "Animal Care and Livestock",
        null,
        "Responsible agricultural animal management"
      ],
      [
        "tree-planting",
        "Tree Planting and Greening",
        null,
        "Verified environmental volunteer projects"
      ],
      [
        "recycling",
        "Recycling Center",
        null,
        "Resource recovery and public recycling missions"
      ],
      [
        "ecology",
        "Environmental Stewardship",
        null,
        "Evidence-based conservation challenges"
      ]
    ]
  },
  {
    "id": "bayanihan",
    "world": "village",
    "title": "Bayanihan & Development",
    "icon": "handshake-outline",
    "facilities": [
      [
        "volunteer",
        "Bayanihan Volunteering",
        "/bayanihan",
        "Existing organized community volunteering"
      ],
      [
        "giving",
        "Community Giving",
        "/giving",
        "Use existing donation/giving rules and controls"
      ],
      [
        "contribution",
        "Participation and Contribution",
        "/community-contribution",
        "Existing qualified community contribution entry"
      ],
      [
        "community-projects",
        "Project Coordination",
        "/bayanihan",
        "Existing practical projects and volunteer invitations"
      ],
      [
        "relief",
        "Relief and Humanitarian Drives",
        null,
        "Permissioned relief inventory and coordination"
      ],
      [
        "cleanup",
        "Community Clean-up Drives",
        null,
        "Verified environmental participation"
      ],
      [
        "treasury",
        "Community Treasury",
        null,
        "Isolated auditable community BP accounts; no personal reward duplication"
      ],
      [
        "progress-receipts",
        "Verified Project Evidence",
        null,
        "Private proof review, independent audit and appeal"
      ],
      [
        "challenge",
        "Community Development Challenges",
        null,
        "Collaborative challenges separate from Empire Arena combat"
      ],
      [
        "honors",
        "Community Recognition",
        "/points/progression",
        "Existing participation achievements and Circle Rank"
      ]
    ]
  },
  {
    "id": "social-services",
    "world": "village",
    "title": "Digital Services & Daily Life",
    "icon": "apps",
    "facilities": [
      [
        "connect-messages",
        "Connect Center",
        "/messages",
        "Private and scope-guarded communication"
      ],
      [
        "notifications",
        "Community Notifications",
        "/notifications",
        "Updates, invitations and official alerts"
      ],
      [
        "focus-apps",
        "Focus Apps Center",
        "/profile/focus-apps",
        "Government, education and specialized workspaces"
      ],
      [
        "account-privacy",
        "Privacy and Settings",
        "/settings",
        "Account privacy and personal preferences"
      ],
      [
        "info",
        "About BUKLOD",
        "/about-buklod",
        "Community principles and mission"
      ],
      [
        "rank",
        "Circle Rank and Achievements",
        "/points/progression",
        "Legitimately earned lifetime BP progression"
      ],
      [
        "character-kingdom",
        "Character Kingdom",
        "/games",
        "Separate personal character and exploration destination"
      ],
      [
        "empire-arena",
        "Empire Arena",
        "/games/empire-arena",
        "Separate in-app combat; ranked outcomes remain server gated"
      ]
    ]
  },
  {
    "id": "home-lot",
    "world": "home",
    "title": "My Lot & Estate",
    "icon": "terrain",
    "facilities": [
      [
        "my-world",
        "Lot and House Scene",
        "/season2/my-world",
        "Visual-only local construction and customization preview"
      ],
      [
        "my-progress",
        "Personal Development Progress",
        "/points/progression",
        "Existing points and development view"
      ],
      [
        "land-boundaries",
        "Lot Boundaries and Zoning",
        null,
        "Server-approved virtual plot footprints and setbacks"
      ],
      [
        "home-building",
        "Verified House Construction",
        null,
        "Materials, five stages, item receipts and build permissions"
      ],
      [
        "home-garage",
        "My Garage and Vehicles",
        null,
        "Vehicle storage and garage customization"
      ],
      [
        "home-paths",
        "Fences, Gate and Pathway",
        null,
        "Stage-based landscaping and structure placement"
      ],
      [
        "home-decor",
        "Decor Placement and Inventory",
        null,
        "Persistent room edits with asset entitlement checks"
      ],
      [
        "home-mastery",
        "Permanent Estate Mastery",
        null,
        "Unbounded visible progress beyond major level ten"
      ]
    ]
  },
  {
    "id": "home-family",
    "world": "home",
    "title": "Family & Household",
    "icon": "home-heart-outline",
    "facilities": [
      [
        "family-bahay",
        "BUKLOD Bahay",
        "/profile/buklod-family",
        "Existing members, roles, invites, rooms and gardens"
      ],
      [
        "family-life",
        "Personal Home",
        "/personal-home",
        "Existing daily home dashboard"
      ],
      [
        "household-reminders",
        "Household Reminders",
        "/personal-home/reminders",
        "Existing personal reminders"
      ],
      [
        "family-budget",
        "Home Budget",
        "/personal-home/budget",
        "Existing personal budget tools"
      ],
      [
        "family-children",
        "Family Story Time",
        "/children-stories",
        "Child-friendly storytelling and learning"
      ],
      [
        "family-room",
        "Room and Guest Access",
        "/profile/buklod-family",
        "Existing household workspace; ownership is separately gated"
      ],
      [
        "elderly-homecare",
        "Elderly Family Care",
        null,
        "Consent-based senior household support"
      ],
      [
        "home-shared-ownership",
        "Household Co-ownership",
        null,
        "Fractional property rights separated from guest invitations"
      ]
    ]
  },
  {
    "id": "home-farm",
    "world": "home",
    "title": "Garden, Farm & Pets",
    "icon": "sprout",
    "facilities": [
      [
        "home-garden",
        "Household Garden",
        "/profile/buklod-family",
        "Existing garden tools in household workspace"
      ],
      [
        "home-farm",
        "Personal Farm",
        null,
        "Growing plots, seeds, crops and verified harvest inventory"
      ],
      [
        "home-pets",
        "Companion Animals",
        null,
        "Virtual pets with transparent care and requirements"
      ],
      [
        "home-animals",
        "Livestock",
        null,
        "Farm animals and welfare-minded husbandry"
      ],
      [
        "home-seeds",
        "Seeds, Soil and Farm Tools",
        null,
        "Catalog items with honest ownership"
      ],
      [
        "home-water",
        "Water and Energy",
        null,
        "Landscaping and future utility development"
      ],
      [
        "home-crafting",
        "Home Workshop",
        null,
        "Material crafting with server-verified recipes"
      ],
      [
        "home-recycle",
        "Household Recycling",
        null,
        "Eco-development and verified community projects"
      ]
    ]
  },
  {
    "id": "home-daily",
    "world": "home",
    "title": "My Life & Personal Tools",
    "icon": "account-heart-outline",
    "facilities": [
      [
        "my-profile",
        "My Profile",
        "/me",
        "Verified identity, posts, profile and rank"
      ],
      [
        "my-points",
        "My BP and Circle Rank",
        "/points",
        "Legitimately earned points and period summary"
      ],
      [
        "my-messages",
        "Connect Family and Friends",
        "/messages",
        "Messages and calls through existing permissions"
      ],
      [
        "my-radio",
        "Personal Radio",
        "/personal-home/radio",
        "Existing audio and radio controls"
      ],
      [
        "my-health",
        "Health Resources",
        "/profile/buklod-health",
        "Existing privacy-sensitive health destination"
      ],
      [
        "my-learning",
        "Personal Learning",
        "/learn",
        "Lessons and learning activities"
      ],
      [
        "my-service",
        "My Focus Apps",
        "/profile/focus-apps",
        "Access only eligible role-based Focus Apps"
      ],
      [
        "my-settings",
        "Privacy and Settings",
        "/settings",
        "Account and personal settings"
      ]
    ]
  }
]);
const normalize = value => String(value ?? '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('en');
export const COMMUNITY_FACILITY_ZONES = ZONES.map(z => Object.freeze({
  id:z.id,world:z.world,title:z.title,icon:z.icon,
}));
const FACILITIES = Object.freeze(ZONES.flatMap(z => z.facilities.map(row => {
  const [id,label,route,description,faithOnly=false] = row;
  const status = route ? 'linked' : 'planned';
  return Object.freeze({
    id,world:z.world,zone:z.id,label,route,description,status,faithOnly,
    searchText:normalize(z.title+' '+label+' '+description+' '+id.replace(/-/g,' ')),
  });
})));
/** The exact scene accepts one world only. False/unknown world values fail closed. */
export function getCommunityZones(world,showFaith=false) {
  if(world!=='village'&&world!=='home')return [];
  return COMMUNITY_FACILITY_ZONES.filter(z=>z.world===world
    && FACILITIES.some(f=>f.zone===z.id&&(!f.faithOnly||showFaith)));
}
export function listCommunityFacilities({world,zone='all',query='',showFaith=false}={}) {
  if(world!=='village'&&world!=='home')return [];
  const tokens=normalize(query).slice(0,80).split(/\s+/).filter(Boolean);
  return FACILITIES.filter(f=>
    f.world===world &&
    (zone==='all'||f.zone===zone) &&
    (!f.faithOnly||showFaith) &&
    tokens.every(token=>f.searchText.includes(token))
  );
}
export function communityFacilitySummary(world,showFaith=false) {
  const all=listCommunityFacilities({world,showFaith});
  return Object.freeze({
    total:all.length,
    linked:all.filter(f=>f.status==='linked').length,
    planned:all.filter(f=>f.status==='planned').length,
  });
}
