import type { ImportValidationIssue } from "./import-error";
import { ImportValidationError, throwIfIssues } from "./import-error";

export interface CsvRow {
  readonly rowNumber: number;
  readonly values: readonly string[];
}

export interface CsvDocument {
  readonly headers: readonly string[];
  readonly rows: readonly CsvRow[];
}

function pushRow(
  rows: CsvRow[],
  rowNumber: number,
  values: readonly string[],
): void {
  const isTrailingBlank = values.length === 1 && values[0] === "";

  if (!isTrailingBlank) {
    rows.push({ rowNumber, values });
  }
}

export function parseCsvDocument(content: string): CsvDocument {
  const issues: ImportValidationIssue[] = [];
  const rows: CsvRow[] = [];
  let rowNumber = 1;
  let currentRowNumber = 1;
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;
  let afterClosingQuote = false;
  let index = content.startsWith("\uFEFF") ? 1 : 0;

  while (index < content.length) {
    const character = content[index];

    if (character === undefined) {
      break;
    }

    if (inQuotes) {
      if (character === '"') {
        const nextCharacter = content[index + 1];

        if (nextCharacter === '"') {
          currentField += '"';
          index += 2;
          continue;
        }

        inQuotes = false;
        afterClosingQuote = true;
        index += 1;
        continue;
      }

      currentField += character;
      index += 1;
      continue;
    }

    if (afterClosingQuote && character !== "," && character !== "\n") {
      if (character === "\r" && content[index + 1] === "\n") {
        currentRow.push(currentField);
        pushRow(rows, currentRowNumber, currentRow);
        currentRow = [];
        currentField = "";
        afterClosingQuote = false;
        index += 2;
        rowNumber += 1;
        currentRowNumber = rowNumber;
        continue;
      }

      issues.push({
        code: "MALFORMED_CSV",
        rowNumber: currentRowNumber,
        message: "Unexpected character after closing quote",
      });
      break;
    }

    if (character === '"') {
      if (currentField.length > 0) {
        issues.push({
          code: "MALFORMED_CSV",
          rowNumber: currentRowNumber,
          message: "Quote must begin a quoted field",
        });
        break;
      }

      inQuotes = true;
      index += 1;
      continue;
    }

    if (character === ",") {
      currentRow.push(currentField);
      currentField = "";
      afterClosingQuote = false;
      index += 1;
      continue;
    }

    if (character === "\n" || character === "\r") {
      currentRow.push(currentField);
      pushRow(rows, currentRowNumber, currentRow);
      currentRow = [];
      currentField = "";
      afterClosingQuote = false;

      if (character === "\r" && content[index + 1] === "\n") {
        index += 2;
      } else {
        index += 1;
      }

      rowNumber += 1;
      currentRowNumber = rowNumber;
      continue;
    }

    currentField += character;
    index += 1;
  }

  if (inQuotes) {
    issues.push({
      code: "MALFORMED_CSV",
      rowNumber: currentRowNumber,
      message: "Unclosed quoted field",
    });
  }

  currentRow.push(currentField);
  pushRow(rows, currentRowNumber, currentRow);
  throwIfIssues(issues);

  const [headerRow, ...dataRows] = rows;

  if (headerRow === undefined) {
    throw new ImportValidationError([
      {
        code: "MALFORMED_CSV",
        rowNumber: 1,
        message: "CSV file is empty",
      },
    ]);
  }

  const headers = headerRow.values.map((header) => header.trim());
  const shapeIssues = dataRows
    .filter(({ values }) => values.length !== headers.length)
    .map(({ rowNumber: malformedRowNumber }) => ({
      code: "MALFORMED_CSV" as const,
      rowNumber: malformedRowNumber,
      message: "CSV row has a different number of columns than the header",
    }));

  throwIfIssues(shapeIssues);

  return { headers, rows: dataRows };
}

export function requiredColumnIndexes(
  headers: readonly string[],
  requiredColumns: readonly string[],
): Map<string, number> {
  const issues = requiredColumns
    .filter((columnName) => !headers.includes(columnName))
    .map((columnName) => ({
      code: "MISSING_REQUIRED_COLUMN" as const,
      field: columnName,
      message: `Missing required column: ${columnName}`,
    }));

  throwIfIssues(issues);

  return new Map(
    requiredColumns.map((columnName) => [
      columnName,
      headers.indexOf(columnName),
    ]),
  );
}
