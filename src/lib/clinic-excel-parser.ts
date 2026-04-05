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

function excelToText(wb: XLSX.WorkBook): string {
  const lines: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];
    lines.push(`\n=== ${name} ===`);
    let count = 0;
    for (const row of rows) {
      const cells = row.map((v) => (v == null ? "" : String(v)));
      if (cells.some((c) => c !== "")) {
        lines.push(cells.join("\t"));
        if (++count >= 40) break;
      }
    }
  }
  return lines.join("\n");
}

export async function parseClinicExcel(file: File): Promise<ClinicMonthData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });

        const excelText = excelToText(wb);

        const res = await fetch("/api/parse-excel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ excelText, fileName: file.name }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "サーバーエラー");
        }

        const { data: d } = await res.json();

        const tv = (total: number, jihi: number, hoken: number): TripleValue => ({
          total: total || 0,
          jihi: jihi || 0,
          hoken: hoken || 0,
        });

        resolve({
          yearMonth: d.yearMonth || file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          sheet1: {
            shiharaiGoukei: tv(d.shiharaiGoukeiTotal, d.shiharaiGoukeiJihi, d.shiharaiGoukeiHoken),
            genkin: tv(d.genkinTotal, d.genkinJihi, d.genkinHoken),
            credit: tv(d.creditTotal, d.creditJihi, d.creditHoken),
            qr: tv(d.qrTotal, d.qrJihi, d.qrHoken),
            emoney: tv(d.emoneyTotal, d.emoneyJihi, d.emoneyHoken),
            henkin: tv(d.henkinTotal, d.henkinJihi, d.henkinHoken),
            nyukinGoukei: tv(d.nyukinGoukeiTotal, d.nyukinGoukeiJihi, d.nyukinGoukeiHoken),
          },
          hoken: {
            tensuGoukei: d.tensuGoukei || 0,
            seikyuGoukei: d.seikyuGoukei || 0,
            madoGuchiGoukei: d.madoGuchiGoukei || 0,
            mishuGoukei: d.mishuGoukei || 0,
            shaHo: d.shaHo || 0,
            kokuHo: d.kokuHo || 0,
            rosai: d.rosai || 0,
            jibaiseki: d.jibaiseki || 0,
            kogai: d.kogai || 0,
            sonotaHoken: d.sonotaHoken || 0,
            shoshinRyo: d.shoshinRyo || 0,
            saishinRyo: d.saishinRyo || 0,
            kanriRyo: d.kanriRyo || 0,
            zaitakuRyo: d.zaitakuRyo || 0,
            chusha: d.chusha || 0,
            shochi: d.shochi || 0,
            shujutsu: d.shujutsu || 0,
            kensa: d.kensa || 0,
            byori: d.byori || 0,
            shohosenRyo: d.shohosenRyo || 0,
            sonotaTensu: d.sonotaTensu || 0,
            gazoShindan: d.gazoShindan || 0,
          },
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("ファイル読み込みエラー"));
    reader.readAsArrayBuffer(file);
  });
}
