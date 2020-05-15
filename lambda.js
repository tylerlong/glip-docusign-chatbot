const createApp = require('ringcentral-chatbot/dist/apps').default
const { createAsyncProxy } = require('ringcentral-chatbot/dist/lambda')
const serverlessHTTP = require('serverless-http')
const axios = require('axios')
const { Bot } = require('ringcentral-chatbot/dist/models')

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
  const json = JSON.parse(event.body)
  let r = await bot.rc.post('/restapi/v1.0/glip/conversations', { members: [json.glip] })
  console.log(JSON.stringify(r.data))
  r = await await bot.rc.post('/restapi/v1.0/glip/posts', {
    groupId: r.data.id,
    text: `Please [sign this DocuSign Document](${json.docusign.link})`
  })
  console.log(JSON.stringify(r.data))
  return {
    statusCode: 200,
    body: 'Done'
  }
}
