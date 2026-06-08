export const BACKEND_ERROR_KEYS = Object.freeze({
  INTERNAL_ERROR: 'errors.backend.internalError',
  VALIDATION_ERROR: 'errors.backend.validationError',
  MISSING_BODY: 'errors.backend.missingBody',
  JOB_NOT_FOUND: 'errors.backend.jobNotFound',
  JOB_ALREADY_EXECUTED: 'errors.backend.jobAlreadyExecuted',
  JOB_STILL_PROCESSING: 'errors.backend.jobStillProcessing',
  JOB_FAILED: 'errors.backend.jobFailed',
  MODEL_NOT_FOUND: 'errors.backend.modelNotFound',
  INVALID_MODEL: 'errors.backend.invalidModel',
  FILE_NOT_FOUND: 'errors.backend.fileNotFound',
  HOLLOW_GENERATION_FAILED: 'errors.backend.hollowGenerationFailed',
  BOOLEAN_FAILED: 'errors.backend.booleanFailed',
  NO_DRAIN_HOLES: 'errors.backend.noDrainHoles',
  NO_HEX_GRID_CELLS: 'errors.backend.noHexGridCells',
  SERVER_UNAVAILABLE: 'errors.backend.serverUnavailable',
  MODEL_UPLOAD_FAILED: 'errors.backend.modelUploadFailed',
  SLICING_FAILED: 'errors.backend.slicingFailed',
  SUPPORT_GENERATION_FAILED: 'errors.backend.supportGenerationFailed',
  JOB_TIMEOUT: 'errors.backend.jobTimeout',
  ORTHO_PROCESSING_FAILED: 'errors.backend.orthoProcessingFailed',
  BOOLEAN_OPERATION_FAILED: 'errors.backend.booleanOperationFailed',
})

export function getBackendErrorKey(code, fallback = 'errors.backend.unexpected') {
  return BACKEND_ERROR_KEYS[code] ?? fallback
}

export function getBackendErrorToast(errorOrCode) {
  const code = typeof errorOrCode === 'string' ? errorOrCode : errorOrCode?.code
  return {
    summaryKey: 'errors.backend.failed',
    detailKey: getBackendErrorKey(code),
  }
}

/**
 * Base error class for backend service errors
 */
export class BackendError extends Error {
  constructor(message, code, details = null) {
    super(message || code || 'BACKEND_ERROR')
    this.name = 'BackendError'
    this.code = code
    this.details = details
  }
}

/**
 * Server is unavailable or unreachable
 */
export class ServerUnavailableError extends BackendError {
  constructor(message = 'SERVER_UNAVAILABLE', details = null) {
    super(message, 'SERVER_UNAVAILABLE', details)
    this.name = 'ServerUnavailableError'
  }
}

/**
 * Model upload failed
 */
export class ModelUploadError extends BackendError {
  constructor(message = 'MODEL_UPLOAD_FAILED', details = null) {
    super(message, 'MODEL_UPLOAD_FAILED', details)
    this.name = 'ModelUploadError'
  }
}

/**
 * Slicing operation failed
 */
export class SlicingError extends BackendError {
  constructor(message = 'SLICING_FAILED', details = null) {
    super(message, 'SLICING_FAILED', details)
    this.name = 'SlicingError'
  }
}

/**
 * Support generation failed
 */
export class SupportGenerationError extends BackendError {
  constructor(message = 'SUPPORT_GENERATION_FAILED', details = null) {
    super(message, 'SUPPORT_GENERATION_FAILED', details)
    this.name = 'SupportGenerationError'
  }
}

/**
 * Validation error for business logic
 */
export class ValidationError extends BackendError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

/**
 * Job polling timeout
 */
export class JobTimeoutError extends BackendError {
  constructor(message = 'JOB_TIMEOUT', details = null) {
    super(message, 'JOB_TIMEOUT', details)
    this.name = 'JobTimeoutError'
  }
}

/**
 * Job execution failed
 */
export class JobFailedError extends BackendError {
  constructor(message = 'JOB_FAILED', details = null) {
    super(message, 'JOB_FAILED', details)
    this.name = 'JobFailedError'
  }
}

/**
 * Ortho processing pipeline failed
 */
export class OrthoProcessingError extends BackendError {
  constructor(message = 'ORTHO_PROCESSING_FAILED', details = null) {
    super(message, 'ORTHO_PROCESSING_FAILED', details)
    this.name = 'OrthoProcessingError'
  }
}

/**
 * Boolean operation failed
 */
export class BooleanOperationError extends BackendError {
  constructor(message = 'BOOLEAN_OPERATION_FAILED', details = null) {
    super(message, 'BOOLEAN_OPERATION_FAILED', details)
    this.name = 'BooleanOperationError'
  }
}

