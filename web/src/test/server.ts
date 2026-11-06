import { setupServer } from 'msw/node'

/**
 * Mock Service Worker intercepts the app's real axios requests at the network
 * level, so tests exercise the actual API layer (interceptors, error mapping)
 * instead of mocking our own modules. Each test adds the handlers it needs with
 * server.use(...); they're reset after every test.
 */
export const server = setupServer()
