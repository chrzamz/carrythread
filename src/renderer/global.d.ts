import type { CarrythreadAPI } from '../core/contracts'
declare global {
  interface Window {
    carrythread: CarrythreadAPI
  }
}
export {}
