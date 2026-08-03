import { compile } from 'foldocs-mdx'
import { describe, expect, it } from 'vitest'

import { generateAsyncApiFiles, parseAsyncApi } from '../src/index.js'

const source = `
asyncapi: 2.6.0
info:
  title: Orders
  version: 1.0.0
  description: Order lifecycle events.
channels:
  orders/{orderId}:
    publish:
      operationId: orderUpdated
      summary: Order updated
      description: Emitted after an order changes.
      tags:
        - name: Orders
      message:
        $ref: "#/components/messages/OrderUpdated"
components:
  messages:
    OrderUpdated:
      name: OrderUpdated
      description: The new order state.
      payload:
        type: object
        required: [id, status]
        properties:
          id:
            type: string
            format: uuid
            description: Order identifier.
          status:
            type: string
            description: Current state.
`

describe('AsyncAPI generation', () => {
  it('generates compilable operation pages and root navigation', async () => {
    const files = generateAsyncApiFiles(parseAsyncApi(source), {
      baseUrl: '/en/docs/events',
    })

    expect(files.map(file => file.path)).toEqual([
      'index.mdx',
      'meta.json',
      'orderupdated.mdx',
    ])
    expect(files[0]?.content).toContain(
      '[Order updated](/en/docs/events/orderupdated)',
    )
    expect(files[1]?.content).toContain('"root": true')
    expect(files[2]?.content).toContain('`PUBLISH orders/{orderId}`')
    expect(files[2]?.content).toContain('Order identifier')
    expect(files[2]?.content).toContain('<AsyncApiPlayground')
    await Promise.all(
      files
        .filter(file => file.path.endsWith('.mdx'))
        .map(file => compile(file.content, { filePath: file.path })),
    )
  })

  it('validates the AsyncAPI document shape', () => {
    expect(() => parseAsyncApi('title: nope')).toThrow('channels or operations')
  })

  it('supports AsyncAPI 3 operations and channel message references', async () => {
    const document = parseAsyncApi(`
asyncapi: 3.0.0
info:
  title: Users
  version: 1.0.0
channels:
  userSignedUp:
    address: users/signed-up
    messages:
      userSignedUp:
        name: UserSignedUp
        payload:
          type: object
          properties:
            userId:
              type: string
operations:
  sendUserSignedUp:
    action: send
    summary: Send user signed up
    channel:
      $ref: "#/channels/userSignedUp"
    messages:
      - $ref: "#/channels/userSignedUp/messages/userSignedUp"
`)
    const files = generateAsyncApiFiles(document)
    const operation = files.find(
      file => file.path === 'send-users-signed-up.mdx',
    )

    expect(files.map(file => file.path)).toContain('send-users-signed-up.mdx')
    expect(operation).toBeDefined()
    if (!operation) throw new Error('Expected the generated operation page.')
    expect(operation.content).toContain('`SEND users/signed-up`')
    await compile(operation.content, { filePath: operation.path })
  })
})
