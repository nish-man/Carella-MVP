require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// ─── MOCK UK INVENTORY (26 cars spanning all segments) ────────────────────────
// Replace searchInventory() with Marketcheck UK API or Apify when keys are ready
const UK_CARS = [
  { id:'u001', make:'Volkswagen', model:'Golf', variant:'1.5 TSI Life', year:2021, price:13495, mileage:34200, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Indigo Blue', location:'Manchester', region:'North West', insurance_group:16, mpg:52, boot_litres:380, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-12',result:'Pass',mileage:30100,advisories:[]}], description:'One careful owner, full VW service history, recent major service.' },
  { id:'u002', make:'Toyota', model:'Yaris', variant:'1.5 Hybrid Icon', year:2022, price:15990, mileage:18500, fuel:'Hybrid', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Pearl White', location:'Birmingham', region:'Midlands', insurance_group:11, mpg:68, boot_litres:270, ncap:5, ulez:true, ved_annual:20, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-05-20',result:'Pass',mileage:16200,advisories:[]}], description:'Low mileage hybrid, perfect city runabout. Exceptionally economical.' },
  { id:'u003', make:'Ford', model:'Focus', variant:'1.0 EcoBoost ST-Line', year:2020, price:11750, mileage:52000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Race Red', location:'Leeds', region:'Yorkshire', insurance_group:18, mpg:48, boot_litres:375, ncap:5, ulez:true, ved_annual:165, fsh:false, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-07-15',result:'Pass',mileage:49800,advisories:['Brake fluid old, recommend change']}], description:'Sporty ST-Line spec with full infotainment suite. Two previous owners.' },
  { id:'u004', make:'BMW', model:'3 Series', variant:'320d M Sport', year:2019, price:18995, mileage:61000, fuel:'Diesel', transmission:'Automatic', body:'Saloon', seats:5, colour:'Black Sapphire', location:'London', region:'London', insurance_group:32, mpg:58, boot_litres:480, ncap:5, ulez:true, ved_annual:180, fsh:true, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-02-28',result:'Pass',mileage:58200,advisories:[]},{date:'2023-02-20',result:'Pass',mileage:49100,advisories:[]}], description:'Premium M Sport spec, full BMW history, heated leather seats.' },
  { id:'u005', make:'Nissan', model:'Qashqai', variant:'1.3 DIG-T N-Connecta', year:2021, price:17490, mileage:29800, fuel:'Petrol', transmission:'Manual', body:'SUV', seats:5, colour:'Gun Metal Grey', location:'Bristol', region:'South West', insurance_group:22, mpg:42, boot_litres:504, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-04-10',result:'Pass',mileage:27300,advisories:[]}], description:"UK's best-selling SUV. Excellent condition, panoramic roof, sat nav." },
  { id:'u006', make:'Tesla', model:'Model 3', variant:'Long Range AWD', year:2022, price:29990, mileage:28000, fuel:'Electric', transmission:'Automatic', body:'Saloon', seats:5, colour:'Midnight Silver', location:'London', region:'London', insurance_group:29, mpg:null, range_miles:358, boot_litres:542, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-06-05',result:'Pass',mileage:25100,advisories:[]}], description:'Full self-driving capability, Autopilot, 358-mile real-world range. Home charging cable included.' },
  { id:'u007', make:'Land Rover', model:'Discovery Sport', variant:'D165 SE AWD 7-Seat', year:2021, price:29500, mileage:35000, fuel:'Diesel', transmission:'Automatic', body:'SUV', seats:7, colour:'Fuji White', location:'Guildford', region:'South East', insurance_group:33, mpg:45, boot_litres:981, ncap:5, ulez:true, ved_annual:30, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-01-22',result:'Pass',mileage:32000,advisories:[]}], description:'7-seat family SUV with Terrain Response 2. Full Meridian sound system.' },
  { id:'u008', make:'Hyundai', model:'Ioniq 5', variant:'77kWh AWD Ultimate', year:2022, price:34500, mileage:19000, fuel:'Electric', transmission:'Automatic', body:'SUV', seats:5, colour:'Atlas White', location:'London', region:'London', insurance_group:35, mpg:null, range_miles:298, boot_litres:531, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1593941707874-ef25b8b4a92b?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Award-winning EV. Ultra-fast 800V charging. Heat pump standard.' },
  { id:'u009', make:'Skoda', model:'Octavia', variant:'2.0 TDI SE Technology Estate', year:2021, price:14995, mileage:44000, fuel:'Diesel', transmission:'Manual', body:'Estate', seats:5, colour:'Quartz Grey', location:'Cardiff', region:'Wales', insurance_group:17, mpg:60, boot_litres:640, ncap:5, ulez:true, ved_annual:30, fsh:true, owners:1, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-05-08',result:'Pass',mileage:41200,advisories:[]}], description:'Enormous 640L boot, excellent motorway cruiser. VW Group reliability.' },
  { id:'u010', make:'Ford', model:'Kuga', variant:'2.5 PHEV ST-Line X', year:2021, price:22500, mileage:31000, fuel:'PHEV', transmission:'Automatic', body:'SUV', seats:5, colour:'Frozen White', location:'Nottingham', region:'Midlands', insurance_group:26, mpg:201, boot_litres:411, ncap:5, ulez:true, ved_annual:20, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-01-15',result:'Pass',mileage:28900,advisories:[]}], description:'37-mile EV-only range. Company car tax friendly. Charge at home overnight.' },
  { id:'u011', make:'Mazda', model:'MX-5', variant:'2.0 Skyactiv-G Sport', year:2020, price:18500, mileage:19000, fuel:'Petrol', transmission:'Manual', body:'Convertible', seats:2, colour:'Soul Red Crystal', location:'Bath', region:'South West', insurance_group:27, mpg:38, boot_litres:130, ncap:5, ulez:true, ved_annual:265, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-05-12',result:'Pass',mileage:17200,advisories:[]}], description:"The definitive driver's car. Low mileage, single owner, sensational condition." },
  { id:'u012', make:'Vauxhall', model:'Corsa', variant:'1.2 Turbo GS Line', year:2022, price:11995, mileage:22000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Midnight Black', location:'Liverpool', region:'North West', insurance_group:12, mpg:50, boot_litres:309, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-08-01',result:'Pass',mileage:20100,advisories:[]}], description:'Stylish GS Line spec, Apple CarPlay, digital cockpit.' },
  { id:'u013', make:'Audi', model:'A3', variant:'35 TFSI S Line Sportback', year:2021, price:21900, mileage:25000, fuel:'Petrol', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Navarra Blue', location:'London', region:'London', insurance_group:28, mpg:46, boot_litres:380, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1616788494707-ec28f08d05a1?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-04-22',result:'Pass',mileage:23100,advisories:[]}], description:'Premium S Line spec, virtual cockpit, Bang & Olufsen sound.' },
  { id:'u014', make:'Volvo', model:'XC60', variant:'B4 AWD R-Design', year:2021, price:34000, mileage:33000, fuel:'Mild Hybrid', transmission:'Automatic', body:'SUV', seats:5, colour:'Pebble Grey', location:'Oxford', region:'South East', insurance_group:36, mpg:48, boot_litres:505, ncap:5, ulez:true, ved_annual:30, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1581540222194-0def2dda95b8?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-02-10',result:'Pass',mileage:30800,advisories:[]}], description:'Scandinavian luxury SUV. Pilot Assist, Bowers & Wilkins audio.' },
  { id:'u015', make:'Renault', model:'Zoe', variant:'50kWh GT Line+', year:2021, price:12900, mileage:31000, fuel:'Electric', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Flame Red', location:'Brighton', region:'South East', insurance_group:21, mpg:null, range_miles:245, boot_litres:338, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-07-30',result:'Pass',mileage:29200,advisories:[]}], description:'Affordable EV entry point. Ideal for city use. Rapid charge compatible.' },
  // Budget tier (£7k–£12k)
  { id:'u016', make:'Ford', model:'Fiesta', variant:'1.0 EcoBoost Titanium', year:2019, price:7995, mileage:44000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Magnetic Grey', location:'Derby', region:'Midlands', insurance_group:10, mpg:55, boot_litres:292, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-06-01',result:'Pass',mileage:42100,advisories:[]},{date:'2023-05-28',result:'Pass',mileage:35200,advisories:['Windscreen chip, monitor']}], description:"Britain's best-selling small car. Insurance group 10, ideal first car." },
  { id:'u017', make:'Toyota', model:'Aygo', variant:'1.0 VVT-i X-Play', year:2021, price:9200, mileage:19000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Pulse White', location:'Birmingham', region:'Midlands', insurance_group:6, mpg:58, boot_litres:168, ncap:5, ulez:true, ved_annual:30, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-07-10',result:'Pass',mileage:17800,advisories:[]}], description:'Insurance group 6 — the lowest available. Perfect city car.' },
  { id:'u018', make:'Volkswagen', model:'Polo', variant:'1.0 TSI SE', year:2019, price:10495, mileage:38500, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Deep Black', location:'Leicester', region:'Midlands', insurance_group:13, mpg:50, boot_litres:351, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-05-20',result:'Pass',mileage:36300,advisories:[]}], description:'VW build quality at a budget price. Apple CarPlay, single owner.' },
  { id:'u019', make:'SEAT', model:'Ibiza', variant:'1.0 TSI SE Technology', year:2020, price:10950, mileage:28000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Nevada White', location:'Sheffield', region:'Yorkshire', insurance_group:11, mpg:52, boot_litres:355, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-25',result:'Pass',mileage:26100,advisories:[]}], description:'VW Group quality, sporty styling, digital dash.' },
  { id:'u020', make:'Hyundai', model:'i10', variant:'1.2 MPi SE Connect', year:2022, price:11200, mileage:13500, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Aqua Sparkling', location:'Norwich', region:'East', insurance_group:7, mpg:53, boot_litres:252, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Nearly new with Hyundai 5-year warranty. Tiny running costs.' },
  // Premium / upper segment
  { id:'u021', make:'Mercedes-Benz', model:'C-Class', variant:'C220d AMG Line', year:2020, price:26500, mileage:44000, fuel:'Diesel', transmission:'Automatic', body:'Saloon', seats:5, colour:'Obsidian Black', location:'London', region:'London', insurance_group:38, mpg:62, boot_litres:455, ncap:5, ulez:true, ved_annual:30, fsh:true, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-18',result:'Pass',mileage:41200,advisories:[]},{date:'2023-03-15',result:'Pass',mileage:34000,advisories:[]}], description:'Executive saloon, Burmester sound, driving assistance package.' },
  { id:'u022', make:'Porsche', model:'Cayenne', variant:'3.0 V6 S E-Hybrid Tiptronic', year:2019, price:54995, mileage:38000, fuel:'PHEV', transmission:'Automatic', body:'SUV', seats:5, colour:'Jet Black', location:'London', region:'London', insurance_group:44, mpg:83, boot_litres:770, ncap:5, ulez:true, ved_annual:20, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1581540222194-0def2dda95b8?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-01-05',result:'Pass',mileage:35400,advisories:[]}], description:"Performance SUV with hybrid efficiency. Porsche Approved Warranty." },
  // New cars
  { id:'n001', make:'Toyota', model:'Yaris Cross', variant:'1.5 Hybrid Excel', year:2024, price:28950, mileage:0, fuel:'Hybrid', transmission:'Automatic', body:'SUV', seats:5, colour:'Juniper Blue', location:'Milton Keynes', region:'Midlands', insurance_group:14, mpg:64, boot_litres:397, ncap:5, ulez:true, ved_annual:20, fsh:true, owners:0, condition:'New', new_or_used:'new', image:'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80', listing_url:'https://www.toyota.co.uk', mot_history:[], description:'Brand new. 5-year Toyota warranty. Self-charging hybrid, no plug needed.' },
  { id:'n002', make:'Volkswagen', model:'ID.3', variant:'Pro S 77kWh', year:2024, price:39500, mileage:0, fuel:'Electric', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Moonstone Grey', location:'Milton Keynes', region:'Midlands', insurance_group:31, mpg:null, range_miles:336, boot_litres:385, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:0, condition:'New', new_or_used:'new', image:'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80', listing_url:'https://www.volkswagen.co.uk', mot_history:[], description:'Brand new. 3-year/100,000 mile warranty. 336-mile range. OTA updates.' },
  { id:'n003', make:'Kia', model:'EV6', variant:'77.4kWh GT-Line S RWD', year:2024, price:44995, mileage:0, fuel:'Electric', transmission:'Automatic', body:'SUV', seats:5, colour:'Glacier White', location:'London', region:'London', insurance_group:34, mpg:null, range_miles:328, boot_litres:480, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:0, condition:'New', new_or_used:'new', image:'https://images.unsplash.com/photo-1593941707874-ef25b8b4a92b?w=800&q=80', listing_url:'https://www.kia.com/uk', mot_history:[], description:'Brand new. 7-year Kia warranty. 800V ultra-fast charging. Head-up display.' },
  { id:'n004', make:'Ford', model:'Puma', variant:'1.0 EcoBoost Hybrid ST-Line', year:2024, price:27495, mileage:0, fuel:'Mild Hybrid', transmission:'Automatic', body:'SUV', seats:5, colour:'Desert Island Blue', location:'Coventry', region:'Midlands', insurance_group:20, mpg:52, boot_litres:456, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:0, condition:'New', new_or_used:'new', image:'https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?w=800&q=80', listing_url:'https://www.ford.co.uk', mot_history:[], description:'Brand new. Ford 3-year warranty. Clever MegaBox understorage.' },
  { id:'n005', make:'BMW', model:'i4', variant:'eDrive40 M Sport', year:2024, price:59900, mileage:0, fuel:'Electric', transmission:'Automatic', body:'Saloon', seats:5, colour:'Phytonic Blue', location:'London', region:'London', insurance_group:40, mpg:null, range_miles:365, boot_litres:470, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:0, condition:'New', new_or_used:'new', image:'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80', listing_url:'https://www.bmw.co.uk', mot_history:[], description:'Brand new M Sport electric. 3-year/unlimited mileage warranty. Wireless CarPlay.' },
];

// ─── ELLA SYSTEM PROMPT (covers all user + broker criteria) ──────────────────
function buildEllaPrompt(profile) {
  const p = profile || {};
  return `You are Ella, Carella's AI car concierge. You are the user's brilliant, impartial car expert friend — knowledgeable about the UK market, never salesy, always honest.

Your job is to deeply understand what the user needs — including things they might not know to ask — and find them the right car. You should ask smart follow-up questions where you need more information, and use everything you already know about the user.

━━━ DRIVER PROFILE (from onboarding quiz) ━━━
Age: ${p.age||'unknown'} | Gender: ${p.gender||'unknown'} | Location: ${p.location_display||'unknown'} (${p.location_postcode||''})
Occupation: ${p.occupation||'unknown'}
Driving history: ${Array.isArray(p.driving_history)?p.driving_history.join(', '):'none specified'}
Finance preference: ${Array.isArray(p.finance_method)?p.finance_method.join(', '):'unknown'}
Budget: ${p.budget?JSON.stringify(p.budget):'unknown'}
Priorities (1–10): ${p.priorities?JSON.stringify(p.priorities):'not set'}
Preferred brands: ${Array.isArray(p.preferred_brands)?p.preferred_brands.join(', '):'none'}
Car types wanted: ${Array.isArray(p.car_types)?p.car_types.join(', '):'any'}
Use cases: ${Array.isArray(p.use_cases)?p.use_cases.join(', '):'unknown'}
Must-have features: ${Array.isArray(p.must_have_features)?p.must_have_features.join(', '):'none'}
Dream car: ${Array.isArray(p.dream_cars)?p.dream_cars.join(', '):'not specified'}

━━━ FULL USER CRITERIA TO ASSESS ━━━
You must consider ALL of the following when searching and advising. Ask about any that are unknown and material:

VEHICLE TYPE & CONDITION:
- EV / HEV (self-charging hybrid) / PHEV (plug-in) / petrol / diesel preference
- New vs used — if used: acceptable age range, max mileage, auction tolerance, willingness to travel to collect, reliability tolerance, how 'perfect' they want it (cosmetic tolerance)
- If new: inventory (available now) vs build-to-order, how long willing to wait, willing to travel to collect

FINANCIAL:
- Finance method: lease / PCP finance / HP / cash / salary sacrifice
- Total budget OR monthly payment budget, deposit available, contract length (lease/finance)
- Insurance group sensitivity (especially important for young/new drivers)
- Annual VED (road tax) cost — relevant especially for older diesels and high-emission cars
- Maintenance budget — cost of servicing, parts availability, main dealer vs independent
- How long they plan to keep the car (affects depreciation calculation)
- Residual value / resale considerations — some models hold value far better
- Is there a car to part-exchange? What is it? Likely value?

USAGE & LIFESTYLE:
- Primary journey types: motorway commuting (→ favour diesel/hybrid), city driving (→ favour EV/small/petrol), fun weekend driving, mixed
- Weather and road conditions (e.g. rural roads → consider ground clearance/AWD)
- Annual mileage estimate
- Kids in the car? Age of children (affects NCAP priority, ISOFIX, boot size)
- Pets? (boot space, folding seats)
- Towing? (weight rating needed)
- Need to test drive before buying?
- Congestion charge / ULEZ zones in regular driving area

CHARGING / RANGE (for EV/PHEV):
- Ability to charge at home (driveway/garage → big yes to EV; flat/street parking → makes EV harder)
- Workplace charging available?
- Typical daily mileage vs EV range needs
- Range anxiety tolerance

PRACTICAL REQUIREMENTS:
- Number of seats needed (5 vs 7)
- Boot size requirements (buggy, bikes, dog, shopping)
- Body type preference (hatchback, SUV/crossover, estate, saloon, coupe, convertible, MPV)
- Size constraints (garage dimensions, parking space size, city parking ease)
- Who else drives the car? (spouse, partner — affects ease of use, size preference, features needed)
- ADAS preferences: full ADAS suite, parking cameras/sensors, adaptive cruise, lane keep, blind spot warning, specific preferences

CAR QUALITY & HISTORY (for used):
- Full main dealer service history (FSH) vs partial vs none — and the price premium worth paying
- MOT history — any advisories, recurring issues
- Accident / damage history
- Finance outstanding check (HPI clear)
- Number of previous owners (many owners quickly = red flag)
- Tyre condition and age (4 new tyres = £400-600 cost if needed)
- Spare key, book pack, standard tools
- Signs of bodywork repairs (resprays, panel alignment)
- Import/export/scrapped flag

PREFERENCES & SPECIFICS:
- Brand preference / country of origin bias
- Specific model in mind already?
- Colour (exterior and interior) — note: black shows chips/scratches more, dark interiors hide mess, light interiors feel larger
- Style preferences (sporty, practical, understated, premium feel)
- Manual vs automatic gearbox
- Engine character preferences (turbocharged, naturally aspirated, power/torque balance)
- Handling: sporty vs comfortable ride
- Noise levels (important for motorway cruising or if young kids sleep in the car)
- New tech features wanted (wireless CarPlay, digital cockpit, head-up display, etc.)
- Modifications acceptable / planning to modify?

BROKER INTELLIGENCE (surface automatically where relevant):
- Is a new model coming soon that would drop residual values / make waiting worthwhile?
- Typical depreciation curve for the specific model — some cars lose 40% in year 1, others hold value well
- Supply/demand dynamics (some models have long waits or are hard to find)
- Upcoming legislation changes (e.g. ZEV mandate, London ULEZ expansion, BIK tax changes for PHEV/EV)
- Price vs market benchmarks (CAP Clean / Glass's Guide — is this a fair price?)
- How long has it been listed? Any price reductions? (signals ability to negotiate)
- Proximity to main dealers for warranty claims / servicing
- Outstanding manufacturer recalls
- Parts availability for rarer models

━━━ INSTRUCTIONS ━━━
1. Use the Driver Profile AND the current conversation to extract search parameters.
2. Apply profile intelligence automatically:
   - driving_history includes "licence points" → cap insurance_group_max at 18
   - driving_history includes "newly qualified" or age < 23 → prioritise low insurance groups
   - occupation suggests salary sacrifice eligibility → flag PHEV/EV benefit
   - location is London → check ULEZ, flag congestion charge for diesels pre-Euro 6
   - dream_cars → use for aspirational context and comparison
   - use_cases includes "towing" → check tow rating
   - use_cases includes "school run" + kids → weight NCAP, ISOFIX, boot size
3. Return ONLY valid JSON — no prose outside the JSON object.
4. Skip follow-up questions already answered in the Driver Profile.
5. Ask ONE smart follow-up question about the most important unknown, NOT a list of questions.

━━━ REQUIRED JSON RESPONSE FORMAT ━━━
{
  "search_params": {
    "budget_max": number|null,
    "budget_min": number|null,
    "monthly_max": number|null,
    "make": string[],
    "model": string[],
    "body_type": string[],
    "fuel_type": string|null,
    "new_or_used": "new"|"used"|"either"|null,
    "transmission": string|null,
    "year_min": number|null,
    "year_max": number|null,
    "mileage_max": number|null,
    "seats_min": number|null,
    "ulez_required": boolean|null,
    "ncap_min": number|null,
    "insurance_group_max": number|null,
    "boot_litres_min": number|null,
    "tow_required": boolean|null,
    "fsh_required": boolean|null,
    "ev_range_min": number|null,
    "home_charging": boolean|null,
    "adas_required": boolean|null,
    "max_owners": number|null,
    "needs_clarification": boolean
  },
  "ella_message": "1–2 warm, specific sentences referencing what you found and why it suits this user.",
  "follow_up_question": "One smart question about the most important unknown gap.",
  "broker_notes": "Optional: 1 sentence of broker intelligence worth surfacing (depreciation, new model, legislation, etc.). Omit if nothing material."
}`;
}

// ─── SCORING ──────────────────────────────────────────────────────────────────
function scoreCar(car, params, profile) {
  let score = 100;
  const p = profile || {};
  const bmax = params.budget_max || p.budget?.cash_max || 50000;
  const bmin = params.budget_min || 0;

  // Budget (40 pts)
  if (car.price <= bmax && car.price >= bmin) {
    score += 30 + (1 - (car.price / bmax)) * 10; // closer to ceiling = slightly higher spec
  } else if (car.price > bmax) {
    score -= 60;
  }

  // Monthly budget (alternative)
  if (params.monthly_max && !params.budget_max) {
    const est = car.price / 48; // rough 4yr finance
    if (est <= params.monthly_max) score += 30;
    else score -= 40;
  }

  // New vs used
  if (params.new_or_used === 'new' && car.new_or_used !== 'new') score -= 50;
  if (params.new_or_used === 'used' && car.new_or_used === 'new') score -= 50;

  // Fuel (20 pts)
  const wantedFuel = params.fuel_type;
  if (wantedFuel) {
    const f = car.fuel.toLowerCase();
    const w = wantedFuel.toLowerCase();
    if (f === w || (w === 'hybrid' && (f === 'hybrid' || f === 'mild hybrid' || f === 'phev')) ||
        (w === 'phev' && f === 'phev') || (w === 'electric' && f === 'electric')) {
      score += 20;
    } else if (w === 'ev' && f === 'electric') {
      score += 20;
    } else {
      score -= 15;
    }
  }

  // Body (20 pts)
  const wantedBody = params.body_type?.length ? params.body_type : (p.car_types || []);
  if (wantedBody.length > 0) {
    if (wantedBody.some(b => car.body.toLowerCase().includes(b.toLowerCase()))) score += 20;
    else score -= 10;
  }

  // Insurance group (15 pts)
  const igMax = params.insurance_group_max ||
    (Array.isArray(p.driving_history) && p.driving_history.some(h => h.toLowerCase().includes('licence points')) ? 18 : null) ||
    (p.age < 23 ? 16 : null);
  if (igMax) {
    if (car.insurance_group <= igMax) score += 15;
    else score -= 25;
  }

  // Mileage (10 pts)
  const miMax = params.mileage_max;
  if (miMax && car.mileage > miMax) score -= 30;
  else if (car.mileage < 20000) score += 10;
  else if (car.mileage < 40000) score += 5;

  // ULEZ
  if (params.ulez_required === true) {
    if (car.ulez) score += 12; else score -= 35;
  }

  // Seats
  if (params.seats_min && car.seats < params.seats_min) score -= 50;

  // NCAP
  if (params.ncap_min && car.ncap < params.ncap_min) score -= 25;

  // Towing
  if (params.tow_required === true && car.body !== 'Estate' && car.body !== 'SUV') score -= 20;

  // FSH
  if (params.fsh_required === true && !car.fsh && car.new_or_used === 'used') score -= 20;

  // EV range
  if (params.ev_range_min && car.range_miles && car.range_miles < params.ev_range_min) score -= 30;
  if (params.ev_range_min && !car.range_miles) score -= 20;

  // Make match (bonus)
  if (params.make?.length) {
    if (params.make.some(m => car.make.toLowerCase().includes(m.toLowerCase()) || car.model.toLowerCase().includes(m.toLowerCase()))) {
      score += 25;
    }
  }

  // Transmission
  if (params.transmission) {
    if (car.transmission.toLowerCase() === params.transmission.toLowerCase()) score += 10;
    else score -= 12;
  }

  // Year
  if (params.year_min && car.year < params.year_min) score -= 20;
  if (params.year_max && car.year > params.year_max) score -= 20;

  // Max owners
  if (params.max_owners != null && car.owners > params.max_owners) score -= 15;

  // MOT quality bonus
  const lastMot = car.mot_history?.[0];
  if (lastMot?.result === 'Pass' && lastMot?.advisories?.length === 0) score += 8;
  if (car.fsh) score += 5;
  if (car.owners <= 1) score += 5;

  // Boot size
  if (params.boot_litres_min && car.boot_litres < params.boot_litres_min) score -= 15;

  return Math.round(score);
}

function calcTCO(car) {
  const petrolP = 1.48, dieselP = 1.52, evPpm = 0.05; // £/mile for ev
  const annualMiles = 8000;
  let fuelMonthly = 0;
  if (car.fuel === 'Electric') fuelMonthly = (annualMiles * evPpm) / 12;
  else if (['Hybrid','Mild Hybrid'].includes(car.fuel)) fuelMonthly = (annualMiles / (car.mpg * 0.8) * 4.546 * petrolP) / 12;
  else if (car.fuel === 'PHEV') fuelMonthly = (annualMiles * 0.4 * evPpm + annualMiles * 0.6 / (car.mpg || 50) * 4.546 * petrolP) / 12;
  else if (car.fuel === 'Diesel') fuelMonthly = (annualMiles / (car.mpg || 55) * 4.546 * dieselP) / 12;
  else fuelMonthly = (annualMiles / (car.mpg || 40) * 4.546 * petrolP) / 12;

  const insMonthly = car.insurance_group * 4.2;
  const vedMonthly = (car.ved_annual || 0) / 12;
  return {
    total: Math.round(fuelMonthly + insMonthly + vedMonthly),
    fuel: Math.round(fuelMonthly),
    insurance: Math.round(insMonthly),
    ved: Math.round(vedMonthly),
  };
}

function searchInventory(params, profile) {
  // In production: call Marketcheck UK API or Apify AutoTrader scraper here
  // Marketcheck UK: GET https://marketcheck.uk/api/v1/search?api_key=KEY&fuel_type=...
  // Apify: POST https://api.apify.com/v2/acts/memo23~autotrader-cheerio/run-sync-get-dataset-items
  const bmax = params.budget_max || profile?.budget?.cash_max || 200000;
  const candidates = UK_CARS.filter(c => {
    if (c.price > bmax * 1.15) return false;
    if (params.seats_min && c.seats < params.seats_min) return false;
    if (params.ulez_required === true && !c.ulez) return false;
    if (params.new_or_used === 'new' && c.new_or_used !== 'new') return false;
    if (params.new_or_used === 'used' && c.new_or_used === 'new') return false;
    return true;
  });
  return candidates
    .map(c => ({ ...c, score: scoreCar(c, params, profile), tco: calcTCO(c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ─── SMART MOCK ELLA (when no API key) ──────────────────────────────────────
function mockElla(message, existing, profile) {
  const m = message.toLowerCase();
  const params = { ...existing };

  // Budget
  const bm = m.match(/£?([\d,]+)\s*k?(?:\s*(?:per\s*month|\/mo|pm|a\s*month))?/gi);
  if (bm) {
    const amounts = bm.map(x => {
      const n = parseFloat(x.replace(/[£,]/g,''));
      const isK = x.toLowerCase().includes('k') && n < 500;
      const isMonthly = x.toLowerCase().match(/per\s*month|\/mo|pm|a\s*month/);
      return isMonthly ? { monthly: n } : { cash: isK ? n*1000 : n };
    });
    const cash = amounts.filter(a => a.cash).map(a => a.cash).filter(n => n > 500 && n < 200000);
    const monthly = amounts.filter(a => a.monthly).map(a => a.monthly).filter(n => n > 50 && n < 5000);
    if (cash.length >= 2) { params.budget_min = Math.min(...cash); params.budget_max = Math.max(...cash); }
    else if (cash.length === 1) params.budget_max = cash[0];
    if (monthly.length) params.monthly_max = Math.max(...monthly);
  }

  // New vs used
  if (m.includes('brand new') || m.includes('new car') || m.includes('new model') || m.includes('0 miles') || m.match(/buy new\b/)) params.new_or_used = 'new';
  else if (m.includes('used') || m.includes('second hand') || m.includes('preowned') || m.includes('pre-owned')) params.new_or_used = 'used';

  // Fuel
  if (m.match(/\bev\b|electric|battery|bev/)) params.fuel_type = 'Electric';
  else if (m.includes('phev') || m.match(/plug[- ]in hybrid/)) params.fuel_type = 'PHEV';
  else if (m.includes('hybrid') || m.includes('hev')) params.fuel_type = 'Hybrid';
  else if (m.includes('diesel')) params.fuel_type = 'Diesel';
  else if (m.includes('petrol')) params.fuel_type = 'Petrol';

  // Body
  if (m.match(/\bsuv\b|crossover|4x4|four.wheel drive/)) params.body_type = ['SUV'];
  else if (m.includes('estate')) params.body_type = ['Estate'];
  else if (m.match(/saloon|sedan/)) params.body_type = ['Saloon'];
  else if (m.match(/hatchback|\bhatch\b/)) params.body_type = ['Hatchback'];
  else if (m.match(/convertible|cabriolet|roadster|open.top/)) params.body_type = ['Convertible'];
  else if (m.match(/mpv|people.carrier|minivan/)) params.body_type = ['MPV'];
  else if (m.match(/coupe|coupé/)) params.body_type = ['Coupe'];
  else if (m.match(/7.seat|seven.seat|7 seat|8 seat/)) { params.body_type = ['SUV']; params.seats_min = 7; }

  // Insurance sensitivity
  if (m.match(/low insurance|cheap insurance|new driver|first car|just passed|provisional|young driver|18|19|20|21/)) {
    params.insurance_group_max = 16;
  }

  // ULEZ / London
  if (m.match(/ulez|london|congestion|clean air zone|caz/)) params.ulez_required = true;

  // Transmission
  if (m.match(/\bauto\b|automatic|dsg|tip.?tronic/)) params.transmission = 'Automatic';
  else if (m.match(/\bmanual\b|\bmt\b/)) params.transmission = 'Manual';

  // Seats
  const sm = m.match(/(\d)\s*seat/);
  if (sm) params.seats_min = parseInt(sm[1]);

  // Towing
  if (m.match(/tow|trailer|caravan|horse|box/)) params.tow_required = true;

  // Service history
  if (m.match(/full service history|fsh|full history/)) params.fsh_required = true;

  // Mileage
  const mm = m.match(/under\s*([\d,]+)\s*(?:k\s*)?miles?|below\s*([\d,]+)\s*(?:k\s*)?miles?|([\d,]+)\s*(?:k\s*)?miles?\s*(?:max|maximum|or less)/i);
  if (mm) {
    const raw = mm[1]||mm[2]||mm[3];
    const n = parseFloat(raw.replace(/,/g,''));
    params.mileage_max = raw.includes('k') || n < 500 ? n*1000 : n;
  }

  // EV range
  const rm = m.match(/([\d]+)\s*(?:\+\s*)?miles?\s*(?:range|of range)?/i);
  if (rm && params.fuel_type === 'Electric') params.ev_range_min = parseInt(rm[1]);

  // Year
  const ym = m.match(/(?:from\s*)?(20\d\d)\s*(?:or newer|onwards|\+)?/i);
  if (ym) params.year_min = parseInt(ym[1]);

  // Brand / model
  const brands = ['volkswagen','vw','golf','ford','toyota','bmw','audi','mercedes','mercedes-benz','nissan','honda','volvo','tesla','hyundai','kia','seat','skoda','vauxhall','peugeot','renault','mazda','land rover','landrover','jaguar','porsche','lexus','mini','citroen','fiat','alfa romeo','subaru','mitsubishi','suzuki'];
  const found = brands.filter(b => m.includes(b));
  if (found.length) params.make = found.map(b => b === 'vw' ? 'Volkswagen' : b.charAt(0).toUpperCase()+b.slice(1));

  // Is it a car query?
  const isCar = m.length > 4 && (bm||params.fuel_type||params.body_type||params.make?.length||['car','drive','vehicle','miles','seats','boot','engine','petrol','diesel','ev','hybrid','reliable','family','commute','lease','finance'].some(w=>m.includes(w)));

  if (!isCar) {
    return {
      search_params: { needs_clarification: true },
      ella_message: "Hi, I'm Ella — your personal car concierge. Tell me what you're after: your budget, what you'll use it for, and anything that matters to you in a car.",
      follow_up_question: "What's your rough budget, and are you looking at new or used?",
      broker_notes: null,
    };
  }

  const msgs = [
    `I've searched the UK market and here are your strongest options right now.`,
    `Found some great matches for you — these should tick your key boxes.`,
    `Here are the best picks I found across the UK market.`,
    `I've filtered through the listings and these stand out for your situation.`,
  ];
  const fqs = [
    "Are you planning to charge at home, or would street parking be a factor?",
    "Would you prefer automatic gearbox, or are you happy with manual?",
    "How important is a full service history to you versus a lower price?",
    "Are there any must-have features — parking cameras, CarPlay, heated seats?",
    "How many miles do you typically drive per year?",
    "Is there a car you're trading in? That could affect the budget significantly.",
    "Would you be willing to travel to collect the right car, or does it need to be nearby?",
  ];

  return {
    search_params: { ...params, needs_clarification: false },
    ella_message: msgs[Math.floor(Math.random()*msgs.length)],
    follow_up_question: fqs[Math.floor(Math.random()*fqs.length)],
    broker_notes: null,
  };
}

// ─── SESSION STORE ────────────────────────────────────────────────────────────
const sessions = new Map();
function getSession(id, profile) {
  if (!sessions.has(id)) {
    sessions.set(id, { id, profile: profile||{}, messages:[], resolved_params:{}, result_ids:[], daily_count:0 });
  }
  return sessions.get(id);
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status:'ok', inventory:UK_CARS.length, ella: process.env.ANTHROPIC_API_KEY ? 'live' : 'demo' }));

app.get('/api/cars', (_, res) => res.json(UK_CARS.map(c => ({ ...c, tco: calcTCO(c) }))));

app.get('/api/car/:id', (req, res) => {
  const car = UK_CARS.find(c => c.id === req.params.id);
  if (!car) return res.status(404).json({ error: 'Not found' });
  res.json({ ...car, tco: calcTCO(car) });
});

app.post('/api/ella/search', async (req, res) => {
  const { session_id, user_message, profile } = req.body;
  if (!user_message?.trim()) return res.status(400).json({ error: 'message required' });

  const session = getSession(session_id || `s_${Date.now()}`, profile);
  session.messages.push({ role: 'user', content: user_message });

  let ella;
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('no key');

    const history = session.messages.slice(-10).map(m => ({
      role: m.role,
      content: m.role === 'user' && session.messages.indexOf(m) === session.messages.length-1
        ? (Object.keys(session.resolved_params).length
            ? `[Previous context: ${JSON.stringify(session.resolved_params)}]\n${user_message}`
            : user_message)
        : m.content,
    }));

    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: buildEllaPrompt(session.profile),
      messages: history,
    });

    const raw = resp.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('bad json');
    ella = JSON.parse(match[0]);
  } catch {
    ella = mockElla(user_message, session.resolved_params, session.profile);
  }

  const { search_params, ella_message, follow_up_question, broker_notes } = ella;
  const merged = { ...session.resolved_params, ...search_params };
  session.resolved_params = merged;
  session.messages.push({ role: 'assistant', content: ella_message });
  session.daily_count++;

  let results = [];
  if (!search_params.needs_clarification) {
    results = searchInventory(merged, session.profile);
    session.result_ids = results.map(r => r.id);
  }

  res.json({ session_id: session.id, ella_message, follow_up_question, broker_notes, results, resolved_params: merged, needs_clarification: search_params.needs_clarification || false });
});

app.get('/api/ella/session/:id', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  res.json(s);
});

app.get('/{*splat}', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚗  Carella running → http://localhost:${PORT}`);
  console.log(`    Ella: ${process.env.ANTHROPIC_API_KEY ? '✅ Live (Claude API)' : '⚡ Demo mode'}`);
  console.log(`    Inventory: ${UK_CARS.length} UK cars (${UK_CARS.filter(c=>c.new_or_used==='new').length} new, ${UK_CARS.filter(c=>c.new_or_used==='used').length} used)\n`);
  console.log(`    Inventory source: Marketcheck UK API (add MARKETCHECK_UK_KEY to .env)`);
  console.log(`    Fallback: Apify AutoTrader scraper (add APIFY_KEY to .env)\n`);
});
