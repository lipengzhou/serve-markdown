const express = require('express')
const serveIndex = require('serve-index')
const fs = require('fs')
const path = require('path')
const md = require('markdown-it')()
const resolve = file => path.join(__dirname, file)
const chokidar = require('chokidar')
const getLanIPs = require('./utils/get-lan-ip')

const app = express()

const server = require('http').createServer(app)

const io = require('socket.io')(server)

app.use('/public', express.static(resolve('./public')))

app.engine('html', require('express-art-template'))
app.set('views', resolve('./views/'))

const serveDir = process.argv.slice(2)[0] || './'

try {
  fs.readdirSync(serveDir)
} catch (err) {
  return console.error(`${serveDir} not exists.`)
}

// handle dir
app.use(serveIndex(serveDir, {
  icons: true
}))

// handle md file
app.use((req, res, next) => {
  try {
    const url = decodeURI(req.url)
    if (!url.endsWith('.md')) {
      return next()
    }
    const filePath = path.join(serveDir, url)
    const mdContent = fs.readFileSync(filePath, 'utf8')
    const html = md.render(mdContent)
    res.render('markdown-template.html', {
      content: html
    })
  } catch (err) {
    next(err)
  }
})

// handle other file
app.use(express.static(serveDir))

// watch md files and update to browser
chokidar.watch([
  path.join(serveDir, '**/*.md'),
  path.join(serveDir, '!node_modules')
]).on('change', filePath => {
  const html = md.render(fs.readFileSync(filePath, 'utf8'))
  const url = `/${filePath.split(path.sep).join('/')}`.replace(serveDir, '')
  io.emit('update-content', {
    url,
    html
  })
})

app.use((err, req, res, next) => {
  // res.status(500).send(`Internal Server Error: ${err.message}`)
  res.render('500.html', {
    err: JSON.stringify(err, null, '  ')
  })
})

const PORT = process.env.PORT || 5000

server.listen(PORT, '0.0.0.0', () => {
  const { port } = server.address()
  const ips = getLanIPs()
  ips.push('localhost')
  ips.forEach(ip => {
    console.log(`Server is running at http://${ip}:${port}`)
  })
})
