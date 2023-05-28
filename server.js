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

const users = new Map()

const encodeMsg = (msg) => {
  const now = new Date()
  msg.time = `${now.getHours() < 10 ? "0" : ""}${now.getHours()}:${
    now.getMinutes() < 10 ? "0" : ""
  }${now.getMinutes()}`
  return JSON.stringify(msg)
}

const broadcast = (msg) => {
  const data = encodeMsg(msg)
  for (client of users.keys()) {
    if (client.readyState == OPEN) {
      client.send(data, { binary: false })
    }
  }
}

wss.on("connection", (ws) => {
  users.set(ws, null)

  const leave = () => {
    const nick = users.get(ws)
    if (nick != null) {
      broadcast({ type: "leave", nick })
    }
    users.delete(ws)
  }

  ws.on("error", leave)
  ws.on("close", leave)

  ws.on("message", (data) => {
    data = data.toString()
    const nick = users.get(ws)
    if (/^\/nick/.test(data)) {
      const newnick = data.replace(/^\/nick\s*/, "")
      if (!/^[\wæøåÆØÅäÂöÖ\.@_-]{2,20}$/.test(newnick)) {
        ws.send(encodeMsg({ type: "error", msg: "Invalid nick" }))
      } else if (new Set(users.values()).has(newnick)) {
        ws.send(encodeMsg({ type: "error", msg: "Nick already in use" }))
      } else {
        users.set(ws, newnick)
        if (nick == null) {
          ws.send(encodeMsg({ type: "welcome" }))
          broadcast({ type: "join", nick: newnick, oldnick: nick })
        } else {
          broadcast({ type: "nick", nick: newnick, oldnick: nick })
        }
      }
    } else if (/^\/me/.test(data)) {
      const msg = data.replace(/^\/me\s*/, "")
      if (msg != "") {
        broadcast({ type: "me", nick, msg })
      }
    } else if (/^\/help/.test(data)) {
      ws.send(encodeMsg({ type: "error", msg: "lol" }))
    } else if (data != "") {
      broadcast({ type: "msg", nick, msg: data })
    }
  })
})

server.listen(443)
