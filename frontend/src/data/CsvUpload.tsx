import { useRef, useState } from "react";

export function CsvUpload({
  disabled,
  onUpload,
  onValidationError,
}: {
  readonly disabled: boolean;
  readonly onUpload: (file: File) => void;
  readonly onValidationError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  function handleFile(file: File | undefined): void {
    if (file === undefined) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      onValidationError("Please choose a .csv file.");
      return;
    }

    if (file.size > 1024 * 1024) {
      onValidationError("CSV file must be 1 MB or smaller.");
      return;
    }

    setSelectedFileName(file.name);
    onUpload(file);
  }

  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold text-slate-950">
        Import trade CSV
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Uploading a valid trade CSV atomically replaces the globally active
        trade dataset.
      </p>
      <div
        className="mt-5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center"
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          handleFile(event.dataTransfer.files[0]);
        }}
      >
        <p className="text-sm font-medium text-slate-700">
          Drag and drop `trades.csv` here
        </p>
        <p className="mt-1 text-xs text-slate-500">Maximum upload size: 1 MB</p>
        <button
          className="focus-ring mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Browse CSV
        </button>
        <input
          accept=".csv,text/csv"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            handleFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
          ref={inputRef}
          type="file"
        />
        {selectedFileName === null ? null : (
          <p className="mt-3 text-sm text-slate-600">
            Selected: {selectedFileName}
          </p>
        )}
      </div>
    </section>
  );
}
