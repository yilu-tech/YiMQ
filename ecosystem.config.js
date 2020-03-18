module.exports = {
  apps : [{
    name: "yimq",
    script: "./dist/main.js",
    instances: 'max',
    exec_mode: 'cluster'
  }]
}