
import { join, parse } from 'node:path'
import { existsSync } from 'node:fs'
import fse from 'fs-extra'

import { log } from './logger.js'
import appPaths from '../app-paths.js'

function getStoreFlagPath(storeIndexPath) {
  return join(parse(storeIndexPath).dir, 'store-flag.d.ts')
}

export async function regenerateTypesFeatureFlags (quasarConf) {
  // Flags must be available even in pure JS codebases,
  //    because boot and configure wrappers functions files will
  //    provide autocomplete based on them also to JS users
  // Flags files should be copied over, for every enabled mode,
  //    every time `quasar dev` and `quasar build` are run:
  //    this automatize the upgrade for existing codebases
  for (const feature of [
    'pwa',
    'cordova',
    'capacitor',
    'ssr',
    'store',
    'bex'
  ]) {
    const [ isFeatureInstalled, sourceFlagPath, destFlagPath ] = feature === 'store'
      ? [
        quasarConf.store,
        appPaths.resolve.cli('templates/store/store-flag.d.ts'),
        appPaths.resolve.app(getStoreFlagPath(quasarConf.sourceFiles.store))
      ]
      : [
        (await import(`../modes/${ feature }/${ feature }-installation.js`)).isInstalled,
        appPaths.resolve.cli(`templates/${ feature }/${ feature }-flag.d.ts`),
        appPaths.resolve[ feature ](`${ feature }-flag.d.ts`)
      ]

    if (isFeatureInstalled && !existsSync(destFlagPath)) {
      fse.copySync(sourceFlagPath, destFlagPath)
      log(`'${ feature }' feature flag was missing and has been regenerated`)
    }
  }
}
