
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./veswap-sdk.cjs.production.min.js')
} else {
  module.exports = require('./veswap-sdk.cjs.development.js')
}
