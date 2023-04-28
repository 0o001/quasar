
import { join } from 'node:path'
import fse from 'fs-extra'
import archiver from 'archiver'

import { AppBuilder } from '../../app-builder.js'
import { progress } from '../../helpers/logger.js'
import { modeConfig } from './bex-config.js'
import { createManifest, copyBexAssets } from './utils.js'
import { appPackageJson } from '../../helpers/app-package-json.js'

const { name } = appPackageJson

export class AppProdBuilder extends AppBuilder {
  async build () {
    const viteConfig = await modeConfig.vite(this.quasarConf)
    await this.buildWithVite('BEX UI', viteConfig)

    const { err } = createManifest(this.quasarConf)
    if (err !== void 0) { process.exit(1) }

    const backgroundConfig = await modeConfig.backgroundScript(this.quasarConf)
    await this.buildWithEsbuild('Background Script', backgroundConfig)

    for (const name of this.quasarConf.bex.contentScripts) {
      const contentConfig = await modeConfig.contentScript(this.quasarConf, name)
      await this.buildWithEsbuild('Content Script', contentConfig)
    }

    const domConfig = await modeConfig.domScript(this.quasarConf)
    await this.buildWithEsbuild('Dom Script', domConfig)

    copyBexAssets(this.quasarConf)

    this.printSummary(this.quasarConf.build.distDir)
    this.#bundlePackage(this.quasarConf.build.distDir)
  }

  #bundlePackage (folder) {
    const done = progress('Bundling in progress...')
    const zipName = `Packaged.${ name }.zip`
    const file = join(folder, zipName)

    const output = fse.createWriteStream(file)
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    })

    archive.pipe(output)
    archive.directory(folder, false, entryData => ((entryData.name !== zipName) ? entryData : false))
    archive.finalize()

    done(`Bundle has been generated at: ${ file }`)
  }
}
