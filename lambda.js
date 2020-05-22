const createApp = require('ringcentral-chatbot/dist/apps').default
const { createAsyncProxy } = require('ringcentral-chatbot/dist/lambda')
const serverlessHTTP = require('serverless-http')
const axios = require('axios')
const { Bot } = require('ringcentral-chatbot/dist/models')
const X2JS = require('x2js')
const qs = require('qs')

const x2js = new X2JS()

const app = createApp()
module.exports.app = serverlessHTTP(app)
module.exports.proxy = createAsyncProxy('app')
module.exports.maintain = async () => axios.put(`${process.env.RINGCENTRAL_CHATBOT_SERVER}/admin/maintain`, undefined, {
  auth: {
    username: process.env.RINGCENTRAL_CHATBOT_ADMIN_USERNAME,
    password: process.env.RINGCENTRAL_CHATBOT_ADMIN_PASSWORD
  }
})

module.exports.webhook = async (event) => {
  const bots = await Bot.findAll()
  if (!bots || bots.length === 0) {
    return {
      statusCode: 404,
      body: 'Cannot find chatbot. Please ask admin to add chatbot to Glip.'
    }
  }
  const bot = bots[0]
  const json = x2js.xml2js(event.body)
  console.log(event.body)
  const email = json.DocuSignEnvelopeInformation.EnvelopeStatus.Email
  let r = await bot.rc.post('/restapi/v1.0/glip/conversations', { members: [{ email }] })
  console.log(JSON.stringify(r.data))
  r = await await bot.rc.post('/restapi/v1.0/glip/posts', {
    groupId: r.data.id,
    text: `You have a document to sign, please check your inbox of ${email}.`
  })
  console.log(JSON.stringify(r.data))
  return {
    statusCode: 200,
    body: 'Done'
  }
}

const redirectUri = `${process.env.RINGCENTRAL_CHATBOT_SERVER}/docusign/callback`
module.exports.login = async (event) => {
  const url = `https://account${process.env.DOCUSIGN_PRODUCTION === 'true' ? '' : '-d'}.docusign.com/oauth/auth?response_type=code&scope=signature&&client_id=${process.env.DOCUSIGN_INTEGRATION_KEY}&redirect_uri=${redirectUri}&login_hint=${process.env.DOCUSIGN_ADMIN_EMAIL}`
  return {
    statusCode: 301,
    headers: {
      Location: url
    }
  }
}

module.exports.callback = async (event) => {
  const code = event.queryStringParameters.code
  const r = await axios.create({
    validateStatus: () => {
      return true
    }
  }).request({
    method: 'post',
    url: `https://account${process.env.DOCUSIGN_PRODUCTION === 'true' ? '' : '-d'}.docusign.com/oauth/token`,
    auth: {
      username: process.env.DOCUSIGN_INTEGRATION_KEY,
      password: process.env.DOCUSIGN_SECRET_KEY
    },
    data: qs.stringify({
      grant_type: 'authorization_code',
      code
    })
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
  return {
    statusCode: 200,
    body: result
  }
}
