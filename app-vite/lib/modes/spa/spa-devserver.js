
import { createServer } from 'vite'

import { AppDevServer as QuasarDevServer } from '../../app-devserver.js'
import { openBrowser } from '../../helpers/open-browser.js'
import { modeConfig } from './spa-config.js'

export class AppDevServer extends QuasarDevServer {
  #server

  run (quasarConf, __isRetry) {
    const { diff, queue } = super.run(quasarConf, __isRetry)

    if (diff('vite', quasarConf) === true) {
      return queue(() => this.#runVite(quasarConf, diff('viteUrl', quasarConf)))
    }
  }

  async #runVite (quasarConf, urlDiffers) {
    if (this.#server !== void 0) {
      this.#server.close()
    }

    const viteConfig = await modeConfig.vite(quasarConf)

    this.#server = await createServer(viteConfig)
    await this.#server.listen()

    this.printBanner(quasarConf)

    if (urlDiffers === true && quasarConf.metaConf.openBrowser) {
      const { metaConf } = quasarConf
      openBrowser({
        url: metaConf.APP_URL,
        opts: metaConf.openBrowser !== true ? metaConf.openBrowser : false
      })
    }
  }
}
