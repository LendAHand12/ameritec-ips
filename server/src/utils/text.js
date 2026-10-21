/**
 * Notes edited by hand in the database often contain a typed backslash + n (two characters) instead of a real
 * line break. Turn those into real line breaks so they display as separate lines.
 */
export const withLineBreaks = (text) => (text == null ? text : String(text).replace(/\\r?\\n/g, '\n'))
