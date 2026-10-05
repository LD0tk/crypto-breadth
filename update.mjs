import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {GROUPS,DAY,dailyMap,breadth} from './math.mjs';
const root=fileURLToPath(new URL('./',import.meta.url));
const cache=process.env.CACHE_DIR||path.join(root,'.cache');
const out=process.env.BREADTH_OUTPUT_FILE||path.join(root,'data.json');
await mkdir(cache,{recursive:true});await mkdir(path.dirname(out),{recursive:true});
const now=new Date(),today=now.toISOString().slice(0,10);
let previous=null;try{previous=JSON.parse(await readFile(out,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const bootstrap=!previous?.points?.length;
if(previous?.points?.some(p=>p.date===today&&p.mode==='observed')){
 console.log(`Observation for ${today} already saved; preserving its original membership and values.`);
 process.exit(0);
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let lastRequest=0;
async function api(endpoint,tag){
 const file=path.join(cache,`${today}-${tag}.json`);
 try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 for(let attempt=0;attempt<6;attempt++){
  const spacing=process.env.COINGECKO_DEMO_API_KEY?2500:6500;
  await sleep(Math.max(0,spacing-(Date.now()-lastRequest)));lastRequest=Date.now();
  let r;try{r=await fetch(`https://api.coingecko.com/api/v3/${endpoint}`,{headers:process.env.COINGECKO_DEMO_API_KEY?{'x-cg-demo-api-key':process.env.COINGECKO_DEMO_API_KEY}:{},signal:AbortSignal.timeout(30000)});}catch(e){if(attempt===5)throw e;await sleep(5000*(attempt+1));continue;}
  if(r.status===429||r.status>=500){if(attempt===5)throw Error(`CoinGecko HTTP ${r.status}: ${tag}`);console.log(`Provider HTTP ${r.status}; retry ${attempt+1}/5 (${tag})`);await sleep(Math.min(120000,Math.max(20000*(attempt+1),Number(r.headers.get('retry-after')||0)*1000)));continue;}
  if(!r.ok)throw Error(`CoinGecko HTTP ${r.status}: ${tag}`);
  const data=await r.json();await writeFile(file,JSON.stringify(data));return data;
 }
}
// Restrict category pagination to the market-cap range of the candidate universe.
// Low-cap tokenized shares cannot enter the top-200 candidate set.
const marketRows=[];
for(let page=1;page<=2;page++){
 const rows=await api(`coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`,`markets-${page}`);
 if(!Array.isArray(rows)||!rows.length)throw Error('Market list incomplete');
 marketRows.push(...rows);
}
const floor=Math.min(...marketRows.filter(c=>c.market_cap>0).map(c=>c.market_cap));
async function category(id){const ids=[];for(let page=1;page<=20;page++){const rows=await api(`coins/markets?vs_currency=usd&category=${id}&order=market_cap_desc&per_page=250&page=${page}`,`${id}-${page}`);if(!Array.isArray(rows))throw Error('Invalid category response');ids.push(...rows.map(x=>x.id));if(rows.length<250||(rows.at(-1).market_cap??0)<floor)return ids;}throw Error('Category pagination incomplete');}
const excluded=new Set();
for(const id of ['stablecoins','yield-bearing-stablecoins','bridged-stablecoins','commodity-backed-stablecoin','tokenized-products']){for(const c of await category(id))excluded.add(c);}
if(excluded.size<20)throw Error('Stablecoin classification incomplete; refusing update.');
const candidates=[];
for(const r of marketRows){if(r.id!=='bitcoin'&&!excluded.has(r.id)&&r.market_cap>0&&!candidates.some(c=>c.id===r.id))candidates.push({id:r.id,name:r.name,symbol:r.symbol,marketCap:r.market_cap});}
candidates.sort((a,b)=>b.marketCap-a.marketCap);const coins=candidates.slice(0,200);
if(coins.length!==200)throw Error('Need 200 eligible coins.');
console.log(`Stablecoins excluded: ${excluded.size}; volatile coins: ${coins.length}; mode: ${bootstrap?'historical reconstruction':'daily snapshot'}`);
// 365-day history is fetched once. Subsequent runs use a small daily window;
// any outage longer than that remains a visible gap rather than being invented.
const days=bootstrap?365:7;
const prices=new Map();
for(const [i,coin] of [{id:'bitcoin'},...coins].entries()){
 const h=await api(`coins/${encodeURIComponent(coin.id)}/market_chart?vs_currency=usd&days=${days}${bootstrap?'&interval=daily':''}`,`history-${days}-${coin.id}`);
 if(!Array.isArray(h.prices))throw Error(`Missing prices for ${coin.id}`);
 prices.set(coin.id,dailyMap(h.prices));
 if(i%20===0||i===200)console.log(`Price histories ${i+1}/201`);
}
const btc=prices.get('bitcoin');
// UTC-midnight observations only: discard CoinGecko's trailing live quote.
const dates=[...btc.keys()].sort().filter(d=>d<=today);
const target=dates.at(-1);
if(!target||Date.parse(today)-Date.parse(target)>DAY)throw Error('Bitcoin daily data is stale.');
const points=bootstrap?[]:previous.points;
if(points.some(p=>p.date===target&&p.mode==='observed'))throw Error('Provider has no new completed day; preserving previous observation.');
const generate=bootstrap?dates.slice(1):[target];
for(const date of generate){
 const groups={};for(const g of GROUPS)groups[g.id]=breadth(coins.slice(g.start,g.end),prices,btc,date);
 if(date===target&&GROUPS.some(g=>groups[g.id].eligible/groups[g.id].total<0.95))throw Error('Less than 95% current price coverage; retaining previous published data.');
 const point={date,mode:bootstrap&&date!==target?'reconstructed':'observed',groups};
 const index=points.findIndex(p=>p.date===date);
 if(index<0)points.push(point);else if(points[index].mode!=='observed')points[index]=point;
}
points.sort((a,b)=>a.date.localeCompare(b.date));
const membership=previous?.membership||{};
membership[target]=coins.map((c,i)=>({...c,rank:i+1}));
const data={version:1,source:'CoinGecko',updatedAt:now.toISOString(),latestDate:target,bootstrapDate:previous?.bootstrapDate||today,groups:GROUPS,points,membership,excludedIds:[...excluded].sort(),method:{returnWindow:'UTC midnight to UTC midnight, 1 calendar day',rank:'Current market cap at daily collection, after excluding Bitcoin and stablecoins',historical:'Before first observation: today’s 200-coin cohort and today’s fixed rank groups; survivorship bias. Not historical market-cap membership.',ties:'Equal BTC returns are not outperformers',missing:'Missing daily prices excluded from denominator, never counted as losses',stablecoins:'CoinGecko stablecoins, yield-bearing-stablecoins, bridged-stablecoins, commodity-backed-stablecoin, tokenized-products; dynamic category classification',schedule:'Daily 02:20 UTC; GitHub Actions schedules can be delayed'}};
await writeFile(`${out}.tmp`,JSON.stringify(data));await rename(`${out}.tmp`,out);
console.log(`Published ${points.length} daily points through ${target}.`);

