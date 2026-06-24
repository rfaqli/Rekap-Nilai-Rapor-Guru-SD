import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { fetchWithAuth } from '../lib/api';
import { Project, ProjectData } from '../types';
import { Save, CheckCircle2 } from 'lucide-react';
import { StatsAndExport } from './StatsAndExport';

// --- KATROL LOGIC ---
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


export function ProjectView({ projectId }: { projectId: number }) {
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [katrolData, setKatrolData] = useState<ProjectData | null>(null);

    const saveTimeout = useRef<NodeJS.Timeout | null>(null);

    const loadProject = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchWithAuth(`/projects/${projectId}`) as Project;
            setProject(data);
            setKatrolData(null); // reset katrol view on load
        } catch (err) {
            // Ignore
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadProject();
    }, [loadProject]);

    const autoSave = useCallback(async (dataToSave: Project) => {
        setSaving(true);
        try {
             await fetchWithAuth('/projects', {
                 method: 'POST',
                 body: JSON.stringify(dataToSave)
             });
             // Artificial delay to make savings feel "real"
             await new Promise(r => setTimeout(r, 1500));
             setLastSaved(new Date());
        } catch (e) {
            // Ignore
        } finally {
            setSaving(false);
        }
    }, []);

    const triggerSave = (newApp: Project) => {
         setProject(newApp);
         if (saveTimeout.current) clearTimeout(saveTimeout.current);
         saveTimeout.current = setTimeout(() => {
             autoSave(newApp);
         }, 1000); // 1s debounce
    };

    const handleManualSave = async () => {
        if (project) {
            if (saveTimeout.current) clearTimeout(saveTimeout.current);
            await autoSave(project);
        }
    };

    if (loading || !project) {
        return <div className="py-20 text-center text-gray-500">Memuat data...</div>;
    }

    if (!project.data || !project.data.students || !project.data.subjectsList) {
        return <div className="py-20 text-center text-gray-500">Data project tidak valid atau masih kosong.</div>;
    }

    const { data } = project;
    const { students, subjectsList } = data;

    // Handlers
    const updateStudentProp = (sId: string, field: string, val: any) => {
        const newStudents = students.map(s => s.id === sId ? { ...s, [field]: val } : s);
        triggerSave({ ...project, data: { ...data, students: newStudents } });
    };

    const updateGrade = (sId: string, mapelIdx: number, comp: keyof any, valStr: string) => {
        const val = valStr.trim() === '' ? null : Math.max(0, Math.min(100, parseInt(valStr) || 0));
        const newStudents = students.map(s => {
            if (s.id !== sId) return s;
            const subKey = `mapel_${mapelIdx}`;
            const currentSub = s.subjects[subKey] || { TGS: null, UH: null, UTS: null, SAJ: null };
            return {
                ...s,
                subjects: { ...s.subjects, [subKey]: { ...currentSub, [comp]: val } }
            };
        });
        triggerSave({ ...project, data: { ...data, students: newStudents } });
    };

    const updateAbsensi = (sId: string, comp: 'S'|'I'|'A', valStr: string) => {
        const val = Math.max(0, Math.floor(Number(valStr)) || 0);
        const newStudents = students.map(s => {
            if (s.id !== sId) return s;
            return { ...s, absensi: { S: s.absensi?.S || 0, I: s.absensi?.I || 0, A: s.absensi?.A || 0, [comp]: val } }
        });
        triggerSave({ ...project, data: { ...data, students: newStudents } });
    };

    // --- KATROL EXECUTION ---
    const handleKatrol = () => {
        let newStudents = JSON.parse(JSON.stringify(students));
        
        let studentsNaik: any[] = [];
        let studentsTidakNaik: any[] = [];
        
        newStudents.forEach((student: any) => {
            if (student.tidakNaikKelas) studentsTidakNaik.push(student);
            else studentsNaik.push(student);
        });
        
        // BAGIAN A - SISWA NAIK KELAS
        // 1a. Hitung NR_Rata_Asli per siswa
        studentsNaik.forEach(student => {
            let sumNR = 0;
            let countMapel = 0;
            subjectsList.forEach((_, mId) => {
                const subKey = `mapel_${mId}`;
                const subAsli = student?.subjects?.[subKey];
                if (subAsli) {
                    const presentKeys = ['TGS', 'UH', 'UTS', 'SAJ'].filter(k => subAsli[k] !== null && subAsli[k] !== undefined);
                    if (presentKeys.length > 0) {
                        const sumComps = presentKeys.reduce((acc, k) => acc + subAsli[k], 0);
                        const nr = sumComps / presentKeys.length;
                        sumNR += nr;
                        countMapel++;
                    }
                }
            });
            student.nrRataAsli = countMapel > 0 ? sumNR / countMapel : 0;
        });

        // 1b. Urutkan & tetapkan Rank
        studentsNaik.sort((a, b) => b.nrRataAsli - a.nrRataAsli);
        
        let currentRank = 1;
        if (studentsNaik.length > 0) {
            studentsNaik[0].rank = currentRank;
            for (let i = 1; i < studentsNaik.length; i++) {
                if (studentsNaik[i].nrRataAsli < studentsNaik[i-1].nrRataAsli) {
                    currentRank++;
                }
                studentsNaik[i].rank = currentRank;
            }
        }
        
        const N = currentRank; // max rank

        // 1c. Hitung TARGET_NR_i
        studentsNaik.forEach(student => {
            if (N <= 1) {
                student.targetNR = 79;
            } else {
                student.targetNR = Math.round(86 - ((student.rank - 1) / (N - 1)) * 15);
            }
        });

        // 2. Katrol Komponen
        const applyVariation = (target: number, keys: string[], varRange: number) => {
            let comps: any = {};
            keys.forEach(k => comps[k] = target);
            if (keys.length > 1) {
                let amount = Math.floor(Math.random() * varRange) + 1;
                let shuffled = [...keys].sort(() => Math.random() - 0.5);
                comps[shuffled[0]] += amount;
                comps[shuffled[1]] -= amount;
            }
            return comps;
        };

        studentsNaik.forEach(student => {
            subjectsList.forEach((_, mId) => {
                const subKey = `mapel_${mId}`;
                const subAsli = student?.subjects?.[subKey] || { TGS: null, UH: null, UTS: null, SAJ: null };
                const presentKeys = ['TGS', 'UH', 'UTS', 'SAJ'].filter(k => subAsli[k] !== null && subAsli[k] !== undefined);
                
                if (presentKeys.length === 0) return;
                
                const finalComps = applyVariation(student.targetNR, presentKeys, 1);
                student.subjects[subKey] = { ...subAsli, ...finalComps };
            });
        });

        // BAGIAN B - SISWA TIDAK NAIK KELAS
        let usedTargets = new Set<number>();
        studentsTidakNaik.forEach(student => {
            let targetNR = 50 + Math.floor(Math.random() * 11);
            while (usedTargets.has(targetNR) && usedTargets.size < 11) {
                targetNR = 50 + Math.floor(Math.random() * 11);
            }
            usedTargets.add(targetNR);
            student.targetNR = targetNR;
            
            subjectsList.forEach((_, mId) => {
                const subKey = `mapel_${mId}`;
                const subAsli = student?.subjects?.[subKey] || { TGS: null, UH: null, UTS: null, SAJ: null };
                const presentKeys = ['TGS', 'UH', 'UTS', 'SAJ'].filter(k => subAsli[k] !== null && subAsli[k] !== undefined);
                
                if (presentKeys.length === 0) return;
                
                const finalComps = applyVariation(student.targetNR, presentKeys, 2);
                student.subjects[subKey] = { ...subAsli, ...finalComps };
            });
        });
        
        setKatrolData({ subjectsList, students: newStudents });
    };
    
    // --- KEYBOARD NAV ---
    const onKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number, isAbs: boolean = false) => {
        const key = e.key;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;
        
        e.preventDefault();
        const inputs = Array.from(document.querySelectorAll(`input[data-nav="true"]`));
        const currentIdx = inputs.findIndex(el => el === e.target);
        if (currentIdx === -1) return;
        
        let nextEl: HTMLElement | null = null;
        let cPerRow = subjectsList.length * 4 + 3; // 4 comps per mapel + 3 absensi
        
        if (key === 'ArrowRight' && currentIdx + 1 < inputs.length) nextEl = inputs[currentIdx + 1] as HTMLElement;
        if (key === 'ArrowLeft' && currentIdx - 1 >= 0) nextEl = inputs[currentIdx - 1] as HTMLElement;
        if (key === 'ArrowDown' && currentIdx + cPerRow < inputs.length) nextEl = inputs[currentIdx + cPerRow] as HTMLElement;
        if (key === 'ArrowUp' && currentIdx - cPerRow >= 0) nextEl = inputs[currentIdx - cPerRow] as HTMLElement;
        
        if (nextEl) {
            nextEl.focus();
            if (nextEl instanceof HTMLInputElement) nextEl.select();
        }
    };


    return (
        <div className="space-y-6 pb-24 bg-white flex-1 p-4 shadow-sm border border-gray-200">
            <div className="flex justify-between items-end">
                <h2 className="text-lg font-bold border-b-2 border-brand-maroon pb-1 text-brand-red uppercase">
                    NILAI ASLI - {project.name}
                </h2>
                <div className="flex items-center gap-2 text-xs">
                    {saving && <div className="flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded border border-gray-200"><span className="block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span><span className="text-gray-600 font-medium">Menyimpan...</span></div>}
                    {!saving && lastSaved && <div className="flex items-center space-x-1 bg-green-50 px-2 py-1 rounded border border-green-200"><span className="block w-2 h-2 bg-green-500 rounded-full"></span><span className="text-green-700 font-medium whitespace-nowrap">Tersimpan Otomatis</span></div>}
                    <button onClick={handleManualSave} disabled={saving} className="bg-white text-brand-red font-bold text-xs px-4 py-2 rounded shadow hover:bg-gray-100 transition-colors disabled:opacity-50 border border-gray-200 flex items-center gap-1">
                        <Save className="h-4 w-4" /> Simpan Project
                    </button>
                </div>
            </div>

            {/* TABEL NILAI ASLI */}
            <div className="overflow-x-auto bg-white rounded shadow-sm border border-gray-200 custom-scrollbar max-h-[400px]">
                <table className="w-full text-xs text-center border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-brand-maroon text-white font-medium">
                            <th rowSpan={2} className="border border-red-800 p-2 min-w-[150px] bg-red-900 text-left">Nama Siswa</th>
                            {subjectsList.map((m, i) => (
                                <th key={i} colSpan={5} className="border border-red-800 p-1 bg-red-800 whitespace-nowrap">
                                    <input type="text" value={m} onChange={(e) => {
                                        const nw = [...subjectsList]; nw[i] = e.target.value;
                                        triggerSave({ ...project, data: { ...data, subjectsList: nw } });
                                    }} className="bg-transparent text-center focus:outline-none focus:bg-white/10 w-full" />
                                </th>
                            ))}
                            <th rowSpan={2} className="border border-red-800 p-2 bg-red-900 font-bold">NILAI RAPOR AKHIR</th>
                            
                            {/* ABSENSI HEADER */}
                            <th colSpan={3} className="border border-pink-300 p-1 bg-brand-pink text-gray-900 font-bold">ABSENSI</th>
                        </tr>
                        <tr className="bg-brand-red text-white">
                            {subjectsList.map((_, i) => (
                                <React.Fragment key={i}>
                                    <th className="border border-red-800 p-1 w-12">TGS</th>
                                    <th className="border border-red-800 p-1 w-12">UH</th>
                                    <th className="border border-red-800 p-1 w-12">UTS</th>
                                    <th className="border border-red-800 p-1 w-12">SAJ</th>
                                    <th className="border border-red-800 p-1 w-14 font-bold">NR</th>
                                </React.Fragment>
                            ))}
                            {/* ABSENSI SUB */}
                            <th className="bg-brand-pink border border-pink-300 text-gray-900 p-1">S</th>
                            <th className="bg-brand-pink border border-pink-300 text-gray-900 p-1">I</th>
                            <th className="bg-brand-pink border border-pink-300 text-gray-900 p-1">A</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student, rIdx) => {
                            const nrAkhir = calcRaporAkhir(student);
                            return (
                                <tr key={student.id} className={`hover:bg-red-50 transition-colors border-b border-gray-200 ${student.tidakNaikKelas ? 'bg-yellow-50' : 'bg-white'}`}>
                                    <td className="border border-gray-200 p-2 text-left font-medium">
                                        <input type="text" value={student.name} onChange={e => updateStudentProp(student.id, 'name', e.target.value)} className="w-full appearance-none bg-transparent focus:outline-none" />
                                        {student.tidakNaikKelas && <span className="ml-2 text-[9px] bg-red-500 text-white px-1 rounded">TIDAK NAIK</span>}
                                    </td>
                                    {subjectsList.map((_, mIdx) => {
                                        const sub = student?.subjects?.[`mapel_${mIdx}`] || { TGS: null, UH: null, UTS: null, SAJ: null };
                                        const avg = calculateMapelAverage(sub);
                                        return (
                                            <React.Fragment key={mIdx}>
                                                {(['TGS', 'UH', 'UTS', 'SAJ'] as const).map((comp) => (
                                                    <td key={comp} className="border border-gray-200 p-1 text-center">
                                                         <input type="number" data-nav="true" onKeyDown={e => onKeyDown(e, rIdx, mIdx)} value={sub[comp] ?? ''} onChange={e => updateGrade(student.id, mIdx, comp, e.target.value)} className="w-10 text-center text-xs border border-transparent focus:border-brand-red focus:outline-none p-0.5" />
                                                    </td>
                                                ))}
                                                <td className="border border-gray-200 p-1 font-bold bg-gray-50">
                                                    {avg !== null ? avg : '-'}
                                                </td>
                                            </React.Fragment>
                                        )
                                    })}
                                    <td className="border border-gray-200 p-2 font-bold text-brand-maroon bg-gray-100 text-sm">
                                        {nrAkhir !== null ? nrAkhir : '-'}
                                    </td>
                                    
                                    {/* ABSENSI DATA */}
                                    <td className="border border-gray-200 p-1">
                                        <input type="number" data-nav="true" onKeyDown={e => onKeyDown(e, rIdx, 0, true)} value={student.absensi?.S || ''} onChange={e => updateAbsensi(student.id, 'S', e.target.value)} className="w-8 text-center bg-transparent border border-transparent focus:border-brand-red p-0.5 outline-none font-mono text-xs" />
                                    </td>
                                    <td className="border border-gray-200 p-1">
                                        <input type="number" data-nav="true" onKeyDown={e => onKeyDown(e, rIdx, 0, true)} value={student.absensi?.I || ''} onChange={e => updateAbsensi(student.id, 'I', e.target.value)} className="w-8 text-center bg-transparent border border-transparent focus:border-brand-red p-0.5 outline-none font-mono text-xs" />
                                    </td>
                                    <td className="border border-gray-200 p-1">
                                        <input type="number" data-nav="true" onKeyDown={e => onKeyDown(e, rIdx, 0, true)} value={student.absensi?.A || ''} onChange={e => updateAbsensi(student.id, 'A', e.target.value)} className="w-8 text-center bg-transparent border border-transparent focus:border-brand-red p-0.5 outline-none font-mono text-xs" />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    <span className="text-xs font-bold">Tandai Siswa Tidak Naik Kelas:</span>
                    <div className="flex space-x-4 overflow-x-auto max-w-sm pb-1 custom-scrollbar">
                        {students.map(s => (
                            <label key={s.id} className="flex items-center space-x-1 text-xs cursor-pointer whitespace-nowrap">
                                <input type="checkbox" checked={s.tidakNaikKelas} onChange={e => updateStudentProp(s.id, 'tidakNaikKelas', e.target.checked)} className="accent-red-600 w-3 h-3" />
                                <span>{s.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <button
                    onClick={handleKatrol}
                    className="bg-brand-red text-white font-bold py-2 px-6 rounded-full shadow-lg hover:bg-brand-maroon transition-all active:scale-95 text-xs flex-shrink-0"
                >
                    🪄 Katrol Nilai Sekarang
                </button>
            </div>

            {/* HASIL KATROL */}
            {katrolData && (
                <>
                    <div className="space-y-4 animate-in fade-in duration-500 mt-6">
                        <h2 className="text-lg font-bold border-b-2 border-brand-maroon pb-1 text-brand-red uppercase">NILAI KATROL</h2>
                        <div className="overflow-x-auto bg-white rounded shadow-sm border border-gray-200 custom-scrollbar max-h-[400px]">
                            <table className="w-full text-xs text-center border-collapse">
                                {/* SAME HEADER */}
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-brand-maroon text-white font-medium">
                                        <th rowSpan={2} className="border border-red-800 p-2 min-w-[150px] bg-red-900 text-left">Nama Siswa</th>
                                        {katrolData.subjectsList.map((m, i) => (
                                            <th key={i} colSpan={5} className="border border-red-800 p-1 bg-red-800 whitespace-nowrap">{m}</th>
                                        ))}
                                        <th rowSpan={2} className="border border-red-800 p-2 bg-red-900 font-bold">NILAI RAPOR AKHIR</th>
                                        <th colSpan={3} className="border border-pink-300 p-1 bg-brand-pink text-gray-900 font-bold">ABSENSI</th>
                                    </tr>
                                    <tr className="bg-brand-red text-white">
                                        {katrolData.subjectsList.map((_, i) => (
                                            <React.Fragment key={i}>
                                                <th className="border border-red-800 p-1 w-12">TGS</th><th className="border border-red-800 p-1 w-12">UH</th><th className="border border-red-800 p-1 w-12">UTS</th><th className="border border-red-800 p-1 w-12">SAJ</th><th className="border border-red-800 p-1 w-14 font-bold">NR</th>
                                            </React.Fragment>
                                        ))}
                                        <th className="bg-brand-pink border border-pink-300 text-gray-900 p-1">S</th><th className="bg-brand-pink border border-pink-300 text-gray-900 p-1">I</th><th className="bg-brand-pink border border-pink-300 text-gray-900 p-1">A</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {katrolData.students.map((student) => {
                                        const nrAkhir = calcRaporAkhir(student);
                                        return (
                                            <tr key={student.id} className={`hover:bg-red-50 transition-colors border-b border-gray-200 ${student.tidakNaikKelas ? 'bg-yellow-50' : 'bg-white'}`}>
                                                <td className="border border-gray-200 p-2 text-left font-medium">
                                                    {student.name}
                                                    {student.tidakNaikKelas && <span className="ml-2 text-[9px] bg-red-500 text-white px-1 rounded">TIDAK NAIK</span>}
                                                </td>
                                                {katrolData.subjectsList.map((_, mIdx) => {
                                                    const sub = student?.subjects?.[`mapel_${mIdx}`] || { TGS: null, UH: null, UTS: null, SAJ: null };
                                                    const avg = calculateMapelAverage(sub);
                                                    return (
                                                        <React.Fragment key={mIdx}>
                                                            {(['TGS', 'UH', 'UTS', 'SAJ'] as const).map((comp) => (
                                                                <td key={comp} className="border border-gray-200 p-1 text-center font-mono opacity-90">{sub[comp] !== null ? Math.round(Number(sub[comp])) : '-'}</td>
                                                            ))}
                                                            <td className="border border-gray-200 p-1 font-bold bg-gray-50 text-brand-maroon">{avg !== null ? Math.round(avg) : '-'}</td>
                                                        </React.Fragment>
                                                    )
                                                })}
                                                <td className="border border-gray-200 p-2 font-bold text-brand-maroon bg-gray-100 text-sm">
                                                    {nrAkhir !== null ? nrAkhir.toFixed(1) : '-'}
                                                </td>
                                                <td className="border border-gray-200 p-1 text-center font-mono">{student.absensi?.S || '0'}</td>
                                                <td className="border border-gray-200 p-1 text-center font-mono">{student.absensi?.I || '0'}</td>
                                                <td className="border border-gray-200 p-1 text-center font-mono">{student.absensi?.A || '0'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <StatsAndExport project={project} katrolData={katrolData} />
                </>
            )}
        </div>
    );
}
