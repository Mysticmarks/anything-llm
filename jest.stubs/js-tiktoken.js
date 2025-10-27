module.exports = {
  getEncoding: () => ({
    encode: (text) => new Array(text.length).fill(0),
  }),
};
