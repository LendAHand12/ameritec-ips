export default class ApiError extends Error {
  constructor(statusCode, message, details, code) {
    super(message)
    this.statusCode = statusCode
    this.details = details
    this.code = code
  }
}
