var postcss = require('postcss')
var selectorParser = require('postcss-selector-parser')
var loaderUtils = require('loader-utils')
var assign = Object.assign;

var addId = postcss.plugin('add-id', function (opts) {
  return function (root) {
    root.each(function rewriteSelector (node) {
      if (!node.selector) {
        if (node.type === 'atrule' && node.name === 'media') {
          node.each(rewriteSelector)
        }
        return
      }
      node.selector = selectorParser(function (selectors) {
        selectors.each(function (selector) {
          var node = null
          selector.each(function (n) {

            if (n.type === 'combinator' && n.value === '>>>') {
              n.value = ' '
              n.spaces.before = n.spaces.after = ''
              return false
            }
            
            if (n.type === 'tag' && n.value === '/deep/') {
              var next = n.next()
              if(next.type === 'combinator' && next.value === '') {
                next.remove()
              }
              n.remove()
              return false
            }

            if (n.type !== 'pseudo' && n.type !== 'combinator') {
              node = n
            }

          })
          selector.insertAfter(node, selectorParser.attribute({
            attribute: opts.id
          }))
        })
      }).process(node.selector).result
    })
  }
})

module.exports = function (css, map) {
  this.cacheable()
  var cb = this.async()

  var query = loaderUtils.getOptions(this) || {}
  var options = this.options.ng || {}
  var autoprefixOptions = options.autoprefixer
  var postcssOptions = options.postcss

  var plugins
  if (Array.isArray(postcssOptions)) {
    plugins = postcssOptions
  } else if (typeof postcssOptions === 'function') {
    plugins = postcssOptions.call(this, this)
  } else if (isObject(postcssOptions) && postcssOptions.plugins) {
    plugins = postcssOptions.plugins
  }
  plugins = plugins ? plugins.slice() : [] // make sure to copy it

  if (query.scoped) {
    plugins.push(addId({ id: query.id }))
  }

  if (autoprefixOptions !== false) {
    autoprefixOptions = assign(
      {},
      this.options.autoprefixer,
      autoprefixOptions
    )
    var autoprefixer = require('autoprefixer')(autoprefixOptions)
    plugins.push(autoprefixer)
  }

  var file = this.resourcePath
  var opts
  opts = {
    from: file,
    to: file,
    map: false
  }
  if (
    this.sourceMap &&
    !this.minimize &&
    options.cssSourceMap !== false &&
    process.env.NODE_ENV !== 'production' &&
    !(isObject(postcssOptions) && postcssOptions.options && postcssOptions.map)
  ) {
    opts.map = {
      inline: false,
      annotation: false,
      prev: map
    }
  }

  if (isObject(postcssOptions) && postcssOptions.options) {
    for (var option in postcssOptions.options) {
      if (!opts.hasOwnProperty(option)) {
        opts[option] = postcssOptions.options[option]
      }
    }
  }

  postcss(plugins)
    .process(css, opts)
    .then(function (result) {
      var map = result.map && result.map.toJSON()
      cb(null, result.css, map)
    })
    .catch(function (e) {
      console.log(e)
      cb(e)
    })
}

function isObject (val) {
  return val && typeof val === 'object'
}
