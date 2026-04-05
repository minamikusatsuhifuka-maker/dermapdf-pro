import * as XLSX from "xlsx";

export interface TripleValue {
  total: number;
  jihi: number;
  hoken: number;
}

export interface ClinicMonthData {
  yearMonth: string;
  fileName: string;
  sheet1: {
    shiharaiGoukei: TripleValue;
    genkin: TripleValue;
    credit: TripleValue;
    qr: TripleValue;
    emoney: TripleValue;
    henkin: TripleValue;
    nyukinGoukei: TripleValue;
  };
  hoken: {
    tensuGoukei: number;
    seikyuGoukei: number;
    madoGuchiGoukei: number;
    mishuGoukei: number;
    shaHo: number;
    kokuHo: number;
    rosai: number;
    jibaiseki: number;
    kogai: number;
    sonotaHoken: number;
    shoshinRyo: number;
    saishinRyo: number;
    kanriRyo: number;
    zaitakuRyo: number;
    chusha: number;
    shochi: number;
    shujutsu: number;
    kensa: number;
    byori: number;
    shohosenRyo: number;
    sonotaTensu: number;
    gazoShindan: number;
  };
}

type Row = (string | number | null)[];

function parseSheet1(ws: XLSX.WorkSheet): ClinicMonthData["sheet1"] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as Row[];

  // ヘッダー行（B列が「支払い方法」）を見つける
  let headerRowIdx = 0;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][1] ?? "").trim() === "支払い方法") {
      headerRowIdx = i;
      break;
    }
  }

  const dataRows = rows.slice(headerRowIdx + 1);

  const get = (label: string): TripleValue => {
    for (const row of dataRows) {
      const b = String(row[1] ?? "").trim();
      if (b === label) {
        return {
          total: Math.round(Number(row[2]) || 0),
          jihi: Math.round(Number(row[3]) || 0),
          hoken: Math.round(Number(row[4]) || 0),
        };
      }
    }
    return { total: 0, jihi: 0, hoken: 0 };
  };

  const getMax = (labels: string[]): TripleValue => {
    let best: TripleValue = { total: 0, jihi: 0, hoken: 0 };
    for (const row of dataRows) {
      const b = String(row[1] ?? "").trim();
      if (labels.includes(b)) {
        const total = Math.round(Number(row[2]) || 0);
        if (total > best.total) {
          best = {
            total,
            jihi: Math.round(Number(row[3]) || 0),
            hoken: Math.round(Number(row[4]) || 0),
          };
        }
      }
    }
    return best;
  };

  return {
    shiharaiGoukei: getMax(["支払い合計(税込)", "支払合計(税込)"]),
    genkin: get("現金"),
    credit: get("クレジットカード"),
    qr: get("ＱＲ決済"),
    emoney: get("電子マネー"),
    henkin: get("返金対応用"),
    nyukinGoukei: get("入金額合計"),
  };
}

function parseHoken(ws: XLSX.WorkSheet): ClinicMonthData["hoken"] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as Row[];

  // 指定列ペアでラベルを検索
  const findInCols = (labelCol: number, valueCol: number, label: string): number => {
    for (const row of rows) {
      const cell = String(row[labelCol] ?? "").trim();
      if (cell === label || cell.startsWith(label)) {
        return Math.round(Number(row[valueCol]) || 0);
      }
    }
    return 0;
  };

  // B→C, E→F, H→I, K→L, N→O の順で探す
  const find = (label: string): number => {
    const colPairs: [number, number][] = [[1, 2], [4, 5], [7, 8], [10, 11], [13, 14]];
    for (const [lc, vc] of colPairs) {
      const val = findInCols(lc, vc, label);
      if (val !== 0) return val;
    }
    return 0;
  };

  return {
    tensuGoukei: find("保険点数合計"),
    seikyuGoukei: find("保険請求額合計"),
    madoGuchiGoukei: find("窓口負担額合計"),
    mishuGoukei: find("未収金合計"),
    shaHo: find("社保"),
    kokuHo: find("国保"),
    rosai: find("労災"),
    jibaiseki: find("自賠責"),
    kogai: find("公害"),
    sonotaHoken: find("その他"),
    shoshinRyo: find("初診料"),
    saishinRyo: find("再診料"),
    kanriRyo: find("管理料"),
    zaitakuRyo: find("在宅料"),
    chusha: find("皮下・筋肉内注射"),
    shochi: find("処置行為"),
    shujutsu: find("手術"),
    kensa: find("検査"),
    byori: find("病理診断"),
    shohosenRyo: find("処方箋料"),
    sonotaTensu: find("その他（リハビリ"),
    gazoShindan: find("画像診断"),
  };
}

function extractYearMonth(fileName: string, rows: Row[]): string {
  const m1 = fileName.match(/(\d{4})年(\d{1,2})月/);
  if (m1) return `${m1[1]}年${m1[2]}月`;
  const m2 = fileName.match(/(\d{4})[_\-](\d{2})/);
  if (m2) return `${m2[1]}年${parseInt(m2[2])}月`;

  for (const row of rows.slice(0, 10)) {
    for (const cell of row) {
      if (!cell) continue;
      const s = String(cell);
      const md = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-]\d{1,2}/);
      if (md) return `${md[1]}年${parseInt(md[2])}月`;
    }
  }
  return fileName.replace(/\.[^/.]+$/, "");
}

export async function parseClinicExcel(file: File): Promise<ClinicMonthData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });

        const s1Name = wb.SheetNames.find((n) => n.toLowerCase() === "sheet1") ?? wb.SheetNames[0];
        const hName = wb.SheetNames.find((n) => n.includes("保険"));
        const ws1 = wb.Sheets[s1Name];
        const wsH = hName ? wb.Sheets[hName] : null;

        const rows1 = XLSX.utils.sheet_to_json<unknown[]>(ws1, { header: 1, defval: null }) as Row[];
        const yearMonth = extractYearMonth(file.name, rows1);

        resolve({
          yearMonth,
          fileName: file.name,
          sheet1: parseSheet1(ws1),
          hoken: wsH ? parseHoken(wsH) : ({} as ClinicMonthData["hoken"]),
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("ファイル読み込みエラー"));
    reader.readAsArrayBuffer(file);
  });
}
