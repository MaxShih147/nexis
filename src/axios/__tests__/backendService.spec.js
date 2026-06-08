import { beforeEach, describe, expect, it, vi } from 'vitest'

const slicer = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/axios/axios', () => ({ slicer }))

describe('backendService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('createJob', () => {
    it('sends prz_config and center in the body — no config field', async () => {
      slicer.post.mockResolvedValue({ data: { success: true, data: { jobId: 'abc' } } })

      const { createJob } = await import('@/axios/backendService')
      const przConfig = { Machine: { machine_type: 'sonic_4k' }, Print: {}, Advanced: {} }
      const center = [10, -5]

      await createJob(przConfig, center)

      const [url, body] = slicer.post.mock.calls[0]
      expect(url).toBe('/api/v2/slices')
      expect(body).toHaveProperty('prz_config', przConfig)
      expect(body).toHaveProperty('center', center)
      expect(body).not.toHaveProperty('config')
    })

    it('omits center field when center is not provided', async () => {
      slicer.post.mockResolvedValue({ data: { success: true, data: { jobId: 'abc' } } })

      const { createJob } = await import('@/axios/backendService')
      const przConfig = { Machine: {}, Print: {}, Advanced: {} }

      await createJob(przConfig)

      const [, body] = slicer.post.mock.calls[0]
      expect(body).toHaveProperty('prz_config', przConfig)
      expect(body).not.toHaveProperty('center')
      expect(body).not.toHaveProperty('config')
    })

    it('omits center field when center is undefined', async () => {
      slicer.post.mockResolvedValue({ data: { success: true, data: { jobId: 'abc' } } })

      const { createJob } = await import('@/axios/backendService')

      await createJob({ Machine: {}, Print: {}, Advanced: {} }, undefined)

      const [, body] = slicer.post.mock.calls[0]
      expect(body).not.toHaveProperty('center')
    })
  })

  describe('downloadPrz', () => {
    it('sends only preview fields — no Mechado config keys in body', async () => {
      slicer.post.mockResolvedValue({ data: new Blob() })

      const { downloadPrz } = await import('@/axios/backendService')
      const previews = {
        small: { width: 116, height: 116, rgb: new Uint8Array(116 * 116 * 3).fill(128) },
        large: { width: 290, height: 290, rgb: new Uint8Array(290 * 290 * 3).fill(64) },
      }

      await downloadPrz('job-1', previews)

      const [url, body] = slicer.post.mock.calls[0]
      expect(url).toBe('/api/v2/slices/job-1/download.prz')
      expect(body).toHaveProperty('preview_small')
      expect(body).toHaveProperty('preview_large')
      expect(body).not.toHaveProperty('Machine')
      expect(body).not.toHaveProperty('Print')
      expect(body).not.toHaveProperty('Advanced')
    })

    it('sends empty body when previews is null', async () => {
      slicer.post.mockResolvedValue({ data: new Blob() })

      const { downloadPrz } = await import('@/axios/backendService')

      await downloadPrz('job-2', null)

      const [, body] = slicer.post.mock.calls[0]
      expect(body).toEqual({})
    })

    it('does not require a config argument', async () => {
      slicer.post.mockResolvedValue({ data: new Blob() })

      const { downloadPrz } = await import('@/axios/backendService')

      await expect(downloadPrz('job-3')).resolves.not.toThrow()
    })
  })
})
