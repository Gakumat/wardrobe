"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { isMobile } from "@/lib/images/process";
import { uploadAndTag, type UploadStage } from "@/lib/items/upload";

type Job = {
  key: string;
  file: File;
  preview: string;
  stage: UploadStage;
  progress?: number;
  error?: string;
};

const STAGE_LABEL: Record<UploadStage, string> = {
  queued: "Waiting",
  resizing: "Preparing",
  cutout: "Cutting out",
  uploading: "Uploading",
  tagging: "Tagging",
  done: "Ready to review",
  error: "Failed",
};
const STAGE_PCT: Record<UploadStage, number> = {
  queued: 0,
  resizing: 10,
  cutout: 30,
  uploading: 65,
  tagging: 80,
  done: 100,
  error: 100,
};

export function Uploader() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const queue = useRef<Job[]>([]);
  const running = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Job>) =>
    setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...p } : j)));

  const pump = () => {
    // Background removal is heavy, so keep concurrency low (1 on phones).
    const limit = isMobile() ? 1 : 2;
    while (running.current < limit && queue.current.length) {
      const job = queue.current.shift()!;
      running.current++;
      let last: UploadStage = "queued";
      uploadAndTag(job.file, (stage, progress) => {
        last = stage;
        patch(job.key, { stage, progress });
      })
        .then(() => router.refresh())
        .catch((e: Error) => {
          // If the item was saved but tagging failed, it now lives in the review
          // queue (with its own retry), so drop it from this list.
          patch(job.key, last === "tagging" ? { stage: "done" } : { stage: "error", error: e.message });
          router.refresh();
        })
        .finally(() => {
          running.current--;
          pump();
        });
    }
  };

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const fresh: Job[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
      .map((file) => ({
        key: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        stage: "queued" as const,
      }));
    setJobs((js) => [...fresh, ...js]);
    queue.current.push(...fresh);
    pump();
  };

  const retry = (job: Job) => {
    patch(job.key, { stage: "queued", error: undefined });
    queue.current.push(job);
    pump();
  };

  const active = jobs.filter((j) => j.stage !== "done" && j.stage !== "error").length;
  const visible = jobs.filter((j) => j.stage !== "done");

  return (
    <section className="px-5">
      <button
        onClick={() => input.current?.click()}
        className="card flex w-full flex-col items-center gap-2 border-dashed px-6 py-10 text-center"
      >
        <Icon name="camera" className="h-8 w-8 text-muted" />
        <span className="font-medium">Add photos</span>
        <span className="text-sm text-muted">
          One item per photo, laid flat or on a hanger. Pick as many as you like.
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />

      {visible.length > 0 && (
        <div className="mt-4 space-y-2">
          {active > 0 && (
            <p className="text-xs text-muted">
              Processing {active} photo{active === 1 ? "" : "s"}. Keep this screen open. The first one
              takes longer while the cut-out model downloads.
            </p>
          )}
          {visible.map((j) => (
            <div key={j.key} className="card flex items-center gap-3 p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={j.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-sm">
                  <span className={j.stage === "error" ? "text-warn" : ""}>{STAGE_LABEL[j.stage]}</span>
                  {j.stage === "cutout" && j.progress != null && j.progress < 1 && (
                    <span className="text-xs text-muted">downloading model {Math.round(j.progress * 100)}%</span>
                  )}
                </div>
                {j.error ? (
                  <p className="truncate text-xs text-warn">{j.error}</p>
                ) : (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${STAGE_PCT[j.stage]}%` }}
                    />
                  </div>
                )}
              </div>
              {j.stage === "error" && (
                <button onClick={() => retry(j)} className="p-2 text-muted" aria-label="Retry">
                  <Icon name="refresh" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
