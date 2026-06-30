"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle, AlertTriangle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { showSuccess } from "@/lib/utils/toast";
import { getBatchPdfSignedUrl } from "@/app/actions/batch";

type StepStatus = "pending" | "active" | "done" | "error";

interface Step {
  key: string;
  label: string;
  status: StepStatus;
}

const INITIAL_STEPS: Step[] = [
  { key: "classify", label: "PDF 분류·정산서 파싱", status: "done" },
  { key: "inventory", label: "입고현황 xlsx 파싱", status: "done" },
  { key: "ocr", label: "신고필증 OCR", status: "pending" },
  { key: "validate", label: "수량 검증 (㉟=㊶)", status: "pending" },
];

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === "active") return <Loader2 className="text-primary h-5 w-5 animate-spin" />;
  if (status === "error") return <XCircle className="text-destructive h-5 w-5" />;
  return <Circle className="text-muted-foreground h-5 w-5" />;
}

export function ProcessStatus({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [logs, setLogs] = useState<string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [lowConfidence, setLowConfidence] = useState<number[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const started = useRef(false);

  const setStep = (key: string, status: StepStatus) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status } : s)));
  const log = (msg: string) => setLogs((prev) => [...prev, msg]);

  useEffect(() => {
    if (started.current) return; // React strict mode 중복 실행 방지
    started.current = true;

    (async () => {
      // 1) 신고필증 OCR
      setStep("ocr", "active");
      log("신고필증 페이지를 OCR 처리 중입니다...");
      try {
        const ocrRes = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId }),
        });
        const ocrBody = await ocrRes.json();
        if (!ocrRes.ok) {
          setStep("ocr", "error");
          setFailed(ocrBody.error ?? "OCR 처리에 실패했습니다.");
          return;
        }
        setStep("ocr", "done");
        log(`신고필증 ${ocrBody.itemCount}개 품목을 추출했습니다.`);
        if (Array.isArray(ocrBody.lowConfidencePages) && ocrBody.lowConfidencePages.length > 0) {
          setLowConfidence(ocrBody.lowConfidencePages);
          setPdfUrl(await getBatchPdfSignedUrl(batchId));
        }
      } catch {
        setStep("ocr", "error");
        setFailed("OCR 처리 중 오류가 발생했습니다.");
        return;
      }

      // 2) ㉟=㊶ 수량 검증
      setStep("validate", "active");
      log("35번·41번 수량 합계를 검증 중입니다...");
      try {
        const valRes = await fetch("/api/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId }),
        });
        const valBody = await valRes.json();
        if (!valRes.ok) {
          setStep("validate", "error");
          setFailed(valBody.error ?? "검증에 실패했습니다.");
          return;
        }
        if (!valBody.passed) {
          setStep("validate", "error");
          setFailed(valBody.message);
          return;
        }
        setStep("validate", "done");
        log("수량 검증을 통과했습니다.");
        showSuccess("처리가 완료되었습니다. 매칭 검토로 이동합니다.");
        setTimeout(() => router.push(`/protected/match/${batchId}`), 1200);
      } catch {
        setStep("validate", "error");
        setFailed("검증 처리 중 오류가 발생했습니다.");
      }
    })();
  }, [batchId, router]);

  const doneCount = steps.filter((s) => s.status === "done").length;
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>처리 진행</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Progress value={progress} aria-label="처리 진행률" />

          <ul className="flex flex-col gap-3">
            {steps.map((step) => (
              <li key={step.key} className="flex items-center gap-3 text-sm">
                <StepIcon status={step.status} />
                <span className={step.status === "error" ? "text-destructive" : ""}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>

          {lowConfidence.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span>
                OCR 저신뢰 페이지: {lowConfidence.join(", ")}쪽.
                {pdfUrl && (
                  <>
                    {" "}
                    <a href={pdfUrl} target="_blank" rel="noreferrer" className="underline">
                      원본 보기
                    </a>
                  </>
                )}
              </span>
            </div>
          )}

          {failed && (
            <div className="border-destructive/40 bg-destructive/10 flex flex-col gap-3 rounded-md border p-4">
              <p className="text-destructive text-sm font-medium">{failed}</p>
              <Button asChild variant="outline" size="sm" className="self-start">
                <a href="/protected/upload">다시 업로드</a>
              </Button>
            </div>
          )}

          {logs.length > 0 && (
            <div className="text-muted-foreground flex flex-col gap-1 text-xs">
              {logs.map((l, i) => (
                <p key={i}>· {l}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
