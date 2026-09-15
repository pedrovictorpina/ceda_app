import { connect } from 'node:net'

const socket = connect({ host: '127.0.0.1', port: 3000 })
socket.setTimeout(500)
socket.once('connect', () => {
  socket.destroy()
  console.error('Pare o servidor dev da porta 3000 antes do E2E. O build e o dev não podem compartilhar .nuxt.')
  process.exit(1)
})
socket.once('timeout', () => {
  socket.destroy()
  process.exit(0)
})
socket.once('error', () => process.exit(0))
