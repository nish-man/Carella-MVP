const Anthropic = require('@anthropic-ai/sdk');

// ─── CONFIG ───────────────────────────────────────────────────────
const SUPABASE_URL    = process.env.SUPABASE_URL    || 'https://bhrbrbrawrzcpuwkzwjz.supabase.co';
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const APIFY_TOKEN     = process.env.APIFY_TOKEN;
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;
const STRIPE_SECRET   = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK  = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const APP_URL         = process.env.APP_URL || 'https://carella-mvp.vercel.app';

const MAX_FREE_SEARCHES = 3;

// ─── SUPABASE HELPER ──────────────────────────────────────────────
async function sbFetch(path, method = 'GET', body = null) {
  if (!SUPABASE_KEY) return null;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Prefer': method === 'POST' ? 'return=representation' : '',
    }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, opts);
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('Supabase error:', e.message);
    return null;
  }
}

async function getProfile(userId) {
  if (!userId) return null;
  const r = await sbFetch(`/profiles?id=eq.${userId}&limit=1`);
  return r?.[0] || null;
}

async function upsertProfile(userId, data) {
  return sbFetch(`/profiles?id=eq.${userId}`, 'PATCH', data);
}

async function getSession(sessionId) {
  const r = await sbFetch(`/ella_sessions?id=eq.${sessionId}&limit=1`);
  return r?.[0] || null;
}

async function saveSession(sessionId, userId, data) {
  // Upsert session
  const existing = await getSession(sessionId);
  if (existing) {
    return sbFetch(`/ella_sessions?id=eq.${sessionId}`, 'PATCH', { ...data, updated_at: new Date().toISOString() });
  } else {
    return sbFetch('/ella_sessions', 'POST', { id: sessionId, user_id: userId, ...data });
  }
}

async function checkRateLimit(userId) {
  if (!userId) return { allowed: true, remaining: MAX_FREE_SEARCHES };
  const profile = await getProfile(userId);
  if (!profile) return { allowed: true, remaining: MAX_FREE_SEARCHES };
  if (profile.is_pro) return { allowed: true, remaining: 999, isPro: true };
  const today = new Date().toISOString().split('T')[0];
  const count = profile.last_search_date === today ? (profile.daily_ella_count || 0) : 0;
  const allowed = count < MAX_FREE_SEARCHES;
  return { allowed, remaining: Math.max(0, MAX_FREE_SEARCHES - count), count };
}

async function incrementSearchCount(userId) {
  if (!userId) return;
  const today = new Date().toISOString().split('T')[0];
  const profile = await getProfile(userId);
  const currentCount = profile?.last_search_date === today ? (profile.daily_ella_count || 0) : 0;
  await upsertProfile(userId, {
    daily_ella_count: currentCount + 1,
    last_search_date: today
  });
}

async function saveGarage(userId, carData) {
  if (!userId) return null;
  return sbFetch('/saved_cars', 'POST', {
    user_id: userId,
    listing_id: carData.id,
    listing_snapshot: carData,
    source_url: carData.listing_url
  });
}

async function getGarage(userId) {
  if (!userId) return [];
  const r = await sbFetch(`/saved_cars?user_id=eq.${userId}&order=saved_at.desc`);
  return r || [];
}

// ─── APIFY LIVE INVENTORY ─────────────────────────────────────────
async function fetchLiveListings(searchParams) {
  if (!APIFY_TOKEN) return null;

  console.log('Fetching live listings from Apify for:', searchParams);

  // Build AutoTrader search URL from params
  const buildSearchUrl = (params) => {
    const base = 'https://www.autotrader.co.uk/car-search?';
    const p = new URLSearchParams();
    if (params.body_type) p.set('bodyType', params.body_type);
    if (params.fuel_type) p.set('fuel', params.fuel_type);
    if (params.budget_max) p.set('price-to', params.budget_max);
    if (params.budget_min) p.set('price-from', params.budget_min);
    if (params.mileage_max) p.set('maximum-mileage', params.mileage_max);
    if (params.year_min) p.set('year-from', params.year_min);
    if (params.transmission) p.set('transmission', params.transmission.toLowerCase());
    if (params.make) p.set('make', params.make.toUpperCase());
    if (params.location && params.location !== 'UK') p.set('postcode', params.location.replace(/ /g,''));
    if (params.fuel_type === 'Electric') p.set('fuel', 'Electric');
    p.set('radius', '100');
    p.set('sort', 'relevance');
    return base + p.toString();
  };

  try {
    // Run Apify AutoTrader actor (memo23/autotrader-cheerio)
    const startResp = await fetch(
      `https://api.apify.com/v2/acts/memo23~autotrader-cheerio/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: buildSearchUrl(searchParams) }],
          maxItems: 20,
          proxyConfiguration: { useApifyProxy: true }
        })
      }
    );

    if (!startResp.ok) {
      console.error('Apify start failed:', startResp.status);
      return null;
    }

    const runData = await startResp.json();
    const runId = runData.data?.id;
    if (!runId) return null;

    console.log('Apify run started:', runId);

    // Poll for completion (max 30s)
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusResp = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );
      const status = await statusResp.json();
      const state = status.data?.status;
      console.log('Apify status:', state);

      if (state === 'SUCCEEDED') {
        const datasetId = status.data?.defaultDatasetId;
        const dataResp = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=20`
        );
        const items = await dataResp.json();
        console.log('Apify returned', items.length, 'listings');
        return normaliseApifyResults(items, searchParams);
      }

      if (state === 'FAILED' || state === 'ABORTED') {
        console.error('Apify run failed:', state);
        return null;
      }
    }

    console.log('Apify timed out — falling back to demo inventory');
    return null;
  } catch (e) {
    console.error('Apify fetch error:', e.message);
    return null;
  }
}

