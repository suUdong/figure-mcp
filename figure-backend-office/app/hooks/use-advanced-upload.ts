"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "idle" | "uploading" | "paused" | "success" | "error" | "cancelled";
  message: string;
  uploadedBytes: number;
  totalBytes: number;
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  abortController?: AbortController;
  chunks?: Blob[];
  currentChunk?: number;
}

export interface UploadOptions {
  chunkSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  onProgress?: (file: UploadFile) => void;
  onSuccess?: (file: UploadFile) => void;
  onError?: (file: UploadFile, error: string) => void;
}

export function useAdvancedUpload(options: UploadOptions = {}) {
  const {
    chunkSize = 1024 * 1024, // 1MB chunks
    maxRetries = 3,
    retryDelay = 1000,
    onProgress,
    onSuccess,
    onError,
  } = options;

  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const retryCountRef = useRef<Map<string, number>>(new Map());

  // 파일을 청크로 분할
  const createChunks = useCallback(
    (file: File): Blob[] => {
      const chunks: Blob[] = [];
      let start = 0;

      while (start < file.size) {
        const end = Math.min(start + chunkSize, file.size);
        chunks.push(file.slice(start, end));
        start = end;
      }

      return chunks;
    },
    [chunkSize]
  );

  // 파일 추가
  const addFiles = useCallback(
    (newFiles: File[]) => {
      const uploadFiles: UploadFile[] = newFiles.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        progress: 0,
        status: "idle",
        message: "업로드 대기",
        uploadedBytes: 0,
        totalBytes: file.size,
        abortController: new AbortController(),
        chunks: createChunks(file),
        currentChunk: 0,
      }));

      setFiles((prev) => [...prev, ...uploadFiles]);
      return uploadFiles;
    },
    [createChunks]
  );

  // 단일 청크 업로드
  const uploadChunk = useCallback(
    async (
      uploadFile: UploadFile,
      chunkIndex: number,
      chunk: Blob,
      metadata?: any
    ): Promise<boolean> => {
      try {
        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("chunkIndex", chunkIndex.toString());
        formData.append("totalChunks", uploadFile.chunks!.length.toString());
        formData.append("fileId", uploadFile.id);
        formData.append("fileName", uploadFile.file.name);
        formData.append("fileSize", uploadFile.file.size.toString());

        if (metadata) {
          formData.append("metadata", JSON.stringify(metadata));
        }

        // 실제 청크 업로드 API 엔드포인트 (백엔드에서 구현 필요)
        const response = await api.post(
          "/api/documents/upload-chunk",
          formData,
          {
            headers: {}, // Content-Type 제거 - axios가 자동으로 boundary와 함께 설정
            signal: uploadFile.abortController?.signal,
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const chunkProgress =
                  (progressEvent.loaded / progressEvent.total) * 100;
                const totalProgress =
                  ((chunkIndex + chunkProgress / 100) /
                    uploadFile.chunks!.length) *
                  100;
                const uploadedBytes =
                  chunkIndex * chunkSize + progressEvent.loaded;

                const updatedFile = {
                  ...uploadFile,
                  progress: Math.round(totalProgress),
                  uploadedBytes: Math.min(uploadedBytes, uploadFile.totalBytes),
                  currentChunk: chunkIndex,
                  message: `업로드 중... ${Math.round(totalProgress)}% (${
                    chunkIndex + 1
                  }/${uploadFile.chunks!.length} 청크)`,
                };

                setFiles((prev) =>
                  prev.map((f) => (f.id === uploadFile.id ? updatedFile : f))
                );
                onProgress?.(updatedFile);
              }
            },
          }
        );

        return response.data.success;
      } catch (error: any) {
        if (error.name === "AbortError") {
          return false;
        }
        throw error;
      }
    },
    [chunkSize, onProgress]
  );

  // 청크 업로드 완료 처리
  const finalizeUpload = useCallback(
    async (uploadFile: UploadFile, metadata?: any): Promise<any> => {
      try {
        const response = await api.post(
          "/api/documents/finalize-upload",
          {
            fileId: uploadFile.id,
            fileName: uploadFile.file.name,
            fileSize: uploadFile.file.size,
            totalChunks: uploadFile.chunks!.length,
            metadata,
          },
          {
            signal: uploadFile.abortController?.signal,
          }
        );

        return response.data.data;
      } catch (error: any) {
        if (error.name === "AbortError") {
          return null;
        }
        throw error;
      }
    },
    []
  );

  // 파일 업로드 (청크 방식)
  const uploadFile = useCallback(
    async (uploadFile: UploadFile, metadata?: any) => {
      if (uploadFile.status === "uploading") return;

      const updatedFile = {
        ...uploadFile,
        status: "uploading" as const,
        message: "업로드 시작...",
        startTime: new Date(),
        progress: 0,
        uploadedBytes: 0,
      };

      setFiles((prev) =>
        prev.map((f) => (f.id === uploadFile.id ? updatedFile : f))
      );

      try {
        // 청크별 업로드
        for (
          let i = uploadFile.currentChunk || 0;
          i < uploadFile.chunks!.length;
          i++
        ) {
          const chunk = uploadFile.chunks![i];
          const success = await uploadChunk(updatedFile, i, chunk, metadata);

          if (!success) {
            // 업로드가 취소되었거나 실패한 경우
            return;
          }
        }

        // 업로드 완료 처리
        const result = await finalizeUpload(updatedFile, metadata);

        if (result) {
          const completedFile = {
            ...updatedFile,
            status: "success" as const,
            message: "업로드 완료",
            progress: 100,
            uploadedBytes: updatedFile.totalBytes,
            endTime: new Date(),
            result,
          };

          setFiles((prev) =>
            prev.map((f) => (f.id === uploadFile.id ? completedFile : f))
          );
          onSuccess?.(completedFile);
          retryCountRef.current.delete(uploadFile.id);
        } else {
          throw new Error("업로드 완료 처리 실패");
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          const cancelledFile = {
            ...updatedFile,
            status: "cancelled" as const,
            message: "업로드 취소됨",
            progress: 0,
          };
          setFiles((prev) =>
            prev.map((f) => (f.id === uploadFile.id ? cancelledFile : f))
          );
          return;
        }

        // 에러 메시지 안전하게 추출 (객체인 경우 JSON 변환)
        let errorMessage = "업로드 실패";
        
        try {
          const errorDetail = error?.response?.data?.detail;
          if (typeof errorDetail === 'string') {
            errorMessage = errorDetail;
          } else if (typeof errorDetail === 'object' && errorDetail) {
            // 배열인 경우 (FastAPI 422 에러)
            if (Array.isArray(errorDetail)) {
              errorMessage = errorDetail.map(err => err.msg || err).join(', ');
            } else {
              errorMessage = JSON.stringify(errorDetail);
            }
          } else if (error?.message) {
            errorMessage = error.message;
          }
        } catch (e) {
          console.error('Error parsing error message:', e);
          errorMessage = "업로드 실패 (에러 메시지 파싱 실패)";
        }
        const errorFile = {
          ...updatedFile,
          status: "error" as const,
          message: errorMessage,
          error: errorMessage,
        };

        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? errorFile : f))
        );
        onError?.(errorFile, errorMessage);

        // 자동 재시도
        const retryCount = retryCountRef.current.get(uploadFile.id) || 0;
        if (retryCount < maxRetries) {
          retryCountRef.current.set(uploadFile.id, retryCount + 1);
          setTimeout(() => {
            retryUpload(uploadFile.id);
          }, retryDelay * (retryCount + 1));
        }
      }
    },
    [uploadChunk, finalizeUpload, onSuccess, onError, maxRetries, retryDelay]
  );

  // 업로드 일시정지
  const pauseUpload = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (file && file.status === "uploading") {
        file.abortController?.abort();
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: "paused", message: "일시정지됨" }
              : f
          )
        );
      }
    },
    [files]
  );

  // 업로드 재개
  const resumeUpload = useCallback(
    (fileId: string, metadata?: any) => {
      const file = files.find((f) => f.id === fileId);
      if (file && file.status === "paused") {
        const newAbortController = new AbortController();
        const updatedFile = { ...file, abortController: newAbortController };
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? updatedFile : f))
        );
        uploadFile(updatedFile, metadata);
      }
    },
    [files, uploadFile]
  );

  // 업로드 취소
  const cancelUpload = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (file) {
        file.abortController?.abort();
        retryCountRef.current.delete(fileId);
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    },
    [files]
  );

  // 업로드 재시도
  const retryUpload = useCallback(
    (fileId: string, metadata?: any) => {
      const file = files.find((f) => f.id === fileId);
      if (file && (file.status === "error" || file.status === "cancelled")) {
        const newAbortController = new AbortController();
        const updatedFile = {
          ...file,
          status: "idle" as const,
          message: "재시도 대기",
          progress: 0,
          uploadedBytes: 0,
          currentChunk: 0,
          error: undefined,
          abortController: newAbortController,
        };
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? updatedFile : f))
        );
        uploadFile(updatedFile, metadata);
      }
    },
    [files, uploadFile]
  );

  // 전체 업로드
  const uploadAllFiles = useCallback(
    async (metadata?: any) => {
      const pendingFiles = files.filter((f) => f.status === "idle");
      if (pendingFiles.length === 0) return;

      setIsUploading(true);

      try {
        // 순차 업로드 (동시 업로드를 원하면 Promise.all 사용)
        for (const file of pendingFiles) {
          await uploadFile(file, metadata);
        }
      } finally {
        setIsUploading(false);
      }
    },
    [files, uploadFile]
  );

  // 파일 제거
  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    retryCountRef.current.delete(fileId);
  }, []);

  // 모든 파일 제거
  const clearFiles = useCallback(() => {
    files.forEach((file) => {
      file.abortController?.abort();
    });
    setFiles([]);
    retryCountRef.current.clear();
  }, [files]);

  // 업로드 통계
  const getStats = useCallback(() => {
    const total = files.length;
    const pending = files.filter((f) => f.status === "idle").length;
    const uploading = files.filter((f) => f.status === "uploading").length;
    const paused = files.filter((f) => f.status === "paused").length;
    const completed = files.filter((f) => f.status === "success").length;
    const failed = files.filter((f) => f.status === "error").length;
    const cancelled = files.filter((f) => f.status === "cancelled").length;

    const totalSize = files.reduce((acc, f) => acc + f.totalBytes, 0);
    const uploadedSize = files.reduce((acc, f) => acc + f.uploadedBytes, 0);

    const overallProgress =
      totalSize > 0 ? (uploadedSize / totalSize) * 100 : 0;

    return {
      total,
      pending,
      uploading,
      paused,
      completed,
      failed,
      cancelled,
      totalSize,
      uploadedSize,
      overallProgress,
    };
  }, [files]);

  return {
    files,
    isUploading,
    addFiles,
    uploadFile,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    uploadAllFiles,
    removeFile,
    clearFiles,
    getStats,
  };
}
