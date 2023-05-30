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
wss.close
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
    if (!users.has(ws)) {
      return
    }
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
    } else if (/^\/(help|join)/.test(data)) {
      ws.send(encodeMsg({ type: "error", msg: "lol" }))
    } else if (/^\/shrug/.test(data)) {
      const msg = data.replace(/^\/shrug\s*/, "")
      broadcast({ type: "msg", nick, msg: `${msg} ¯\\_(ツ)_/¯` })
    } else if (/^\/giphy/.test(data)) {
      const msg = data.replace(/^\/giphy\s*/, "")
      broadcast({
        type: "msg",
        nick: "giphy",
        msg: `[se for deg en gif av «${msg}» her]`
      })
    } else if (/^\/leave/.test(data)) {
      const msg = data.replace(/^\/leave\s*/, "")
      broadcast({ type: "msg", nick, msg: `🍃 ${msg}` })
    } else if (/^\/op/.test(data)) {
      const opee = data.replace(/^\/op\s*/, "")
      const nopee = `@${opee}`
      if (opee.length <= 19 && new Set(users.values()).has(opee)) {
        broadcast({ type: "nick", nick: nopee, oldnick: opee })
        for (const [ws, n] of users) {
          if (n == opee) {
            users.set(ws, nopee)
            break
          }
        }
      }
    } else if (/^\/deop/.test(data)) {
      const opee = data.replace(/^\/deop\s*/, "")
      const nopee = opee.replace(/^@/, "")
      if (opee != nopee && new Set(users.values()).has(opee)) {
        broadcast({ type: "nick", nick: nopee, oldnick: opee })
        for (const [ws, n] of users) {
          if (n == opee) {
            users.set(ws, nopee)
            break
          }
        }
      }
    } else if (/^\/kick/.test(data)) {
      const kickee = data.replace(/^\/kick\s*/, "")
      if (new Set(users.values()).has(kickee)) {
        if (
          nick.replace(/[^@].*$/, "").length >
          kickee.replace(/[^@].*$/, "").length
        ) {
          broadcast({
            type: "me",
            nick: kickee,
            msg: `was kicked by ${nick}`
          })
          for (const [ws, n] of users) {
            if (n == kickee) {
              ws.send(
                encodeMsg({ type: "msg", nick: "SERVER", msg: "Goodbye" })
              )
              users.delete(ws)
              break
            }
          }
        } else {
          ws.send(encodeMsg({ type: "error", msg: "You need more op" }))
        }
      }
    } else if (/^\/slap/.test(data)) {
      const slapee = data.replace(/^\/slap\s*/, "")
      if (new Set(users.values()).has(slapee)) {
        broadcast({
          type: "me",
          nick,
          msg: `kliner til ${slapee} med en svær laks`
        })
      }
    } else if (/^\/list/.test(data)) {
      const ulist = [...users.keys()]
        .filter((ws) => ws.readyState == OPEN)
        .map((ws) => users.get(ws))
        .join(", ")
      ws.send(encodeMsg({ type: "msg", nick: "SERVER", msg: ulist }))
    } else if (data != "") {
      broadcast({ type: "msg", nick, msg: data })
    }
  })
})

server.listen(443)