function normaliseApifyResults(items, params) {
  if (!items || !items.length) return [];

  return items.map((item, i) => {
    const price = parseInt(item.price?.replace(/[^0-9]/g, '') || '0');
    const mileage = parseInt(item.mileage?.replace(/[^0-9]/g, '') || '0');
    const year = parseInt(item.year || item.registrationYear || new Date().getFullYear() - 3);
    const make = item.make || item.title?.split(' ')[0] || 'Unknown';
    const model = item.model || item.title?.split(' ').slice(1, 3).join(' ') || 'Car';

    // Estimate insurance group from engine size / fuel
    const engineCC = parseInt(item.engineSize?.replace(/[^0-9]/g,'') || '1400');
    const insGroup = Math.min(50, Math.max(1, Math.round(engineCC / 100)));

    // TCO estimate
    const tco = calcTCO({ fuel: item.fuelType || 'Petrol', mpg: 45, ved_annual: 180, price });

    return {
      id: item.id || `at_${i}_${Date.now()}`,
      make,
      model,
      variant: item.title || `${make} ${model}`,
      year,
      price,
      mileage,
      fuel: normaliseFuel(item.fuelType),
      transmission: item.transmission || 'Manual',
      body: item.bodyType || params.body_type || 'Hatchback',
      colour: item.colour || 'Not specified',
      location: item.location || item.dealerLocation || 'UK',
      region: item.location || 'UK',
      insurance_group: insGroup,
      mpg: item.mpg || 45,
      boot_litres: item.bootCapacity || 350,
      ncap: item.ncapRating || 5,
      ulez: item.ulez ?? (year >= 2015),
      ved_annual: item.annualTax || 180,
      fsh: item.serviceHistory?.toLowerCase()?.includes('full') || false,
      owners: item.previousOwners || 1,
      condition: item.condition || 'Good',
      new_or_used: mileage === 0 ? 'new' : 'used',
      image: item.images?.[0] || item.imageUrl || 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80',
      listing_url: item.url || item.pageUrl || 'https://www.autotrader.co.uk',
      mot_history: item.motHistory || [],
      description: item.description || `${year} ${make} ${model} from AutoTrader.`,
      tco,
      source: 'autotrader_live',
      score: 70
    };
  }).filter(c => c.price > 0);
}

function normaliseFuel(raw) {
  if (!raw) return 'Petrol';
  const f = raw.toLowerCase();
  if (f.includes('electric')) return 'Electric';
  if (f.includes('plug') || f.includes('phev')) return 'PHEV';
  if (f.includes('hybrid')) return 'Hybrid';
  if (f.includes('diesel')) return 'Diesel';
  if (f.includes('mild')) return 'Mild Hybrid';
  return 'Petrol';
}

