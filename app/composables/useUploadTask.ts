import type { Ref } from 'vue'

export type UploadTaskStatus = 'idle' | 'uploading' | 'done' | 'cancelled'

export interface UploadTask {
  status: UploadTaskStatus
  total: number
  done: number
  uploadedCount: number
  errorCount: number
  cancelledCount: number
  cancelRequested: boolean
  /**
   * True while the uploader UI that owns this task is mounted (modal open).
   * The floating dock only shows when this is false, so progress is never
   * rendered twice.
   */
  ownerVisible: boolean
}

export function useUploadTask() {
  return useState<UploadTask>('admin-upload-task', () => ({
    status: 'idle',
    total: 0,
    done: 0,
    uploadedCount: 0,
    errorCount: 0,
    cancelledCount: 0,
    cancelRequested: false,
    ownerVisible: true
  }))
}

// AbortController is not serializable, so it lives outside the reactive state.
let activeUploadAbort: AbortController | null = null

export function registerUploadAbort(controller: AbortController | null) {
  activeUploadAbort = controller
}

export function requestUploadCancel(task: Ref<UploadTask>) {
  if (task.value.status !== 'uploading' || task.value.cancelRequested) return
  task.value.cancelRequested = true
  activeUploadAbort?.abort()
}
