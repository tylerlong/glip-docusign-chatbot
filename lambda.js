const createApp = require('ringcentral-chatbot/dist/apps').default
const { createAsyncProxy } = require('ringcentral-chatbot/dist/lambda')
const serverlessHTTP = require('serverless-http')
const axios = require('axios')
const { Service, Bot } = require('ringcentral-chatbot/dist/models')
const moment = require('moment-timezone')

axios.defaults.headers.common['X-Client-Key'] = process.env.APPFIGURES_CLIENT_KEY
axios.defaults.headers.common.Authorization = `Basic ${process.env.BASIC_AUTHORIZATION_KEY}`

const crontab = async () => {
  const services = await Service.findAll({ where: { name: 'RingCentral Apps Reviews' } })
  if (!services || services == null || services.length === 0) {
    return
  }
  const r = await axios.get('https://api.appfigures.com/v2/reviews', {
    params: {
      count: 100
    }
  })
  const oneDayAgo = moment().add(-2, 'days').utc().format()
  const newReviews = r.data.reviews.filter(review => moment(review.date).tz('EST').utc().format() > oneDayAgo)
  for (const service of services) {
    const bot = await Bot.findByPk(service.botId)
    try {
      await bot.sendMessage(service.groupId, {
        text: `
**New app reviews posted for the past 48 hours**

${newReviews.length === 0 ? '**None**' : newReviews.map(review => `User **${review.author}** posted review for **${review.product_name}** **${review.store === 'apple' ? 'iOS' : 'Android'}** ${review.version}
**Stars**: ${review.stars}
**Title**: ${review.title}
**Content**: ${review.original_review}`).join('\n\n')}
`
      })
    } catch (e) { // catch the exception so that it won't break the for loop
      console.error(e)
    }
  }
}
module.exports.crontab = crontab

const handle = async event => {
  const { type, text, group, bot } = event
  if (type === 'Message4Bot') {
    if (text === 'ping') {
      await bot.sendMessage(group.id, { text: 'pong' })
    } else if (text === 'enable') {
      const one = await Service.findOne({
        where: {
          name: 'RingCentral Apps Reviews',
          groupId: group.id,
          botId: bot.id
        }
      })
      if (one !== null) {
        await bot.sendMessage(group.id, { text: 'RingCentral Apps Reviews notification had been enabled for this team.' })
        return
      }
      await Service.create({
        name: 'RingCentral Apps Reviews',
        groupId: group.id,
        botId: bot.id
      })
      await bot.sendMessage(group.id, { text: 'RingCentral Apps Reviews notification has been enabled for this team.' })
    } else if (text === 'disable') {
      await Service.destroy({
        where: {
          name: 'RingCentral Apps Reviews',
          groupId: group.id,
          botId: bot.id
        }
      })
      await bot.sendMessage(group.id, { text: 'RingCentral Apps Reviews notification has been disabled for this team.' })
    } else if (text === 'report') {
      await crontab()
    }
  }
}
const app = createApp(handle)
module.exports.app = serverlessHTTP(app)
module.exports.proxy = createAsyncProxy('app')
module.exports.maintain = async () => axios.put(`${process.env.RINGCENTRAL_CHATBOT_SERVER}/admin/maintain`, undefined, {
  auth: {
    username: process.env.RINGCENTRAL_CHATBOT_ADMIN_USERNAME,
    password: process.env.RINGCENTRAL_CHATBOT_ADMIN_PASSWORD
  }
})

module.exports.test = async () => {
  const r = await axios.get('https://api.appfigures.com/v2/reviews', {
    params: {
      count: 100
    }
  })
  const oneDayAgo = moment().add(-2, 'days').utc().format()
  const newReviews = r.data.reviews.filter(review => moment(review.date).tz('EST').utc().format() > oneDayAgo)
  const text = `
**New app reviews posted for the last 48 hours**

${newReviews.length === 0 ? '**None**' : newReviews.map(review => `User **${review.author}** posted review for **${review.product_name}** **${review.store === 'apple' ? 'iOS' : 'Android'}** ${review.version}
**Stars**: ${review.stars}
**Title**: ${review.title}
**Content**: ${review.original_review}`).join('\n\n')}`
  console.log(text.replace(/[\r\n]+/g, ' '))
  return text
}
