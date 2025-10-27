const mimeTypes = require("../server/node_modules/mime-types");

module.exports = {
  lookup: (value) => mimeTypes.lookup(value),
  contentType: (value) => mimeTypes.contentType(value),
  charsets: {
    lookup: (value) => mimeTypes.charset(value),
  },
};
