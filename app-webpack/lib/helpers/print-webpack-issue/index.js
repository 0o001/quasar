/**
 * Initially forked from friendly-errors-webpack-plugin 2.0.0-beta.2
 */

import { uniqueBy } from './utils.js'
import { transformErrors } from './transform-errors.js'
import { getError, getWarning, infoPill } from '../logger.js'

function extract (stats, severity) {
  const type = severity + 's'

  const findErrorsRecursive = compilation => {
    const errors = compilation[type]
    if (errors.length === 0 && compilation.children) {
      for (const child of compilation.children) {
        errors.push(...findErrorsRecursive(child))
      }
    }

    return uniqueBy(errors, error => error.message)
  }

  return findErrorsRecursive(stats.compilation)
}

function getMaxSeverityErrors (errors) {
  const maxSeverity = errors.reduce(
    (res, curr) => (curr.__severity > res ? curr.__severity : res),
    0
  )

  return errors.filter(e => e.__severity === maxSeverity)
}

function display (stats, severity, titleFn) {
  const errors = extract(stats, severity)

  // Please leave this comment for easy debugging
  // console.log(errors.map(err => Object.keys(err).map(key => key + '---' + typeof(err[key]) + '---' + err[key])))

  const errorsBag = transformErrors(errors)
  const topErrors = getMaxSeverityErrors(errorsBag)
  const summary = `${topErrors.length} ${severity}${topErrors.length > 1 ? 's' : ''}`
  const printLog = console[severity === 'error' ? 'error' : 'warn']

  topErrors.forEach(err => {
    printLog()
    err.__formatter(err, printLog, titleFn)
  })

  printLog()

  return summary
}

export function printWebpackWarnings (webpackName, stats) {
  return display(stats, 'warning', title => getWarning(infoPill(webpackName) + ' ' + title))
}

export function printWebpackErrors (webpackName, stats) {
  return display(stats, 'error', title => getError(infoPill(webpackName) + ' ' + title))
}