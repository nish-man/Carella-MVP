const Anthropic = require('@anthropic-ai/sdk');

// ─── Full UK Car Inventory (27 cars) ─────────────────────────────
const UK_CARS = [
  { id:'u001', make:'Volkswagen', model:'Golf', variant:'1.5 TSI Life', year:2021, price:13495, mileage:34200, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Indigo Blue', location:'Manchester', region:'North West', insurance_group:16, mpg:52, boot_litres:380, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-12',result:'Pass',mileage:30100,advisories:[]}], description:'One careful owner, full VW service history, recent major service.' },
  { id:'u002', make:'Toyota', model:'Yaris', variant:'1.5 Hybrid Icon', year:2022, price:15990, mileage:18500, fuel:'Hybrid', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Pearl White', location:'Birmingham', region:'Midlands', insurance_group:11, mpg:68, boot_litres:270, ncap:5, ulez:true, ved_annual:20, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-05-20',result:'Pass',mileage:16200,advisories:[]}], description:'Low mileage hybrid, perfect city runabout.' },
  { id:'u003', make:'Ford', model:'Focus', variant:'1.0 EcoBoost ST-Line', year:2020, price:11750, mileage:52000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Race Red', location:'Leeds', region:'Yorkshire', insurance_group:18, mpg:48, boot_litres:375, ncap:5, ulez:true, ved_annual:165, fsh:false, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-07-15',result:'Pass',mileage:49800,advisories:['Brake fluid old, recommend change']}], description:'Sporty ST-Line spec with full infotainment suite.' },
  { id:'u004', make:'BMW', model:'3 Series', variant:'320d M Sport', year:2019, price:18995, mileage:61000, fuel:'Diesel', transmission:'Automatic', body:'Saloon', seats:5, colour:'Black Sapphire', location:'London', region:'London', insurance_group:32, mpg:58, boot_litres:480, ncap:5, ulez:true, ved_annual:180, fsh:true, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-02-28',result:'Pass',mileage:58200,advisories:[]},{date:'2023-02-20',result:'Pass',mileage:49100,advisories:[]}], description:'Premium M Sport spec, full BMW history, heated leather seats.' },
  { id:'u005', make:'Nissan', model:'Qashqai', variant:'1.3 DIG-T N-Connecta', year:2021, price:17490, mileage:29800, fuel:'Petrol', transmission:'Manual', body:'SUV', seats:5, colour:'Gun Metal Grey', location:'Bristol', region:'South West', insurance_group:22, mpg:42, boot_litres:504, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-04-10',result:'Pass',mileage:27300,advisories:[]}], description:"UK's best-selling SUV. Excellent condition, panoramic roof." },
  { id:'u006', make:'Tesla', model:'Model 3', variant:'Long Range AWD', year:2022, price:29990, mileage:28000, fuel:'Electric', transmission:'Automatic', body:'Saloon', seats:5, colour:'Midnight Silver', location:'London', region:'London', insurance_group:29, mpg:null, range_miles:358, boot_litres:542, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-06-05',result:'Pass',mileage:25100,advisories:[]}], description:'Full Autopilot, 358-mile real-world range. Home charging cable included.' },
  { id:'u007', make:'Land Rover', model:'Discovery Sport', variant:'D165 SE AWD 7-Seat', year:2021, price:29500, mileage:35000, fuel:'Diesel', transmission:'Automatic', body:'SUV', seats:7, colour:'Fuji White', location:'Guildford', region:'South East', insurance_group:33, mpg:45, boot_litres:981, ncap:5, ulez:true, ved_annual:30, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-01-22',result:'Pass',mileage:32000,advisories:[]}], description:'7-seat family SUV with Terrain Response 2.' },
  { id:'u008', make:'Hyundai', model:'Ioniq 5', variant:'77kWh AWD Ultimate', year:2022, price:34500, mileage:19000, fuel:'Electric', transmission:'Automatic', body:'SUV', seats:5, colour:'Atlas White', location:'London', region:'London', insurance_group:35, mpg:null, range_miles:298, boot_litres:531, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1593941707874-ef25b8b4a92b?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Award-winning EV. 800V ultra-fast charging. Heat pump standard.' },
  { id:'u009', make:'Skoda', model:'Octavia', variant:'2.0 TDI SE Technology Estate', year:2021, price:14995, mileage:44000, fuel:'Diesel', transmission:'Manual', body:'Estate', seats:5, colour:'Quartz Grey', location:'Cardiff', region:'Wales', insurance_group:17, mpg:60, boot_litres:640, ncap:5, ulez:true, ved_annual:30, fsh:true, owners:1, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-05-08',result:'Pass',mileage:41200,advisories:[]}], description:'Enormous 640L boot, excellent motorway cruiser. VW Group reliability.' },
  { id:'u010', make:'Ford', model:'Kuga', variant:'2.5 PHEV ST-Line X', year:2021, price:22500, mileage:31000, fuel:'PHEV', transmission:'Automatic', body:'SUV', seats:5, colour:'Frozen White', location:'Nottingham', region:'Midlands', insurance_group:26, mpg:201, boot_litres:411, ncap:5, ulez:true, ved_annual:20, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-01-15',result:'Pass',mileage:28900,advisories:[]}], description:'37-mile EV-only range. Company car tax friendly.' },
  { id:'u011', make:'Mazda', model:'MX-5', variant:'2.0 Skyactiv-G Sport', year:2020, price:18500, mileage:19000, fuel:'Petrol', transmission:'Manual', body:'Convertible', seats:2, colour:'Soul Red Crystal', location:'Bath', region:'South West', insurance_group:27, mpg:38, boot_litres:130, ncap:5, ulez:true, ved_annual:265, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-05-12',result:'Pass',mileage:17200,advisories:[]}], description:"The definitive driver's car. Single owner, sensational condition." },
  { id:'u012', make:'Vauxhall', model:'Corsa', variant:'1.2 Turbo GS Line', year:2022, price:11995, mileage:22000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Midnight Black', location:'Liverpool', region:'North West', insurance_group:12, mpg:50, boot_litres:309, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-08-01',result:'Pass',mileage:20100,advisories:[]}], description:'Stylish GS Line spec, Apple CarPlay, digital cockpit.' },
  { id:'u013', make:'Audi', model:'A3', variant:'35 TFSI S Line Sportback', year:2021, price:21900, mileage:25000, fuel:'Petrol', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Navarra Blue', location:'London', region:'London', insurance_group:28, mpg:46, boot_litres:380, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1616788494707-ec28f08d05a1?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-04-22',result:'Pass',mileage:23100,advisories:[]}], description:'Premium S Line spec, virtual cockpit, Bang & Olufsen sound.' },
  { id:'u014', make:'Volvo', model:'XC60', variant:'B4 AWD R-Design', year:2021, price:34000, mileage:33000, fuel:'Mild Hybrid', transmission:'Automatic', body:'SUV', seats:5, colour:'Pebble Grey', location:'Oxford', region:'South East', insurance_group:36, mpg:48, boot_litres:505, ncap:5, ulez:true, ved_annual:30, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1581540222194-0def2dda95b8?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-02-10',result:'Pass',mileage:30800,advisories:[]}], description:'Scandinavian luxury SUV. Pilot Assist, Bowers & Wilkins audio.' },
  { id:'u015', make:'Renault', model:'Zoe', variant:'50kWh GT Line+', year:2021, price:12900, mileage:31000, fuel:'Electric', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Flame Red', location:'Brighton', region:'South East', insurance_group:21, mpg:null, range_miles:245, boot_litres:338, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-07-30',result:'Pass',mileage:29200,advisories:[]}], description:'Affordable EV entry point. Rapid charge compatible.' },
  // Budget tier
  { id:'u016', make:'Ford', model:'Fiesta', variant:'1.0 EcoBoost Titanium', year:2019, price:7995, mileage:44000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Magnetic Grey', location:'Derby', region:'Midlands', insurance_group:10, mpg:55, boot_litres:292, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-06-01',result:'Pass',mileage:42100,advisories:[]}], description:"Britain's best-selling small car. Insurance group 10, ideal first car." },
  { id:'u017', make:'Toyota', model:'Aygo', variant:'1.0 VVT-i X-Play', year:2021, price:9200, mileage:19000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Pulse White', location:'Birmingham', region:'Midlands', insurance_group:6, mpg:58, boot_litres:168, ncap:5, ulez:true, ved_annual:30, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-07-10',result:'Pass',mileage:17800,advisories:[]}], description:'Insurance group 6 — the lowest available. Perfect city car.' },
  { id:'u018', make:'Volkswagen', model:'Polo', variant:'1.0 TSI SE', year:2019, price:10495, mileage:38500, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Deep Black', location:'Leicester', region:'Midlands', insurance_group:13, mpg:50, boot_litres:351, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-05-20',result:'Pass',mileage:36300,advisories:[]}], description:'VW build quality at a budget price. Apple CarPlay, single owner.' },
  { id:'u019', make:'SEAT', model:'Ibiza', variant:'1.0 TSI SE Technology', year:2020, price:10950, mileage:28000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Nevada White', location:'Sheffield', region:'Yorkshire', insurance_group:11, mpg:52, boot_litres:355, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-25',result:'Pass',mileage:26100,advisories:[]}], description:'VW Group quality, sporty styling, digital dash.' },
  { id:'u020', make:'Hyundai', model:'i10', variant:'1.2 MPi SE Connect', year:2022, price:11200, mileage:13500, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Aqua Sparkling', location:'Norwich', region:'East', insurance_group:7, mpg:53, boot_litres:252, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Nearly new with Hyundai 5-year warranty. Tiny running costs.' },
  // Premium
  { id:'u021', make:'Mercedes-Benz', model:'C-Class', variant:'C220d AMG Line', year:2020, price:26500, mileage:44000, fuel:'Diesel', transmission:'Automatic', body:'Saloon', seats:5, colour:'Obsidian Black', location:'London', region:'London', insurance_group:38, mpg:62, boot_litres:455, ncap:5, ulez:true, ved_annual:30, fsh:true, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-18',result:'Pass',mileage:41200,advisories:[]}], description:'Executive saloon, Burmester sound, driving assistance package.' },
  { id:'u022', make:'Porsche', model:'Cayenne', variant:'S E-Hybrid Tiptronic', year:2019, price:54995, mileage:38000, fuel:'PHEV', transmission:'Automatic', body:'SUV', seats:5, colour:'Jet Black', location:'London', region:'London', insurance_group:44, mpg:83, boot_litres:770, ncap:5, ulez:true, ved_annual:20, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1581540222194-0def2dda95b8?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-01-05',result:'Pass',mileage:35400,advisories:[]}], description:'Performance SUV with hybrid efficiency. Porsche Approved Warranty.' },
  // New cars
  { id:'n001', make:'Toyota', model:'Yaris Cross', variant:'1.5 Hybrid Excel', year:2024, price:28950, mileage:0, fuel:'Hybrid', transmission:'Automatic', body:'SUV', seats:5, colour:'Juniper Blue', location:'Milton Keynes', region:'Midlands', insurance_group:14, mpg:64, boot_litres:397, ncap:5, ulez:true, ved_annual:20, fsh:true, owners:0, condition:'New', new_or_used:'new', image:'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80', listing_url:'https://www.toyota.co.uk', mot_history:[], description:'Brand new. 5-year Toyota warranty. Self-charging hybrid.' },
  { id:'n002', make:'Volkswagen', model:'ID.3', variant:'Pro S 77kWh', year:2024, price:39500, mileage:0, fuel:'Electric', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Moonstone Grey', location:'Milton Keynes', region:'Midlands', insurance_group:31, mpg:null, range_miles:336, boot_litres:385, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:0, condition:'New', new_or_used:'new', image:'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80', listing_url:'https://www.volkswagen.co.uk', mot_history:[], description:'Brand new. 3-year warranty. 336-mile range. OTA updates.' },
  { id:'n003', make:'Kia', model:'EV6', variant:'77.4kWh GT-Line S RWD', year:2024, price:44995, mileage:0, fuel:'Electric', transmission:'Automatic', body:'SUV', seats:5, colour:'Glacier White', location:'London', region:'London', insurance_group:34, mpg:null, range_miles:328, boot_litres:480, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:0, condition:'New', new_or_used:'new', image:'https://images.unsplash.com/photo-1593941707874-ef25b8b4a92b?w=800&q=80', listing_url:'https://www.kia.com/uk', mot_history:[], description:'Brand new. 7-year Kia warranty. 800V ultra-fast charging.' },
  { id:'n004', make:'Ford', model:'Puma', variant:'1.0 EcoBoost Hybrid ST-Line', year:2024, price:27495, mileage:0, fuel:'Mild Hybrid', transmission:'Automatic', body:'SUV', seats:5, colour:'Desert Island Blue', location:'Coventry', region:'Midlands', insurance_group:20, mpg:52, boot_litres:456, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:0, condition:'New', new_or_used:'new', image:'https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?w=800&q=80', listing_url:'https://www.ford.co.uk', mot_history:[], description:'Brand new. Ford 3-year warranty. Clever MegaBox understorage.' },
  { id:'n005', make:'BMW', model:'i4', variant:'eDrive40 M Sport', year:2024, price:59900, mileage:0, fuel:'Electric', transmission:'Automatic', body:'Saloon', seats:5, colour:'Phytonic Blue', location:'London', region:'London', insurance_group:40, mpg:null, range_miles:365, boot_litres:470, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:0, condition:'New', new_or_used:'new', image:'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80', listing_url:'https://www.bmw.co.uk', mot_history:[], description:'Brand new M Sport electric. 3-year/unlimited mileage warranty.' },
];

// ─── ELLA SYSTEM PROMPT ───────────────────────────────────────────
function buildEllaPrompt(profile) {
  const p = profile || {};
  return `You are Ella, Carella's AI car concierge. You are the user's brilliant, impartial car expert friend — knowledgeable about the UK market, never salesy, always honest. You ask the questions buyers don't know to ask.

DRIVER PROFILE:
Age: ${p.age||'unknown'} | Location: ${p.location_display||'unknown'} (${p.location_postcode||''})
Occupation: ${p.occupation||'unknown'}
Driving history: ${Array.isArray(p.driving_history)?p.driving_history.join(', '):'none'}
Finance preference: ${Array.isArray(p.finance_method)?p.finance_method.join(', '):'unknown'}
Budget: ${p.budget?JSON.stringify(p.budget):'unknown'} | Max: £${p.budget_max||'unknown'}
Priorities (1-10): ${p.priorities?JSON.stringify(p.priorities):'not set'}
Car types wanted: ${Array.isArray(p.car_types)?p.car_types.join(', '):'any'}
Use cases: ${Array.isArray(p.use_cases)?p.use_cases.join(', '):'unknown'}
Must-haves: ${Array.isArray(p.must_have_features)?p.must_have_features.join(', '):'none'}
Dream car: ${Array.isArray(p.dream_cars)?p.dream_cars.join(', '):'not specified'}

CRITERIA TO ASSESS (ask about unknowns that are material):
VEHICLE: EV/HEV/PHEV/petrol/diesel · new vs used · age/mileage · condition tolerance · willing to travel to collect?
FINANCIAL: budget method · insurance group sensitivity · VED · depreciation · how long keeping · part-exchange value · salary sacrifice eligibility
USAGE: motorway vs city vs fun · road quality · annual miles · kids/ages · pets · towing weight · ULEZ/congestion charge · who else drives it
EV/PHEV: home charging access (make or break for EV) · workplace charging · daily miles vs range · range anxiety · does user actually plug in PHEVs?
HISTORY (used): FSH · MOT advisories · HPI check essential · previous owners (many quickly = red flag) · tyre condition/age · bodywork repairs
PREFS: brand · colour (black shows chips more) · ADAS requirements · gearbox · ride vs handling · noise · cars previously liked/disliked
BROKER (surface proactively): new model imminent? · depreciation curve · days listed + price reductions (negotiating room) · price vs CAP Clean · outstanding recalls · BIK for company cars · upcoming legislation

Return ONLY valid JSON:
{
  "search_params": {
    "budget_max": number|null, "budget_min": number|null, "monthly_max": number|null,
    "make": string[], "body_type": string[], "fuel_type": string|null,
    "new_or_used": "new"|"used"|"either"|null, "transmission": string|null,
    "year_min": number|null, "mileage_max": number|null, "seats_min": number|null,
    "ulez_required": boolean|null, "ncap_min": number|null, "insurance_group_max": number|null,
    "boot_litres_min": number|null, "tow_required": boolean|null, "fsh_required": boolean|null,
    "ev_range_min": number|null, "needs_clarification": boolean
  },
  "ella_message": "1-2 warm specific sentences",
  "follow_up_question": "ONE smart question about the most important unknown",
  "broker_notes": "1 sentence of broker intelligence if material, otherwise null"
}`;
}

// ─── SCORING ──────────────────────────────────────────────────────
function scoreCar(car, params, profile) {
  let score = 100;
  const p = profile || {};
  const bmax = params.budget_max || p.budget?.cash_max || p.budget_max || 50000;

  if (car.price <= bmax) score += 30 + (1 - car.price/bmax) * 10;
  else score -= 60;

  if (params.new_or_used === 'new' && car.new_or_used !== 'new') score -= 50;
  if (params.new_or_used === 'used' && car.new_or_used === 'new') score -= 50;

  const wf = params.fuel_type;
  if (wf) {
    const f = car.fuel.toLowerCase(), w = wf.toLowerCase();
    if (f === w || (w==='hybrid'&&['hybrid','mild hybrid'].includes(f)) || (w==='electric'&&f==='electric') || (w==='ev'&&f==='electric') || (w==='phev'&&f==='phev')) score += 20;
    else score -= 15;
  }

  const wb = params.body_type?.length ? params.body_type : (p.car_types||[]);
  if (wb.length > 0) {
    if (wb.some(b => car.body.toLowerCase().includes(b.toLowerCase()))) score += 20;
    else score -= 10;
  }

  const igMax = params.insurance_group_max || (Array.isArray(p.driving_history) && p.driving_history.some(h=>h.toLowerCase().includes('licence points')) ? 18 : null) || (p.age < 23 ? 16 : null);
  if (igMax) { if (car.insurance_group <= igMax) score += 15; else score -= 25; }

  if (params.mileage_max && car.mileage > params.mileage_max) score -= 30;
  else if (car.mileage < 20000) score += 10;
  else if (car.mileage < 40000) score += 5;

  if (params.ulez_required === true) { if (car.ulez) score += 12; else score -= 35; }
  if (params.seats_min && car.seats < params.seats_min) score -= 50;
  if (params.ncap_min && car.ncap < params.ncap_min) score -= 25;
  if (params.tow_required === true && !['Estate','SUV'].includes(car.body)) score -= 20;
  if (params.fsh_required === true && !car.fsh && car.new_or_used==='used') score -= 20;
  if (params.ev_range_min && car.range_miles && car.range_miles < params.ev_range_min) score -= 30;
  if (params.make?.length) { if (params.make.some(m=>car.make.toLowerCase().includes(m.toLowerCase())||car.model.toLowerCase().includes(m.toLowerCase()))) score += 25; }
  if (params.transmission) { if (car.transmission.toLowerCase()===params.transmission.toLowerCase()) score += 10; else score -= 12; }
  if (params.year_min && car.year < params.year_min) score -= 20;
  if (car.fsh) score += 5; if (car.owners <= 1) score += 5;
  const m = car.mot_history?.[0]; if (m?.result==='Pass'&&m?.advisories?.length===0) score += 8;

  return Math.round(score);
}

function calcTCO(car) {
  const mi=8000, pp=1.48, pd=1.52, epm=0.05;
  let fuel=0;
  if (car.fuel==='Electric') fuel=(mi*epm)/12;
  else if (['Hybrid','Mild Hybrid'].includes(car.fuel)) fuel=(mi/(car.mpg*.8)*4.546*pp)/12;
  else if (car.fuel==='PHEV') fuel=(mi*.4*epm+mi*.6/(car.mpg||50)*4.546*pp)/12;
  else if (car.fuel==='Diesel') fuel=(mi/(car.mpg||55)*4.546*pd)/12;
  else fuel=(mi/(car.mpg||40)*4.546*pp)/12;
  return { total:Math.round(fuel+car.insurance_group*4.2+(car.ved_annual||0)/12), fuel:Math.round(fuel), insurance:Math.round(car.insurance_group*4.2), ved:Math.round((car.ved_annual||0)/12) };
}

function searchInventory(params, profile) {
  const bmax = params.budget_max || profile?.budget?.cash_max || profile?.budget_max || 200000;
  return UK_CARS
    .filter(c => {
      if (c.price > bmax * 1.15) return false;
      if (params.seats_min && c.seats < params.seats_min) return false;
      if (params.ulez_required===true && !c.ulez) return false;
      if (params.new_or_used==='new' && c.new_or_used!=='new') return false;
      if (params.new_or_used==='used' && c.new_or_used==='new') return false;
      return true;
    })
    .map(c => ({...c, score:scoreCar(c,params,profile), tco:calcTCO(c)}))
    .sort((a,b) => b.score - a.score)
    .slice(0, 5);
}

// ─── MOCK ELLA (demo mode) ────────────────────────────────────────
function mockElla(message, existing, profile) {
  const m = message.toLowerCase();
  const params = {...existing};
  const bm = m.match(/£?([\d,]+)\s*k?/gi);
  if (bm) {
    const amounts = bm.map(x=>{const n=parseFloat(x.replace(/[£,]/g,''));return x.toLowerCase().includes('k')&&n<500?n*1000:n;}).filter(n=>n>500&&n<200000);
    if (amounts.length>=2){params.budget_min=Math.min(...amounts);params.budget_max=Math.max(...amounts);}
    else if (amounts.length===1) params.budget_max=amounts[0];
  }
  if (m.includes('brand new')||m.includes('new car')||m.includes('new model')||m.includes('0 miles')) params.new_or_used='new';
  else if (m.includes('used')||m.includes('second hand')||m.includes('pre-owned')) params.new_or_used='used';
  if (m.match(/\bev\b|electric|battery/)) params.fuel_type='Electric';
  else if (m.includes('phev')||m.match(/plug[- ]in hybrid/)) params.fuel_type='PHEV';
  else if (m.includes('hybrid')) params.fuel_type='Hybrid';
  else if (m.includes('diesel')) params.fuel_type='Diesel';
  else if (m.includes('petrol')) params.fuel_type='Petrol';
  if (m.match(/\bsuv\b|crossover|4x4/)) params.body_type=['SUV'];
  else if (m.includes('estate')) params.body_type=['Estate'];
  else if (m.match(/saloon|sedan/)) params.body_type=['Saloon'];
  else if (m.match(/hatchback|\bhatch\b/)) params.body_type=['Hatchback'];
  else if (m.match(/convertible|roadster|cabriolet/)) params.body_type=['Convertible'];
  else if (m.match(/7.seat|seven.seat/)){params.body_type=['SUV'];params.seats_min=7;}
  if (m.match(/low insurance|cheap insurance|new driver|just passed|first car|young driver/)) params.insurance_group_max=16;
  if (m.match(/ulez|london|clean air zone/)) params.ulez_required=true;
  if (m.match(/\bauto\b|automatic/)) params.transmission='Automatic';
  else if (m.match(/\bmanual\b/)) params.transmission='Manual';
  const sm=m.match(/(\d)\s*seat/); if(sm) params.seats_min=parseInt(sm[1]);
  if (m.match(/tow|trailer|caravan/)) params.tow_required=true;
  if (m.match(/full service|fsh/)) params.fsh_required=true;
  const mm=m.match(/under\s*([\d,]+)\s*(?:k\s*)?miles?/i); if(mm){const n=parseFloat(mm[1].replace(/,/g,''));params.mileage_max=n<500?n*1000:n;}
  const rm=m.match(/([\d]+)\s*(?:\+\s*)?miles?\s*(?:range)?/i); if(rm&&params.fuel_type==='Electric') params.ev_range_min=parseInt(rm[1]);
  const brands=['volkswagen','vw','ford','toyota','bmw','audi','mercedes','nissan','honda','volvo','tesla','hyundai','kia','seat','skoda','vauxhall','peugeot','renault','mazda','land rover','porsche','lexus','mini'];
  const found=brands.filter(b=>m.includes(b));
  if(found.length) params.make=found.map(b=>b==='vw'?'Volkswagen':b.charAt(0).toUpperCase()+b.slice(1));
  const isCar=m.length>4&&(bm||params.fuel_type||params.body_type||params.make?.length||['car','drive','vehicle','miles','seats','engine','petrol','diesel','ev','hybrid','reliable','family','commute','lease','finance','suv','hatchback','saloon','estate'].some(w=>m.includes(w)));
  if(!isCar) return { search_params:{needs_clarification:true}, ella_message:"Hi, I'm Ella — your personal car concierge. Tell me your budget and what kind of car you're after, and I'll search the entire UK market for you.", follow_up_question:"What's your rough budget, and are you looking at new or used?", broker_notes:null };
  const msgs=["I've searched the UK market and found your strongest options.","Found some great matches — these should tick your key boxes.","Here are the best picks I found across the UK right now."];
  const fqs=["Do you have the ability to charge at home — driveway or garage?","Would you prefer automatic gearbox, or happy with manual?","How important is a full service history vs a lower price?","How many miles do you typically drive per year?","Is there a car you're trading in? That could affect the budget."];
  return { search_params:{...params,needs_clarification:false}, ella_message:msgs[Math.floor(Math.random()*msgs.length)], follow_up_question:fqs[Math.floor(Math.random()*fqs.length)], broker_notes:null };
}

// ─── In-memory sessions (Vercel is stateless — use Supabase for prod) ─────
const sessions = {};

// ─── HANDLER ─────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';

  // Health
  if (url === '/api/health' || url === '/api/health/') {
    return res.json({ status:'ok', inventory:UK_CARS.length, ella:process.env.ANTHROPIC_API_KEY?'live':'demo' });
  }

  // Get all cars
  if (url === '/api/cars') {
    return res.json(UK_CARS.map(c=>({...c,tco:calcTCO(c)})));
  }

  // Get single car
  if (url.startsWith('/api/car/')) {
    const id = url.split('/api/car/')[1];
    const car = UK_CARS.find(c=>c.id===id);
    if (!car) return res.status(404).json({error:'Not found'});
    return res.json({...car, tco:calcTCO(car)});
  }

  // Ella search
  if (url === '/api/ella/search' || url === '/api/ella' || req.url?.includes('ella/search')) {
    if (req.method !== 'POST') return res.status(405).json({error:'POST only'});
    const { session_id, user_message, profile } = req.body;
    if (!user_message?.trim()) return res.status(400).json({error:'message required'});

    const sid = session_id || `s_${Date.now()}`;
    if (!sessions[sid]) sessions[sid] = { id:sid, profile:profile||{}, messages:[], resolved_params:{}, result_ids:[] };
    const session = sessions[sid];
    if (profile) session.profile = { ...session.profile, ...profile };
    session.messages.push({ role:'user', content:user_message });

    let ella;
    try {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('no key');
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const history = session.messages.slice(-10).map((m,i,arr) => ({
        role: m.role,
        content: (m.role==='user' && i===arr.length-1 && Object.keys(session.resolved_params).length)
          ? `[Previous context: ${JSON.stringify(session.resolved_params)}]\n${user_message}`
          : m.content,
      }));
      const resp = await anthropic.messages.create({ model:'claude-sonnet-4-20250514', max_tokens:1200, system:buildEllaPrompt(session.profile), messages:history });
      const raw = resp.content[0].text;
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('bad json');
      ella = JSON.parse(match[0]);
    } catch {
      ella = mockElla(user_message, session.resolved_params, session.profile);
    }

    const { search_params, ella_message, follow_up_question, broker_notes } = ella;
    session.resolved_params = { ...session.resolved_params, ...search_params };
    session.messages.push({ role:'assistant', content:ella_message });

    let results = [];
    if (!search_params.needs_clarification) {
      results = searchInventory(session.resolved_params, session.profile);
      session.result_ids = results.map(r=>r.id);
    }

    return res.json({ session_id:sid, ella_message, follow_up_question, broker_notes, results, resolved_params:session.resolved_params, needs_clarification:search_params.needs_clarification||false });
  }

  return res.status(404).json({ error:'Not found' });
};
