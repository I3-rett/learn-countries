export { EUROPE_CODES } from './maps'

export type EuropeCode = (typeof import('./maps').EUROPE_CODES)[number]
