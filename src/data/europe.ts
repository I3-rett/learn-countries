export { EUROPE_CODES } from './continents'

export type EuropeCode = (typeof import('./continents').EUROPE_CODES)[number]
