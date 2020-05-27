const axios = require('axios')

const { formatResponse } = require('../utils')

;(async () => {
  const r = await axios.create({
    validateStatus: () => {
      return true
    }
  }).request({
    url: 'http://github.com'
  })
  console.log(formatResponse(r))
})()
