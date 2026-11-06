export function downloadExcel(filename: string, title: string, headers: string[], rows: unknown[][]) {
  const cell = (value: unknown) => String(value ?? "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);
  const header = headers.map((value) => `<th>${cell(value)}</th>`).join("");
  const body = rows.map((row) => `<tr>${row.map((value) => `<td>${cell(value)}</td>`).join("")}</tr>`).join("");
  const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial}h1{color:#176b4d}table{border-collapse:collapse}th{background:#176b4d;color:white;font-weight:bold}th,td{border:1px solid #cbd8d0;padding:8px;mso-number-format:"\\@"}tr:nth-child(even){background:#f0f6f2}</style></head><body><h1>${cell(title)}</h1><table dir="rtl"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const blob = new Blob(["\uFEFF", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
