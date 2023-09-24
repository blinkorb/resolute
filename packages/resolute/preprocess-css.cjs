// eslint-disable-next-line no-restricted-globals, @typescript-eslint/no-var-requires
const sass = require('sass');

module.exports = (data /* filename: string*/) => {
  return sass.compileString(data).css.toString();
};
