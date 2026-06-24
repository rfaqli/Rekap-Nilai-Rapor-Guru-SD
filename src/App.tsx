/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Register } from './pages/Register';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AdminDashboard } from './pages/AdminDashboard';

import { safeGetItem } from './lib/storage';

function ProtectedRoute({ children, requireAdmin }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const token = safeGetItem('token');
  
  let user: any = {};
  try {
    const userStr = safeGetItem('user');
    if (userStr && userStr !== 'undefined' && userStr !== 'null') {
      user = JSON.parse(userStr) || {};
    }
  } catch (e) {
    // Ignore
  }
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !(user as any).is_admin) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

