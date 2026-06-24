import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Menu, X, Save, Trash2, Edit2, BookOpen, ZoomIn, ZoomOut } from 'lucide-react';
import { fetchWithAuth } from '../lib/api';
import { safeGetItem, safeRemoveItem } from '../lib/storage';
import { Project } from '../types';
import { ProjectView } from '../components/ProjectView';

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [user, setUser] = useState<any>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const userData = safeGetItem('user');
    if (userData && userData !== 'undefined' && userData !== 'null') {
      try {
        setUser(JSON.parse(userData) || {});
      } catch (e) {}
    }
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await fetchWithAuth('/projects');
      setProjects(data);
    } catch (err) {
      // Ignore
    }
  };

  const handleLogout = () => {
    safeRemoveItem('token');
    safeRemoveItem('user');
    navigate('/login');
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [renameProjectTarget, setRenameProjectTarget] = useState<Project | null>(null);
  const [renameInput, setRenameInput] = useState('');

  const confirmDeleteProject = async () => {
    if (deleteConfirmId === null) return;
    try {
      await fetchWithAuth(`/projects/${deleteConfirmId}`, { method: 'DELETE' });
      if (activeProjectId === deleteConfirmId) setActiveProjectId(null);
      loadProjects();
    } catch (err) {
      console.error("Gagal menghapus", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const deleteProject = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmRenameProject = async () => {
    if (!renameProjectTarget || !renameInput || renameInput === renameProjectTarget.name) {
      setRenameProjectTarget(null);
      return;
    }
    try {
      await fetchWithAuth(`/projects/${renameProjectTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: renameInput })
      });
      loadProjects();
    } catch (err) {
      console.error("Gagal mengubah nama project", err);
    } finally {
      setRenameProjectTarget(null);
    }
  };

  const renameProject = (project: Project) => {
    setRenameProjectTarget(project);
    setRenameInput(project.name);
  };

  // Form for new project
  const [newName, setNewName] = useState('');
  const [newStudents, setNewStudents] = useState<number>(30);
  const [newSubjects, setNewSubjects] = useState<number>(10);

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || newStudents <= 0 || newSubjects <= 0) return;
    
    const initialData = {
        subjectsList: Array.from({length: newSubjects}, (_, i) => `Mapel ${i + 1}`),
        students: Array.from({length: newStudents}, (_, i) => ({
            id: `student-${Date.now()}-${i}`,
            name: `Siswa ${i + 1}`,
            subjects: {},
            tidakNaikKelas: false,
            absensi: { S: 0, I: 0, A: 0 }
        }))
    };

    try {
      const res = await fetchWithAuth('/projects', {
        method: 'POST',
        body: JSON.stringify({
            name: newName,
            student_count: newStudents,
            subject_count: newSubjects,
            data: initialData
        })
      });
      setIsCreating(false);
      setActiveProjectId(res.id);
      loadProjects();
      setNewName('');
    } catch (err) {
      alert("Gagal membuat project");
    }
  };

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col font-sans text-gray-900">
      <header className="bg-brand-red p-4 text-white flex justify-between items-center shadow-md z-10 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 -ml-2 hover:bg-brand-maroon rounded-md transition-colors">
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div className="w-10 h-10 bg-white rounded flex items-center justify-center">
             <BookOpen className="h-6 w-6 text-brand-red" />
          </div>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight hidden sm:block">Mesin Pengkatrol Nilai by Aqli</h1>
            <p className="text-xs opacity-90 hidden md:block">Alat Bantu Rekap & Kalkulasi Nilai Rapor Otomatis</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 border-r border-white/30 pr-4">
            <button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))} className="p-1 hover:bg-brand-maroon rounded" title="Zoom Out">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs font-mono w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel(Math.min(1.5, zoomLevel + 0.1))} className="p-1 hover:bg-brand-maroon rounded" title="Zoom In">
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center space-x-2">
            {user?.is_admin ? (
              <button onClick={() => navigate('/admin')} className="bg-yellow-500 text-white font-bold text-xs px-2 py-1 rounded hover:bg-yellow-600 mr-2">
                Admin Panel
              </button>
            ) : null}
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold hidden sm:flex">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <span className="text-xs font-semibold hidden sm:block">{user?.name}</span>
          </div>
          <button onClick={handleLogout} className="text-white font-bold text-xs px-2 py-1 hover:text-gray-200">
            Keluar
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative bg-gray-50">
        {/* Sidebar */}
        {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-[40] md:hidden" onClick={() => setSidebarOpen(false)} />}
        <aside className={`${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'} transition-all duration-300 ease-in-out bg-white border-r flex flex-col flex-shrink-0 z-[50] absolute md:relative h-full shadow-lg md:shadow-none overflow-hidden`}> 
          <div className="p-4 border-b flex items-center space-x-2 bg-brand-maroon text-white h-[4.5rem]">
             <BookOpen className="h-5 w-5 flex-shrink-0" />
             <span className="font-bold text-sm leading-tight uppercase whitespace-nowrap">Riwayat Project</span>
             <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white md:hidden hover:text-gray-200"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-gray-50 w-64">
            <button 
              onClick={() => { setIsCreating(true); setActiveProjectId(null); }}
              className="w-full py-2 px-3 bg-brand-red text-white rounded-lg flex items-center justify-center font-semibold text-xs mb-4 shadow-sm hover:opacity-90 transition-all focus:outline-none"
            >
              <span className="mr-2">+</span> Buat Project Baru
            </button>
            
            <div className="space-y-2">
              {projects.map(p => (
                <div key={p.id} onClick={() => { setActiveProjectId(p.id!); setIsCreating(false); if (window.innerWidth < 768) setSidebarOpen(false); }} className={`project-item bg-white p-3 rounded border border-l-4 flex justify-between items-center group cursor-pointer hover:border-brand-maroon transition-colors ${activeProjectId === p.id && !isCreating ? 'border-brand-maroon' : 'border-gray-200'}`}>
                  <div className="text-xs font-semibold text-gray-700 truncate mr-2">
                    {p.name}
                  </div>
                  <div className="flex space-x-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); renameProject(p); }} className="text-gray-400 hover:text-blue-500 p-1"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); deleteProject(p.id!); }} className="text-gray-400 hover:text-red-500 p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {projects.length === 0 && <p className="text-xs text-gray-500 italic p-2 text-center">Belum ada project.</p>}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-100">
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-4" style={{ zoom: zoomLevel } as any}>
            {isCreating ? (
              <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Buat Project Baru</h2>
                <form onSubmit={handleCreateNew} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nama Project / Kelas</label>
                    <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Contoh: Kelas 4A Semester 1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red sm:text-sm border p-2" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Berapa jumlah siswa di kelas ini?</label>
                      <input type="number" required min="1" max="100" value={newStudents} onChange={e => setNewStudents(parseInt(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red sm:text-sm border p-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Berapa jumlah mata pelajaran tahun ini?</label>
                      <input type="number" required min="1" max="30" value={newSubjects} onChange={e => setNewSubjects(parseInt(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red sm:text-sm border p-2" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <button type="submit" className="w-full bg-brand-red text-white py-3 px-4 rounded-md font-medium hover:bg-brand-maroon focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red shadow-sm transition-colors text-base">
                      Buat Tabel
                    </button>
                  </div>
                </form>
              </div>
            ) : activeProjectId ? (
              <ProjectView projectId={activeProjectId} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 mt-20">
                <BookOpen className="h-16 w-16 text-gray-300 mb-4" />
                <p className="text-lg">Silakan pilih project di sidebar atau buat yang baru.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-2">Hapus Project?</h3>
            <p className="text-sm text-gray-600 mb-6">Apakah Yakin ingin menghapus project ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded">Batal</button>
              <button onClick={confirmDeleteProject} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {renameProjectTarget !== null && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Ganti Nama Project</h3>
            <input 
              type="text" 
              className="w-full border p-2 rounded mb-6" 
              value={renameInput} 
              onChange={e => setRenameInput(e.target.value)} 
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') confirmRenameProject(); }}
            />
            <div className="flex justify-end space-x-3">
              <button onClick={() => setRenameProjectTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded">Batal</button>
              <button onClick={confirmRenameProject} className="px-4 py-2 text-sm font-medium text-white bg-brand-red hover:bg-brand-maroon rounded">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
