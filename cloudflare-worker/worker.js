export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
        },
      })
    }

    let target
    if (url.pathname.startsWith('/dexscreener/')) {
      target = 'https://api.dexscreener.com/latest/dex' + url.pathname.slice('/dexscreener'.length) + url.search
    } else if (url.pathname.startsWith('/coingecko/')) {
      target = 'https://api.coingecko.com/api/v3' + url.pathname.slice('/coingecko'.length) + url.search
    } else {
      target = 'https://api.jup.ag' + url.pathname + url.search
    }

    const res = await fetch(target, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'JIJBot/1.0',
      },
      body: request.method === 'POST' ? request.body : undefined,
    })

    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
