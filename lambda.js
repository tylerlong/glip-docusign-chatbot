const createApp = require('ringcentral-chatbot/dist/apps').default
const { createAsyncProxy } = require('ringcentral-chatbot/dist/lambda')
const serverlessHTTP = require('serverless-http')
const axios = require('axios')
const { Bot, Service } = require('ringcentral-chatbot/dist/models')
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
  // const bot = bots[0]
  const json = x2js.xml2js(event.body)
  console.log(JSON.stringify(json))
  // const email = json.DocuSignEnvelopeInformation.EnvelopeStatus.Email
  const envelopeId = json.DocuSignEnvelopeInformation.EnvelopeStatus.EnvelopeID
  const service = await Service.findOne({
    where: {
      name: 'OAuth',
      groupId: '0',
      botId: '0',
      userId: '0'
    }
  })
  const httpClient = axios.create({
    validateStatus: () => {
      return true
    }
  })
  console.log(JSON.stringify(service))
  const account = service.data.userId.accounts[0]
  const r = await httpClient.request({
    method: 'get',
    url: `${account.base_uri}/restapi/v2.1/accounts/${account.account_id}/envelopes/${envelopeId}/recipients`,
    headers: {
      Authorization: `Bearer ${service.data.token.access_token}`
    }
  })
  console.log(r.data)
  // const r = await bot.rc.post('/restapi/v1.0/glip/conversations', { members: [{ email }] })
  // await bot.rc.post('/restapi/v1.0/glip/posts', {
  //   groupId: r.data.id,
  //   text: `You have a document to sign, please check your inbox of ${email}.`
  // })
  return {
    statusCode: 200,
    body: r.data
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
  const httpClient = axios.create({
    validateStatus: () => {
      return true
    }
  })

  const r = await httpClient.request({
    method: 'post',
    url: `https://account${process.env.DOCUSIGN_PRODUCTION === 'true' ? '' : '-d'}.docusign.com/oauth/token`,
    auth: {
      username: process.env.DOCUSIGN_INTEGRATION_KEY,
      password: process.env.DOCUSIGN_SECRET_KEY
    },
    data: qs.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  })

  const r2 = await httpClient.request({
    method: 'get',
    url: `https://account${process.env.DOCUSIGN_PRODUCTION === 'true' ? '' : '-d'}.docusign.com/oauth/userinfo`,
    headers: {
      Authorization: `Bearer ${r.data.access_token}`
    }
  })

  await Service.destroy({
    where: {
      name: 'OAuth',
      groupId: '0',
      botId: '0',
      userId: '0'
    }
  })

  const service = await Service.create({
    name: 'OAuth',
    botId: '0',
    groupId: '0',
    userId: '0',
    data: {
      token: r.data,
      userInfo: r2.data
    }
  })

  return {
    statusCode: 200,
    body: JSON.stringify(service, null, 2)
  }
}
