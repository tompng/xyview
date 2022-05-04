module.exports = {
  mode: 'development',
  entry: {
    example: './example.ts',
  },
  // output: {
  //   path: `${__dirname}/dist`,
  //   filename: '[name].js'
  // },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader'
      }
    ]
  },
  resolve: { extensions: ['.ts', '.js'] }
}
