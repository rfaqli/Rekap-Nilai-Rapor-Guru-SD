import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, BookOpen } from 'lucide-react';
import { API_URL } from '../lib/api';

export function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Password dan Konfirmasi Password tidak cocok.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute inset-0 bg-black/40 z-0"></div>
      
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md border-t-8 border-brand-maroon relative z-10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-brand-red rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg">
             <BookOpen className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-brand-red uppercase">
            Daftar Akun Guru
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Mesin Pengkatrol Nilai by Aqli
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleRegister}>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-md">
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-900">Nama Guru</label>
            <input
              type="text" required placeholder="Bapak Budi"
              value={name} onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-red outline-none shadow-sm text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-900">Email</label>
            <input
              type="email" required placeholder="email@sd-indonesia.sch.id"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-red outline-none shadow-sm text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-900">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} required placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-red outline-none shadow-sm text-sm pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-900">Konfirmasi Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'} required placeholder="••••••••"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-red outline-none shadow-sm text-sm pr-10"
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-brand-red text-white font-bold py-3 rounded-lg shadow-lg hover:bg-brand-maroon transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red"
            >
              DAFTAR AKUN
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-4">
            Sudah punya akun? <Link to="/login" className="text-brand-red font-bold hover:underline">Masuk di sini</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