export const AUTO_PROCESSING_ERROR_CODES = Object.freeze({
  autoOrientNoSelection: 'AUTO_ORIENT_NO_SELECTION',
  autoOrientNoDentalMode: 'AUTO_ORIENT_NO_DENTAL_MODE',
  autoOrientInvalidGeometry: 'AUTO_ORIENT_INVALID_GEOMETRY',
  autoOrientComputeFailed: 'AUTO_ORIENT_COMPUTE_FAILED',
  autoProcessNoSelection: 'AUTO_PROCESS_NO_SELECTION',
  autoProcessExportFailed: 'AUTO_PROCESS_EXPORT_FAILED',
  autoProcessHollowManagerUnavailable: 'AUTO_PROCESS_HOLLOW_MANAGER_UNAVAILABLE',
  autoProcessSupportPipelineFailed: 'AUTO_PROCESS_SUPPORT_PIPELINE_FAILED',
  autoProcessOrthoPipelineFailed: 'AUTO_PROCESS_ORTHO_PIPELINE_FAILED',
  autoProcessUnknown: 'AUTO_PROCESS_UNKNOWN',
})

const AUTO_PROCESSING_ERROR_CODE_SET = new Set(Object.values(AUTO_PROCESSING_ERROR_CODES))

export class AutoProcessingFlowError extends BackendError {
  constructor(code, { details = '', cause = null, context = null } = {}) {
    super(code, code, details)
    this.name = 'AutoProcessingFlowError'
    this.cause = cause
    this.context = context
  }
}

export function createAutoProcessingError(code, options = {}) {
  return new AutoProcessingFlowError(code, options)
}

export function normalizeAutoProcessingError(error, fallbackCode = AUTO_PROCESSING_ERROR_CODES.autoProcessUnknown) {
  if (error instanceof AutoProcessingFlowError)
    return error

  return new AutoProcessingFlowError(
    AUTO_PROCESSING_ERROR_CODE_SET.has(error?.code) ? error.code : fallbackCode,
    {
      details: error?.message || String(error || ''),
      cause: error,
      context: error?.context ?? null,
    },
  )
}

function descriptor(summaryKey, detailKey, detailParams = undefined) {
  return { summaryKey, detailKey, detailParams }
}

export function getAutoOrientationErrorToast(error) {
  switch (error.code) {
    case AUTO_PROCESSING_ERROR_CODES.autoOrientNoSelection:
      return descriptor('errors.autoOrientation.failed', 'errors.autoOrientation.noSelection')
    case AUTO_PROCESSING_ERROR_CODES.autoOrientNoDentalMode:
      return descriptor('errors.autoOrientation.failed', 'errors.autoOrientation.noDentalMode')
    case AUTO_PROCESSING_ERROR_CODES.autoOrientInvalidGeometry:
      return descriptor('errors.autoOrientation.failed', 'errors.autoOrientation.invalidGeometry')
    case AUTO_PROCESSING_ERROR_CODES.autoOrientComputeFailed:
      return descriptor('errors.autoOrientation.failed', 'errors.autoOrientation.computeFailed')
    default:
      return descriptor('errors.autoOrientation.failed', 'errors.autoOrientation.unknown')
  }
}

export function getAutoProcessErrorToast(error, branch = 'support') {
  switch (error.code) {
    case AUTO_PROCESSING_ERROR_CODES.autoProcessNoSelection:
      return descriptor('errors.autoProcessing.failed', 'errors.autoProcessing.noSelection')
    case AUTO_PROCESSING_ERROR_CODES.autoOrientNoDentalMode:
      return descriptor('errors.autoProcessing.failed', 'errors.autoOrientation.noDentalMode')
    case AUTO_PROCESSING_ERROR_CODES.autoOrientInvalidGeometry:
      return descriptor('errors.autoProcessing.failed', 'errors.autoOrientation.invalidGeometry')
    case AUTO_PROCESSING_ERROR_CODES.autoOrientComputeFailed:
      return descriptor('errors.autoProcessing.failed', 'errors.autoOrientation.computeFailed')
    case AUTO_PROCESSING_ERROR_CODES.autoProcessExportFailed:
      return descriptor('errors.autoProcessing.failed', 'errors.autoProcessing.exportFailed')
    case AUTO_PROCESSING_ERROR_CODES.autoProcessHollowManagerUnavailable:
      return descriptor('errors.autoProcessing.failed', 'errors.autoProcessing.hollowManagerUnavailable')
    case 'ORTHO_PROCESSING_FAILED':
    case AUTO_PROCESSING_ERROR_CODES.autoProcessOrthoPipelineFailed:
      return descriptor('errors.autoProcessing.failed', 'errors.autoProcessing.orthoPipelineFailed')
    case 'SUPPORT_GENERATION_FAILED':
    case AUTO_PROCESSING_ERROR_CODES.autoProcessSupportPipelineFailed:
      return descriptor('errors.autoProcessing.failed', 'errors.autoProcessing.supportPipelineFailed')
    default:
      return descriptor(
        'errors.autoProcessing.failed',
        branch === 'ortho' ? 'errors.autoProcessing.orthoPipelineFailed' : 'errors.autoProcessing.unknown',
      )
  }
}
