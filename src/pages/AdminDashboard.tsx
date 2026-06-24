import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../lib/api';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const formatBytes = (bytes: number) => {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_URL}/admin/users`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (err) {
        // Ignore
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
      <div className="max-w-6xl w-full mx-auto">
        <header className="flex justify-between items-center mb-8 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand-maroon text-white p-2 text-xl font-bold rounded">ADM</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
              <p className="text-sm text-gray-500">Overview of all registered users and projects</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded hover:bg-gray-300 transition-colors"
            >
              <LayoutDashboard size={18} /> Back to App
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white font-medium rounded hover:bg-gray-800 transition-colors"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </header>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 p-4 bg-gray-50 flex items-center gap-2">
            <Users className="text-gray-500" />
            <h2 className="font-semibold text-gray-700">Daftar Akun Guru / Pengguna</h2>
          </div>
          
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500 animate-pulse">Memuat data...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Belum ada akun terdaftar.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 border-b">
                  <tr>
                    <th className="p-4 font-semibold">ID</th>
                    <th className="p-4 font-semibold">Nama</th>
                    <th className="p-4 font-semibold">Email</th>
                    <th className="p-4 font-semibold">Admin?</th>
                    <th className="p-4 font-semibold">Jumlah Project</th>
                    <th className="p-4 font-semibold">Memory Data</th>
                    <th className="p-4 font-semibold">Tanggal Daftar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-mono text-gray-500">#{u.id}</td>
                      <td className="p-4 font-medium text-gray-900">{u.name}</td>
                      <td className="p-4 text-gray-600">{u.email}</td>
                      <td className="p-4">
                        {u.is_admin ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold uppercase">Admin</span>
                        ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs font-bold uppercase">User</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="bg-brand-maroon/10 text-brand-maroon px-2 py-1 rounded font-bold">
                            {u.project_count}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 font-mono text-sm">
                        {formatBytes(u.total_data_bytes)}
                      </td>
                      <td className="p-4 text-gray-500">
                        {new Date(u.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
