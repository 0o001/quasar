
import { readFileSync } from 'node:fs'
import appPaths from '../app-paths.js'

const { name } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')
)

export class BaseAPI {
  engine = name
  hasWebpack = true
  hasVite = false

  extId
  prompts
  resolve = appPaths.resolve
  appDir = appPaths.appDir

  __hooks = {}

  constructor ({ extId, prompts }) {
    this.extId = extId
    this.prompts = prompts
  }

  /**
   * Private-ish methods
   */

  __getHooks () {
    return this.__hooks
  }

  __addHook (name, fn) {
    this.__hooks[name].push({ fn, api: this })
  }
}