const https = require("https")
const fs = require("fs")
const options = require("./settings")

const html = fs.readFileSync("./index.html")

const handler = (req, res) => {
  if (req.headers.host == "irc.aurlien.net") {
    res.writeHead(200, {
      "Content-Type": "text/html"
    })
    res.end(html)
  } else {
    res.writeHead(404)
    res.end("not found")
  }
}

const server = https.createServer(options, handler)

const { WebSocketServer, OPEN } = require("ws")
const wss = new WebSocketServer({ server })

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState == OPEN) {
        client.send(data, { binary: false })
      }
    })
  })
})

server.listen(443)
