module.exports.formatResponse = r => {
  return `HTTP ${r.status} ${r.statusText}${
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
}
