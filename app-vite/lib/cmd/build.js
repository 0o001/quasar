
if (process.env.NODE_ENV === void 0) {
  process.env.NODE_ENV = 'production'
}

import parseArgs from 'minimist'

const argv = parseArgs(process.argv.slice(2), {
  alias: {
    m: 'mode',
    T: 'target',
    A: 'arch',
    b: 'bundler',
    s: 'skip-pkg',
    i: 'ide',
    d: 'debug',
    h: 'help',
    P: 'publish'
  },
  boolean: ['h', 'd', 'u', 'i'],
  string: ['m', 'T', 'P'],
  default: {
    m: 'spa'
  }
})

if (argv.help) {
  console.log(`
  Description
    Builds distributables of your app.

  Usage
    $ quasar build
    $ quasar build -p <port number>

    $ quasar build -m ssr

    # alias for "quasar build -m cordova -T ios"
    $ quasar build -m ios

    # alias for "quasar build -m cordova -T android"
    $ quasar build -m android

    # passing extra parameters and/or options to
    # underlying "cordova" executable:
    $ quasar build -m ios -- some params --and options --here
    # when on Windows and using Powershell:
    $ quasar build -m ios '--' some params --and options --here

  Options
    --mode, -m      App mode [spa|ssr|pwa|cordova|capacitor|electron|bex] (default: spa)
    --target, -T    App target
                      - Cordova (default: all installed)
                        [android|ios]
                      - Capacitor
                        [android|ios]
                      - Electron with default "electron-packager" bundler (default: yours)
                        [darwin|win32|linux|mas|all]
                      - Electron with "electron-builder" bundler (default: yours)
                        [darwin|mac|win32|win|linux|all]
    --publish, -P   Also trigger publishing hooks (if any are specified)
                      - Has special meaning when building with Electron mode and using
                        electron-builder as bundler
    --debug, -d     Build for debugging purposes
    --skip-pkg, -s  Build only UI (skips creating Cordova/Capacitor/Electron executables)
                      - Cordova (it only fills in /src/cordova/www folder with the UI code)
                      - Capacitor (it only fills in /src/capacitor/www folder with the UI code)
                      - Electron (it only creates the /dist/electron/UnPackaged folder)
    --help, -h      Displays this message

    ONLY for Cordova and Capacitor mode:
    --ide, -i       Open IDE (Android Studio / XCode) instead of finalizing with a
                    terminal/console-only build

    ONLY for Electron mode:
    --bundler, -b   Bundler (electron-packager or electron-builder)
                      [packager|builder]
    --arch, -A      App architecture (default: yours)
                      - with default "electron-packager" bundler:
                          [ia32|x64|armv7l|arm64|mips64el|all]
                      - with "electron-builder" bundler:
                          [ia32|x64|armv7l|arm64|all]

    ONLY for electron-builder (when using "publish" parameter):
    --publish, -P  Publish options [onTag|onTagOrDraft|always|never]
                     - see https://www.electron.build/configuration/publish

  `)
  process.exit(0)
}

import { ensureArgv } from '../helpers/ensure-argv.js'
ensureArgv(argv, 'build')

import { readFileSync } from 'node:fs'
console.log(
  readFileSync(
    new URL('../../assets/logo.art', import.meta.url).pathname,
    'utf8'
  )
)

import { displayBanner } from '../helpers/banner-global.js'
displayBanner(argv, 'build')

import { log, fatal } from '../helpers/logger.js'
import path from 'node:path'

async function build () {
  // install mode if it's missing
  const { add } = await import(`../modes/${argv.mode}/${argv.mode}-installation.js`)
  await add(true, argv.target)

  const { getQuasarCtx } = await import('../helpers/get-quasar-ctx.js')
  const ctx = getQuasarCtx({
    mode: argv.mode,
    target: argv.target,
    arch: argv.arch,
    bundler: argv.bundler,
    debug: argv.debug,
    prod: true,
    publish: argv.publish
  })

  // register app extensions
  const { extensionRunner } = await import('../app-extension/extensions-runner.js')
  await extensionRunner.registerExtensions(ctx)

  const { QuasarConfFile } = await import('../quasar-config-file.js')
  const quasarConfFile = new QuasarConfFile({
    ctx,
    port: argv.port,
    host: argv.hostname
  })

  const quasarConf = await quasarConfFile.read()
  if (quasarConf.error !== void 0) {
    fatal(quasarConf.error, 'FAIL')
  }

  const { regenerateTypesFeatureFlags } = await import('../helpers/types-feature-flags.js')
  regenerateTypesFeatureFlags(quasarConf)

  const { AppProdBuilder } = await import(`../modes/${argv.mode}/${argv.mode}-builder.js`)
  const appBuilder = new AppProdBuilder({ argv, quasarConf })

  const { clean, add } = await import('../artifacts.js')
  let outputFolder = quasarConf.build.distDir
  clean(outputFolder)

  const { default: getEntryFiles } = await import('../entry-files-generator.js')
  const entryFiles = getEntryFiles(ctx)
  entryFiles.generate(quasarConf)

  if (typeof quasarConf.build.beforeBuild === 'function') {
    await quasarConf.build.beforeBuild({ quasarConf })
  }

  // run possible beforeBuild hooks
  await extensionRunner.runHook('beforeBuild', async hook => {
    log(`Extension(${hook.api.extId}): Running beforeBuild hook...`)
    await hook.fn(hook.api, { quasarConf })
  })

  appBuilder.build().then(async () => {
    add(outputFolder)

    outputFolder = argv.mode === 'cordova'
      ? path.join(outputFolder, '..')
      : outputFolder

    banner(argv, 'build', {
      buildOutputFolder: outputFolder,
      target: quasarConf.build.target
    })

    if (typeof quasarConf.build.afterBuild === 'function') {
      await quasarConf.build.afterBuild({ quasarConf })
    }

    // run possible beforeBuild hooks
    await extensionRunner.runHook('afterBuild', async hook => {
      log(`Extension(${hook.api.extId}): Running afterBuild hook...`)
      await hook.fn(hook.api, { quasarConf })
    })

    if (argv.publish !== void 0) {
      const opts = {
        arg: argv.publish,
        distDir: outputFolder,
        quasarConf
      }

      if (typeof quasarConf.build.onPublish === 'function') {
        await quasarConf.build.onPublish(opts)
      }

      // run possible onPublish hooks
      await extensionRunner.runHook('onPublish', async hook => {
        log(`Extension(${hook.api.extId}): Running onPublish hook...`)
        await hook.fn(hook.api, opts)
      })
    }
  })
}

build()