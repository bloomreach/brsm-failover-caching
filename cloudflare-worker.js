/**
 * Copyright 2022 Bloomreach Inc. (https://www.bloomreach.com/)
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event))
})

async function handleRequest(event) {
  const RETURN_RESPONSES_FROM_CACHE = await CACHE_CONFIG.get('RETURN_RESPONSES_FROM_CACHE');
  if(RETURN_RESPONSES_FROM_CACHE !== 'TRUE') {
    const resp = await fetch(event.request.url) 
    if (resp) {
        var today = new Date();
        var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
        event.waitUntil(BRSM_CACHE.put(date+'_'+(await getCacheKey(event)), resp.clone().body, {expirationTtl: (await CACHE_CONFIG.get('RETENTION_PERIOD_DAYS')) * 24 * 60 * 60}))
    }
    return resp;
  }

  return serveFromCache(event);
}

async function serveFromCache(event) {
  const url = new URL(event.request.url)
  const RETURN_CACHES_FROM_DATE = await CACHE_CONFIG.get('RETURN_CACHES_FROM_DATE')
  const RETURN_CACHES_FROM_ALTERNATIVE_DATE = await CACHE_CONFIG.get('RETURN_CACHES_FROM_ALTERNATIVE_DATE')
  const cacheKey = await getCacheKey(event);
  if(cacheKey!='' && url.pathname.startsWith('/api/v1/core')){
    cachedResponse = await BRSM_CACHE.get(RETURN_CACHES_FROM_DATE+'_'+cacheKey)
    if(cachedResponse == null){
            cachedResponse = await BRSM_CACHE.get(RETURN_CACHES_FROM_ALTERNATIVE_DATE+'_'+cacheKey)
    if(cachedResponse == null){
            return new Response("Cache Value not found", {status: 404})
    }
    }
    return new Response(cachedResponse, {
        status: 200,
        headers: { 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",}})
  }
   
  return new Response("Invalid cache key", {status: 500});
}

async function getCacheKey(event){
  var DENY_PARAMETERS =  await CACHE_CONFIG.get('DENY_PARAMETERS')
  var DENY_FQ_PARAMETERS =  await CACHE_CONFIG.get('DENY_FQ_PARAMETERS')
  DENY_PARAMETERS = DENY_PARAMETERS.split(',');
  DENY_FQ_PARAMETERS = DENY_FQ_PARAMETERS.split(',');
  var cacheKey = ''

  // parse URL
  const url = new URL(event.request.url)
  const queryString = url.search.slice(1).split('&')

  // generate cacheKey
  queryString.forEach(item => {
    const kv = item.split('=')
    if (kv[0]){
      if(DENY_PARAMETERS.includes(kv[0])){
          return
      }
      if(kv[0] == 'fq' && DENY_FQ_PARAMETERS.includes(decodeURIComponent(kv[1]).split(':')[0])){
        return
      }
      cacheKey += item + '_'
    }  
  })
  cacheKey = decodeURIComponent(cacheKey)

  if(cacheKey.length > 512){
      cacheKey = cacheKey.substring(0,400);
  }

  return cacheKey;
}
