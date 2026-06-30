"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { showError } from "@/lib/utils/toast";
import type { IngestResult } from "@/lib/types/domain";

const PDF_MAX = 50 * 1024 * 1024;
const XLSX_MAX = 10 * 1024 * 1024;

type FileKind = "pdf" | "xlsx";

interface DropZoneProps {
  kind: FileKind;
  file: File | null;
  onSelect: (file: File | null) => void;
}

function validate(kind: FileKind, file: File): string | null {
  if (kind === "pdf") {
    if (!file.name.toLowerCase().endsWith(".pdf")) return "PDF 파일만 업로드할 수 있습니다.";
    if (file.size > PDF_MAX) return "PDF 크기는 50MB를 초과할 수 없습니다.";
  } else {
    if (!/\.xlsx?$/.test(file.name.toLowerCase())) return "xlsx 파일만 업로드할 수 있습니다.";
    if (file.size > XLSX_MAX) return "xlsx 크기는 10MB를 초과할 수 없습니다.";
  }
  return null;
}

function DropZone({ kind, file, onSelect }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const Icon = kind === "pdf" ? FileText : FileSpreadsheet;
  const label = kind === "pdf" ? "최종정산서 (PDF)" : "입고현황 (xlsx)";
  const accept = kind === "pdf" ? ".pdf" : ".xlsx,.xls";

  const handleFile = (f: File | null) => {
    if (!f) return;
    const err = validate(kind, f);
    if (err) {
      showError(err);
      return;
    }
    onSelect(f);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label} 업로드 영역`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0] ?? null);
      }}
      className={cn(
        "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
        dragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-2">
          <Icon className="text-primary h-5 w-5" />
          <span className="text-sm font-medium">{file.name}</span>
          <button
            type="button"
            aria-label="파일 제거"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <UploadCloud className="text-muted-foreground h-8 w-8" />
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">드래그하거나 클릭하여 파일 선택</p>
        </>
      )}
    </div>
  );
}

export function UploadForm() {
  const router = useRouter();
  const [pdf, setPdf] = useState<File | null>(null);
  const [xlsx, setXlsx] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!pdf || !xlsx) {
      showError("정산서 PDF와 입고현황 xlsx를 모두 선택해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("pdf", pdf);
      formData.append("xlsx", xlsx);

      const res = await fetch("/api/ingest", { method: "POST", body: formData });
      const body = (await res.json()) as IngestResult | { error: string };
      if (!res.ok) {
        showError("error" in body ? body.error : "처리에 실패했습니다.");
        return;
      }
      const result = body as IngestResult;
      router.push(`/protected/process/${result.batchId}`);
    } catch {
      showError("업로드 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 정산 처리</CardTitle>
        <CardDescription>
          수입신고필증이 포함된 최종정산서 PDF와 입고현황 xlsx를 업로드하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <DropZone kind="pdf" file={pdf} onSelect={setPdf} />
          <DropZone kind="xlsx" file={xlsx} onSelect={setXlsx} />
        </div>
        <Button onClick={handleSubmit} disabled={submitting || !pdf || !xlsx} className="w-full">
          {submitting ? "처리 중..." : "처리 시작"}
        </Button>
      </CardContent>
    </Card>
  );
}
