"use strict";

const SonicBoom = require("sonic-boom");
const {
  buildFileName,
  detectLastNumber,
  parseSize,
  parseFrequency,
  getNext,
} = require("./lib/utils");

/**
 * @typedef {object} Options
 *
 * @property {string} file - Absolute or relative path to the log file.
 * Your application needs the write right on the parent folder.
 * Number will be appened to this file name.
 * When the parent folder already contains numbered files, numbering will continue based on the highest number.
 * If this path does not exist, the logger with throw an error unless you set `mkdir` to `true`.
 *
 * @property {string|number} size? - When specified, the maximum size of a given log file.
 * Can be combined with frequency.
 * Use 'k', 'm' and 'g' to express values in KB, MB or GB.
 * Numerical values will be considered as MB.
 *
 * @property {string|number} frequency? - When specified, the amount of time a given log file is used.
 * Can be combined with size.
 * Use 'daily' or 'hourly' to rotate file every day (or every hour).
 * Existing file within the current day (or hour) will be re-used.
 * Numerical values will be considered as a number of milliseconds.
 * Using a numerical value will always create a new file upon startup.
 *
 * @property {string} extension? - When specified, appends a file extension after the file number.
 */

/**
 * @typedef {Options & import('sonic-boom').SonicBoomOpts} PinoRollOptions
 */

/**
 * Creates a Pino transport (a Sonic-boom stream) to writing into files.
 * Automatically rolls your files based on a given frequency, size, or both.
 *
 * @param {PinoRollOptions} options - to configure file destionation, and rolling rules.
 * @returns {SonicBoom} the Sonic boom steam, usabled as Pino transport.
 */
module.exports = async function ({
  file,
  size,
  frequency,
  extension,
  formatDate,
  ...opts
} = {}) {
  const frequencySpec = parseFrequency(frequency);

  let number = await detectLastNumber(file, frequencySpec?.start);

  let currentSize = 0;
  const maxSize = parseSize(size);

  const destination = new SonicBoom({
    ...opts,
    dest: buildFileName(file, number, extension, formatDate),
  });

  let rollTimeout;
  if (frequencySpec) {
    destination.once("close", () => {
      clearTimeout(rollTimeout);
    });
    scheduleRoll();
  }

  if (maxSize) {
    destination.on("write", (writtenSize) => {
      currentSize += writtenSize;
      if (currentSize >= maxSize) {
        currentSize = 0;
        // delay to let the our destination finish its write
        setTimeout(() => roll(++number), 0);
      }
    });
  }

  function roll() {
    destination.reopen(buildFileName(file, number, extension, formatDate));
  }

  function scheduleRoll() {
    clearTimeout(rollTimeout);
    rollTimeout = setTimeout(() => {
      // Reset file number when day has changed
      number = 1;
      frequencySpec.next = getNext(frequency);

      roll();
      scheduleRoll();
    }, frequencySpec.next - Date.now());
  }

  return destination;
};
