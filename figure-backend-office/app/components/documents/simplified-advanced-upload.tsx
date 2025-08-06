"use client";

import { useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSites } from "@/hooks/use-sites";
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Trash2,
  Image as ImageIcon,
  FileCode,
  File,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: "idle" | "uploading" | "paused" | "success" | "error" | "cancelled";
  message: string;
  startTime?: Date;
  endTime?: Date;
  preview?: string;
  result?: any;
  error?: string;
  abortController?: AbortController;
}

interface SimplifiedAdvancedUploadProps {
  maxFiles?: number;
  maxSize?: number;
  acceptedTypes?: string[];
  autoUpload?: boolean;
  showPreview?: boolean;
  onUploadComplete?: (file: FileUploadItem) => void;
  onUploadError?: (file: FileUploadItem, error: string) => void;
  onAllComplete?: (files: FileUploadItem[]) => void;
  className?: string;
}

export default function SimplifiedAdvancedUpload({
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
  acceptedTypes = [
    ".txt",
    ".md",
    ".pdf",
    ".doc",
    ".docx",
    ".html",
    ".htm",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
  ],
  autoUpload = false,
  showPreview = true,
  onUploadComplete,
  onUploadError,
  onAllComplete,
  className,
}: SimplifiedAdvancedUploadProps) {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  // 사이트 목록 가져오기
  const { sites, isLoading: sitesLoading } = useSites();

  // 드래그 이벤트 핸들러
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }, []);

  // 파일 추가
  const addFiles = useCallback(
    async (newFiles: File[]) => {
      const validFiles = await Promise.all(
        newFiles.map(async (file) => {
          const validation = await validateFile(file);
          if (!validation.isValid) {
            alert(validation.error);
            return null;
          }
          return file;
        })
      );

      const filesToAdd = validFiles.filter(Boolean) as File[];
      const remainingSlots = maxFiles - files.length;
      const filesToProcess = filesToAdd.slice(0, remainingSlots);

      const newFileItems: FileUploadItem[] = await Promise.all(
        filesToProcess.map(async (file) => {
          const item: FileUploadItem = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            progress: 0,
            status: "idle",
            message: "업로드 대기",
            abortController: new AbortController(),
          };

          // 미리보기 생성
          if (showPreview && file.type.startsWith("image/")) {
            try {
              item.preview = await createFilePreview(file);
            } catch (error) {
              console.warn("미리보기 생성 실패:", error);
            }
          }

          return item;
        })
      );

      setFiles((prev) => [...prev, ...newFileItems]);

      // 자동 업로드
      if (autoUpload) {
        newFileItems.forEach((item) => uploadFile(item));
      }
    },
    [files.length, maxFiles, autoUpload, showPreview]
  );

  // 파일 검증
  const validateFile = async (
    file: File
  ): Promise<{ isValid: boolean; error?: string }> => {
    // 크기 검사
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `파일 크기가 ${formatFileSize(maxSize)}를 초과합니다: ${
          file.name
        }`,
      };
    }

    // 타입 검사
    const fileExt = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));
    if (!acceptedTypes.includes(fileExt)) {
      return {
        isValid: false,
        error: `지원하지 않는 파일 형식입니다: ${file.name}`,
      };
    }

    // 중복 검사
    if (
      files.some((f) => f.file.name === file.name && f.file.size === file.size)
    ) {
      return {
        isValid: false,
        error: `이미 추가된 파일입니다: ${file.name}`,
      };
    }

    return { isValid: true };
  };

  // 파일 미리보기 생성
  const createFilePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 파일 업로드 (기존 API 사용)
  const uploadFile = useCallback(
    async (fileItem: FileUploadItem) => {
      if (fileItem.status === "uploading") return;

      const updatedItem = {
        ...fileItem,
        status: "uploading" as const,
        message: "업로드 시작...",
        startTime: new Date(),
        progress: 0,
      };

      setFiles((prev) =>
        prev.map((f) => (f.id === fileItem.id ? updatedItem : f))
      );

      try {
        const formData = new FormData();
        formData.append("file", fileItem.file);

        if (siteId) {
          formData.append("site_id", siteId);
        }

        const metadata = {
          description: description || "",
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        };
        formData.append("metadata", JSON.stringify(metadata));

        const response = await api.post(
          "/api/documents/upload-file",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
            signal: fileItem.abortController?.signal,
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const progress = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total
                );

                const updatedFile = {
                  ...fileItem,
                  progress,
                  message: `업로드 중... ${progress}%`,
                };

                setFiles((prev) =>
                  prev.map((f) => (f.id === fileItem.id ? updatedFile : f))
                );
              }
            },
          }
        );

        if (response.data.success) {
          const completedItem = {
            ...fileItem,
            status: "success" as const,
            message: "업로드 완료",
            progress: 100,
            endTime: new Date(),
            result: response.data.data,
          };

          setFiles((prev) =>
            prev.map((f) => (f.id === fileItem.id ? completedItem : f))
          );
          onUploadComplete?.(completedItem);
        } else {
          throw new Error(response.data.message || "업로드 실패");
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          const cancelledItem = {
            ...fileItem,
            status: "cancelled" as const,
            message: "업로드 취소됨",
            progress: 0,
          };
          setFiles((prev) =>
            prev.map((f) => (f.id === fileItem.id ? cancelledItem : f))
          );
        } else {
          const errorMessage =
            error?.response?.data?.detail || error?.message || "업로드 실패";
          const errorItem = {
            ...fileItem,
            status: "error" as const,
            message: errorMessage,
            error: errorMessage,
            progress: 0,
          };

          setFiles((prev) =>
            prev.map((f) => (f.id === fileItem.id ? errorItem : f))
          );
          onUploadError?.(errorItem, errorMessage);
        }
      }
    },
    [siteId, description, tags, onUploadComplete, onUploadError]
  );

  // 업로드 제어
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

  const cancelUpload = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (file) {
        file.abortController?.abort();
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    },
    [files]
  );

  const retryUpload = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (
        file &&
        (file.status === "error" ||
          file.status === "cancelled" ||
          file.status === "paused")
      ) {
        const newAbortController = new AbortController();
        const updatedFile = {
          ...file,
          status: "idle" as const,
          message: "재시도 대기",
          progress: 0,
          error: undefined,
          abortController: newAbortController,
        };
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? updatedFile : f))
        );
        uploadFile(updatedFile);
      }
    },
    [files, uploadFile]
  );

  // 전체 업로드
  const uploadAllFiles = useCallback(async () => {
    // 사이트 선택 필수 검증
    if (!siteId) {
      alert("MCP 문서 생성 요청에 필요한 사이트를 선택해주세요.");
      return;
    }

    const pendingFiles = files.filter((f) => f.status === "idle");
    setIsUploading(true);

    try {
      for (const file of pendingFiles) {
        await uploadFile(file);
      }
      onAllComplete?.(files);
    } finally {
      setIsUploading(false);
    }
  }, [files, uploadFile, onAllComplete, siteId]);

  // 유틸리티 함수들
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <ImageIcon className="h-5 w-5" />;
    }
    if (file.type.includes("pdf")) {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    if (file.type.includes("text") || file.name.endsWith(".md")) {
      return <FileCode className="h-5 w-5 text-blue-500" />;
    }
    return <File className="h-5 w-5" />;
  };

  const getStatusConfig = (status: FileUploadItem["status"]) => {
    switch (status) {
      case "idle":
        return {
          color: "bg-gray-500",
          label: "대기",
          icon: <FileText className="h-4 w-4" />,
        };
      case "uploading":
        return {
          color: "bg-figure-500",
          label: "업로드 중",
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
        };
      case "paused":
        return {
          color: "bg-warning-500",
          label: "일시정지",
          icon: <Pause className="h-4 w-4" />,
        };
      case "success":
        return {
          color: "bg-success-500",
          label: "완료",
          icon: <CheckCircle2 className="h-4 w-4" />,
        };
      case "error":
        return {
          color: "bg-error-500",
          label: "오류",
          icon: <AlertCircle className="h-4 w-4" />,
        };
      case "cancelled":
        return {
          color: "bg-gray-500",
          label: "취소됨",
          icon: <X className="h-4 w-4" />,
        };
      default:
        return {
          color: "bg-gray-500",
          label: "알 수 없음",
          icon: <AlertCircle className="h-4 w-4" />,
        };
    }
  };

  // 통계 계산
  const stats = {
    total: files.length,
    pending: files.filter((f) => f.status === "idle").length,
    uploading: files.filter((f) => f.status === "uploading").length,
    completed: files.filter((f) => f.status === "success").length,
    failed: files.filter((f) => f.status === "error").length,
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* 업로드 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>업로드 설정</span>
          </CardTitle>
          <CardDescription>
            파일 업로드를 위한 메타데이터를 설정하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="siteId" className="flex items-center gap-1">
                사이트 선택 
                <span className="text-red-500">*</span>
              </Label>
              <select
                id="siteId"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className={cn(
                  "flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                  !siteId ? "border-red-300 bg-red-50" : "border-input bg-background"
                )}
                disabled={sitesLoading}
                required
              >
                <option value="">사이트를 선택하세요 (필수)</option>
                {sites?.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} - {site.company}
                  </option>
                ))}
              </select>
              {sitesLoading && (
                <p className="text-xs text-gray-500 mt-1">
                  사이트 목록을 불러오는 중...
                </p>
              )}
              {!siteId && (
                <p className="text-xs text-red-600 mt-1">
                  MCP 문서 생성 요청 시 필요한 키값입니다. 반드시 선택해주세요.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="tags">태그</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="쉼표로 구분"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="파일에 대한 설명..."
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* 드래그앤드롭 영역 */}
      <Card>
        <CardContent className="p-6">
          <div
            className={cn(
              "relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer group",
              "hover:border-figure-400 hover:bg-figure-50",
              isDragOver
                ? "border-figure-500 bg-figure-100 scale-[1.02] shadow-lg"
                : "border-gray-300"
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="space-y-6">
              <div
                className={cn(
                  "mx-auto w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
                  isDragOver
                    ? "bg-figure-500 shadow-lg scale-110"
                    : "bg-gray-100 group-hover:bg-figure-100"
                )}
              >
                <Upload
                  className={cn(
                    "h-10 w-10 transition-all duration-300",
                    isDragOver
                      ? "text-white animate-pulse"
                      : "text-gray-400 group-hover:text-figure-500"
                  )}
                />
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">
                  {isDragOver
                    ? "파일을 놓아주세요!"
                    : "파일을 여기에 드래그하거나 클릭하세요"}
                </h3>
                <p className="text-gray-500 mb-4">
                  {acceptedTypes.join(", ")} 파일 지원 (최대{" "}
                  {formatFileSize(maxSize)})
                </p>
                <div className="flex items-center justify-center space-x-6 text-sm text-gray-400">
                  <div className="flex items-center space-x-1">
                    <FileText className="h-4 w-4" />
                    <span>최대 {maxFiles}개 파일</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>일시정지/재개</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Eye className="h-4 w-4" />
                    <span>미리보기</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 애니메이션 효과 */}
            {isDragOver && (
              <div className="absolute inset-0 rounded-xl bg-figure-500 bg-opacity-10 animate-pulse"></div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedTypes.join(",")}
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              addFiles(files);
              e.target.value = ""; // Reset input
            }}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* 업로드 통계 */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>업로드 진행상황</span>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={uploadAllFiles}
                  disabled={isUploading || stats.pending === 0 || !siteId}
                  size="sm"
                  className="flex items-center space-x-2"
                  title={!siteId ? "사이트를 선택해주세요" : undefined}
                >
                  <Play className="h-4 w-4" />
                  <span>전체 업로드</span>
                </Button>
                <Button
                  onClick={() => setFiles([])}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>전체 삭제</span>
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-900">
                  {stats.total}
                </div>
                <div className="text-sm text-gray-500">총 파일</div>
              </div>
              <div className="text-center p-4 bg-figure-50 rounded-lg">
                <div className="text-3xl font-bold text-figure-600">
                  {stats.uploading}
                </div>
                <div className="text-sm text-gray-500">업로드 중</div>
              </div>
              <div className="text-center p-4 bg-success-50 rounded-lg">
                <div className="text-3xl font-bold text-success-600">
                  {stats.completed}
                </div>
                <div className="text-sm text-gray-500">완료</div>
              </div>
              <div className="text-center p-4 bg-error-50 rounded-lg">
                <div className="text-3xl font-bold text-error-600">
                  {stats.failed}
                </div>
                <div className="text-sm text-gray-500">실패</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 파일 목록 */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>파일 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((file) => {
                const statusConfig = getStatusConfig(file.status);

                return (
                  <div
                    key={file.id}
                    className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {/* 파일 아이콘/미리보기 */}
                    <div className="flex-shrink-0">
                      {file.preview ? (
                        <div className="w-16 h-16 rounded-lg overflow-hidden border">
                          <img
                            src={file.preview}
                            alt={file.file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg border flex items-center justify-center bg-gray-50">
                          {getFileIcon(file.file)}
                        </div>
                      )}
                    </div>

                    {/* 파일 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium truncate">
                          {file.file.name}
                        </h4>
                        <Badge className={`${statusConfig.color} text-white`}>
                          <div className="flex items-center space-x-1">
                            {statusConfig.icon}
                            <span>{statusConfig.label}</span>
                          </div>
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                        <span>{formatFileSize(file.file.size)}</span>
                        <span>•</span>
                        <span>{file.message}</span>
                      </div>

                      {/* 진행률 바 */}
                      {file.status === "uploading" && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">
                              진행률
                            </span>
                            <span className="text-xs text-gray-500">
                              {file.progress}%
                            </span>
                          </div>
                          <Progress value={file.progress} className="h-2" />
                        </div>
                      )}

                      {/* 오류 메시지 */}
                      {file.error && (
                        <div className="mt-2 p-3 bg-error-50 border border-error-200 rounded text-sm text-error-600">
                          <div className="flex items-center space-x-1">
                            <AlertCircle className="h-4 w-4" />
                            <span className="font-medium">오류:</span>
                          </div>
                          <p className="mt-1">{file.error}</p>
                        </div>
                      )}

                      {/* 성공 정보 */}
                      {file.status === "success" && file.result && (
                        <div className="mt-2 p-3 bg-success-50 border border-success-200 rounded text-sm text-success-600">
                          <div className="flex items-center space-x-1">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="font-medium">업로드 완료</span>
                          </div>
                          <p className="mt-1">
                            문서 ID: {file.result.document_id}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center space-x-1">
                      {file.status === "idle" && (
                        <Button
                          onClick={() => uploadFile(file)}
                          size="sm"
                          variant="outline"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}

                      {file.status === "uploading" && (
                        <Button
                          onClick={() => pauseUpload(file.id)}
                          size="sm"
                          variant="outline"
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}

                      {(file.status === "error" ||
                        file.status === "cancelled" ||
                        file.status === "paused") && (
                        <Button
                          onClick={() => retryUpload(file.id)}
                          size="sm"
                          variant="outline"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}

                      {file.preview && (
                        <Button
                          onClick={() => window.open(file.preview, "_blank")}
                          size="sm"
                          variant="ghost"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        onClick={() => cancelUpload(file.id)}
                        size="sm"
                        variant="ghost"
                        disabled={file.status === "uploading"}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
