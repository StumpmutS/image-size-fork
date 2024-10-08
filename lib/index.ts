import * as fs from 'fs'
import * as path from 'path'
import type { imageType } from './types/index'
import { typeHandlers } from './types/index'
import { detector } from './detector'
import type { ISizeCalculationResult } from './types/interface'

type CallbackFn = (e: Error | null, r?: ISizeCalculationResult) => void

// Maximum input size, with a default of 512 kilobytes.
// TO-DO: make this adaptive based on the initial signature of the image
const MaxInputSize = 512 * 1024

interface Options {
  disabledFS: boolean
  disabledTypes: imageType[]
}

const globalOptions: Options = {
  disabledFS: false,
  disabledTypes: [],
}

/**
 * Return size information based on an Uint8Array
 *
 * @param {Uint8Array} input
 * @param {String} filepath
 * @returns {Object}
 */
function lookup(input: Uint8Array, filepath?: string): ISizeCalculationResult {
  // detect the file type.. don't rely on the extension
  const type = detector(input)

  if (typeof type !== 'undefined') {
    if (globalOptions.disabledTypes.indexOf(type) > -1) {
      throw new TypeError('disabled file type: ' + type)
    }

    // find an appropriate handler for this file type
    if (type in typeHandlers) {
      const size = typeHandlers[type].calculate(input, filepath)
      if (size !== undefined) {
        size.type = size.type ?? type
        return size
      }
    }
  }

  // throw up, if we don't understand the file
  throw new TypeError(
    'unsupported file type: ' + type + ' (file: ' + filepath + ')',
  )
}

/**
 * Synchronously reads a file into an Uint8Array, blocking the nodejs process.
 *
 * @param {String} filepath
 * @returns {Uint8Array}
 */
function readFileSync(filepath: string): Uint8Array {
  // read from the file, synchronously
  const descriptor = fs.openSync(filepath, 'r')
  try {
    const { size } = fs.fstatSync(descriptor)
    if (size <= 0) {
      throw new Error('Empty file')
    }
    const inputSize = Math.min(size, MaxInputSize)
    const input = new Uint8Array(inputSize)
    fs.readSync(descriptor, input, 0, inputSize, 0)
    return input
  } finally {
    fs.closeSync(descriptor)
  }
}

// eslint-disable-next-line @typescript-eslint/no-use-before-define
module.exports = exports = imageSize // backwards compatibility

export default imageSize
export function imageSize(input: Uint8Array | string): ISizeCalculationResult

/**
 * @param {Uint8Array|string} input - Uint8Array or relative/absolute path of the image file
 */
export function imageSize(
  input: Uint8Array | string,
): ISizeCalculationResult | undefined {
  // Handle Uint8Array input
  if (input instanceof Uint8Array) {
    return lookup(input)
  }

  // input should be a string at this point
  if (typeof input !== 'string' || globalOptions.disabledFS) {
    throw new TypeError('invalid invocation. input should be a Uint8Array')
  }

  // resolve the file path
  const filepath = path.resolve(input)

  const inp = readFileSync(filepath)
  return lookup(inp, filepath)
}

export const disableFS = (v: boolean): void => {
  globalOptions.disabledFS = v
}
export const disableTypes = (types: imageType[]): void => {
  globalOptions.disabledTypes = types
}
export const types = Object.keys(typeHandlers)
