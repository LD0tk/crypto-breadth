const key=process.env.COINGECKO_DEMO_API_KEY;
if(!key){console.log('No Demo key configured; collector will use the public API.');}
else{
 const response=await fetch('https://api.coingecko.com/api/v3/ping',{headers:{'x-cg-demo-api-key':key},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`CoinGecko Demo authentication failed: HTTP ${response.status}`);
 console.log('CoinGecko Demo authentication verified.');
}
