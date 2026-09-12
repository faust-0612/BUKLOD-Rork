import * as XLSX from 'xlsx';

export async function outputReportWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(workbook, fileName);
  return fileName;
}
