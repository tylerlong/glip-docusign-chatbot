const axios = require('axios')
const qs = require('qs')

const code = 'eyJ0eXAiOiJNVCIsImFsZyI6IlJTMjU2Iiwia2lkIjoiNjgxODVmZjEtNGU1MS00Y2U5LWFmMWMtNjg5ODEyMjAzMzE3In0.AQoAAAABAAYABwAAItvy5f3XSAgAAK5hOub910gCACT-LMECPdZEsTcoXbb11GsVAAEAAAAYAAEAAAAFAAAADQAkAAAAMzU1YjYzM2ItZDVhNy00NTA0LWExZDItMzRlZGU1ZjNiMTI0IgAkAAAAMzU1YjYzM2ItZDVhNy00NTA0LWExZDItMzRlZGU1ZjNiMTI0NwDl1WAFqZLJQ79aaM2hzN1pMACAY9cD5f3XSA.kc3hl3CIBMQDH9RhqernzeVnjMWjjKSmgu8R67AFMzoaWtvCwrrXuDyZyTx58aO2Nssx1k-6r62dYTuIdwC69TJ3puYNSLLu04aqM3-hJFzzBmtmeuqmPELDBJGhLj5WgAmMELc_P9W2qJMjoEi_YY7v3eOwjdKIvbq8Ru9Jw3FFMbhgSYFeyi7iQ1oEzD2q0EflqatM5En2XMWC4yzf2L2UwIUra_3qttcr5KRYJhI99j4qcW7b1hzXWApTd_fp69OhdnbDWePTYS2W3Tp4olemqKpazqMaLJ6DmwOV5xKC2kj9QQ13faIWdfa-m25qNffV88VlahnClgQL2ewU7w'

;(async () => {
  const r = await axios.create({
    validateStatus: () => {
      return true
    }
  }).post(`https://account${process.env.DOCUSIGN_PRODUCTION === 'true' ? '' : '-d'}.docusign.com/oauth/token`, qs.stringify({
    grant_type: 'authorization_code',
    code
  }), {
    auth: {
      username: process.env.DOCUSIGN_INTEGRATION_KEY,
      password: process.env.DOCUSIGN_SECRET_KEY
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
