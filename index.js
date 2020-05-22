const axios = require('axios')

;(async () => {
  const r = await axios.create({
    validateStatus: () => {
      return true
    }
  }).request({
    method: 'get',
    url: `https://account${process.env.DOCUSIGN_PRODUCTION === 'true' ? '' : '-d'}.docusign.com/oauth/userinfo`,
    headers: {
      Authorization: `Bearer ${process.env.DOCUSIGN_ACCESS_TOKEN}`
    }
  })
  const result = `HTTP ${r.status} ${r.statusText}${
    r.data.message ? ` - ${r.data.message}` : ''
  }
  Response:
  ${JSON.stringify(
    {
      data: r.data,
      status: r.status,
      statusText: r.statusText,
      headers: r.headers
    },
    null,
    2
  )}
  Request:
  ${JSON.stringify(
    {
      method: r.config.method,
      baseURL: r.config.baseURL,
      url: r.config.url,
      params: r.config.params,
      data: r.config.data,
      headers: r.config.headers
    },
    null,
    2
  )}
  `

  console.log(result)
})()
