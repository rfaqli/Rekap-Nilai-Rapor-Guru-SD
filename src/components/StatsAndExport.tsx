import React from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Download, Trophy } from 'lucide-react';
import { Project, ProjectData } from '../types';

const calculateMapelAverage = (subject: any) => {
    let sum = 0; let count = 0;
    if (subject) {
        if (typeof subject.TGS === 'number') { sum += subject.TGS; count++; }
        if (typeof subject.UH === 'number') { sum += subject.UH; count++; }
        if (typeof subject.UTS === 'number') { sum += subject.UTS; count++; }
        if (typeof subject.SAJ === 'number') { sum += subject.SAJ; count++; }
    }
    if (count === 0) return null;
    return parseFloat((sum / count).toFixed(1));
};

const calcRaporAkhir = (student: any) => {
    let sum = 0; let count = 0;
    if (student?.subjects) {
        Object.values(student.subjects).forEach((sub: any) => {
            const avg = calculateMapelAverage(sub);
            if (avg !== null) { sum += avg; count++; }
        });
    }
    if (count === 0) return null;
    return parseFloat((sum / count).toFixed(1));
};

export function StatsAndExport({ project, katrolData }: { project: Project, katrolData: ProjectData }) {
    const { students: asliStudents, subjectsList } = project.data;
    const { students: kStudents } = katrolData;

    const stats = subjectsList.map((mName, mIdx) => {
        const subKey = `mapel_${mIdx}`;
        
        let sumAsli = 0; let countAsli = 0; let lulusAsli = 0;
        asliStudents.forEach(s => {
            const avg = calculateMapelAverage(s?.subjects?.[subKey]);
            if (avg !== null) { sumAsli += avg; countAsli++; if (avg >= 70) lulusAsli++; }
        });

        let sumKatrol = 0; let countKatrol = 0; let lulusKatrol = 0;
        kStudents.forEach(s => {
            const avg = calculateMapelAverage(s?.subjects?.[subKey]);
            if (avg !== null) { sumKatrol += avg; countKatrol++; if (avg >= 70) lulusKatrol++; }
        });

        return {
            name: mName,
            rataAsli: countAsli ? (sumAsli / countAsli).toFixed(1) : '-',
            rataKatrol: countKatrol ? (sumKatrol / countKatrol).toFixed(1) : '-',
            lulusAsli: countAsli ? `${lulusAsli} (${((lulusAsli/countAsli)*100).toFixed(0)}%)` : '-',
            lulusKatrol: countKatrol ? `${lulusKatrol} (${((lulusKatrol/countKatrol)*100).toFixed(0)}%)` : '-',
        };
    });

    const rankingData = [...kStudents]
         .map(s => ({ name: s.name, nilai: calcRaporAkhir(s) }))
         .filter(s => s.nilai !== null)
         .sort((a, b) => (b.nilai as number) - (a.nilai as number));
    
    // Assign Ranks factoring ties
    let currentRank = 1;
    let rankList: {rank: number, name: string, nilai: number}[] = [];
    rankingData.forEach((s, idx) => {
         if (idx > 0 && s.nilai === rankingData[idx-1].nilai) {
             rankList.push({ rank: currentRank, name: s.name, nilai: s.nilai! });
         } else {
             currentRank = idx + 1;
             rankList.push({ rank: currentRank, name: s.name, nilai: s.nilai! });
         }
    });

    const exportToExcel = async () => {
        const wb = new ExcelJS.Workbook();

        const buildTableSheet = (sheetName: string, studentList: any[], isKatrol: boolean = false) => {
            const ws = wb.addWorksheet(sheetName);
            
            // Header Info
            ws.mergeCells('A1:E1');
            const h1 = ws.getCell('A1');
            h1.value = `REKAPITULASI NILAI ${isKatrol ? 'KATROL' : 'ASLI'}`;
            h1.font = { size: 16, bold: true, color: { argb: 'FF990000' } };
            
            ws.mergeCells('A2:E2');
            ws.getCell('A2').value = 'Aplikasi: Mesin Pengkatrol Nilai by Aqli';
            
            ws.mergeCells('A3:E3');
            ws.getCell('A3').value = `Project / Kelas: ${project.name}`;
            
            // Table Headers
            const startRow = 5;
            
            let currentHeaderColIdx = 2; // Col B is Mapel 1
            ws.getCell(startRow, 1).value = 'Nama Siswa';
            ws.mergeCells(startRow, 1, startRow + 1, 1);
            
            subjectsList.forEach((m) => {
                ws.mergeCells(startRow, currentHeaderColIdx, startRow, currentHeaderColIdx + 4);
                ws.getCell(startRow, currentHeaderColIdx).value = m;
                ['TGS', 'UH', 'UTS', 'SAJ', 'NR'].forEach((sub, i) => {
                    ws.getCell(startRow + 1, currentHeaderColIdx + i).value = sub;
                });
                currentHeaderColIdx += 5;
            });
            
            ws.getCell(startRow, currentHeaderColIdx).value = 'Nilai Rapor Akhir Siswa';
            ws.mergeCells(startRow, currentHeaderColIdx, startRow + 1, currentHeaderColIdx);
            
            // Absensi Header
            const absColIdx = currentHeaderColIdx + 1;
            ws.getCell(startRow, absColIdx).value = 'Absensi';
            ws.mergeCells(startRow, absColIdx, startRow, absColIdx + 2);
            ws.getCell(startRow + 1, absColIdx).value = 'S';
            ws.getCell(startRow + 1, absColIdx + 1).value = 'I';
            ws.getCell(startRow + 1, absColIdx + 2).value = 'A';

            // Styling Headers
            const lastHeaderCol = absColIdx + 2;
            for (let r = startRow; r <= startRow + 1; r++) {
                for (let c = 1; c <= lastHeaderCol; c++) {
                    const cell = ws.getCell(r, c);
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    
                    if (c >= absColIdx) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } }; // Pink
                        cell.font = { bold: true, color: { argb: 'FF000000' } };
                    } else {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF990000' } }; // Maroon
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    }
                }
            }

            // Data Rows
            let rowIdx = startRow + 2;
            studentList.forEach((s) => {
                ws.getCell(rowIdx, 1).value = s.name;
                ws.getCell(rowIdx, 1).alignment = { horizontal: 'left' };
                
                let colIdx = 2;
                subjectsList.forEach((_, mIdx) => {
                     const sub = s?.subjects?.[`mapel_${mIdx}`] || {};
                     const comps = ['TGS', 'UH', 'UTS', 'SAJ'];
                     comps.forEach(c => {
                         const val = sub[c];
                         const cell = ws.getCell(rowIdx, colIdx++);
                         cell.value = val !== null && val !== undefined ? (isKatrol ? Math.round(Number(val)) : Number(Number(val).toFixed(1))) : '-';
                         cell.alignment = { horizontal: 'center' };
                     });
                     
                     const avg = calculateMapelAverage(sub);
                     const avgCell = ws.getCell(rowIdx, colIdx++);
                     avgCell.value = avg !== null ? (isKatrol ? Math.round(Number(avg)) : Number(avg.toFixed(1))) : '-';
                     avgCell.alignment = { horizontal: 'center' };
                     // Thicker border for end of mapel
                     avgCell.border = { right: { style: 'medium', color: { argb: 'FF990000' } }, top: { style:'thin' }, bottom: {style:'thin'}, left: {style:'thin'} };
                });
                
                const nr = calcRaporAkhir(s);
                const nrCell = ws.getCell(rowIdx, colIdx++);
                nrCell.value = nr !== null ? Number(nr) : '-';
                nrCell.alignment = { horizontal: 'center' };
                nrCell.border = { right: { style: 'medium', color: { argb: 'FF990000' } }, top: { style:'thin' }, bottom: {style:'thin'}, left: {style:'thin'} };

                ws.getCell(rowIdx, colIdx++).value = s.absensi?.S || 0;
                ws.getCell(rowIdx, colIdx++).value = s.absensi?.I || 0;
                ws.getCell(rowIdx, colIdx++).value = s.absensi?.A || 0;

                // Highlight not passing
                if (s.tidakNaikKelas) {
                    for(let c=1; c<=lastHeaderCol; c++) {
                        ws.getCell(rowIdx, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F5' } };
                    }
                }
                
                rowIdx++;
            });
            
            // Apply common borders
            for (let r = startRow + 2; r < rowIdx; r++) {
                for (let c = 1; c <= lastHeaderCol; c++) {
                    const cell = ws.getCell(r, c);
                    if (!cell.border) {
                         cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    }
                }
            }
            ws.columns.forEach(column => { column.width = 10; });
            ws.getColumn(1).width = 25; // Nama
        };

        buildTableSheet('Nilai Asli', asliStudents, false);
        buildTableSheet('Nilai Katrol', kStudents, true);

        // Sheet 3: Ringkasan
        const ws3 = wb.addWorksheet('Ringkasan Statistik');
        ws3.addRow(['Mata Pelajaran', 'Rata-rata Asli', 'Rata-rata Katrol', 'Lulus KKM (≥70) Asli', 'Lulus KKM (≥70) Katrol']);
        const row1 = ws3.getRow(1);
        row1.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008080' } }; // Teal
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        
        stats.forEach(st => {
            const r = ws3.addRow([st.name, st.rataAsli, Number(st.rataKatrol), st.lulusAsli, st.lulusKatrol]);
            r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } }; // Light blue
            r.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } };
            r.eachCell(c => c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } });
            r.getCell(3).numFmt = '0.0';
        });
        ws3.columns.forEach(column => { column.width = 20; });

        // Sheet 4: Ranking
        const ws4 = wb.addWorksheet('Ranking Siswa');
        ws4.addRow(['Rank', 'Nama Siswa', 'Nilai Rapor Akhir Siswa (Katrol)']);
        ws4.getRow(1).eachCell(cell => {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFB300' } }; // Gold
             cell.font = { bold: true, color: { argb: 'FF000000' } };
             cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        
        rankList.forEach(s => {
             let rankLabel = s.rank.toString();
             let fillArgb = 'FFFFFFFF';
             if (s.rank === 1) { rankLabel = '🥇 1'; fillArgb = 'FFFFD54F'; }
             else if (s.rank === 2) { rankLabel = '🥈 2'; fillArgb = 'FFE0E0E0'; }
             else if (s.rank === 3) { rankLabel = '🥉 3'; fillArgb = 'FFFFAB91'; }
             
             const r = ws4.addRow([rankLabel, s.name, Number(s.nilai)]);
             r.getCell(3).numFmt = '0.0';
             r.eachCell(c => {
                 c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
                 c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                 c.alignment = { horizontal: 'center' };
             });
        });
        ws4.getColumn(1).width = 15;
        ws4.getColumn(2).width = 25;
        ws4.getColumn(3).width = 30;

        const buffer = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Rekap_Nilai_${project.name.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
    };

    const getRankIcon = (r: number) => {
        if (r === 1) return (
            <div className="inline-flex items-center justify-center gap-1 font-bold px-3 py-1.5 rounded-full text-white shadow-sm w-16" style={{ background: 'linear-gradient(135deg, #F5B800 0%, #F59E0B 100%)' }}>
                 <span>🥇</span> <span>1</span>
            </div>
        );
        if (r === 2) return (
            <div className="inline-flex items-center justify-center gap-1 font-bold px-3 py-1.5 rounded-full text-gray-800 shadow-sm w-16" style={{ background: 'linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%)' }}>
                 <span>🥈</span> <span>2</span>
            </div>
        );
        if (r === 3) return (
            <div className="inline-flex items-center justify-center gap-1 font-bold px-3 py-1.5 rounded-full text-white shadow-sm w-16" style={{ background: 'linear-gradient(135deg, #CD7F32 0%, #B45309 100%)' }}>
                 <span>🥉</span> <span>3</span>
            </div>
        );
        return <span className="text-gray-600 font-bold px-3 py-1.5">{r}</span>;
    };
    const getRankRowClass = (r: number) => {
        if (r===1) return 'bg-yellow-50/50';
        if (r===2) return 'bg-gray-50/50';
        if (r===3) return 'bg-orange-50/50';
        return 'bg-white border-b';
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700 mt-6 pt-4 border-t border-gray-200 flex-1 flex flex-col">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                 <span className="text-xs font-bold text-gray-700">Simpan Hasil Kalkulasi Katrol ke Excel</span>
                 <button onClick={exportToExcel} className="flex items-center gap-2 bg-white border-2 border-brand-maroon text-brand-red text-xs px-3 py-1 font-bold rounded shadow-sm hover:bg-red-50 transition-colors focus:outline-none">
                     <Download className="h-4 w-4" /> Download Excel (.xlsx)
                 </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                {/* STATISTIK */}
                <div className="flex flex-col h-full bg-white rounded border border-gray-200 p-3 shadow-sm">
                     <h3 className="text-xs font-bold uppercase mb-2 text-teal-700 flex items-center">
                        <span className="w-2 h-4 bg-teal-600 mr-2"></span>Ringkasan Statistik
                     </h3>
                     <div className="flex-1 w-full overflow-hidden border border-teal-200 rounded">
                         <table className="w-full text-[10px]">
                              <thead className="bg-teal-600 text-white leading-tight">
                                  <tr>
                                      <th className="p-2 border">Mapel</th>
                                      <th className="p-2 border">Rata Asli</th>
                                      <th className="p-2 border">Rata Katrol</th>
                                      <th className="p-2 border">Lulus Asli</th>
                                      <th className="p-2 border">Lulus Katrol</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {stats.map((st, i) => (
                                      <tr key={i} className="bg-white border-b hover:bg-slate-50">
                                          <td className="p-2 border text-left font-medium text-gray-800 break-words">{st.name}</td>
                                          <td className="p-2 border font-mono text-center">{st.rataAsli}</td>
                                          <td className="p-2 border font-mono font-bold text-center bg-teal-50 text-teal-800">{st.rataKatrol}</td>
                                          <td className="p-2 border text-center">{st.lulusAsli}</td>
                                          <td className="p-2 border font-bold text-center bg-teal-50 text-teal-800">{st.lulusKatrol}</td>
                                      </tr>
                                  ))}
                              </tbody>
                         </table>
                     </div>
                </div>

                {/* RANKING */}
                <div className="flex flex-col h-full bg-white rounded border border-gray-200 p-3 shadow-sm">
                     <h3 className="text-xs font-bold uppercase mb-2 text-yellow-700 flex items-center">
                        <span className="w-2 h-4 bg-yellow-600 mr-2"></span>🏆 Ranking Siswa
                     </h3>
                     <div className="flex-1 w-full overflow-y-auto max-h-[300px] border border-yellow-200 rounded custom-scrollbar">
                         <table className="w-full text-xs">
                              <thead className="text-white sticky top-0 z-10 leading-tight" style={{ background: 'linear-gradient(135deg, #F5A623 0%, #F59E0B 100%)' }}>
                                  <tr>
                                      <th className="p-3 border-x border-b border-orange-500 w-24 text-center">Rank</th>
                                      <th className="p-3 border-x border-b border-orange-500 text-left">Nama Siswa</th>
                                      <th className="p-3 border-x border-b border-orange-500 w-32 text-center">Skor Akhir (Katrol)</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {rankList.map((st, i) => (
                                      <tr key={i} className={`${getRankRowClass(st.rank)}`}>
                                          <td className="p-2 border text-center font-bold">
                                              {getRankIcon(st.rank)}
                                          </td>
                                          <td className="p-2 border font-medium text-gray-900">
                                              {st.name}
                                          </td>
                                          <td className="p-2 border font-mono font-bold text-center">
                                              {st.nilai.toFixed(1)}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                         </table>
                     </div>
                </div>
            </div>
        </div>
    );
}