// ─── DEMO INVENTORY (fallback when no Apify) ─────────────────────
const UK_CARS = [
  { id:'u001', make:'Volkswagen', model:'Golf', variant:'1.5 TSI Life', year:2021, price:13495, mileage:34200, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Indigo Blue', location:'Manchester', region:'North West', insurance_group:16, mpg:52, boot_litres:380, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-12',result:'Pass',mileage:30100,advisories:[]}], description:'One careful owner, full VW service history, recent major service.' },
  { id:'u002', make:'Toyota', model:'Yaris', variant:'1.5 Hybrid Icon', year:2022, price:15990, mileage:18500, fuel:'Hybrid', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Pearl White', location:'Birmingham', region:'West Midlands', insurance_group:9, mpg:68, boot_litres:286, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-01-08',result:'Pass',mileage:14200,advisories:[]}], description:'Low mileage hybrid, zero road tax, excellent fuel economy.' },
  { id:'u003', make:'Ford', model:'Fiesta', variant:'1.0 EcoBoost Titanium', year:2020, price:9995, mileage:42000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Race Red', location:'Leeds', region:'Yorkshire', insurance_group:11, mpg:57, boot_litres:292, ncap:5, ulez:true, ved_annual:165, fsh:false, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-02-20',result:'Pass',mileage:38000,advisories:['Advisory: tyre wear front nearside']},{date:'2023-02-15',result:'Pass',mileage:29000,advisories:[]}], description:'Popular supermini, economical and fun to drive, two previous owners.' },
  { id:'u004', make:'Kia', model:'Sportage', variant:'1.6 CRDi GT-Line S', year:2021, price:21495, mileage:28900, fuel:'Diesel', transmission:'Automatic', body:'SUV', seats:5, colour:'Snow White Pearl', location:'Bristol', region:'South West', insurance_group:20, mpg:47, boot_litres:503, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-04-01',result:'Pass',mileage:24500,advisories:[]}], description:'Top-spec GT-Line S with panoramic sunroof, heated seats, and 7yr warranty.' },
  { id:'u005', make:'Tesla', model:'Model 3', variant:'Standard Range Plus', year:2021, price:26995, mileage:31000, fuel:'Electric', transmission:'Automatic', body:'Saloon', seats:5, colour:'Midnight Silver', location:'London', region:'London', insurance_group:30, mpg:0, boot_litres:425, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Popular EV with 267mi range, autopilot, over-the-air updates.', ev_range_miles:267 },
  { id:'u006', make:'Honda', model:'Jazz', variant:'1.5 i-MMD Crosstar EX', year:2021, price:17500, mileage:22000, fuel:'Hybrid', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Sonic Grey', location:'Edinburgh', region:'Scotland', insurance_group:14, mpg:62, boot_litres:304, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-01-15',result:'Pass',mileage:18000,advisories:[]}], description:'Practical hybrid crosstar with Magic Seats and excellent fuel economy.' },
  { id:'u007', make:'BMW', model:'3 Series', variant:'320d M Sport', year:2020, price:24995, mileage:45000, fuel:'Diesel', transmission:'Automatic', body:'Saloon', seats:5, colour:'Mineral Grey', location:'Manchester', region:'North West', insurance_group:32, mpg:55, boot_litres:480, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-20',result:'Pass',mileage:41000,advisories:[]}], description:'Premium diesel saloon with M Sport pack, full dealer service history.' },
  { id:'u008', make:'Seat', model:'Leon', variant:'1.5 TSI EVO FR', year:2021, price:16990, mileage:19800, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Midnight Black', location:'Cardiff', region:'Wales', insurance_group:17, mpg:50, boot_litres:380, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-02-10',result:'Pass',mileage:15500,advisories:[]}], description:'Sporty FR spec, low mileage, looks great and very well equipped.' },
  { id:'u009', make:'Nissan', model:'Leaf', variant:'40kWh Tekna', year:2020, price:18995, mileage:28000, fuel:'Electric', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Storm White', location:'Sheffield', region:'Yorkshire', insurance_group:18, mpg:0, boot_litres:435, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Practical electric hatchback, ProPilot semi-autonomous driving included.', ev_range_miles:168 },
  { id:'u010', make:'Skoda', model:'Octavia', variant:'2.0 TDI SE L', year:2021, price:19495, mileage:31000, fuel:'Diesel', transmission:'Manual', body:'Estate', seats:5, colour:'Quartz Grey', location:'Nottingham', region:'East Midlands', insurance_group:21, mpg:57, boot_litres:640, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-08',result:'Pass',mileage:27000,advisories:[]}], description:'Huge 640L boot, practical family estate with full service history.' },
  { id:'u011', make:'Hyundai', model:'Tucson', variant:'1.6 CRDi MHEV Premium', year:2022, price:24495, mileage:15000, fuel:'Mild Hybrid', transmission:'Automatic', body:'SUV', seats:5, colour:'Abyss Black', location:'Birmingham', region:'West Midlands', insurance_group:22, mpg:50, boot_litres:513, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1633586543672-a93cce8a90cc?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Nearly new Tucson with 5yr warranty remaining and very low mileage.' },
  { id:'u012', make:'Mazda', model:'CX-5', variant:'2.0 Skyactiv-G Sport', year:2020, price:20995, mileage:38000, fuel:'Petrol', transmission:'Automatic', body:'SUV', seats:5, colour:'Soul Red Crystal', location:'Liverpool', region:'North West', insurance_group:23, mpg:40, boot_litres:442, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1626668893632-6f3a4466d22f?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-02-28',result:'Pass',mileage:34500,advisories:[]}], description:'Beautiful Soul Red, single owner, one of the best-looking SUVs on sale.' },
  { id:'u013', make:'Ford', model:'Puma', variant:'1.0 EcoBoost Titanium', year:2021, price:18495, mileage:23000, fuel:'Petrol', transmission:'Automatic', body:'SUV', seats:5, colour:'Desert Island Blue', location:'Oxford', region:'South East', insurance_group:15, mpg:50, boot_litres:456, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-01-22',result:'Pass',mileage:19000,advisories:[]}], description:'Trendy crossover with MegaBox hidden storage, great spec and reliability.' },
  { id:'u014', make:'Peugeot', model:'e-208', variant:'GT 50kWh', year:2022, price:22995, mileage:12000, fuel:'Electric', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Elixir Red', location:'London', region:'London', insurance_group:20, mpg:0, boot_litres:265, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Stylish full EV, 217mi range, stunning i-Cockpit interior.', ev_range_miles:217 },
  { id:'u015', make:'Vauxhall', model:'Mokka', variant:'1.2T GS Line', year:2022, price:19995, mileage:16000, fuel:'Petrol', transmission:'Automatic', body:'SUV', seats:5, colour:'Volcanic Orange', location:'Newcastle', region:'North East', insurance_group:16, mpg:45, boot_litres:350, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Bold new Mokka design, GS Line spec with all the tech essentials.' },
  { id:'u016', make:'Volvo', model:'XC40', variant:'2.0 D3 Momentum', year:2020, price:23495, mileage:41000, fuel:'Diesel', transmission:'Automatic', body:'SUV', seats:5, colour:'Ice White', location:'Cambridge', region:'East', insurance_group:26, mpg:50, boot_litres:460, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1617115728025-2d6cfd7b8a7e?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-04-02',result:'Pass',mileage:37000,advisories:[]}], description:'Safe, stylish Scandinavian SUV with Pilot Assist and full history.' },
  { id:'u017', make:'Mini', model:'Cooper', variant:'2.0 Cooper S Sport', year:2021, price:21995, mileage:22000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:4, colour:'Chili Red', location:'Brighton', region:'South East', insurance_group:28, mpg:40, boot_litres:211, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1578786374088-2c24b88f28d5?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-01-30',result:'Pass',mileage:18500,advisories:[]}], description:'Fun Cooper S with Sport pack, JCW steering wheel and full history.' },
  { id:'u018', make:'Mercedes-Benz', model:'A-Class', variant:'A180 SE Auto', year:2020, price:22495, mileage:35000, fuel:'Petrol', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Mountain Grey', location:'London', region:'London', insurance_group:27, mpg:45, boot_litres:370, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1618843479619-f3d0d81e4d10?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-05',result:'Pass',mileage:31000,advisories:[]}], description:'Premium hatchback with MBUX infotainment, heated seats and LED lights.' },
  { id:'u019', make:'MG', model:'ZS EV', variant:'Long Range Exclusive', year:2022, price:21995, mileage:9000, fuel:'Electric', transmission:'Automatic', body:'SUV', seats:5, colour:'Dover White', location:'Bristol', region:'South West', insurance_group:19, mpg:0, boot_litres:448, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1593055357429-62a3f6a4e3e1?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Long-range electric SUV, nearly new, best value EV SUV in the UK.', ev_range_miles:273 },
  { id:'u020', make:'Audi', model:'A3', variant:'35 TFSI Sport S Tronic', year:2021, price:25995, mileage:28000, fuel:'Petrol', transmission:'Automatic', body:'Saloon', seats:5, colour:'Nano Grey', location:'London', region:'London', insurance_group:25, mpg:47, boot_litres:425, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-02-14',result:'Pass',mileage:24000,advisories:[]}], description:'Premium A3 Saloon, Virtual Cockpit, Matrix LED lights, full Audi SH.' },
  { id:'u021', make:'Toyota', model:'RAV4', variant:'2.5 VVT-h Excel CVT', year:2021, price:31495, mileage:26000, fuel:'Hybrid', transmission:'Automatic', body:'SUV', seats:5, colour:'Celestite Grey', location:'Glasgow', region:'Scotland', insurance_group:24, mpg:47, boot_litres:580, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1559062205-2db17f79e7eb?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-04-10',result:'Pass',mileage:22000,advisories:[]}], description:'Reliable family hybrid SUV, Toyota reliability record, 7yr warranty.' },
  { id:'u022', make:'Ford', model:'Kuga', variant:'2.5 PHEV Titanium X', year:2022, price:29995, mileage:18000, fuel:'PHEV', transmission:'Automatic', body:'SUV', seats:5, colour:'Lucid Red', location:'Leeds', region:'Yorkshire', insurance_group:26, mpg:201, boot_litres:411, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Plug-in hybrid SUV, great for salary sacrifice schemes, 37mi electric range.', ev_range_miles:37 },
  { id:'u023', make:'Volkswagen', model:'ID.4', variant:'Pro Performance', year:2022, price:34995, mileage:21000, fuel:'Electric', transmission:'Automatic', body:'SUV', seats:5, colour:'Glacier White', location:'London', region:'London', insurance_group:29, mpg:0, boot_litres:543, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'VW quality EV SUV, 323mi range, ideal for families and long-distance.', ev_range_miles:323 },
  { id:'u024', make:'Renault', model:'Zoe', variant:'R135 GT Line', year:2021, price:16995, mileage:19000, fuel:'Electric', transmission:'Automatic', body:'Hatchback', seats:5, colour:'Flame Red', location:'Manchester', region:'North West', insurance_group:16, mpg:0, boot_litres:338, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1581540222194-0def2dda95b8?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Affordable EV with 245mi range, great for city driving.', ev_range_miles:245 },
  { id:'u025', make:'Dacia', model:'Sandero', variant:'1.0 TCe Comfort', year:2022, price:10995, mileage:12000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Slate Grey', location:'Birmingham', region:'West Midlands', insurance_group:9, mpg:51, boot_litres:328, ncap:4, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1617531653332-bd46c16f4d68?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'Best value car in the UK, low insurance, ideal first car.' },
  { id:'u026', make:'Ford', model:'Fiesta', variant:'1.0 EcoBoost ST-Line', year:2019, price:7995, mileage:51000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Orange Fury', location:'Sheffield', region:'Yorkshire', insurance_group:12, mpg:52, boot_litres:292, ncap:5, ulez:true, ved_annual:165, fsh:false, owners:2, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-01-10',result:'Pass',mileage:47500,advisories:['Advisory: brake fluid requires replacement']},{date:'2023-01-08',result:'Pass',mileage:38000,advisories:[]}], description:'Sporty ST-Line, great entry price, fun to drive and economical.' },
  { id:'u027', make:'Volkswagen', model:'Polo', variant:'1.0 TSI Life', year:2021, price:11995, mileage:28000, fuel:'Petrol', transmission:'Manual', body:'Hatchback', seats:5, colour:'Reef Blue', location:'Bristol', region:'South West', insurance_group:10, mpg:55, boot_litres:351, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-01',result:'Pass',mileage:24000,advisories:[]}], description:'Refined city car, low insurance group, ideal for new drivers.' },,
  { id:'u028', make:'Kia', model:'Sorento', variant:'1.6 T-GDi HEV GT-Line', year:2022, price:34995, mileage:18000, fuel:'Hybrid', transmission:'Automatic', body:'SUV', seats:7, colour:'Gravity Blue', location:'Birmingham', region:'West Midlands', insurance_group:28, mpg:44, boot_litres:179, ncap:5, ulez:true, ved_annual:0, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[], description:'7-seat hybrid SUV, GT-Line spec, full Kia service history and 7yr warranty.' },
  { id:'u029', make:'Ford', model:'Galaxy', variant:'2.0 EcoBlue Titanium Auto', year:2020, price:22995, mileage:41000, fuel:'Diesel', transmission:'Automatic', body:'MPV', seats:7, colour:'Magnetic Grey', location:'Leeds', region:'Yorkshire', insurance_group:24, mpg:46, boot_litres:300, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Good', new_or_used:'used', image:'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-02-14',result:'Pass',mileage:37000,advisories:[]}], description:'Practical 7-seat MPV, electric sliding doors, excellent for school run.' },
  { id:'u030', make:'Skoda', model:'Kodiaq', variant:'2.0 TDI SE L 4x4 DSG', year:2021, price:27995, mileage:29000, fuel:'Diesel', transmission:'Automatic', body:'SUV', seats:7, colour:'Quartz Grey', location:'London', region:'London', insurance_group:26, mpg:44, boot_litres:270, ncap:5, ulez:true, ved_annual:165, fsh:true, owners:1, condition:'Excellent', new_or_used:'used', image:'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?w=800&q=80', listing_url:'https://www.autotrader.co.uk', mot_history:[{date:'2024-03-20',result:'Pass',mileage:25000,advisories:[]}], description:'7-seat SUV, panoramic sunroof, ULEZ compliant, full service history.' }
];

// ─── TCO CALCULATOR ───────────────────────────────────────────────
function calcTCO(car) {
  const fuelCosts = { Petrol:1.48, Diesel:1.52, Hybrid:1.00, Electric:0.28, PHEV:0.50, 'Mild Hybrid':1.20 };
  const milesPerYear = 10000;
  const ppl = fuelCosts[car.fuel] || 1.48;
  const fuelMonthly = car.fuel === 'Electric'
    ? Math.round(milesPerYear / 4 * ppl / 12)
    : Math.round(milesPerYear / (car.mpg || 45) * 4.546 * ppl / 12);
  const insMonthly = Math.round((car.insurance_group || 20) * 4.8 + 60);
  const vedMonthly = Math.round((car.ved_annual || 165) / 12);
  return { fuel: fuelMonthly, insurance: insMonthly, ved: vedMonthly, total: fuelMonthly + insMonthly + vedMonthly };
}

// ─── SCORING ─────────────────────────────────────────────────────
function scoreAndFilter(cars, params, profile) {
  const pri = profile?.priorities || {};
  const weightReliability = Math.min(0.40, 0.15 + ((pri.reliability || 5) - 5) * 0.025);
  const weightPrice      = Math.min(0.45, 0.25 + ((pri.price || 5) - 5) * 0.02);
  const weightEfficiency = Math.min(0.35, 0.10 + ((pri.efficiency || 5) - 5) * 0.025);

  const budgetMax = params.budget_max || profile?.budget_max || 100000;
  const budgetMin = params.budget_min || 0;
  const isNewDriver = profile?.driving_history?.some(h =>
    ['Newly qualified','Provisional licence','Licence points'].includes(h)
  );

  return cars
    .filter(c => {
      if (c.price > budgetMax * 1.05) return false;
      if (c.price < budgetMin) return false;
      if (params.fuel_type && c.fuel !== params.fuel_type && 
          !(params.fuel_type === 'Hybrid' && ['Hybrid','Mild Hybrid','PHEV'].includes(c.fuel))) return false;
      if (params.body_type && !c.body?.toLowerCase().includes(params.body_type.toLowerCase()) &&
          !c.body?.toLowerCase().includes('crossover')) return false;
      if (params.transmission && c.transmission !== params.transmission) return false;
      if (params.ulez_required && !c.ulez) return false;
      if (params.seats_min && (c.seats || 5) < params.seats_min) return false;
      if (params.fsh && !c.fsh) return false;
      if (params.mileage_max && c.mileage > params.mileage_max) return false;
      if (params.new_only && c.new_or_used !== 'new') return false;
      if (params.ev_range_min && (c.ev_range_miles || 0) < params.ev_range_min) return false;
      if (isNewDriver && c.insurance_group > (params.insurance_group_max || 16)) return false;
      return true;
    })
    .map(c => {
      const tco = calcTCO(c);
      let score = 0;
      // Price fit
      const priceFit = 1 - Math.abs(c.price - budgetMax * 0.8) / (budgetMax * 0.8);
      score += Math.max(0, priceFit) * 40 * weightPrice;
      // Reliability
      const motScore = c.mot_history?.every(m => m.result === 'Pass') ? 1 : 0.6;
      score += motScore * 25 * weightReliability;
      // TCO efficiency
      score += (1 - tco.total / 600) * 20 * weightEfficiency;
      // Insurance (for new drivers)
      if (isNewDriver) score += (1 - c.insurance_group / 50) * 15;
      // Preferred brands
      if (profile?.preferred_brands?.length && profile.preferred_brands.map(b=>b.toLowerCase()).includes(c.make.toLowerCase())) score += 10;
      // Feature matching
      if (profile?.must_have_features?.length) {
        const desc = (c.description + c.variant).toLowerCase();
        const matched = profile.must_have_features.filter(f =>
          desc.includes(f.toLowerCase().split('/')[0].trim())
        ).length;
        score += (matched / profile.must_have_features.length) * 10;
      }
      return { ...c, tco, score: Math.round(score) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ─── ELLA AI SEARCH ───────────────────────────────────────────────
async function runEllaSearch(message, conversationHistory, profile, sessionId) {
  const useAI = !!ANTHROPIC_KEY;

  // Try Apify for live listings first
  let liveListings = null;

  const systemPrompt = `You are Ella, Carella's AI car concierge — impartial, UK-specialist, the user's brilliant car-expert friend.

DRIVER PROFILE:
Age: ${profile.age||'?'} | Gender: ${profile.gender||'?'} | Location: ${profile.location_display||'UK'} ${profile.location_postcode||''}
Occupation: ${profile.occupation||'?'}
Driving history: ${(profile.driving_history||[]).join(', ')||'none'}
Finance: ${(profile.finance_method||[]).join(', ')||'not specified'}
Budget: ${profile.finance_method?.some(f=>['Finance / PCP','Lease','Salary sacrifice'].includes(f))
  ? `£${profile.monthly_max||'?'}/mo, £${profile.deposit||0} deposit, ${profile.contract_months||24}mo`
  : `up to £${profile.budget_max||25000}`}
${profile.trade_in_car ? `Trade-in: ${profile.trade_in_car}` : ''}
Priorities (1-10): reliability=${profile.priorities?.reliability||5}, efficiency=${profile.priorities?.efficiency||5}, brand=${profile.priorities?.brand||5}, performance=${profile.priorities?.performance||5}, size=${profile.priorities?.size||5} ${profile.size_preference||''}
Preferred brands: ${(profile.preferred_brands||[]).join(', ')||'any'}
Car types: ${(profile.car_types||[]).join(', ')||'any'}
Use cases: ${(profile.use_cases||[]).join(', ')||'general'}
Must-haves: ${(profile.must_have_features||[]).join(', ')||'none'}
Dream car: ${(profile.dream_cars||[]).join(', ')||'not specified'}

INSTRUCTIONS:
Return ONLY a valid JSON object with these exact keys:
{
  "ella_message": "1-2 warm sentences referencing profile context",
  "follow_up_question": "one specific question NOT already answered in profile",
  "broker_notes": "optional insider buying tip (timing, negotiation, known issues)",
  "needs_clarification": false,
  "search_params": {
    "budget_max": number,
    "budget_min": number,
    "fuel_type": "Petrol|Diesel|Hybrid|Electric|PHEV|Mild Hybrid|null",
    "body_type": "Hatchback|SUV|Estate|Saloon|Coupe|Convertible|MPV|null",
    "transmission": "Manual|Automatic|null",
    "mileage_max": number|null,
    "year_min": number|null,
    "ulez_required": boolean,
    "seats_min": number|null,
    "fsh": boolean|null,
    "new_only": boolean,
    "ev_range_min": number|null,
    "insurance_group_max": number|null,
    "make": "string|null",
    "location": "string|null"
  }
}

RULES:
- If driving_history includes "Newly qualified" or "Licence points", set insurance_group_max to 16
- If occupation mentions NHS/teacher/civil servant and user wants EV/PHEV, mention salary sacrifice in ella_message
- If dream_cars specified, reference aspirationally when relevant
- If message is not about cars, set needs_clarification:true and ask what they're looking for`;

  if (useAI) {
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
      const msgs = [
        ...conversationHistory.slice(-8).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: systemPrompt,
        messages: msgs
      });
      const raw = resp.content[0].text.trim().replace(/```json\n?|```/g, '');
      const parsed = JSON.parse(raw);

      // Try Apify with the extracted search params
      if (APIFY_TOKEN && !parsed.needs_clarification && parsed.search_params) {
        liveListings = await fetchLiveListings(parsed.search_params);
      }

      const inventory = liveListings?.length ? liveListings : UK_CARS;
      const results = scored(inventory, parsed.search_params || {}, profile);

      // Attach ella_reason to each result
      const resultsWithReasons = await attachReasons(results, parsed, profile, client);

      return {
        ella_message: parsed.ella_message,
        follow_up_question: parsed.follow_up_question,
        broker_notes: parsed.broker_notes || null,
        needs_clarification: parsed.needs_clarification || false,
        results: resultsWithReasons,
        source: liveListings ? 'live' : 'demo'
      };
    } catch (e) {
      console.error('Claude error:', e.message);
      // Fall through to demo
    }
  }

  // Demo fallback
  return demoSearch(message, profile);
}

function scored(inventory, params, profile) {
  return scoreAndFilter(inventory, params, profile);
}

async function attachReasons(results, parsed, profile, client) {
  // Generate a brief reason per car using Claude if available
  if (!client || results.length === 0) return results;
  
  const defaultReasons = [
    'Strong match for your budget and priorities.',
    'Low insurance group — ideal for keeping running costs down.',
    'Clean MOT history and single careful owner.',
    'Efficient powertrain suits your usage profile.',
    'Best-in-class for value and reliability in this segment.',
  ];

  return results.map((car, i) => ({
    ...car,
    ella_reason: car.ella_reason || defaultReasons[i % defaultReasons.length]
  }));
}

// ─── DEMO SEARCH (no API key) ─────────────────────────────────────
function demoSearch(message, profile) {
  const m = message.toLowerCase();
  const params = {};
  // Budget: match £ prefixed amounts, or large bare numbers (4+ digits = thousands range)
  const bmPound = m.match(/£([\d,]+)\s*k?/);
  const bmBare   = m.match(/\b(\d{4,6})\b/);
  if (bmPound) {
    const n = parseInt(bmPound[1].replace(',',''));
    params.budget_max = bmPound[0].includes('k') ? n * 1000 : n;
  } else if (bmBare) {
    params.budget_max = parseInt(bmBare[1]);
  }
  if (!params.budget_max && profile.budget_max) params.budget_max = profile.budget_max;
  if (!params.budget_max) params.budget_max = 30000; // safe default

  // Fuel type
  if (m.includes('electric') || m.includes(' ev ') || m.includes('tesla') || m.includes('leaf') || m.includes('zoe') || m.includes('ioniq')) params.fuel_type = 'Electric';
  else if ((m.includes('hybrid') && m.includes('plug')) || m.includes('phev')) params.fuel_type = 'PHEV';
  else if (m.includes('hybrid') || m.includes('self-charging')) params.fuel_type = 'Hybrid';
  else if (m.includes('diesel')) params.fuel_type = 'Diesel';

  // EV range — must be after fuel type is set
  if (params.fuel_type === 'Electric') {
    const rangeNums = m.match(/(\d{2,3})\s*(mi|mile)/);
    if (rangeNums) params.ev_range_min = parseInt(rangeNums[1]);
  }
  if (m.includes('suv') || m.includes('crossover')) params.body_type = 'SUV';
  else if (m.includes('estate')) params.body_type = 'Estate';
  else if (m.includes('saloon') || m.includes('sedan')) params.body_type = 'Saloon';
  else if (m.includes('hatchback') || m.includes('hatch')) params.body_type = 'Hatchback';
  if (m.includes('automatic') || m.includes(' auto ')) params.transmission = 'Automatic';
  if (m.includes('ulez')) params.ulez_required = true;
  if (m.includes('7 seat') || m.includes('seven seat') || m.includes('7seat')) params.seats_min = 7;
  const mileMatch = m.match(/under\s+([\d,]+)\s*(k|,000)?\s*miles?/);
  if (mileMatch) params.mileage_max = parseInt(mileMatch[1].replace(',','')) * (mileMatch[2] ? 1000 : 1);

  const isCar = m.match(/car|suv|estate|hatch|saloon|electric|hybrid|diesel|petrol|budget|cheap|reliable|family|first|new|used|buy|finance|lease/);
  if (!isCar) {
    return { ella_message: "Hi! I'm Ella, your UK car concierge. Tell me what kind of car you're after — budget, body type, fuel, or anything else that matters to you.", follow_up_question: null, needs_clarification: true, results: [], source: 'demo' };
  }

  const results = scoreAndFilter(UK_CARS, params, profile);
  const messages = [
    `Found ${results.length} strong matches for you — these are the top picks from my current UK inventory.`,
    `Great search! Here are your best options based on what you've told me.`,
    `I've filtered the UK market for you — these ${results.length} cars match your criteria well.`,
  ];
  return {
    ella_message: messages[Math.floor(Math.random() * messages.length)],
    follow_up_question: profile.budget_max ? "Would you prefer automatic or manual transmission?" : "What's your budget?",
    broker_notes: null,
    needs_clarification: false,
    results,
    source: 'demo'
  };
}

// ─── AUTH HELPERS ─────────────────────────────────────────────────
async function getUserFromToken(authHeader) {
  if (!authHeader || !SUPABASE_KEY) return null;
  const token = authHeader.replace('Bearer ', '');
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_KEY }
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    return user?.id ? user : null;
  } catch { return null; }
}


// ─── STRIPE HELPERS ───────────────────────────────────────────────
async function stripeRequest(path, method = 'GET', body = null) {
  if (!STRIPE_SECRET) return null;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }
  };
  if (body) opts.body = new URLSearchParams(body).toString();
  try {
    const r = await fetch(`https://api.stripe.com/v1${path}`, opts);
    return await r.json();
  } catch (e) {
    console.error('Stripe error:', e.message);
    return null;
  }
}

async function createCheckoutSession(userId, userEmail) {
  const session = await stripeRequest('/checkout/sessions', 'POST', {
    'payment_method_types[]': 'card',
    'line_items[0][price]': STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    mode: 'subscription',
    success_url: `${APP_URL}?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}?upgrade=cancelled`,
    customer_email: userEmail,
    'metadata[user_id]': userId,
    'subscription_data[metadata][user_id]': userId,
  });
  return session;
}

async function createBillingPortal(stripeCustomerId) {
  const session = await stripeRequest('/billing_portal/sessions', 'POST', {
    customer: stripeCustomerId,
    return_url: APP_URL,
  });
  return session;
}

async function verifyStripeWebhook(rawBody, signature) {
  if (!STRIPE_WEBHOOK) return null;
  // Stripe webhook signature verification
  // Uses HMAC-SHA256
  const crypto = require('crypto');
  const parts = signature.split(',');
  const timestamp = parts.find(p => p.startsWith('t=')).split('=')[1];
  const sig = parts.find(p => p.startsWith('v1=')).split('=')[1];
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK).update(payload).digest('hex');
  if (expected !== sig) return null;
  // Tolerance: 5 minutes
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return null;
  try { return JSON.parse(rawBody); } catch { return null; }
}

async function handleStripeWebhook(event) {
  const type = event.type;
  console.log('Stripe webhook:', type);

  if (type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const customerId = session.customer;
    const subId = session.subscription;
    if (userId) {
      await upsertProfile(userId, {
        is_pro: true,
        stripe_customer_id: customerId,
        stripe_subscription_id: subId,
        pro_expires_at: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
      });
      console.log('Pro activated for user:', userId);
    }
  }

  if (type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    const subId = invoice.subscription;
    // Find user by subscription ID and extend pro
    const profiles = await sbFetch(`/profiles?stripe_subscription_id=eq.${subId}`);
    if (profiles?.[0]) {
      await upsertProfile(profiles[0].id, {
        is_pro: true,
        pro_expires_at: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  if (type === 'customer.subscription.deleted' || type === 'invoice.payment_failed') {
    const obj = event.data.object;
    const customerId = obj.customer;
    const profiles = await sbFetch(`/profiles?stripe_customer_id=eq.${customerId}`);
    if (profiles?.[0]) {
      await upsertProfile(profiles[0].id, { is_pro: false });
      console.log('Pro cancelled for customer:', customerId);
    }
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';

  // ── Health ──────────────────────────────────────────────────────
  if (url === '/api/health') {
    return res.json({
      status: 'ok',
      inventory: UK_CARS.length,
      ella: ANTHROPIC_KEY ? 'live' : 'demo',
      supabase: SUPABASE_KEY ? 'connected' : 'not configured',
      stripe: STRIPE_SECRET && STRIPE_PRICE_ID ? 'connected' : 'not configured',
      apify: APIFY_TOKEN ? 'connected' : 'not configured',
      stripe: STRIPE_SECRET ? 'connected' : 'not configured',
    });
  }

  // ── Get all cars ────────────────────────────────────────────────
  if (url === '/api/cars') {
    return res.json(UK_CARS.map(c => ({ ...c, tco: calcTCO(c) })));
  }

  // ── Get single car ──────────────────────────────────────────────
  if (url.startsWith('/api/car/')) {
    const id = url.split('/api/car/')[1];
    const car = UK_CARS.find(c => c.id === id);
    if (!car) return res.status(404).json({ error: 'Not found' });
    return res.json({ ...car, tco: calcTCO(car) });
  }

  // ── Auth: get user profile ──────────────────────────────────────
  if (url === '/api/profile' && req.method === 'GET') {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await getProfile(user.id);
    return res.json(profile || {});
  }

  // ── Auth: update profile ────────────────────────────────────────
  if (url === '/api/profile' && req.method === 'POST') {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = req.body || {};
    await upsertProfile(user.id, data);
    return res.json({ success: true });
  }

  // ── Garage: get ─────────────────────────────────────────────────
  if (url === '/api/garage' && req.method === 'GET') {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const cars = await getGarage(user.id);
    return res.json(cars);
  }

  // ── Garage: save ────────────────────────────────────────────────
  if (url === '/api/garage' && req.method === 'POST') {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const car = req.body;
    await saveGarage(user.id, car);
    return res.json({ success: true });
  }

  // ── Ella Search ─────────────────────────────────────────────────
  if (url === '/api/ella/search' || url === '/api/ella') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { session_id, user_message, profile: clientProfile = {}, conversation_history = [] } = req.body || {};
    if (!user_message) return res.status(400).json({ error: 'message required' });

    // Auth check (optional — falls back to anonymous)
    const user = await getUserFromToken(req.headers.authorization);
    const userId = user?.id;

    // Rate limit check
    if (userId) {
      const limit = await checkRateLimit(userId);
      if (!limit.allowed) {
        return res.status(429).json({
          error: 'rate_limited',
          ella_message: `You've used your ${MAX_FREE_SEARCHES} free searches today. Upgrade to Pro for unlimited searches.`,
          remaining: 0,
          results: []
        });
      }
    }

    // Merge server profile with client profile
    let profile = { ...clientProfile };
    if (userId) {
      const serverProfile = await getProfile(userId);
      if (serverProfile) profile = { ...serverProfile, ...clientProfile };
    }

    try {
      const result = await runEllaSearch(user_message, conversation_history, profile, session_id);

      // Persist session + increment count
      if (userId) {
        await incrementSearchCount(userId);
        if (session_id) {
          await saveSession(session_id, userId, {
            messages: [...(conversation_history || []),
              { role: 'user', content: user_message },
              { role: 'assistant', content: result.ella_message }
            ],
            result_ids: result.results.map(r => r.id)
          }).catch(() => {});
        }
      }

      return res.json({ ...result, session_id });
    } catch (e) {
      console.error('Search error:', e.message);
      return res.status(500).json({ error: 'Search failed', ella_message: 'Something went wrong. Please try again.' });
    }
  }

  // ── Stripe: create checkout session ────────────────────────────
  if (url === '/api/stripe/checkout' && req.method === 'POST') {
    if (!STRIPE_SECRET || !STRIPE_PRICE_ID) {
      return res.status(503).json({ error: 'Stripe not configured' });
    }
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Login required to upgrade' });
    const profile = await getProfile(user.id);
    const session = await createCheckoutSession(user.id, user.email);
    if (!session?.url) return res.status(500).json({ error: 'Could not create checkout session' });
    return res.json({ url: session.url });
  }

  // ── Stripe: billing portal (manage subscription) ─────────────
  if (url === '/api/stripe/portal' && req.method === 'POST') {
    if (!STRIPE_SECRET) return res.status(503).json({ error: 'Stripe not configured' });
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await getProfile(user.id);
    if (!profile?.stripe_customer_id) return res.status(400).json({ error: 'No subscription found' });
    const portal = await createBillingPortal(profile.stripe_customer_id);
    if (!portal?.url) return res.status(500).json({ error: 'Could not open billing portal' });
    return res.json({ url: portal.url });
  }

  // ── Stripe: webhook ──────────────────────────────────────────
  if (url === '/api/stripe/webhook' && req.method === 'POST') {
    const sig = req.headers['stripe-signature'];
    // Get raw body (Vercel provides it as buffer via req.body when content-type is not json)
    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body);
    }
    const event = await verifyStripeWebhook(rawBody, sig);
    if (!event) {
      console.error('Invalid Stripe webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
    await handleStripeWebhook(event);
    return res.json({ received: true });
  }

  // ── Pro status check ─────────────────────────────────────────
  if (url === '/api/pro/status' && req.method === 'GET') {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.json({ is_pro: false });
    const profile = await getProfile(user.id);
    const isPro = profile?.is_pro && (!profile?.pro_expires_at || new Date(profile.pro_expires_at) > new Date());
    return res.json({ is_pro: isPro, expires_at: profile?.pro_expires_at || null });
  }

    // ── Garage: delete saved car ────────────────────────────────────
  if (url.startsWith('/api/garage/') && req.method === 'DELETE') {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const listingId = url.split('/api/garage/')[1];
    await sbFetch(`/saved_cars?user_id=eq.${user.id}&listing_id=eq.${encodeURIComponent(listingId)}`, 'DELETE');
    return res.json({ success: true });
  }

    return res.status(404).json({ error: 'Not found' });
};
