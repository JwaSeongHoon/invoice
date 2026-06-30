import { UploadForm } from "@/components/upload-form";

export default function UploadPage() {
  return (
    <section className="flex w-full flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">새 정산 처리</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          영문 수입신고필증(PDF)과 한글 입고현황(xlsx)을 업로드하면 자동으로 분류·파싱합니다.
        </p>
      </div>
      <UploadForm />
    </section>
  );
}
