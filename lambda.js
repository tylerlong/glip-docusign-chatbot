const createApp = require('ringcentral-chatbot/dist/apps').default
const { createAsyncProxy } = require('ringcentral-chatbot/dist/lambda')
const serverlessHTTP = require('serverless-http')
const axios = require('axios')
const { Bot, Cache } = require('ringcentral-chatbot/dist/models')
const X2JS = require('x2js')
const qs = require('qs')
const hyperid = require('hyperid')
const { capitalCase } = require('capital-case')

const uuid = hyperid()

const x2js = new X2JS()

const httpClient = axios.create({
  validateStatus: () => {
    return true
  }
})

const app = createApp()
module.exports.app = serverlessHTTP(app)
module.exports.proxy = createAsyncProxy('app')
module.exports.maintain = async () => axios.put(`${process.env.RINGCENTRAL_CHATBOT_SERVER}/admin/maintain`, undefined, {
  auth: {
    username: process.env.RINGCENTRAL_CHATBOT_ADMIN_USERNAME,
    password: process.env.RINGCENTRAL_CHATBOT_ADMIN_PASSWORD
  }
})

// triggered when company admin click the authorize button
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

// second step of 3-legged OAuth
module.exports.callback = async (event) => {
  const code = event.queryStringParameters.code

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

  const bot = await Bot.findOne()
  await Bot.update({
    data: {
      token: r.data,
      userInfo: r2.data
    }
  }, {
    where: {
      id: bot.id
    }
  })

  return {
    statusCode: 200,
    body: 'Done'
  }
}

module.exports.crontab = async () => {
  const bot = await Bot.findOne() // only one bot since it's a privave app
  if (bot === null) {
    return
  }
  const r = await httpClient.request({
    method: 'post',
    url: `https://account${process.env.DOCUSIGN_PRODUCTION === 'true' ? '' : '-d'}.docusign.com/oauth/token`,
    auth: {
      username: process.env.DOCUSIGN_INTEGRATION_KEY,
      password: process.env.DOCUSIGN_SECRET_KEY
    },
    data: qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: bot.data.token.refresh_token
    })
  })

  // Todo: if refresh failed, send Glip message to admin:
  // Please [authorize](`${process.env.RINGCENTRAL_CHATBOT_SERVER}/docusign/login`)

  const r2 = await httpClient.request({
    method: 'get',
    url: `https://account${process.env.DOCUSIGN_PRODUCTION === 'true' ? '' : '-d'}.docusign.com/oauth/userinfo`,
    headers: {
      Authorization: `Bearer ${r.data.access_token}`
    }
  })

  await Bot.update({
    data: {
      token: r.data,
      userInfo: r2.data
    }
  }, {
    where: {
      id: bot.id
    }
  })
}

// triggered when a envelope sent out from DocuSign
module.exports.webhook = async (event) => {
  const bot = await Bot.findOne()
  if (bot === null) {
    return {
      statusCode: 404,
      body: 'Cannot find chatbot. Please ask admin to add chatbot to Glip.'
    }
  }
  const json = x2js.xml2js(event.body)
  console.log(JSON.stringify(json))
  const key = uuid()
  const email = json.DocuSignEnvelopeInformation.EnvelopeStatus.Email
  const envelopeId = json.DocuSignEnvelopeInformation.EnvelopeStatus.EnvelopeID
  await Cache.create({
    key,
    value: {
      email, envelopeId
    }
  })

  const r = await bot.rc.post('/restapi/v1.0/glip/conversations', { members: [{ email }] })
  await bot.rc.post('/restapi/v1.0/glip/posts', {
    groupId: r.data.id,
    text: `You have a new document to [review and sign](${process.env.RINGCENTRAL_CHATBOT_SERVER}/docusign/sign?key=${key}).`
  })

  return {
    statusCode: 200,
    body: 'Done'
  }
}

// triggered when a Glip user clicks link to sign a doc
module.exports.sign = async (event) => {
  const key = event.queryStringParameters.key
  const cache = await Cache.findOne({
    where: {
      key
    }
  })
  if (cache === null) {
    return {
      statusCode: 404,
      body: 'Wrong or expired link'
    }
  }
  const bot = await Bot.findOne() // only one bot since it is a private app
  const account = bot.data.userInfo.accounts[0]
  const r = await httpClient.request({
    method: 'post',
    url: `${account.base_uri}/restapi/v2.1/accounts/${account.account_id}/envelopes/${cache.value.envelopeId}/views/recipient`,
    headers: {
      Authorization: `Bearer ${bot.data.token.access_token}`
    },
    data: {
      email: cache.value.email,
      userName: capitalCase(cache.value.email.split('@')[0]),
      returnUrl: 'https://app.ringcentral.com/',
      AuthenticationMethod: 'none'
    }
  })
  return {
    statusCode: 200,
    body: JSON.stringify(r.data, null, 2)
  }
}
