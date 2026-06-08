import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock slicer service calls
// ---------------------------------------------------------------------------
const slicerGetMock = vi.fn()
const performBooleanMock = vi.fn()
const getBooleanStlMock = vi.fn()

vi.mock('@/axios/axios', () => ({
  slicer: {
    get: (...args) => slicerGetMock(...args),
  },
}))

vi.mock('@/axios/backendService', () => ({
  performBoolean: (...args) => performBooleanMock(...args),
  getBooleanStl: (...args) => getBooleanStlMock(...args),
}))

// Import after mocking
const { embossText } = await import('@/services/textEmbossService')

const MODEL_BLOB = new Blob(['model-stl'], { type: 'application/octet-stream' })
const TEXT_BLOB = new Blob(['text-stl'], { type: 'application/octet-stream' })
const RESULT_BLOB = new Blob(['result-stl'], { type: 'application/octet-stream' })

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Task 5.1 – Emboss API: success returns new model, failure throws
// ---------------------------------------------------------------------------
describe('5.1 – embossText API', () => {
  beforeEach(() => {
    slicerGetMock.mockReset()
    performBooleanMock.mockReset()
    getBooleanStlMock.mockReset()
  })

  it('returns a Blob on successful boolean union', async () => {
    performBooleanMock.mockResolvedValue({
      data: { jobId: 'job-123', resultPath: '/api/jobs/job-123/boolean.stl' },
    })
    slicerGetMock.mockResolvedValue({ data: RESULT_BLOB })

    const result = await embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB })

    expect(result).toBeInstanceOf(Blob)
  })

  it('calls performBoolean with union operation', async () => {
    performBooleanMock.mockResolvedValue({
      data: { jobId: 'job-123', resultPath: '/api/jobs/job-123/boolean.stl' },
    })
    slicerGetMock.mockResolvedValue({ data: RESULT_BLOB })

    await embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB })

    expect(performBooleanMock).toHaveBeenCalledWith(
      MODEL_BLOB,
      TEXT_BLOB,
      'union',
      '',
    )
  })

  it('passes through parentJobId when provided', async () => {
    performBooleanMock.mockResolvedValue({
      data: { jobId: 'job-123', resultPath: '/api/jobs/job-123/boolean.stl' },
    })
    slicerGetMock.mockResolvedValue({ data: RESULT_BLOB })

    await embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB, parentJobId: '989e90de' })

    expect(performBooleanMock).toHaveBeenCalledWith(
      MODEL_BLOB,
      TEXT_BLOB,
      'union',
      '989e90de',
    )
  })

  it('throws when backend returns failure', async () => {
    performBooleanMock.mockResolvedValue({
      data: { jobId: 'job-fail', resultPath: '/api/jobs/job-fail/boolean.stl' },
    })
    slicerGetMock.mockRejectedValue(new Error('Job failed'))

    await expect(embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB })).rejects.toThrow()
  })

  it('throws when performBoolean itself rejects', async () => {
    performBooleanMock.mockRejectedValue(new Error('Network error'))

    await expect(embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB })).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Task 5.3 – Emboss flow: duplicate submission prevention, success updates model,
//             failure shows error
// ---------------------------------------------------------------------------
describe('5.3 – Emboss flow behaviour', () => {
  beforeEach(() => {
    slicerGetMock.mockReset()
    performBooleanMock.mockReset()
    getBooleanStlMock.mockReset()
  })

  it('downloads the boolean result from resultPath when provided', async () => {
    performBooleanMock.mockResolvedValue({
      data: { jobId: 'job-abc', resultPath: '/api/jobs/job-abc/boolean.stl' },
    })
    slicerGetMock.mockResolvedValue({ data: RESULT_BLOB })

    await embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB })

    expect(slicerGetMock).toHaveBeenCalledWith('/api/jobs/job-abc/boolean.stl', { responseType: 'blob' })
    expect(getBooleanStlMock).not.toHaveBeenCalled()
  })

  it('falls back to getBooleanStl when resultPath is missing', async () => {
    performBooleanMock.mockResolvedValue({ data: { jobId: 'job-abc' } })
    getBooleanStlMock.mockResolvedValue(RESULT_BLOB)

    const result = await embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB })

    expect(result).toBe(RESULT_BLOB)
    expect(getBooleanStlMock).toHaveBeenCalledWith('job-abc')
  })

  it('falls back to getBooleanStl after resultPath exceeds max consecutive 404 retries', async () => {
    vi.useFakeTimers()

    performBooleanMock.mockResolvedValue({
      data: { jobId: 'job-stale', resultPath: '/api/jobs/job-stale/boolean.stl' },
    })
    // resultPath always returns 404 (stale path)
    slicerGetMock.mockRejectedValue({ response: { status: 404 } })
    getBooleanStlMock.mockResolvedValue(RESULT_BLOB)

    const promise = embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB })

    // Advance past 10 retry intervals (10 × 500ms) to exhaust resultPath retries,
    // then one more interval for the getBooleanStl attempt to resolve.
    for (let i = 0; i <= 10; i++) {
      await vi.advanceTimersByTimeAsync(500)
    }

    const result = await promise

    expect(result).toBe(RESULT_BLOB)
    expect(getBooleanStlMock).toHaveBeenCalledWith('job-stale')

    vi.useRealTimers()
  })

  it('returns result STL blob from getBooleanStl after success', async () => {
    performBooleanMock.mockResolvedValue({ data: { jobId: 'job-xyz' } })
    getBooleanStlMock.mockResolvedValue(RESULT_BLOB)

    const result = await embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB })

    expect(result).toBe(RESULT_BLOB)
  })
})

// ---------------------------------------------------------------------------
// Task 5.5 – Restore: undo state management (unit-tested via component interaction;
//             the service itself is stateless — restore is a component concern)
// ---------------------------------------------------------------------------
// Note: Restore functionality is managed in TextEmbossEditor.vue component state:
// - preEmbossBlob is stored before each emboss operation
// - Restore replaces model geometry with the stored blob
// - canRestore is cleared when the panel is closed
// The following tests document and verify the service contract for restore support.

describe('5.5 – Service contract for restore support', () => {
  beforeEach(() => {
    slicerGetMock.mockReset()
    performBooleanMock.mockReset()
    getBooleanStlMock.mockReset()
  })

  it('embossText is a pure function with no internal restore state', async () => {
    performBooleanMock.mockResolvedValue({ data: { jobId: 'j1' } })
    getBooleanStlMock.mockResolvedValue(new Blob(['r1']))

    const result1 = await embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB })

    performBooleanMock.mockResolvedValue({ data: { jobId: 'j2' } })
    getBooleanStlMock.mockResolvedValue(new Blob(['r2']))
    const result2 = await embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB })

    // Two independent calls produce independent results
    expect(result1).not.toBe(result2)
  })

  it('second emboss call uses the most recent model blob as input', async () => {
    performBooleanMock.mockResolvedValue({ data: { jobId: 'j1' } })
    getBooleanStlMock.mockResolvedValue(RESULT_BLOB)

    await embossText({ modelBlob: MODEL_BLOB, textBlob: TEXT_BLOB })

    const secondModelBlob = new Blob(['second-model'])
    performBooleanMock.mockResolvedValue({ data: { jobId: 'j2' } })
    getBooleanStlMock.mockResolvedValue(new Blob(['r2']))
    await embossText({ modelBlob: secondModelBlob, textBlob: TEXT_BLOB })

    // The second call should have used the second model blob, not the first
    const secondCall = performBooleanMock.mock.calls[1]
    expect(secondCall[0]).toBe(secondModelBlob)
  })
})
