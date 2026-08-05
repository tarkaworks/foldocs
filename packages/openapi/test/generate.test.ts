import { compile } from 'foldocs-mdx'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  generateFiles,
  generateOpenApiFiles,
  parseOpenApi,
} from '../src/index.js'

const source = `
openapi: 3.1.0
info:
  title: Pet Store
  version: 1.0.0
  description: Manage pets.
servers:
  - url: https://pets.example.com
paths:
  /pets/{petId}:
    parameters:
      - name: petId
        in: path
        required: true
        schema:
          type: string
    get:
      operationId: getPet
      summary: Get a pet
      tags: [Pets]
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
components:
  schemas:
    Pet:
      type: object
      required: [id]
      properties:
        id:
          type: string
          format: uuid
          description: Stable pet identifier.
        name:
          type: string
`

describe('OpenAPI generation', () => {
  it('generates compilable Foldocs pages, metadata, schemas, and samples', async () => {
    const files = generateOpenApiFiles(parseOpenApi(source), {
      baseUrl: '/en/docs/api',
    })

    expect(files.map(file => file.path)).toEqual([
      'index.mdx',
      'meta.json',
      'getpet.mdx',
    ])
    expect(files[0]?.content).toContain('<ApiCards>')
    expect(files[0]?.content).toContain(
      '<ApiCard href="/en/docs/api/getpet" method="GET" title="Get a pet"',
    )
    expect(files[1]?.content).toContain('"root": true')
    expect(files[2]?.content).toContain('`GET /pets/{petId}`')
    expect(files[2]?.content).toContain('Stable pet identifier')
    expect(files[2]?.content).toContain('https://pets.example.com/pets/{petId}')
    expect(files[2]?.content).toContain('<ApiPlayground')
    await Promise.all(
      files
        .filter(file => file.path.endsWith('.mdx'))
        .map(file => compile(file.content, { filePath: file.path })),
    )
  })

  it('rejects objects that are not OpenAPI documents', () => {
    expect(() => parseOpenApi('title: nope')).toThrow(
      'info.title, info.version, and a paths object',
    )
  })

  it('emits selected language samples and can disable the playground', () => {
    const operation = generateOpenApiFiles(parseOpenApi(source), {
      codeSamples: ['curl', 'python', 'go'],
      playground: false,
    }).find(file => file.path === 'getpet.mdx')

    expect(operation?.content).toContain('tab="cURL"')
    expect(operation?.content).toContain('tab="Python"')
    expect(operation?.content).toContain('tab="Go"')
    expect(operation?.content).not.toContain('<ApiPlayground')
  })

  it('removes only stale files owned by a previous generation', async () => {
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'foldocs-openapi-'))
    await generateFiles({ input: parseOpenApi(source), output })
    await fs.writeFile(path.join(output, 'notes.md'), 'Keep me', 'utf8')
    const withoutPaths = parseOpenApi(
      source.replace(/paths:[\s\S]*/u, 'paths: {}'),
    )

    await generateFiles({ input: withoutPaths, output })

    await expect(
      fs.stat(path.join(output, 'getpet.mdx')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(
      fs.readFile(path.join(output, 'notes.md'), 'utf8'),
    ).resolves.toBe('Keep me')
  })
})
