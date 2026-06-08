// 沒在用
import { slicerV2 } from './axios'

export async function createSliceJob(przConfig) {
  if (!przConfig) {
    throw new Error('No prz_config data provided')
  }
  const response = await slicerV2.post('/slices', { prz_config: przConfig })
  const { success, message, data } = response.data
  if (success) {
    return data.jobId
  }
  else {
    throw new Error(message || 'Failed to create slice job')
  }
}

export async function updateSliceJobConfig(jobId, configData, isAppend = true) {
  const response = await slicerV2.put(`/slices/${jobId}/config`, { config: configData, isAppend })
  const { success, message } = response.data
  if (success) {
    return true
  }
  else {
    throw new Error(message || 'Failed to update slice job config')
  }
}

export async function addModelsToSliceJob(jobId, models) {
  const response = await slicerV2.post(`/slices/${jobId}/models`, { models })
  const { success, message, data } = response.data
  if (success) {
    return data.modelIds
  }
  else {
    throw new Error(message || 'Failed to add models to slice job')
  }
}

export async function executeSliceJob(jobId) {
  const response = await slicerV2.post(`/slices/${jobId}/execute`)
  const { success, message, data } = response.data
  if (success) {
    return data.currentConfig
  }
  else {
    throw new Error(message || 'Failed to execute slice job')
  }
}

export async function getUChars(jobId) {
  const response = await slicerV2.get(`/slices/${jobId}/uchars`)
  const { success, message, data } = response.data
  if (success) {
    return data.uchars
  }
  else {
    throw new Error(message || 'Failed to retrieve UCHARs')
  }
}

export async function getGCode(jobId) {
  const response = await slicerV2.get(`/slices/${jobId}/gcode`)
  const { success, message, data } = response.data
  if (success) {
    return data.gcode
  }
  else {
    throw new Error(message || 'Failed to retrieve GCODE')
  }
}
