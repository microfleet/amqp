import Joi = require('joi')
import { setTimeout } from 'timers/promises'

export interface Preset {
  min: number
  max: number
  factor: number
}

export interface Settings {
  "private": Preset
  "consumed": Preset
  [custom: string]: Preset
}

/**
 * Settings confirm to [policy: string] : settings schema
 */
export class Backoff {
  static schema = Joi.object({
    private: Joi.object({
      min: Joi.number().min(0)
        .description('min delay for attempt #1')
        .default(250),

      max: Joi.number().min(0)
        .description('max delay')
        .default(1000),

      factor: Joi.number().min(1)
        .description('exponential increase factor')
        .default(1.2),
    }).default(),

    consumed: Joi.object({
      min: Joi.number().min(0)
        .description('min delay for attempt #1')
        .default(500),

      max: Joi.number().min(0)
        .description('max delay')
        .default(5000),

      factor: Joi.number().min(1)
        .description('exponential increase factor')
        .default(1.2),
    }).default(),
  })

  constructor(private settings: Settings) {

  }

  get(policy: keyof Settings, attempt = 0) {
    const { min, factor, max } = this.settings[policy]

    if (attempt === 0) return 0
    if (attempt === 1) return min

    return Math.min(Math.round((Math.random() + 1) * min * (factor ** (attempt - 1))), max)
  }

  async wait(policy: keyof Settings, attempt = 0) {
    await setTimeout(this.get(policy, attempt))
  }
}
