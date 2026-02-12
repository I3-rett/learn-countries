import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw/server'

const baseFetch = globalThis.fetch
if (baseFetch) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.signal) {
      const { signal, ...rest } = init
      return baseFetch(input, rest)
    }
    return baseFetch(input, init)
  }) as typeof globalThis.fetch
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
